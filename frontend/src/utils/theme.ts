export function normalizeThemeKey(theme: string): string {
  return theme.trim().replace(/\s+/g, ' ').toLowerCase();
}
