import { HOME_INTRO_PANEL_CONFIG } from '../data/home-intro-panel';
import type { IconifyIcon } from '@iconify/types';
import { HOME_TECH_ICONIFY_DEFAULT_SIZE, HOME_TECH_ICONIFY_MAP } from '../data/home-tech-iconify';
import {
	siArchlinux,
	siBlender,
	siBun,
	siC,
	siClaude,
	siCloudflare,
	siCss,
	siDocker,
	siGit,
	siGithub,
	siHtml5,
	siJavascript,
	siLinux,
	siNginx,
	siNodedotjs,
	siOllama,
	siPostgresql,
	siRedis,
	siRust,
	siTailwindcss,
	siTypescript,
	siVim,
	siVite
} from 'simple-icons';
import type { SimpleIcon } from 'simple-icons';
import elysiaIconRaw from '../assets/icons/elysia.svg?raw';
import comfyuiIconRaw from '../assets/icons/comfyui.svg?raw';
import type { HomeTechStackItem, HomeTechStackKey } from '../types/home-intro-panel';
import { escapeHtml } from '../utils/escape-html';

const DEFAULT_ICON_WIDTH = HOME_TECH_ICONIFY_DEFAULT_SIZE.width;
const DEFAULT_ICON_HEIGHT = HOME_TECH_ICONIFY_DEFAULT_SIZE.height;

const TECH_ICONIFY_MAP: Partial<Record<HomeTechStackKey, IconifyIcon>> = {
	...HOME_TECH_ICONIFY_MAP,
	elysia: createIconFromRawSvg(elysiaIconRaw),
	comfyui: createIconFromRawSvg(comfyuiIconRaw),
};

const TECH_GLYPH_FALLBACK_MAP: Record<HomeTechStackKey, string> = {
	typescript: 'TS',
	html5: 'H5',
	css3: 'C3',
	javascript: 'JS',
	rust: 'RS',
	cloudflare: 'CF',
	blender: 'BL',
	comfyui: 'CU',
	ollama: 'OL',
	vite: 'VT',
	bun: 'BN',
	elysia: 'EL',
	nodejs: 'ND',
	docker: 'DK',
	nginx: 'NX',
	linux: 'LX',
	postgresql: 'PG',
	redis: 'RD',
	tailwind: 'TW',
	arch: 'AR',
	c: 'C',
	claudecode: 'CL',
	codex: 'CX',
	vscode: 'VS',
	git: 'GT',
	github: 'GH',
	vim: 'VM',
	photoshop: 'PS'
};

const TECH_SIMPLE_ICON_FALLBACK_MAP: Partial<Record<HomeTechStackKey, SimpleIcon>> = {
	typescript: siTypescript,
	html5: siHtml5,
	css3: siCss,
	javascript: siJavascript,
	rust: siRust,
	cloudflare: siCloudflare,
	blender: siBlender,
	ollama: siOllama,
	vite: siVite,
	bun: siBun,
	elysia: siBun,
	nodejs: siNodedotjs,
	docker: siDocker,
	nginx: siNginx,
	linux: siLinux,
	postgresql: siPostgresql,
	redis: siRedis,
	tailwind: siTailwindcss,
	arch: siArchlinux,
	c: siC,
	claudecode: siClaude,
	git: siGit,
	github: siGithub,
	vim: siVim
};

interface RenderableTechStackItem extends HomeTechStackItem {
	isFill?: boolean;
}

const TECH_STACK_FILL_ITEM: RenderableTechStackItem = {
	key: 'html5',
	label: 'HTML5',
	isFill: true
};

export function renderHomeIntroPanel(): string {
	const { facts, techStack, hobbies } = HOME_INTRO_PANEL_CONFIG;

	return `
<section class="home-intro-panel page-section" aria-label="个人信息展示板">
  <div class="home-intro-panel-grid">
    <dl class="home-intro-fact-list" aria-label="基础信息">
      ${facts
			.map(
				(item) => `
        <div class="home-intro-fact-row">
          <dt>${escapeHtml(item.label)}</dt>
          <dd>${escapeHtml(item.value)}</dd>
        </div>`
			)
			.join('')}
    </dl>

    <div class="home-intro-side">
      <section class="home-intro-tech" aria-label="掌握技术栈">
        <p class="home-intro-side-title">Tech Stack · 技术栈</p>
        ${renderTechStackWindow(techStack)}
      </section>

      <section class="home-intro-hobby" aria-label="爱好">
        <p class="home-intro-side-title">Hobbies · 爱好</p>
        <ul class="home-intro-hobby-list">
          ${hobbies
			.map(
				(hobby) =>
					`<li class="home-intro-hobby-item"><span>${escapeHtml(hobby)}</span></li>`
			)
			.join('')}
        </ul>
      </section>
    </div>
  </div>
</section>
`;
}

