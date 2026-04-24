import { marked } from 'marked';
import hljs from 'highlight.js';
import sanitizeHtml from 'sanitize-html';

const renderer = new marked.Renderer();
renderer.code = ({ text, lang }) => {
  if (lang && hljs.getLanguage(lang)) {
    const highlighted = hljs.highlight(text, { language: lang }).value;
    return `<pre data-language="${lang}"><code class="hljs language-${lang}">${highlighted}</code></pre>`;
  }

  return `<pre><code>${text}</code></pre>`;
};

marked.use({ gfm: true, breaks: false, async: false, renderer });

export function renderMarkdownToSafeHtml(markdown: string): string {
  const rendered = marked.parse(markdown);
  const html = typeof rendered === 'string' ? rendered : '';

  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      pre: ['data-language'],
      code: ['class'],
      span: ['class']
    },
    allowedSchemesByTag: {
      img: ['http', 'https', 'data']
    }
  });
}
