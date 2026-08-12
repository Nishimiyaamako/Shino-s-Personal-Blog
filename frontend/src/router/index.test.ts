import { describe, expect, it } from 'vitest';
import { isAdminPathname, resolveAdminModule, resolveRoute } from './index';

describe('resolveRoute', () => {
  it('matches static routes', () => {
    const landing = resolveRoute('/');
    expect(landing.route.path).toBe('/');
    expect(landing.isFallback).toBe(false);

    const blog = resolveRoute('/blog');
    expect(blog.route.path).toBe('/blog');

    const archive = resolveRoute('/blog/archive');
    expect(archive.route.path).toBe('/blog/archive');
  });

  it('matches param routes with decoded params', () => {
    const detail = resolveRoute('/blog/hello-world');
    expect(detail.route.path).toBe('/blog/:slug');
    expect(detail.context.params).toEqual({ slug: 'hello-world' });

    const encoded = resolveRoute('/blog/%E6%98%9F%E5%B0%98');
    expect(encoded.context.params).toEqual({ slug: '星尘' });
  });

  it('matches admin routes', () => {
    const posts = resolveRoute('/admin/posts');
    expect(posts.route.path).toBe('/admin/posts');

    const settings = resolveRoute('/admin/settings');
    expect(settings.route.path).toBe('/admin/settings');

    const login = resolveRoute('/admin/login');
    expect(login.route.path).toBe('/admin/login');
  });

  it('normalizes trailing slashes and missing leading slash', () => {
    const trailing = resolveRoute('/blog/');
    expect(trailing.route.path).toBe('/blog');

    const noSlash = resolveRoute('blog');
    expect(noSlash.route.path).toBe('/blog');
  });

  it('falls back to 404 for unknown paths', () => {
    const missing = resolveRoute('/nonexistent/xyz');
    expect(missing.isFallback).toBe(true);
    expect(missing.route.path).toBe('/404');
    expect(missing.context.params).toEqual({});
  });

  it('does not cross-match segment counts', () => {
    // /blog/:slug 不会匹配 /blog/tags
    const tags = resolveRoute('/blog/tags');
    expect(tags.route.path).toBe('/blog/tags');

    // /blog/:slug 不会匹配 /blog（段数不同）
    const plain = resolveRoute('/blog');
    expect(plain.route.path).toBe('/blog');
  });
});

describe('resolveAdminModule', () => {
  it('resolves known modules', () => {
    expect(resolveAdminModule('/admin/friends')).toBe('friends');
    expect(resolveAdminModule('/admin/about')).toBe('about');
    expect(resolveAdminModule('/admin/profile')).toBe('profile');
    expect(resolveAdminModule('/admin/media')).toBe('media');
    expect(resolveAdminModule('/admin/settings')).toBe('settings');
  });

  it('defaults to posts for unknown or non-admin paths', () => {
    expect(resolveAdminModule('/admin/unknown')).toBe('posts');
    expect(resolveAdminModule('/admin')).toBe('posts');
    expect(resolveAdminModule('/blog')).toBe('posts');
  });
});

describe('isAdminPathname', () => {
  it('detects admin paths', () => {
    expect(isAdminPathname('/admin')).toBe(true);
    expect(isAdminPathname('/admin/login')).toBe(true);
    expect(isAdminPathname('/admin/posts')).toBe(true);
  });

  it('rejects non-admin paths', () => {
    expect(isAdminPathname('/')).toBe(false);
    expect(isAdminPathname('/blog')).toBe(false);
    expect(isAdminPathname('/admin-posts')).toBe(false);
  });
});
