import { describe, expect, it } from 'vitest';
import aboutFixture from './about.json';
import friendLinkFixture from './friend-link.json';
import postDetailFixture from './post-detail.json';
import profileCardFixture from './profile-card.json';
import publicPostsFixture from './public-posts.json';
import searchItemFixture from './search-item.json';
import siteConfigFixture from './site-config.json';
import type { AboutStructuredPayload } from '../types/about';
import type { AdminSiteConfig, PublicPostsResponse, SearchResultItem } from '../types/api';
import type { FriendLink } from '../types/friend-link';
import type { ProfileCardConfig } from '../types/profile-card';
import type { PostDetail, PostSummary, PostStatus } from '../types/content';

// 契约镜像夹具测试（对应 backend/rust/tests/api_compat.rs::public_response_shapes_match_frontend_types_contract）
// 夹具来源：api_compat.rs 种子场景的公开端点响应。改后端字段 → 同步 api_compat.rs 契约 + 本夹具 + types/*.ts。

const PUBLIC_POSTS = publicPostsFixture satisfies PublicPostsResponse;
// JSON 的 status 天然为 string（非 union 字面量），结构检查后以运行时断言兜底 status 取值
const POST_DETAIL = postDetailFixture as PostDetail;
const SEARCH_ITEM = searchItemFixture satisfies SearchResultItem;
const FRIEND_LINK = friendLinkFixture satisfies FriendLink;
// fingerprint 为客户端派生字段，原始 API 形状对应 AboutStructuredPayload；
// side 为 'left'|'right' union（JSON 无法表达），结构由运行时键集断言兜底
const ABOUT = aboutFixture as AboutStructuredPayload;
const PROFILE_CARD = profileCardFixture satisfies ProfileCardConfig;
const SITE_CONFIG = siteConfigFixture satisfies AdminSiteConfig;

const isPostStatus = (value: string): value is PostStatus => value === 'draft' || value === 'published';

type DeclaredScalar = string | number | boolean | null;

interface DeclaredShape {
  [key: string]: DeclaredShape | (DeclaredShape | DeclaredScalar)[] | DeclaredScalar;
}

function assertContractKeysCovered(
  fixture: unknown,
  declared: DeclaredShape,
  path: string
): void {
  if (typeof fixture !== 'object' || fixture === null || Array.isArray(fixture)) {
    throw new Error(`${path}: 期望 object，实际 ${String(fixture)}`);
  }

  const fixtureRecord = fixture as Record<string, unknown>;
  const declaredKeys = Object.keys(declared);

  for (const key of declaredKeys) {
    if (!(key in fixtureRecord)) {
      throw new Error(`${path}.${key}: 夹具缺少契约键（后端响应与前端类型不同步）`);
    }

    const fixtureValue = fixtureRecord[key];
    const declaredValue = declared[key];

    if (Array.isArray(declaredValue)) {
      if (!Array.isArray(fixtureValue)) {
        throw new Error(`${path}.${key}: 期望数组`);
      }
      const elementShape = (declaredValue as DeclaredShape[])[0];
      if (fixtureValue.length && typeof elementShape === 'object' && elementShape !== null) {
        assertContractKeysCovered(fixtureValue[0], elementShape, `${path}.${key}[]`);
      }
    } else if (typeof declaredValue === 'object' && declaredValue !== null) {
      assertContractKeysCovered(fixtureValue, declaredValue, `${path}.${key}`);
    }
  }
}

const POST_SUMMARY_SHAPE: DeclaredShape = {
  title: '',
  slug: '',
  date: '',
  theme: '',
  tags: [''],
  summary: '',
  coverImageUrl: ''
};
const SEARCH_ITEM_SHAPE: DeclaredShape = {
  slug: '',
  title: '',
  summary: '',
  tags: [''],
  snippet: '',
  publishedAt: ''
};
const FRIEND_LINK_SHAPE: DeclaredShape = {
  name: '',
  description: '',
  avatar: '',
  url: ''
};
const ABOUT_SHAPE: DeclaredShape = {
  heroTitle: '',
  heroSubtitle: '',
  introParagraphs: [''],
  narrativeSections: [{ id: '', title: '', label: '', side: '', items: [''] }],
  timelineTitle: '',
  timelineLabel: '',
  timelineEvents: [{ id: '', date: '', detail: '' }]
};
const PROFILE_CARD_SHAPE: DeclaredShape = {
  name: '',
  bio: '',
  avatar: '',
  contacts: [{ platform: '', label: '', href: '' }]
};
const SITE_CONFIG_SHAPE: DeclaredShape = {
  siteTitle: '',
  siteSubtitle: '',
  slogan: '',
  copyrightOwner: '',
  poweredBy: '',
  icpRecordText: '',
  icpRecordUrl: '',
  publicSecurityRecordText: '',
  publicSecurityRecordUrl: '',
  friendLinkTemplate: ''
};

describe('API 契约镜像夹具', () => {
  it('公开文章列表夹具覆盖 PostSummary 契约键', () => {
    const summary = PUBLIC_POSTS.items[0] as PostSummary;
    assertContractKeysCovered(summary, POST_SUMMARY_SHAPE, 'public-posts.items[0]');
    expect(PUBLIC_POSTS.total).toBeGreaterThanOrEqual(0);
  });

  it('文章详情夹具覆盖 PostDetail 契约键', () => {
    assertContractKeysCovered(POST_DETAIL, POST_SUMMARY_SHAPE, 'post-detail');
    assertContractKeysCovered(POST_DETAIL, {
      contentMarkdown: '',
      contentHtml: '',
      status: ''
    }, 'post-detail');
    expect(isPostStatus(POST_DETAIL.status)).toBe(true);
  });

  it('搜索结果夹具覆盖 SearchResultItem 契约键', () => {
    assertContractKeysCovered(SEARCH_ITEM, SEARCH_ITEM_SHAPE, 'search-item');
  });

  it('友链夹具覆盖 FriendLink 契约键', () => {
    assertContractKeysCovered(FRIEND_LINK, FRIEND_LINK_SHAPE, 'friend-link');
  });

  it('关于页夹具覆盖 AboutViewModel 契约键', () => {
    assertContractKeysCovered(ABOUT, ABOUT_SHAPE, 'about');
  });

  it('资料卡夹具覆盖 ProfileCardConfig 契约键', () => {
    assertContractKeysCovered(PROFILE_CARD, PROFILE_CARD_SHAPE, 'profile-card');
    expect(PROFILE_CARD.contacts[0].platform).toBeTypeOf('string');
  });

  it('站点配置夹具覆盖 AdminSiteConfig 契约键', () => {
    assertContractKeysCovered(SITE_CONFIG, SITE_CONFIG_SHAPE, 'site-config');
  });
});
