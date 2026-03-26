import localAboutMarkdownRaw from '../content/about.md?raw';
import type {
  AboutApiResponse,
  AboutNarrativeSection,
  AboutTimelineEvent,
  AboutViewModel
} from '../types/about';

const ABOUT_API_ENDPOINT = '/api/about';

const FRONTMATTER_REGEXP = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const SECTION_HEADING_REGEXP = /^##\s+(.+)$/;
const PAGE_HEADING_REGEXP = /^#\s+(.+)$/;
const LIST_ITEM_REGEXP = /^[-*]\s+/;

const SECTION_LABEL_MAP: Record<string, string> = {
  关于名字: 'Name Notes',
  目前状态: 'Current State',
  游戏: 'Game Zone',
  事件表: 'Milestones',
  银生轨迹: 'Journey'
};

interface MarkdownSection {
  heading: string;
  lines: string[];
}

interface ParsedAboutMarkdown {
  metadata: Record<string, string>;
  introLines: string[];
  sections: MarkdownSection[];
}

let localAboutViewModelCache: AboutViewModel | null = null;

export function loadAboutViewModel(): AboutViewModel {
  if (!localAboutViewModelCache) {
    localAboutViewModelCache = buildAboutViewModel(localAboutMarkdownRaw);
  }

  return localAboutViewModelCache;
}

