import type { ProfileCardConfig } from '../types/profile-card';

export const PROFILE_CARD_CONFIG: ProfileCardConfig = {
  name: '长筱团子',
  bio: 'Luna say maybe',
  avatar: 'https://placehold.co/120x120/png?text=ME',
  contacts: [
    {
      platform: 'github',
      label: '',
      href: 'https://github.com/Nishimiyaamako'
    },
    {
      platform: 'bilibili',
      label: '',
      href: 'https://space.bilibili.com/392058093'
    },
    {
      platform: 'gmail',
      label: '',
      href: 'nagashinoamako@gmail.com'
    }
  ]
};

let remoteProfileCardOverride: ProfileCardConfig | null = null;

export function loadProfileCardConfig(): ProfileCardConfig {
  return remoteProfileCardOverride ? { ...remoteProfileCardOverride, contacts: [...remoteProfileCardOverride.contacts] } : {
    ...PROFILE_CARD_CONFIG,
    contacts: [...PROFILE_CARD_CONFIG.contacts]
  };
}

export function applyRemoteProfileCard(profileCard: ProfileCardConfig): boolean {
  const normalizedProfile: ProfileCardConfig = {
    name: profileCard.name.trim(),
    bio: profileCard.bio.trim(),
    avatar: profileCard.avatar.trim(),
    contacts: profileCard.contacts
      .map((contact) => ({
        platform: contact.platform.trim(),
        label: contact.label.trim(),
        href: contact.href.trim()
      }))
      .filter((contact) => contact.platform && contact.href)
  };
  const currentProfile = remoteProfileCardOverride ?? PROFILE_CARD_CONFIG;
  const currentFingerprint = `${currentProfile.name}|${currentProfile.bio}|${currentProfile.avatar}|${currentProfile.contacts
    .map((contact) => `${contact.platform}|${contact.label}|${contact.href}`)
    .join('||')}`;
  const nextFingerprint = `${normalizedProfile.name}|${normalizedProfile.bio}|${normalizedProfile.avatar}|${normalizedProfile.contacts
    .map((contact) => `${contact.platform}|${contact.label}|${contact.href}`)
    .join('||')}`;

  if (currentFingerprint === nextFingerprint) {
    return false;
  }

  remoteProfileCardOverride = normalizedProfile;
  return true;
}
