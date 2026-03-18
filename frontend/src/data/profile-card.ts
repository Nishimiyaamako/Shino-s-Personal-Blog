import type { ProfileCardConfig } from '../types/profile-card';

export const PROFILE_CARD_CONFIG: ProfileCardConfig = {
  name: 'Your Name',
  bio: '这里是我的博客小角落，记录工程实践、学习笔记和一些生活灵感。',
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
      href: 'https://mail.google.com/mail/u/0/#inbox'
    }
  ]
};
