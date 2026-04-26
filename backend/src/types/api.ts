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
  featuredOrder?: number;
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
