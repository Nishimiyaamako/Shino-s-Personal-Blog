export type ProfilePlatform = 'github' | 'bilibili' | 'gmail';

export interface ProfileContact {
  platform: ProfilePlatform;
  label: string;
  href: string;
}

export interface ProfileCardConfig {
  name: string;
  bio: string;
  avatar: string;
  contacts: ProfileContact[];
}
