import type {
  AboutNarrativeSection,
  AboutStructuredPayload,
  AboutTimelineEvent,
  AboutViewModel
} from '../types/about';

const ABOUT_API_ENDPOINT = '/api/about';

const FALLBACK_VIEW_MODEL: AboutViewModel = {
  fingerprint: '0',
  heroTitle: '关于',
  heroSubtitle: '',
  introParagraphs: ['内容建设中...'],
  narrativeSections: [
    {
      id: 'section-1',
      title: '关于我',
      label: 'About Me',
      side: 'left',
      items: ['暂无补充内容。']
    }
  ],
  timelineTitle: '事件表',
  timelineLabel: 'Milestones',
  timelineEvents: []
};

let fallbackAboutViewModelCache: AboutViewModel | null = null;

export function loadAboutViewModel(): AboutViewModel {
  if (!fallbackAboutViewModelCache) {
    fallbackAboutViewModelCache = { ...FALLBACK_VIEW_MODEL };
  }

  return fallbackAboutViewModelCache;
}

function isAboutStructuredPayload(payload: unknown): payload is AboutStructuredPayload {
  return (
    Boolean(payload) &&
    typeof payload === 'object' &&
    typeof (payload as AboutStructuredPayload).heroTitle === 'string'
  );
}

function mapStructuredToViewModel(payload: AboutStructuredPayload): AboutViewModel {
  const fingerprint = createFingerprint(JSON.stringify(payload));

  return {
    fingerprint,
    heroTitle: payload.heroTitle ?? '',
    heroSubtitle: payload.heroSubtitle ?? '',
    introParagraphs: Array.isArray(payload.introParagraphs) ? payload.introParagraphs : [],
    narrativeSections: (Array.isArray(payload.narrativeSections) ? payload.narrativeSections : []).map(
      (s, i): AboutNarrativeSection => ({
        id: s.id || `section-${i + 1}`,
        title: s.title || '',
        label: s.label || `Section ${i + 1}`,
        side: s.side === 'right' ? 'right' : 'left',
        items: s.items?.length ? s.items : ['暂无补充内容。']
      })
    ),
    timelineTitle: payload.timelineTitle ?? '',
    timelineLabel: payload.timelineLabel ?? 'Milestones',
    timelineEvents: (Array.isArray(payload.timelineEvents) ? payload.timelineEvents : []).map(
      (e, i): AboutTimelineEvent => ({
        id: e.id || `event-${i + 1}`,
        date: e.date || '',
        detail: e.detail || ''
      })
    )
  };
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

  if (!isAboutStructuredPayload(payload)) {
    throw new Error('[about] Invalid payload: missing structured about data.');
  }

  return mapStructuredToViewModel(payload);
}

function createFingerprint(rawText: string): string {
  let hash = 0;

  for (let index = 0; index < rawText.length; index += 1) {
    hash = (hash * 31 + rawText.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}
