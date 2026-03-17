/**
 * 动态主题引擎（阅读优先精简版）
 * ------------------------------------------------------------
 * 目标：
 * 1) 每次整页刷新切换背景图（随机且避重）
 * 2) 从背景图提取色相与亮度，计算强调色
 * 3) 仅更新强调文本 / 图标颜色，不再改动大块卡片颜色
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

type RgbColor = {
  r: number;
  g: number;
  b: number;
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

function mixRgb(source: RgbColor, target: RgbColor, targetWeight: number): RgbColor {
  const safeWeight = clamp(targetWeight, 0, 1);
  const sourceWeight = 1 - safeWeight;

  return {
    r: source.r * sourceWeight + target.r * safeWeight,
    g: source.g * sourceWeight + target.g * safeWeight,
    b: source.b * sourceWeight + target.b * safeWeight,
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

  while (contrastRatio(candidate, background) < minRatio && attempts < 20) {
    const backgroundLuminance = relativeLuminance(background);
    const candidateLuminance = relativeLuminance(candidate);
    const target = candidateLuminance > backgroundLuminance ? WHITE : BLACK;

    candidate = mixRgb(candidate, target, 0.16);
    attempts += 1;
  }

  return candidate;
}

function toCssRgb(color: RgbColor): string {
  const r = Math.round(clamp(color.r, 0, 255));
  const g = Math.round(clamp(color.g, 0, 255));
  const b = Math.round(clamp(color.b, 0, 255));
  return `rgb(${r} ${g} ${b})`;
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

function createAccentColors(analysis: ImageThemeAnalysis): { accent: RgbColor; accentStrong: RgbColor } {
  const anchoredHue = mixHue(analysis.hue, 30, 0.22);
  const lightnessOffset = analysis.luminance < 0.45 ? 0.04 : analysis.luminance > 0.78 ? -0.03 : 0;

  const accentBase = hslToRgb(anchoredHue, 0.62, clamp(0.36 + lightnessOffset, 0.3, 0.42));
  const accentStrongBase = hslToRgb(anchoredHue, 0.66, clamp(0.28 + lightnessOffset * 0.7, 0.22, 0.34));

  return {
    accent: ensureContrast(accentBase, WHITE, 4.5),
    accentStrong: ensureContrast(accentStrongBase, WHITE, 4.5),
  };
}

function buildThemeTokens(
  asset: BackgroundAsset,
  accentColors: { accent: RgbColor; accentStrong: RgbColor },
): DynamicThemeTokens {
  return {
    '--bg-image-url': `url('${asset.url}')`,
    '--accent-color': toCssRgb(accentColors.accent),
    '--accent-color-strong': toCssRgb(accentColors.accentStrong),
  };
}

function applyTokens(tokens: DynamicThemeTokens): void {
  const root = document.documentElement;

  Object.entries(tokens).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}

function applySafeFallback(asset: BackgroundAsset): void {
  const safeAccent = ensureContrast(hslToRgb(DEFAULT_ANALYSIS.hue, 0.58, 0.36), WHITE, 4.5);
  const safeAccentStrong = ensureContrast(hslToRgb(DEFAULT_ANALYSIS.hue, 0.62, 0.28), WHITE, 4.5);

  applyTokens(buildThemeTokens(asset, { accent: safeAccent, accentStrong: safeAccentStrong }));
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
    const accentColors = createAccentColors(analysis);
    applyTokens(buildThemeTokens(selectedBackground, accentColors));
  } catch {
    applySafeFallback(selectedBackground);
  }
}
