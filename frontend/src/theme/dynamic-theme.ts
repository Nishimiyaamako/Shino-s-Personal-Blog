/**
 * 动态主题引擎
 * ------------------------------------------------------------
 * 目标：
 * 1) 每次整页刷新切换背景图（随机且避重）
 * 2) 从背景图提取色相与亮度，生成阅读优先的主题令牌
 * 3) 自动校验对比度，不达标时回退到安全主题
 */

export interface BackgroundAsset {
  id: string;
  url: string;
}

export interface ImageThemeAnalysis {
  hue: number;
  luminance: number;
}

export interface DynamicThemeTokens {
  [cssVarName: string]: string;
}

type ThemeMode = 'light' | 'dark';

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type ThemePalette = {
  mode: ThemeMode;
  bgBase: RgbColor;
  bgSoft: RgbColor;
  surface: RgbColor;
  surfaceStrong: RgbColor;
  surfaceHover: RgbColor;
  border: RgbColor;
  text: RgbColor;
  textMuted: RgbColor;
  accent: RgbColor;
  accentStrong: RgbColor;
  overlayStrong: RgbColor;
  overlaySoft: RgbColor;
  shadowBase: RgbColor;
};

const BACKGROUND_ASSETS: readonly BackgroundAsset[] = [
  { id: 'kamitsubaki', url: '/神椿.png' },
  { id: 'jinxi', url: '/今汐-1.jpg' },
];

const STORAGE_KEY_LAST_BACKGROUND = 'personal-blog:last-background-id';

const DEFAULT_ANALYSIS: ImageThemeAnalysis = {
  hue: 28,
  luminance: 0.74,
};

const WHITE: RgbColor = { r: 255, g: 255, b: 255 };
const BLACK: RgbColor = { r: 10, g: 10, b: 12 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function mixHue(from: number, to: number, toWeight: number): number {
  const safeWeight = clamp(toWeight, 0, 1);
  const delta = ((to - from + 540) % 360) - 180;
  return normalizeHue(from + delta * safeWeight);
}

function mixRgb(source: RgbColor, target: RgbColor, targetWeight: number): RgbColor {
  const safeWeight = clamp(targetWeight, 0, 1);
  const sourceWeight = 1 - safeWeight;

  return {
    r: source.r * sourceWeight + target.r * safeWeight,
    g: source.g * sourceWeight + target.g * safeWeight,
    b: source.b * sourceWeight + target.b * safeWeight,
  };
}

function toCssRgb(color: RgbColor): string {
  const r = Math.round(clamp(color.r, 0, 255));
  const g = Math.round(clamp(color.g, 0, 255));
  const b = Math.round(clamp(color.b, 0, 255));
  return `rgb(${r} ${g} ${b})`;
}

function toCssRgba(color: RgbColor, alpha: number): string {
  const r = Math.round(clamp(color.r, 0, 255));
  const g = Math.round(clamp(color.g, 0, 255));
  const b = Math.round(clamp(color.b, 0, 255));
  const safeAlpha = clamp(alpha, 0, 1);
  return `rgb(${r} ${g} ${b} / ${safeAlpha.toFixed(3)})`;
}

function hslToRgb(h: number, s: number, l: number): RgbColor {
  const hue = normalizeHue(h);
  const saturation = clamp(s, 0, 1);
  const lightness = clamp(l, 0, 1);

  if (saturation === 0) {
    const gray = lightness * 255;
    return { r: gray, g: gray, b: gray };
  }

  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hh = hue / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hh >= 0 && hh < 1) {
    r1 = c;
    g1 = x;
  } else if (hh >= 1 && hh < 2) {
    r1 = x;
    g1 = c;
  } else if (hh >= 2 && hh < 3) {
    g1 = c;
    b1 = x;
  } else if (hh >= 3 && hh < 4) {
    g1 = x;
    b1 = c;
  } else if (hh >= 4 && hh < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const m = lightness - c / 2;

  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}

function rgbToHsl(color: RgbColor): { h: number; s: number; l: number } {
  const r = clamp(color.r / 255, 0, 1);
  const g = clamp(color.g / 255, 0, 1);
  const b = clamp(color.b / 255, 0, 1);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
  }

  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return {
    h: normalizeHue(h * 60),
    s: clamp(saturation, 0, 1),
    l: clamp(lightness, 0, 1),
  };
}

