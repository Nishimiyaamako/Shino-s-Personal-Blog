import type { HomeIntroPanelConfig } from '../types/home-intro-panel';

export const HOME_INTRO_PANEL_CONFIG: HomeIntroPanelConfig = {
  facts: [
    { label: '年龄', value: '21' },
    { label: '开源仓库项目', value: '2' },
    { label: '最近在研究', value: '网站开发' }
  ],
  techStack: [
    { key: 'typescript', label: 'TypeScript' },
    { key: 'javascript', label: 'JavaScript' },
    { key: 'vite', label: 'Vite' },
    { key: 'bun', label: 'Bun' },
    { key: 'elysia', label: 'Elysia.js' },
    { key: 'nodejs', label: 'Node.js' },
    { key: 'docker', label: 'Docker' },
    { key: 'nginx', label: 'Nginx' },
    { key: 'linux', label: 'Linux' },
    { key: 'postgresql', label: 'PostgreSQL' },
    { key: 'redis', label: 'Redis' },
    { key: 'tailwind', label: 'Tailwind CSS' }
  ],
  hobbies: ['ACG社区吃瓜', '长跑', '骑行', '折腾电子垃圾']
};
