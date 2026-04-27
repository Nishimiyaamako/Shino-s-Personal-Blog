/**
 * One-time migration script: parses existing about_page.markdown
 * and writes structured JSON columns.
 *
 * Usage: cd backend && bun run src/scripts/migrate-about-structured.ts
 */

import { getDatabaseContext } from '../db/client';
import { runMigrations } from '../db/migrate';

interface MarkdownSection {
  heading: string;
  lines: string[];
}

interface AboutStructured {
  heroTitle: string;
  heroSubtitle: string;
  introParagraphs: string[];
  narrativeSections: Array<{
    title: string;
    label: string;
    side: 'left' | 'right';
    items: string[];
  }>;
  timelineTitle: string;
  timelineEvents: Array<{ date: string; detail: string }>;
}

const SECTION_LABEL_MAP: Record<string, string> = {
  '关于名字': 'Name Notes',
  '目前状态': 'Current State',
  '爱好': 'Hobbies',
  '游戏': 'Game Zone',
  '事件表': 'Milestones'
};

function cleanInlineMarkdown(raw: string): string {
  return raw
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitFrontmatter(markdown: string): { metadata: Record<string, string>; body: string } {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { metadata: {}, body: markdown };

  const metadata: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const pair = trimmed.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.+)$/);
    if (!pair) continue;
    const rawValue = pair[2].trim();
    metadata[pair[1]] = rawValue.replace(/^"(.+)"$/, '$1').replace(/^'(.+)'$/, '$1');
  }
  return { metadata, body: markdown.slice(match[0].length) };
}

function parseAboutMarkdown(markdown: string): { metadata: Record<string, string>; introLines: string[]; sections: MarkdownSection[] } {
  const { metadata, body } = splitFrontmatter(markdown);
  const lines = body.split(/\r?\n/);
  const introLines: string[] = [];
  const sections: MarkdownSection[] = [];
  let cursor: MarkdownSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (cursor) cursor.lines.push('');
      else introLines.push('');
      continue;
    }

    if (/^#\s+/.test(trimmed)) continue; // skip h1

    const sectionMatch = trimmed.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      if (cursor) sections.push(cursor);
      cursor = { heading: cleanInlineMarkdown(sectionMatch[1]), lines: [] };
      continue;
    }

    if (cursor) {
      cursor.lines.push(trimmed);
    } else {
      introLines.push(trimmed);
    }
  }

  if (cursor) sections.push(cursor);
  return { metadata, introLines, sections };
}

function linesToParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = [];
  let buffer: string[] = [];
  const flush = (): void => {
    if (buffer.length) { paragraphs.push(buffer.join(' ')); buffer = []; }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flush(); continue; }
    if (/^[-*]\s+/.test(trimmed)) { flush(); paragraphs.push(trimmed.replace(/^[-*]\s+/, '')); continue; }
    buffer.push(trimmed);
  }
  flush();
  return paragraphs;
}

function extractSectionItems(lines: string[]): string[] {
  const bullets = lines
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, ''));
  if (bullets.length) return bullets;
  return linesToParagraphs(lines);
}

function parseTimelineEvents(section?: MarkdownSection): Array<{ date: string; detail: string }> {
  if (!section) return [];
  const items = extractSectionItems(section.lines);
  return items.map((raw, i) => {
    const normalized = cleanInlineMarkdown(raw);
    const primary = normalized.match(/^(\d{4})[-/.](\d{1,2})\s*(?:[|｜:：-])\s*(.+)$/);
    if (primary) {
      return { date: `${primary[1]}-${primary[2].padStart(2, '0')}`, detail: cleanInlineMarkdown(primary[3]) || '（暂无补充）' };
    }
    const fallback = normalized.match(/^(\d{4})[-/.](\d{1,2})\s+(.+)$/);
    if (fallback) {
      return { date: `${fallback[1]}-${fallback[2].padStart(2, '0')}`, detail: cleanInlineMarkdown(fallback[3]) || '（暂无补充）' };
    }
    return { date: `记录 ${i + 1}`, detail: normalized };
  });
}

function sectionLabel(heading: string, index: number): string {
  for (const [keyword, label] of Object.entries(SECTION_LABEL_MAP)) {
    if (heading.includes(keyword)) return label;
  }
  return `Section ${index + 1}`;
}

// --- Main ---

const context = getDatabaseContext();
runMigrations(context.sqlite);

const row = context.sqlite
  .query('SELECT markdown FROM about_page WHERE id = 1')
  .get() as { markdown: string } | undefined;

if (!row || !row.markdown) {
  console.log('No existing markdown to migrate. Done.');
  process.exit(0);
}

const parsed = parseAboutMarkdown(row.markdown);
const introParagraphs = linesToParagraphs(parsed.introLines)
  .map(cleanInlineMarkdown)
  .filter(Boolean)
  .slice(0, 3);

const timelineSection = parsed.sections.find((s) => /事件表|里程碑/i.test(s.heading));
const narrativeSectionsSource = parsed.sections.filter((s) => s !== timelineSection);

const narrativeSections = narrativeSectionsSource.map((section, index) => {
  const items = extractSectionItems(section.lines).map(cleanInlineMarkdown).filter(Boolean);
  return {
    title: section.heading,
    label: sectionLabel(section.heading, index),
    side: (index % 2 === 0 ? 'left' : 'right') as 'left' | 'right',
    items: items.length ? items : ['暂无补充内容。']
  };
});

const timelineEvents = parseTimelineEvents(timelineSection);

context.sqlite.run(
  `UPDATE about_page SET
    hero_title = ?,
    hero_subtitle = ?,
    intro_paragraphs = ?,
    narrative_sections = ?,
    timeline_title = ?,
    timeline_events = ?,
    updated_at = ?
  WHERE id = 1`,
  [
    parsed.metadata.heroTitle ?? '',
    parsed.metadata.heroSubtitle ?? '',
    JSON.stringify(introParagraphs),
    JSON.stringify(narrativeSections),
    timelineSection?.heading ?? '',
    JSON.stringify(timelineEvents),
    new Date().toISOString()
  ]
);

console.log('Migration complete.');
console.log('  heroTitle:', parsed.metadata.heroTitle ?? '');
console.log('  heroSubtitle:', parsed.metadata.heroSubtitle ?? '');
console.log('  introParagraphs:', introParagraphs.length, 'paragraphs');
console.log('  narrativeSections:', narrativeSections.length, 'sections');
console.log('  timelineEvents:', timelineEvents.length, 'events');