function toLinearSrgb(channel: number): number {
  const value = clamp(channel / 255, 0, 1);
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: RgbColor): number {
  const r = toLinearSrgb(color.r);
  const g = toLinearSrgb(color.g);
  const b = toLinearSrgb(color.b);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function contrastRatio(foreground: RgbColor, background: RgbColor): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);

  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function ensureContrast(foreground: RgbColor, background: RgbColor, minRatio: number): RgbColor {
  let candidate = { ...foreground };
  let attempts = 0;

  while (contrastRatio(candidate, background) < minRatio && attempts < 24) {
    const backgroundLuminance = relativeLuminance(background);
    const candidateLuminance = relativeLuminance(candidate);
    const target = candidateLuminance > backgroundLuminance ? WHITE : BLACK;

    candidate = mixRgb(candidate, target, 0.14);
    attempts += 1;
  }

  return candidate;
}

function pickReadableForeground(background: RgbColor): RgbColor {
  const darkCandidate = { r: 35, g: 24, b: 20 };
  const darkContrast = contrastRatio(darkCandidate, background);
  const whiteContrast = contrastRatio(WHITE, background);

  if (whiteContrast >= darkContrast) {
    return whiteContrast >= 4.5 ? WHITE : ensureContrast(WHITE, background, 4.5);
  }

  return darkContrast >= 4.5 ? darkCandidate : ensureContrast(darkCandidate, background, 4.5);
}

function safeStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 忽略写入失败（隐私模式 / 禁用存储）
  }
}

function pickBackgroundAsset(assets: readonly BackgroundAsset[]): BackgroundAsset {
  if (assets.length === 0) {
    throw new Error('No background asset configured.');
  }

  if (assets.length === 1) {
    return assets[0];
  }

  const lastBackgroundId = safeStorageGet(STORAGE_KEY_LAST_BACKGROUND);
  const candidates = assets.filter((asset) => asset.id !== lastBackgroundId);
  const pickPool = candidates.length > 0 ? candidates : assets;
  const randomIndex = Math.floor(Math.random() * pickPool.length);

  return pickPool[randomIndex];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    image.src = url;
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timerId: number | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timerId = window.setTimeout(() => reject(new Error('Theme analysis timeout.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
    }
  }
}

async function analyzeImageTheme(url: string): Promise<ImageThemeAnalysis> {
  const image = await loadImage(url);
  const sampleSize = 80;

  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return DEFAULT_ANALYSIS;
  }

  context.drawImage(image, 0, 0, sampleSize, sampleSize);

  const imageData = context.getImageData(0, 0, sampleSize, sampleSize);
  const pixels = imageData.data;

  let luminanceSum = 0;
  let luminanceWeightSum = 0;
  let hueX = 0;
  let hueY = 0;
  let hueWeightSum = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;

    if (alpha < 0.04) {
      continue;
    }

    const color: RgbColor = {
      r: pixels[index],
      g: pixels[index + 1],
      b: pixels[index + 2],
    };

    const colorLuminance = relativeLuminance(color);
    luminanceSum += colorLuminance * alpha;
    luminanceWeightSum += alpha;

    const hsl = rgbToHsl(color);

    if (hsl.s < 0.06) {
      continue;
    }

    const hueWeight = alpha * hsl.s * (0.55 + (1 - Math.abs(hsl.l - 0.5)));
    const hueRadians = (hsl.h * Math.PI) / 180;

    hueX += Math.cos(hueRadians) * hueWeight;
    hueY += Math.sin(hueRadians) * hueWeight;
    hueWeightSum += hueWeight;
  }

  const luminance = luminanceWeightSum > 0 ? luminanceSum / luminanceWeightSum : DEFAULT_ANALYSIS.luminance;
  const hasUsableHue = hueWeightSum > 0.12 && (Math.abs(hueX) > 0.0001 || Math.abs(hueY) > 0.0001);

  const hue = hasUsableHue
    ? normalizeHue((Math.atan2(hueY, hueX) * 180) / Math.PI)
    : DEFAULT_ANALYSIS.hue;

  return {
    hue,
    luminance: clamp(luminance, 0, 1),
  };
}

