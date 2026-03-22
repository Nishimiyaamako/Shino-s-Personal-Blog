import { normalizeThemeKey } from '../utils/theme';

/**
 * 主题优先级（从高到低）。
 * 建议始终写“标准化后的 key”，避免大小写/空格差异导致排序异常。
 */
export const THEME_ORDER: string[] = [
  normalizeThemeKey('安装配置')
];

