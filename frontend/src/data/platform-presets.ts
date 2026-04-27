import type { ProfilePlatform } from '../types/profile-card';

export interface PlatformPreset {
  key: ProfilePlatform;
  label: string;
  iconifyIcon: string;
}

export const PLATFORM_PRESETS: PlatformPreset[] = [
  { key: 'github', label: 'GitHub', iconifyIcon: 'mdi:github' },
  { key: 'bilibili', label: 'Bilibili', iconifyIcon: 'simple-icons:bilibili' },
  { key: 'twitter', label: 'Twitter / X', iconifyIcon: 'mdi:twitter' },
  { key: 'email', label: 'Email', iconifyIcon: 'mdi:email' },
  { key: 'website', label: 'Website', iconifyIcon: 'mdi:web' },
  { key: 'telegram', label: 'Telegram', iconifyIcon: 'mdi:telegram' },
  { key: 'discord', label: 'Discord', iconifyIcon: 'mdi:discord' },
  { key: 'rss', label: 'RSS', iconifyIcon: 'mdi:rss' },
  { key: 'mastodon', label: 'Mastodon', iconifyIcon: 'mdi:mastodon' },
  { key: 'youtube', label: 'YouTube', iconifyIcon: 'mdi:youtube' }
];

const PRESET_MAP = new Map<string, PlatformPreset>(
  PLATFORM_PRESETS.map((p) => [p.key, p])
);

const FALLBACK_ICON = 'mdi:link-variant';

export function getIconifyIcon(platform: ProfilePlatform): string {
  const key = platform.trim().toLowerCase();
  return PRESET_MAP.get(key)?.iconifyIcon ?? FALLBACK_ICON;
}

export function getPresetLabel(platform: ProfilePlatform): string {
  const key = platform.trim().toLowerCase();
  return PRESET_MAP.get(key)?.label ?? key;
}

export function isPresetPlatform(platform: ProfilePlatform): boolean {
  const key = platform.trim().toLowerCase();
  return PRESET_MAP.has(key);
}
