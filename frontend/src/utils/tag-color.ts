const TAG_COLOR_VARIANTS = ['strawberry', 'bubble', 'mauve'] as const;

export type TagColorVariant = (typeof TAG_COLOR_VARIANTS)[number];

export function resolveTagColorVariant(label: string): TagColorVariant {
  const normalizedLabel = label.trim().toLowerCase();

  if (!normalizedLabel) {
    return TAG_COLOR_VARIANTS[0];
  }

  let hash = 0;

  for (let index = 0; index < normalizedLabel.length; index += 1) {
    hash = (hash * 31 + normalizedLabel.charCodeAt(index)) >>> 0;
  }

  return TAG_COLOR_VARIANTS[hash % TAG_COLOR_VARIANTS.length]!;
}
