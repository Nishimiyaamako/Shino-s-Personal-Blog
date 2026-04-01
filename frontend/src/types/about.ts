export interface AboutApiResponse {
  markdown: string;
}

export interface AboutNarrativeSection {
  id: string;
  title: string;
  label: string;
  side: 'left' | 'right';
  items: string[];
}

export interface AboutTimelineEvent {
  id: string;
  date: string;
  detail: string;
}

export interface AboutViewModel {
  fingerprint: string;
  heroTitle: string;
  heroSubtitle: string;
  introParagraphs: string[];
  narrativeSections: AboutNarrativeSection[];
  timelineTitle: string;
  timelineLabel: string;
  timelineEvents: AboutTimelineEvent[];
}
