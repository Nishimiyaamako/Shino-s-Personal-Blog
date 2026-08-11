export type PostStatus = 'draft' | 'published';

export interface ApiPostSummary {
  id: number;
  title: string;
  slug: string;
  date: string;
  theme?: string;
  tags: string[];
  summary: string;
  coverImageUrl?: string;
}

export interface ApiPostDetail extends ApiPostSummary {
  contentMarkdown: string;
  contentHtml: string;
  status: PostStatus;
  publishedAt?: string;
}

export interface ApiFriendLink {
  id: number;
  name: string;
  description: string;
  avatar: string;
  url: string;
  enabled: boolean;
  displayOrder: number;
}

export interface ApiProfileContact {
  id: number;
  platform: string;
  label: string;
  href: string;
  displayOrder: number;
}

export interface ApiProfileCard {
  name: string;
  bio: string;
  avatar: string;
  contacts: ApiProfileContact[];
}

export interface ApiSiteConfig {
  siteTitle: string;
  siteSubtitle: string;
  slogan: string;
  copyrightOwner: string;
  poweredBy: string;
  icpRecordText: string;
  icpRecordUrl: string;
  publicSecurityRecordText: string;
  publicSecurityRecordUrl: string;
  friendLinkTemplate: string;
}

export interface ApiSearchItem {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  snippet: string;
  publishedAt: string;
}

export interface ApiAboutNarrativeSection {
  id: string;
  title: string;
  label: string;
  side: 'left' | 'right';
  items: string[];
}

export interface ApiAboutTimelineEvent {
  id: string;
  date: string;
  detail: string;
}

export interface ApiAboutPayload {
  heroTitle: string;
  heroSubtitle: string;
  introParagraphs: string[];
  narrativeSections: ApiAboutNarrativeSection[];
  timelineTitle: string;
  timelineLabel: string;
  timelineEvents: ApiAboutTimelineEvent[];
}

export interface ApiMediaAsset {
  id: number;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
  references: Array<{ postId: number; postTitle: string }>;
  isOrphaned: boolean;
}

export interface ApiMediaListResponse {
  items: ApiMediaAsset[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    totalCount: number;
    totalSize: number;
    orphanedCount: number;
  };
}