function renderTechStackWindow(techStack: HomeTechStackItem[]): string {
	if (!techStack.length) {
		return '<p class="empty-hint">技术栈正在整理中。</p>';
	}

	const { topRow, bottomRow } = splitTechStackIntoDualRows(techStack);

	return `
<div class="home-intro-tech-window" role="region" aria-label="技术栈循环窗口">
  <div class="home-intro-tech-marquee">
    ${renderTechStackRow(topRow)}
    ${renderTechStackRow(bottomRow, { linked: true })}
  </div>
</div>`;
}

function splitTechStackIntoDualRows(
	techStack: HomeTechStackItem[]
): { topRow: RenderableTechStackItem[]; bottomRow: RenderableTechStackItem[] } {
	const topRow: RenderableTechStackItem[] = [];
	const bottomRow: RenderableTechStackItem[] = [];

	techStack.forEach((stack, index) => {
		const targetRow = index % 2 === 0 ? topRow : bottomRow;
		targetRow.push(stack);
	});

	if (topRow.length === bottomRow.length) {
		return { topRow, bottomRow };
	}

	if (topRow.length > bottomRow.length) {
		bottomRow.push(TECH_STACK_FILL_ITEM);
	} else {
		topRow.push(TECH_STACK_FILL_ITEM);
	}

	return { topRow, bottomRow };
}

function renderTechStackRow(
	techStack: RenderableTechStackItem[],
	options: { linked?: boolean } = {}
): string {
	const rowClassName = options.linked ? ' home-intro-tech-row--linked' : '';

	return `
<div class="home-intro-tech-row${rowClassName}">
  <div class="home-intro-tech-track">
    ${renderTechStackList(techStack)}
    ${renderTechStackList(techStack, { clone: true })}
  </div>
</div>`;
}

function renderTechStackList(techStack: RenderableTechStackItem[], options: { clone?: boolean } = {}): string {
	const cloneAttr = options.clone ? ' aria-hidden="true"' : '';

	return `
<ul class="home-intro-tech-list"${cloneAttr}>
  ${techStack
			.map(
				(stack) => `
    <li class="home-intro-tech-item"${stack.isFill ? ' data-tech-fill="true" aria-hidden="true"' : ''}>
      <span class="home-intro-tech-badge" data-tech="${escapeHtml(stack.key)}" title="${escapeHtml(stack.label)}">
        ${renderTechStackIcon(stack.key, stack.label)}
        ${stack.isFill ? '' : `<span class="home-intro-visually-hidden">${escapeHtml(stack.label)}</span>`}
      </span>
    </li>`
			)
			.join('')}
</ul>`;
}

function renderTechStackIcon(key: HomeTechStackKey, label: string): string {
	const iconifyIcon = TECH_ICONIFY_MAP[key];
	if (iconifyIcon) {
		return renderIconifyIcon(iconifyIcon);
	}

	const fallbackIcon = TECH_SIMPLE_ICON_FALLBACK_MAP[key];
	if (fallbackIcon) {
		return `<svg class="home-intro-tech-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="${fallbackIcon.path}" fill="currentColor"></path>
  </svg>`;
	}

	return renderLetterFallback(key, label);
}

function renderIconifyIcon(icon: IconifyIcon): string {
	const left = icon.left ?? 0;
	const top = icon.top ?? 0;
	const width = icon.width ?? DEFAULT_ICON_WIDTH;
	const height = icon.height ?? DEFAULT_ICON_HEIGHT;
	const body = icon.body ?? '';

	return `<svg class="home-intro-tech-icon" viewBox="${left} ${top} ${width} ${height}" aria-hidden="true" focusable="false">
    ${body}
  </svg>`;
}

function renderLetterFallback(key: HomeTechStackKey, label: string): string {
	const fallbackByKey = TECH_GLYPH_FALLBACK_MAP[key];
	const fallbackByLabel = label.slice(0, 2).toUpperCase().replace(/[^A-Z0-9]/g, '');
	const shortLabel = fallbackByKey || fallbackByLabel || 'IX';

	return `<svg class="home-intro-tech-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="1.4"></rect>
    <text x="12" y="15" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor">${escapeHtml(shortLabel)}</text>
  </svg>`;
}

function createIconFromRawSvg(rawSvg: string): IconifyIcon {
	const body = extractSvgBody(rawSvg);
	const viewBox = extractViewBox(rawSvg);

	return {
		body,
		...viewBox
	};
}

function extractSvgBody(rawSvg: string): string {
	const rawBody = rawSvg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '').trim();

	if (!rawBody) {
		return '<rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor"></rect>';
	}

	return rawBody;
}

function extractViewBox(rawSvg: string): Pick<IconifyIcon, 'left' | 'top' | 'width' | 'height'> {
	const matchedViewBox = rawSvg.match(/\bviewBox=["']([^"']+)["']/i)?.[1] ?? '';
	const parts = matchedViewBox
		.split(/[,\s]+/)
		.map((part) => Number.parseFloat(part))
		.filter((part) => Number.isFinite(part));

	if (parts.length === 4) {
		const [left, top, width, height] = parts;
		return { left, top, width, height };
	}

	return {
		left: 0,
		top: 0,
		width: DEFAULT_ICON_WIDTH,
		height: DEFAULT_ICON_HEIGHT
	};
}
