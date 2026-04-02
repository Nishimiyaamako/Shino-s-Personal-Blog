import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.use({ gfm: true, breaks: false, async: false });

export function renderMarkdownToSafeHtml(markdown: string): string {
  const rendered = marked.parse(markdown);
  const html = typeof rendered === 'string' ? rendered : '';

  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding']
    },
    allowedSchemesByTag: {
      img: ['http', 'https', 'data']
    }
  });
}
