import type { DatabaseContext } from '../db/client';

const DEFAULT_ABOUT_MARKDOWN = '# 关于\n\n内容建设中。';

export function getAboutMarkdown(context: DatabaseContext): string {
  const row = context.sqlite
    .query('SELECT markdown FROM about_page WHERE id = 1 LIMIT 1')
    .get() as { markdown: string } | null;

  if (!row) {
    const now = new Date().toISOString();
    context.sqlite
      .query('INSERT INTO about_page (id, markdown, updated_at) VALUES (1, ?, ?)')
      .run(DEFAULT_ABOUT_MARKDOWN, now);

    return DEFAULT_ABOUT_MARKDOWN;
  }

  return row.markdown;
}

export function updateAboutMarkdown(context: DatabaseContext, markdown: string): { markdown: string } {
  const normalizedMarkdown = markdown.trim();

  if (!normalizedMarkdown) {
    throw new Error('markdown 不能为空');
  }

  context.sqlite
    .query(`
      INSERT INTO about_page (id, markdown, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        markdown = excluded.markdown,
        updated_at = excluded.updated_at
    `)
    .run(normalizedMarkdown, new Date().toISOString());

  return {
    markdown: normalizedMarkdown
  };
}