function createPaletteFromAnalysis(analysis: ImageThemeAnalysis): ThemePalette {
  const mode: ThemeMode = analysis.luminance >= 0.62 ? 'light' : 'dark';
  const anchoredHue = mixHue(analysis.hue, 30, 0.28);
  const accentHue = normalizeHue(anchoredHue + 8);

  if (mode === 'light') {
    return {
      mode,
      bgBase: hslToRgb(anchoredHue, 0.42, 0.94),
      bgSoft: hslToRgb(anchoredHue, 0.33, 0.9),
      surface: hslToRgb(anchoredHue, 0.33, 0.95),
      surfaceStrong: hslToRgb(anchoredHue, 0.35, 0.97),
      surfaceHover: hslToRgb(anchoredHue, 0.28, 0.985),
      border: hslToRgb(anchoredHue, 0.26, 0.45),
      text: hslToRgb(anchoredHue, 0.26, 0.2),
      textMuted: hslToRgb(anchoredHue, 0.19, 0.33),
      accent: hslToRgb(accentHue, 0.62, 0.39),
      accentStrong: hslToRgb(accentHue, 0.66, 0.31),
      overlayStrong: mixRgb(hslToRgb(anchoredHue, 0.4, 0.96), WHITE, 0.22),
      overlaySoft: mixRgb(hslToRgb(anchoredHue, 0.28, 0.9), WHITE, 0.1),
      shadowBase: hslToRgb(anchoredHue, 0.24, 0.25),
    };
  }

  return {
    mode,
    bgBase: hslToRgb(anchoredHue, 0.22, 0.13),
    bgSoft: hslToRgb(anchoredHue, 0.16, 0.18),
    surface: hslToRgb(anchoredHue, 0.18, 0.16),
    surfaceStrong: hslToRgb(anchoredHue, 0.16, 0.21),
    surfaceHover: hslToRgb(anchoredHue, 0.14, 0.25),
    border: hslToRgb(anchoredHue, 0.2, 0.58),
    text: hslToRgb(anchoredHue, 0.2, 0.93),
    textMuted: hslToRgb(anchoredHue, 0.12, 0.78),
    accent: hslToRgb(accentHue, 0.67, 0.72),
    accentStrong: hslToRgb(accentHue, 0.68, 0.79),
    overlayStrong: mixRgb(hslToRgb(anchoredHue, 0.16, 0.09), BLACK, 0.38),
    overlaySoft: mixRgb(hslToRgb(anchoredHue, 0.14, 0.16), BLACK, 0.22),
    shadowBase: BLACK,
  };
}

function createSafePalette(mode: ThemeMode): ThemePalette {
  if (mode === 'light') {
    return {
      mode,
      bgBase: { r: 253, g: 250, b: 243 },
      bgSoft: { r: 245, g: 232, b: 214 },
      surface: { r: 253, g: 250, b: 243 },
      surfaceStrong: { r: 253, g: 250, b: 243 },
      surfaceHover: { r: 255, g: 255, b: 255 },
      border: { r: 172, g: 97, b: 37 },
      text: { r: 79, g: 49, b: 28 },
      textMuted: { r: 127, g: 98, b: 77 },
      accent: { r: 172, g: 97, b: 37 },
      accentStrong: { r: 143, g: 78, b: 31 },
      overlayStrong: { r: 253, g: 250, b: 243 },
      overlaySoft: { r: 245, g: 232, b: 214 },
      shadowBase: { r: 79, g: 49, b: 28 },
    };
  }

  return {
    mode,
    bgBase: { r: 29, g: 24, b: 22 },
    bgSoft: { r: 43, g: 34, b: 30 },
    surface: { r: 39, g: 31, b: 28 },
    surfaceStrong: { r: 47, g: 38, b: 34 },
    surfaceHover: { r: 59, g: 47, b: 42 },
    border: { r: 203, g: 161, b: 132 },
    text: { r: 247, g: 237, b: 224 },
    textMuted: { r: 224, g: 204, b: 183 },
    accent: { r: 236, g: 183, b: 132 },
    accentStrong: { r: 247, g: 210, b: 171 },
    overlayStrong: { r: 17, g: 14, b: 12 },
    overlaySoft: { r: 45, g: 36, b: 32 },
    shadowBase: BLACK,
  };
}

