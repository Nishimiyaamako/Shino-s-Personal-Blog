import { afterEach, describe, expect, it } from 'vitest';
import {
  confirmAdminAction,
  formatPostStatus,
  generateSlug,
  parseContacts,
  readPostFormPayload,
  renderMarkdownPreviewHtml,
  renderAdminPostList,
  renderFriendList,
  serializeContacts,
  splitTags
} from './shared';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('splitTags', () => {
  it('splits and trims comma-separated tags', () => {
    expect(splitTags(' rust, 前端 , ,web ')).toEqual(['rust', '前端', 'web']);
    expect(splitTags('')).toEqual([]);
  });
});

describe('contacts serialization round-trip', () => {
  it('serializes then parses back', () => {
    const contacts = [
      { platform: 'github', label: 'GitHub', href: 'https://github.com/x', displayOrder: 0 },
      { platform: 'mail', label: 'Mail', href: 'mailto:a@b.c', displayOrder: 1 }
    ];
    const raw = serializeContacts(contacts);
    expect(parseContacts(raw)).toEqual(contacts);
  });

  it('drops lines without platform or href', () => {
    const parsed = parseContacts('github|GitHub|https://g.x\n||broken\nmail|Mail|');
    expect(parsed).toEqual([{ platform: 'github', label: 'GitHub', href: 'https://g.x', displayOrder: 0 }]);
  });
});

describe('generateSlug', () => {
  it('lowercases, trims and joins with dashes', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
    // 中文被剥离（\w 不含 CJK）：生成 slug 需通过后端 SLUG_REGEXP（仅 a-z0-9-），与现状契约一致
    expect(generateSlug('  Rust  学习  ')).toBe('rust');
  });

  it('collapses duplicate dashes and strips symbols', () => {
    expect(generateSlug('a--b--c')).toBe('a-b-c');
    expect(generateSlug('Rust!!! & More?')).toBe('rust-more');
  });

  it('caps at 80 chars', () => {
    expect(generateSlug('x'.repeat(200))).toHaveLength(80);
  });
});

describe('formatPostStatus', () => {
  it('maps status labels', () => {
    expect(formatPostStatus({ status: 'published' } as never)).toBe('已发布');
    expect(formatPostStatus({ status: 'draft' } as never)).toBe('草稿');
  });
});

describe('readPostFormPayload', () => {
  function buildForm(values: Record<string, string>): HTMLFormElement {
    const form = document.createElement('form');
    for (const [name, value] of Object.entries(values)) {
      const input = document.createElement('input');
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    return form;
  }

  it('reads and trims fields with manual slug priority', () => {
    const form = buildForm({
      title: '  我的文章  ',
      slug: 'auto-slug',
      slugManual: 'manual-slug',
      date: '2026-08-01',
      summary: ' 摘要 ',
      tags: ' a, b ',
      status: 'published',
      contentMarkdown: '## Hi'
    });
    const payload = readPostFormPayload(form);
    expect(payload.title).toBe('我的文章');
    expect(payload.slug).toBe('manual-slug');
    expect(payload.tags).toEqual(['a', 'b']);
    expect(payload.status).toBe('published');
  });

  it('defaults unknown status values to published (only draft is draft)', () => {
    const form = buildForm({ status: 'weird', title: 't' });
    expect(readPostFormPayload(form).status).toBe('published');
  });
});

describe('renderMarkdownPreviewHtml', () => {
  it('returns placeholder for empty input', () => {
    expect(renderMarkdownPreviewHtml('   ')).toContain('empty-hint');
  });

  it('renders GFM and strips scripts via DOMPurify', () => {
    const html = renderMarkdownPreviewHtml('# Title\n\n<script>alert(1)</script>\n\n**bold**');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).not.toContain('<script');
  });

  it('renders code fences', () => {
    const html = renderMarkdownPreviewHtml('```ts\nconst a = 1;\n```');
    expect(html).toContain('<code');
  });
});

describe('confirmAdminAction', () => {
  it('resolves true on confirm click', async () => {
    const promise = confirmAdminAction({ title: '确认删除', message: '确定？' });
    const overlay = document.querySelector('.admin-dialog-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay!.getAttribute('role')).toBe('dialog');

    const confirmButton = document.querySelector('[data-role="admin-dialog-confirm"]') as HTMLButtonElement;
    confirmButton.click();

    await expect(promise).resolves.toBe(true);
    expect(document.querySelector('.admin-dialog-overlay')).toBeNull();
  });

  it('resolves false on cancel click', async () => {
    const promise = confirmAdminAction({ title: 't', message: 'm' });
    const cancelButton = document.querySelector('[data-role="admin-dialog-cancel"]') as HTMLButtonElement;
    cancelButton.click();
    await expect(promise).resolves.toBe(false);
  });

  it('resolves false on Escape key', async () => {
    const promise = confirmAdminAction({ title: 't', message: 'm' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(promise).resolves.toBe(false);
  });

  it('settles only once', async () => {
    const promise = confirmAdminAction({ title: 't', message: 'm' });
    const confirmButton = document.querySelector('[data-role="admin-dialog-confirm"]') as HTMLButtonElement;
    confirmButton.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(promise).resolves.toBe(true);
  });
});

describe('renderAdminPostList / renderFriendList', () => {
  it('shows empty hint for empty lists', () => {
    expect(renderAdminPostList([], 0)).toContain('暂无文章');
    expect(renderFriendList([])).toContain('还没有友链');
  });

  it('renders post entries with active selection', () => {
    const html = renderAdminPostList(
      [{ id: 1, title: '一篇文章', slug: 'a', date: '2026-08-01', status: 'published', tags: ['rust'] }] as never,
      1
    );
    expect(html).toContain('data-post-id="1"');
    expect(html).toContain('is-active');
    expect(html).toContain('已发布');
  });

  it('escapes HTML in titles and escapes nothing untrusted', () => {
    const html = renderFriendList([
      { id: 2, name: '<img src=x onerror=1>', url: 'https://e.v', enabled: true, displayOrder: 0 } as never
    ]);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
    expect(html).toContain('is-enabled');
  });
});
