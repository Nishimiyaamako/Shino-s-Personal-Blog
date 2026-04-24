import { createDatabaseContext } from '../db/client';
import { renderMarkdownToSafeHtml } from '../services/markdown';

const context = createDatabaseContext();

const rows = context.sqlite
    .query(`
    SELECT id, content_markdown FROM posts
  `)
    .all() as Array<{ id: number; content_markdown: string }>;

console.log(`Found ${rows.length} posts to re-render`);

for (const row of rows) {
    const newHtml = renderMarkdownToSafeHtml(row.content_markdown);
    context.sqlite
        .query(`UPDATE posts SET content_html = ? WHERE id = ?`)
        .run(newHtml, row.id);
    console.log(`  Updated post id=${row.id}`);
}

console.log('Done');
