import type { Database } from 'bun:sqlite';

export interface SearchIndexInput {
  postId: number;
  title: string;
  summary: string;
}

export function removePostSearchIndex(sqlite: Database, postId: number): void {
  sqlite.query('DELETE FROM posts_search WHERE post_id = ?').run(postId);
}

export function upsertPostSearchIndex(sqlite: Database, entry: SearchIndexInput): void {
  removePostSearchIndex(sqlite, entry.postId);

  sqlite
    .query('INSERT INTO posts_search (post_id, title, summary) VALUES (?, ?, ?)')
    .run(entry.postId, entry.title, entry.summary);
}

export function clearAllPostSearchIndex(sqlite: Database): void {
  sqlite.exec('DELETE FROM posts_search');
}
