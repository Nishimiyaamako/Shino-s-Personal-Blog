const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

const HTML_ESCAPE_REGEXP = /[&<>"']/g;

/**
 * 将文本中的特殊字符转义为 HTML 实体。
 *
 * @param rawText 原始字符串（可能来自路由参数或用户输入）
 * @returns 可安全插入到 HTML 模板中的字符串
 *
 * 目的：避免把原始字符（如 < > " ' &）直接拼到 HTML 时造成解析问题或注入风险。
 */
export function escapeHtml(rawText: string): string {
  return rawText.replace(HTML_ESCAPE_REGEXP, (token) => HTML_ESCAPE_MAP[token]);
}
