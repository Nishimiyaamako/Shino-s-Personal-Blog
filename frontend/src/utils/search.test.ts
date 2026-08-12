import { describe, expect, it } from 'vitest';
import { fuzzySearchPosts, searchPosts } from './search';
import type { PostSummary } from '../types/content';

function makePost(overrides: Partial<PostSummary> & { slug: string }): PostSummary {
  return {
    title: '默认标题',
    summary: '默认摘要',
    date: '2026-01-01T00:00:00Z',
    tags: [],
    theme: 'default',
    ...overrides
  };
}

describe('searchPosts', () => {
  it('returns empty for empty/whitespace query', () => {
    expect(searchPosts([makePost({ slug: 'a' })], '')).toEqual([]);
    expect(searchPosts([makePost({ slug: 'a' })], '   ')).toEqual([]);
  });

  it('returns empty when no post matches', () => {
    const posts = [makePost({ slug: 'a', title: 'Rust 学习笔记' })];
    expect(searchPosts(posts, 'python')).toEqual([]);
  });

  it('filters out zero-relevance posts', () => {
    const posts = [
      makePost({ slug: 'hit', title: 'Rust 生命周期', summary: '关于借用检查器' }),
      makePost({ slug: 'miss', title: 'Cooking Diary', summary: '今日食谱' })
    ];
    const result = searchPosts(posts, 'rust');
    expect(result.map((item) => item.slug)).toEqual(['hit']);
  });

  it('ranks title exact match above summary match', () => {
    const posts = [
      makePost({ slug: 'summary-hit', title: '随便写点什么', summary: 'rust 在这里出现' }),
      makePost({ slug: 'title-hit', title: 'Rust 学习指南', summary: '无关键词' })
    ];
    const result = searchPosts(posts, 'rust');
    expect(result[0].slug).toBe('title-hit');
    expect(result[1].slug).toBe('summary-hit');
  });

  it('matches tags with high score', () => {
    const posts = [
      makePost({ slug: 'tag-hit', title: '无关键词标题', tags: ['rust'] }),
      makePost({ slug: 'no-tag', title: '无关键词标题', tags: ['other'] })
    ];
    const result = searchPosts(posts, 'rust');
    expect(result.map((item) => item.slug)).toEqual(['tag-hit']);
  });

  it('highlights matching tokens in title with <mark>', () => {
    const posts = [makePost({ slug: 'a', title: 'Rust 入门' })];
    const result = searchPosts(posts, 'rust');
    expect(result[0].title).toContain('<mark>Rust</mark>');
  });

  it('respects limit', () => {
    const posts = ['a', 'b', 'c'].map((slug) =>
      makePost({ slug, title: `rust ${slug}` })
    );
    expect(searchPosts(posts, 'rust', 2)).toHaveLength(2);
  });

  it('sorts by recency when relevance ties', () => {
    const posts = [
      makePost({ slug: 'old', title: 'rust 旧文', date: '2020-01-01T00:00:00Z' }),
      makePost({ slug: 'new', title: 'rust 新文', date: '2026-06-01T00:00:00Z' })
    ];
    const result = searchPosts(posts, 'rust');
    expect(result[0].slug).toBe('new');
  });
});

describe('fuzzySearchPosts', () => {
  it('returns empty for empty query', () => {
    expect(fuzzySearchPosts([makePost({ slug: 'a' })], '')).toEqual([]);
  });

  it('matches by title/summary/tag substring', () => {
    const posts = [
      makePost({ slug: 'title', title: 'Hello World 星尘', summary: 'x', tags: [] }),
      makePost({ slug: 'tag', title: 'x', summary: 'y', tags: ['星尘计划'] })
    ];
    const result = fuzzySearchPosts(posts, '星尘');
    expect(result.map((item) => item.slug).sort()).toEqual(['tag', 'title']);
  });

  it('returns all matched posts sorted by score', () => {
    const posts = [
      makePost({ slug: 'a', title: 'keyword one' }),
      makePost({ slug: 'b', title: 'keyword two' })
    ];
    const result = fuzzySearchPosts(posts, 'keyword');
    expect(result).toHaveLength(2);
  });
});
