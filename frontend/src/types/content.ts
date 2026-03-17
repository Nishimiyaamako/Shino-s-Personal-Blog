export type PostStatus = 'draft' | 'published';

export interface PostFrontmatter {
  title: string;
  slug: string;
  date: string;
  tags: string[];
  summary: string;
  status: PostStatus;
}

export interface PostSummary {
  title: string;
  slug: string;
  date: string;
  tags: string[];
  summary: string;
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

export interface ArchiveStat {
  key: string;
  year: number;
  month: number;
  count: number;
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