export async function fetchAboutViewModel(options: { signal?: AbortSignal } = {}): Promise<AboutViewModel> {
  const response = await fetch(ABOUT_API_ENDPOINT, {
    method: 'GET',
    headers: {
      accept: 'application/json'
    },
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(`[about] Unexpected response: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  if (!isAboutApiResponse(payload)) {
    throw new Error('[about] Invalid payload: missing markdown string.');
  }

  return buildAboutViewModel(payload.markdown);
}

function isAboutApiResponse(payload: unknown): payload is AboutApiResponse {
  return Boolean(payload) && typeof payload === 'object' && typeof (payload as AboutApiResponse).markdown === 'string';
}

function buildAboutViewModel(rawMarkdown: string): AboutViewModel {
  const normalizedMarkdown = typeof rawMarkdown === 'string' ? rawMarkdown.trim() : '';
  const parsedMarkdown = parseAboutMarkdown(normalizedMarkdown);
  const introParagraphs = normalizeTextList(linesToParagraphs(parsedMarkdown.introLines)).slice(0, 3);

  const timelineSection = parsedMarkdown.sections.find((section) => /事件表|里程碑/i.test(section.heading));
  const journeySection = parsedMarkdown.sections.find((section) => /轨迹|经历|journey/i.test(section.heading));

  const narrativeSectionsSource = parsedMarkdown.sections.filter(
    (section) => section !== timelineSection && section !== journeySection
  );

  const narrativeSections = narrativeSectionsSource.map((section, index) => {
    const rawItems = extractSectionItems(section.lines);
    const normalizedItems = normalizeTextList(rawItems);

    return {
      id: sectionId(section.heading, index),
      title: section.heading,
      label: sectionLabel(section.heading, index),
      side: index % 2 === 0 ? 'left' : 'right',
      items: normalizedItems.length ? normalizedItems : ['暂无补充内容。']
    } satisfies AboutNarrativeSection;
  });

  const timelineEvents = parseTimelineEvents(timelineSection);
  const journeyParagraphs = normalizeTextList(linesToParagraphs(journeySection?.lines ?? []));

  return {
    fingerprint: createFingerprint(normalizedMarkdown || JSON.stringify(parsedMarkdown)),
    heroTitle: parsedMarkdown.metadata.heroTitle ?? '你好，我是 Shino',
    heroSubtitle: parsedMarkdown.metadata.heroSubtitle ?? 'About · NagaShino',
    introParagraphs: introParagraphs.length
      ? introParagraphs
      : ['这里是我在互联网上留下的一块小角落。', '不追热闹，只记录我正在认真做的事。'],
    narrativeSections: narrativeSections.length
      ? narrativeSections
      : [
          {
            id: 'about-default',
            title: '关于我',
            label: 'Overview',
            side: 'left',
            items: ['内容整理中。']
          }
        ],
    timelineTitle: timelineSection?.heading ?? '事件表',
    timelineLabel: sectionLabel(timelineSection?.heading ?? '事件表', 0),
    timelineEvents: timelineEvents.length
      ? timelineEvents
      : [
          {
            id: 'event-1',
            date: 'TBD',
            detail: '暂无事件记录。'
          }
        ],
    journeyTitle: journeySection?.heading ?? '银生轨迹',
    journeyLabel: sectionLabel(journeySection?.heading ?? '银生轨迹', 0),
    journeyParagraphs: journeyParagraphs.length ? journeyParagraphs : ['轨迹内容整理中。']
  };
}

function parseAboutMarkdown(markdown: string): ParsedAboutMarkdown {
  const { metadata, body } = splitFrontmatter(markdown);
  const lines = body.split(/\r?\n/);

  const introLines: string[] = [];
  const sections: MarkdownSection[] = [];
  let sectionCursor: MarkdownSection | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      if (sectionCursor) {
        sectionCursor.lines.push('');
      } else {
        introLines.push('');
      }
      continue;
    }

    if (PAGE_HEADING_REGEXP.test(trimmedLine)) {
      continue;
    }

    const sectionMatch = trimmedLine.match(SECTION_HEADING_REGEXP);

    if (sectionMatch) {
      if (sectionCursor) {
        sections.push(sectionCursor);
      }

      sectionCursor = {
        heading: cleanInlineMarkdown(sectionMatch[1]),
        lines: []
      };
      continue;
    }

    if (sectionCursor) {
      sectionCursor.lines.push(trimmedLine);
      continue;
    }

    introLines.push(trimmedLine);
  }

  if (sectionCursor) {
    sections.push(sectionCursor);
  }

  return {
    metadata,
    introLines,
    sections
  };
}

function splitFrontmatter(markdown: string): { metadata: Record<string, string>; body: string } {
  const matched = markdown.match(FRONTMATTER_REGEXP);

  if (!matched) {
    return {
      metadata: {},
      body: markdown
    };
  }

  const metadata: Record<string, string> = {};

  for (const line of matched[1].split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    const pairMatch = trimmedLine.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.+)$/);

    if (!pairMatch) {
      continue;
    }

    const rawValue = pairMatch[2].trim();
    metadata[pairMatch[1]] = rawValue.replace(/^"(.+)"$/, '$1').replace(/^'(.+)'$/, '$1');
  }

  return {
    metadata,
    body: markdown.slice(matched[0].length)
  };
}

function extractSectionItems(lines: string[]): string[] {
  const bulletItems = lines
    .map((line) => line.trim())
    .filter((line) => LIST_ITEM_REGEXP.test(line))
    .map((line) => line.replace(LIST_ITEM_REGEXP, ''));

  if (bulletItems.length) {
    return bulletItems;
  }

  return linesToParagraphs(lines);
}

function parseTimelineEvents(section?: MarkdownSection): AboutTimelineEvent[] {
  if (!section) {
    return [];
  }

  const rawItems = extractSectionItems(section.lines);
  const timelineEvents: AboutTimelineEvent[] = [];

  rawItems.forEach((rawItem, index) => {
    const normalizedItem = cleanInlineMarkdown(rawItem);
    const matched = normalizedItem.match(/^(\d{4})[-/.](\d{1,2})\s*(?:[|｜:：-])\s*(.+)$/);

    if (matched) {
      const year = matched[1];
      const month = matched[2].padStart(2, '0');
      const detail = cleanInlineMarkdown(matched[3]);

      timelineEvents.push({
        id: `event-${index + 1}`,
        date: `${year}-${month}`,
        detail: detail || '（暂无补充）'
      });
      return;
    }

    const fallbackDateMatch = normalizedItem.match(/^(\d{4})[-/.](\d{1,2})\s+(.+)$/);

    if (fallbackDateMatch) {
      const year = fallbackDateMatch[1];
      const month = fallbackDateMatch[2].padStart(2, '0');
      const detail = cleanInlineMarkdown(fallbackDateMatch[3]);

      timelineEvents.push({
        id: `event-${index + 1}`,
        date: `${year}-${month}`,
        detail: detail || '（暂无补充）'
      });
      return;
    }

    timelineEvents.push({
      id: `event-${index + 1}`,
      date: `记录 ${index + 1}`,
      detail: normalizedItem
    });
  });

  return timelineEvents;
}

function linesToParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = [];
  let buffer: string[] = [];

  const flushBuffer = (): void => {
    if (!buffer.length) {
      return;
    }

    paragraphs.push(buffer.join(' '));
    buffer = [];
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushBuffer();
      continue;
    }

    if (LIST_ITEM_REGEXP.test(trimmedLine)) {
      flushBuffer();
      paragraphs.push(trimmedLine.replace(LIST_ITEM_REGEXP, ''));
      continue;
    }

    buffer.push(trimmedLine);
  }

  flushBuffer();

  return paragraphs;
}

function normalizeTextList(values: string[]): string[] {
  return values
    .map((value) => cleanInlineMarkdown(value))
    .filter(Boolean);
}

function cleanInlineMarkdown(rawText: string): string {
  return rawText
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionLabel(heading: string, index: number): string {
  for (const [keyword, label] of Object.entries(SECTION_LABEL_MAP)) {
    if (heading.includes(keyword)) {
      return label;
    }
  }

  return `Section ${index + 1}`;
}

function sectionId(heading: string, index: number): string {
  const fallback = `section-${index + 1}`;
  const slug = heading
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

function createFingerprint(rawText: string): string {
  let hash = 0;

  for (let index = 0; index < rawText.length; index += 1) {
    hash = (hash * 31 + rawText.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}
