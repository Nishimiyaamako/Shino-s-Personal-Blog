export interface HomeIntroFactItem {
  label: string;
  value: string;
}

export type HomeTechStackKey =
  | 'typescript'
  | 'html5'
  | 'css3'
  | 'javascript'
  | 'rust'
  | 'cloudflare'
  | 'blender'
  | 'comfyui'
  | 'ollama'
  | 'vite'
  | 'bun'
  | 'elysia'
  | 'nodejs'
  | 'docker'
  | 'nginx'
  | 'linux'
  | 'postgresql'
  | 'redis'
  | 'tailwind'
  | 'arch'
  | 'c'
  | 'claudecode'
  | 'codex'
  | 'vscode'
  | 'git'
  | 'github'
  | 'vim'
  | 'photoshop';

export interface HomeTechStackItem {
  key: HomeTechStackKey;
  label: string;
}

export interface HomeIntroPanelConfig {
  facts: HomeIntroFactItem[];
  techStack: HomeTechStackItem[];
  hobbies: string[];
}
