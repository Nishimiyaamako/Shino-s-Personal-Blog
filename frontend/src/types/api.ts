import type { PostDetail, PostSummary, PostStatus } from './content';
import type { FriendLink } from './friend-link';
import type { ProfileCardConfig } from './profile-card';

export interface ApiListResponse<T> {
  items: T[];
}

export interface PublicPostsResponse {
  items: PostSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchResultItem {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  snippet: string;
  publishedAt: string;
}

export interface AdminUser {
  id: number;
  username: string;
}

export interface AdminLoginResponse {
  token: string;
  user: AdminUser;
}

export interface AdminPost extends PostDetail {
  id: number;
  status: PostStatus;
}

export interface AdminPostListQuery {
  q?: string;
  status?: PostStatus | 'all';
  tag?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminPostListResponse extends ApiListResponse<AdminPost> {
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminFriendLink extends FriendLink {
  id: number;
  enabled: boolean;
  displayOrder: number;
}

export interface AdminProfileCard extends ProfileCardConfig {
  contacts: Array<{
    id?: number;
    platform: string;
    label: string;
    href: string;
    displayOrder?: number;
  }>;
}

export interface AdminSiteConfig {
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

export interface UploadImageResponse {
  item: {
    url: string;
    fileName: string;
    size: number;
    mimeType: string;
  };
}

export interface AdminMediaAsset {
  id: number;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
  references: Array<{ postId: number; postTitle: string }>;
  isOrphaned: boolean;
}

export interface AdminMediaListResponse {
  items: AdminMediaAsset[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    totalCount: number;
    totalSize: number;
    orphanedCount: number;
  };
}

export interface AdminMediaListQuery {
  page?: number;
  pageSize?: number;
  sort?: 'created_at' | 'size';
  order?: 'asc' | 'desc';
  filter?: 'all' | 'referenced' | 'orphaned';
}
