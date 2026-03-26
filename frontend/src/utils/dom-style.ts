export type CssCustomPropertyName = `--${string}`;

export function setCssVar(element: HTMLElement, name: CssCustomPropertyName, value: string): void {
  element.style.setProperty(name, value);
}

export function setCssPxVar(element: HTMLElement, name: CssCustomPropertyName, value: number): void {
  setCssVar(element, name, `${Math.round(value)}px`);
}

export function clearCssVar(element: HTMLElement, name: CssCustomPropertyName): void {
  element.style.removeProperty(name);
}

export function readCssLengthPx(
  target: Element | CSSStyleDeclaration,
  name: CssCustomPropertyName,
  fallback: number,
  rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
): number {
  const style = target instanceof Element ? getComputedStyle(target) : target;
  const rawValue = style.getPropertyValue(name).trim();

  if (!rawValue) {
    return fallback;
  }

  if (rawValue.endsWith('rem')) {
    const remValue = Number.parseFloat(rawValue);
    return Number.isFinite(remValue) ? remValue * rootFontSize : fallback;
  }

  const parsedValue = Number.parseFloat(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}
