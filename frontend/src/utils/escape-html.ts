const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

const HTML_ESCAPE_REGEXP = /[&<>"']/g;

export function escapeHtml(rawText: string): string {
  return rawText.replace(HTML_ESCAPE_REGEXP, (token) => HTML_ESCAPE_MAP[token]);
}
