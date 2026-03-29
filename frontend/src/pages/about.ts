import { loadAboutViewModel } from '../data/about';
import type { AboutNarrativeSection, AboutTimelineEvent, AboutViewModel } from '../types/about';
import type { PageRenderer } from '../types/router';
import { escapeHtml } from '../utils/escape-html';

export const renderAboutPage: PageRenderer = () => {
  const viewModel = loadAboutViewModel();

  return `<section class="page page-about" data-role="about-page" data-about-fingerprint="${escapeHtml(viewModel.fingerprint)}">
    ${renderAboutPageBody(viewModel)}
  </section>`;
};

export function renderAboutPageBody(viewModel: AboutViewModel): string {
  const introParagraphs = viewModel.introParagraphs
    .map(
      (paragraph) =>
        `<p class="about-intro-paragraph" data-about-motion="intro-item">${escapeHtml(paragraph)}</p>`
    )
    .join('');

  const narrativeBlocks = viewModel.narrativeSections.map((section) => renderNarrativeSection(section)).join('');
  const timelineItems = viewModel.timelineEvents.map((event) => renderTimelineEvent(event)).join('');
  const journeyParagraphs = viewModel.journeyParagraphs
    .map(
      (paragraph) =>
        `<p class="about-journey-paragraph" data-about-motion="journey-item">${escapeHtml(paragraph)}</p>`
    )
    .join('');

  return `
<header class="about-hero" aria-label="关于页标题">
  <p class="about-eyebrow">About</p>
  <h1>${escapeHtml(viewModel.heroTitle)}</h1>
  <p class="about-subtitle">${escapeHtml(viewModel.heroSubtitle)}</p>
</header>

<section class="about-intro" aria-label="开场说明">
  ${introParagraphs}
</section>

<div class="about-divider" aria-hidden="true"></div>

<section class="about-dialogue" aria-label="左右叙事区">
  <div class="about-dialogue-grid">
    ${narrativeBlocks}
  </div>
</section>

<div class="about-divider" aria-hidden="true"></div>

<section class="about-timeline" aria-label="事件时间线">
  <header class="about-section-head">
    <span class="about-section-label">${escapeHtml(viewModel.timelineLabel)}</span>
    <h2>${escapeHtml(viewModel.timelineTitle)}</h2>
  </header>
  <ol class="about-timeline-list">
    ${timelineItems}
  </ol>
</section>

<div class="about-divider" aria-hidden="true"></div>

<section class="about-journey" aria-label="轨迹叙事">
  <header class="about-section-head">
    <span class="about-section-label">${escapeHtml(viewModel.journeyLabel)}</span>
    <h2>${escapeHtml(viewModel.journeyTitle)}</h2>
  </header>
  <div class="about-journey-copy">
    ${journeyParagraphs}
  </div>
</section>
`;
}

function renderNarrativeSection(section: AboutNarrativeSection): string {
  const itemList = section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  return `
<article
  class="about-story-block is-${section.side}"
  data-about-motion="dialogue-item"
  data-about-side="${section.side}"
  aria-labelledby="about-story-${escapeHtml(section.id)}"
>
  <header class="about-section-head about-section-head--story">
    <span class="about-section-label">${escapeHtml(section.label)}</span>
    <h2 id="about-story-${escapeHtml(section.id)}">${escapeHtml(section.title)}</h2>
  </header>
  <ul class="about-story-list">
    ${itemList}
  </ul>
</article>
`;
}

function renderTimelineEvent(event: AboutTimelineEvent): string {
  return `
<li class="about-timeline-item" data-about-motion="timeline-item">
  <time datetime="${escapeHtml(event.date)}">${escapeHtml(event.date)}</time>
  <p>${escapeHtml(event.detail)}</p>
</li>
`;
}