function enforceReadability(palette: ThemePalette): ThemePalette {
  return {
    ...palette,
    text: ensureContrast(palette.text, palette.surfaceStrong, 4.5),
    textMuted: ensureContrast(palette.textMuted, palette.surfaceStrong, 4.5),
    accent: ensureContrast(palette.accent, palette.surfaceStrong, 4.5),
    accentStrong: ensureContrast(palette.accentStrong, palette.surfaceStrong, 4.5),
    border: ensureContrast(palette.border, palette.surfaceStrong, 3),
  };
}

function isReadablePalette(palette: ThemePalette): boolean {
  return (
    contrastRatio(palette.text, palette.surfaceStrong) >= 4.5 &&
    contrastRatio(palette.textMuted, palette.surfaceStrong) >= 4.5 &&
    contrastRatio(palette.accent, palette.surfaceStrong) >= 4.5 &&
    contrastRatio(palette.border, palette.surfaceStrong) >= 3
  );
}

function buildThemeTokens(asset: BackgroundAsset, palette: ThemePalette): DynamicThemeTokens {
  const mode = palette.mode;

  const inlineCodeBackground = mode === 'light'
    ? mixRgb(palette.surfaceStrong, WHITE, 0.16)
    : mixRgb(palette.surfaceStrong, BLACK, 0.12);
  const inlineCodeText = ensureContrast(palette.accentStrong, inlineCodeBackground, 4.5);

  const ghostSurfaceBackground = mode === 'light'
    ? mixRgb(palette.surfaceStrong, WHITE, 0.04)
    : mixRgb(palette.surfaceStrong, palette.bgSoft, 0.22);
  const stepSurfaceBackground = mode === 'light'
    ? mixRgb(palette.surfaceStrong, WHITE, 0.1)
    : mixRgb(palette.surfaceStrong, palette.bgSoft, 0.28);
  const preBackground = mode === 'light'
    ? mixRgb(palette.surfaceStrong, WHITE, 0.14)
    : mixRgb(palette.surfaceStrong, BLACK, 0.08);
  const avatarBackground = mode === 'light'
    ? mixRgb(palette.surfaceStrong, WHITE, 0.22)
    : mixRgb(palette.surfaceStrong, palette.bgSoft, 0.3);
  const buttonText = pickReadableForeground(palette.accent);

  const successBase = mode === 'light' ? hslToRgb(145, 0.5, 0.35) : hslToRgb(145, 0.46, 0.68);
  const errorBase = mode === 'light' ? hslToRgb(2, 0.58, 0.41) : hslToRgb(2, 0.55, 0.71);

  const successText = ensureContrast(
    successBase,
    mode === 'light' ? mixRgb(palette.surfaceStrong, WHITE, 0.2) : mixRgb(palette.surfaceStrong, BLACK, 0.12),
    4.5,
  );
  const errorText = ensureContrast(
    errorBase,
    mode === 'light' ? mixRgb(palette.surfaceStrong, WHITE, 0.2) : mixRgb(palette.surfaceStrong, BLACK, 0.12),
    4.5,
  );

  return {
    '--bg-image-url': `url('${asset.url}')`,
    '--bg-base': toCssRgb(palette.bgBase),
    '--bg-soft': toCssRgb(palette.bgSoft),
    '--surface-color': toCssRgba(palette.surface, mode === 'light' ? 0.9 : 0.78),
    '--surface-color-strong': toCssRgba(palette.surfaceStrong, mode === 'light' ? 0.95 : 0.9),
    '--surface-color-hover': toCssRgba(palette.surfaceHover, mode === 'light' ? 0.88 : 0.84),
    '--border-color': toCssRgba(palette.border, mode === 'light' ? 0.22 : 0.52),
    '--text-color': toCssRgb(palette.text),
    '--text-muted-color': toCssRgb(palette.textMuted),
    '--accent-color': toCssRgb(palette.accent),
    '--accent-color-strong': toCssRgb(palette.accentStrong),
    '--overlay-strong': toCssRgba(palette.overlayStrong, mode === 'light' ? 0.58 : 0.62),
    '--overlay-soft': toCssRgba(palette.overlaySoft, mode === 'light' ? 0.32 : 0.36),
    '--header-bg': toCssRgba(palette.surfaceStrong, mode === 'light' ? 0.9 : 0.84),
    '--button-text-color': toCssRgb(buttonText),
    '--action-button-border-color': toCssRgba(palette.accentStrong, mode === 'light' ? 0.45 : 0.62),
    '--nav-active-border-color': toCssRgba(palette.accentStrong, mode === 'light' ? 0.35 : 0.58),
    '--nav-active-bg': toCssRgba(palette.accent, mode === 'light' ? 0.12 : 0.24),
    '--inline-code-border': toCssRgba(palette.accentStrong, mode === 'light' ? 0.28 : 0.5),
    '--inline-code-bg': toCssRgba(inlineCodeBackground, mode === 'light' ? 0.86 : 0.9),
    '--inline-code-text': toCssRgb(inlineCodeText),
    '--ghost-surface-bg': toCssRgba(ghostSurfaceBackground, mode === 'light' ? 0.78 : 0.66),
    '--step-border-color': toCssRgba(palette.accentStrong, mode === 'light' ? 0.2 : 0.44),
    '--step-surface-bg': toCssRgba(stepSurfaceBackground, mode === 'light' ? 0.48 : 0.56),
    '--pre-border-color': toCssRgba(palette.accentStrong, mode === 'light' ? 0.25 : 0.42),
    '--pre-bg': toCssRgba(preBackground, mode === 'light' ? 0.72 : 0.78),
    '--focus-ring-color': toCssRgba(palette.accentStrong, mode === 'light' ? 0.55 : 0.74),
    '--friend-hover-border-color': toCssRgba(palette.accentStrong, mode === 'light' ? 0.46 : 0.68),
    '--friend-hover-shadow': `0 10px 24px ${toCssRgba(palette.shadowBase, mode === 'light' ? 0.15 : 0.45)}`,
    '--friend-active-shadow': `0 6px 14px ${toCssRgba(palette.shadowBase, mode === 'light' ? 0.13 : 0.38)}`,
    '--avatar-border-color': toCssRgba(palette.accentStrong, mode === 'light' ? 0.25 : 0.44),
    '--avatar-bg': toCssRgba(avatarBackground, mode === 'light' ? 0.55 : 0.72),
    '--copy-button-border': toCssRgba(palette.accentStrong, mode === 'light' ? 0.34 : 0.56),
    '--copy-button-bg': toCssRgba(palette.accent, mode === 'light' ? 0.08 : 0.24),
    '--copy-button-border-hover': toCssRgba(palette.accentStrong, mode === 'light' ? 0.5 : 0.7),
    '--copy-button-bg-hover': toCssRgba(palette.accent, mode === 'light' ? 0.16 : 0.32),
    '--success-border-color': toCssRgba(successBase, mode === 'light' ? 0.45 : 0.7),
    '--success-bg': toCssRgba(successBase, mode === 'light' ? 0.14 : 0.24),
    '--success-text': toCssRgb(successText),
    '--error-border-color': toCssRgba(errorBase, mode === 'light' ? 0.45 : 0.72),
    '--error-bg': toCssRgba(errorBase, mode === 'light' ? 0.12 : 0.24),
    '--error-text': toCssRgb(errorText),
    '--shadow-soft': `0 20px 50px ${toCssRgba(palette.shadowBase, mode === 'light' ? 0.1 : 0.4)}`,
  };
}

function applyTokens(tokens: DynamicThemeTokens): void {
  const root = document.documentElement;

  Object.entries(tokens).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}

function applySafeFallback(asset: BackgroundAsset): void {
  const safePalette = enforceReadability(createSafePalette('light'));
  const safeTokens = buildThemeTokens(asset, safePalette);
  applyTokens(safeTokens);
}

/**
 * 在首屏渲染前调用。
 * 失败时会自动降级到安全主题，不会阻塞页面可用性。
 */
export async function initializeDynamicTheme(): Promise<void> {
  const selectedBackground = pickBackgroundAsset(BACKGROUND_ASSETS);
  safeStorageSet(STORAGE_KEY_LAST_BACKGROUND, selectedBackground.id);

  try {
    const analysis = await withTimeout(analyzeImageTheme(selectedBackground.url), 1200);
    const candidatePalette = enforceReadability(createPaletteFromAnalysis(analysis));
    const finalPalette = isReadablePalette(candidatePalette)
      ? candidatePalette
      : enforceReadability(createSafePalette(candidatePalette.mode));

    const tokens = buildThemeTokens(selectedBackground, finalPalette);
    applyTokens(tokens);
  } catch {
    applySafeFallback(selectedBackground);
  }
}

