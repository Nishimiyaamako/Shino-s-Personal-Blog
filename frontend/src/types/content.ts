export type PostStatus = 'draft' | 'published';

export interface PostFrontmatter {
  title: string;
  slug: string;
  date: string;
  theme?: string;
  tags: string[];
  summary: string;
  status: PostStatus;
}

export interface PostSummary {
  title: string;
  slug: string;
  date: string;
  theme?: string;
  tags: string[];
  summary: string;
  coverImageUrl?: string;
  featuredOrder?: number;
}

export interface PostDetail extends PostSummary {
  status: PostStatus;
  contentMarkdown: string;
  contentHtml: string;
}

export interface TagStat {
  tag: string;
  count: number;
}

export interface ThemeStat {
  key: string;
  label: string;
  count: number;
}

export interface ArchiveStat {
  key: string;
  year: number;
  month: number;
  count: number;
}

export interface ArchiveTimelinePost {
  title: string;
  slug: string;
  date: string;
  month: number;
  day: number;
}

export interface ArchiveTimelineYear {
  year: number;
  posts: ArchiveTimelinePost[];
}

export interface ArchiveTimelineData {
  totalPosts: number;
  years: ArchiveTimelineYear[];
}

export class ContentValidationError extends Error {
  constructor(
    message: string,
    public readonly sourcePath: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ContentValidationError';
  }
}
