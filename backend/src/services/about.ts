import type { DatabaseContext } from '../db/client';
import type { ApiAboutPayload } from '../types/api';

const DEFAULT_ABOUT_MARKDOWN = '# 关于\n\n内容建设中。';

export function getAboutMarkdown(context: DatabaseContext): string {
  const row = context.sqlite
    .query('SELECT markdown FROM about_page WHERE id = 1 LIMIT 1')
    .get() as { markdown: string } | null;

  if (!row) {
    const now = new Date().toISOString();
    context.sqlite
      .query('INSERT INTO about_page (id, markdown, updated_at) VALUES (1, ?, ?)')
      .run(DEFAULT_ABOUT_MARKDOWN, now);

    return DEFAULT_ABOUT_MARKDOWN;
  }

  return row.markdown;
}

export function updateAboutMarkdown(context: DatabaseContext, markdown: string): { markdown: string } {
  const normalizedMarkdown = markdown.trim();

  if (!normalizedMarkdown) {
    throw new Error('markdown 不能为空');
  }

  context.sqlite
    .query(`
      INSERT INTO about_page (id, markdown, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        markdown = excluded.markdown,
        updated_at = excluded.updated_at
    `)
    .run(normalizedMarkdown, new Date().toISOString());

  return {
    markdown: normalizedMarkdown
  };
}

function ensureAboutRow(context: DatabaseContext): void {
  const row = context.sqlite
    .query('SELECT id FROM about_page WHERE id = 1')
    .get() as { id: number } | null;

  if (!row) {
    context.sqlite
      .query('INSERT INTO about_page (id, markdown, updated_at) VALUES (1, ?, ?)')
      .run(DEFAULT_ABOUT_MARKDOWN, new Date().toISOString());
  }
}

export function getAbout(context: DatabaseContext): ApiAboutPayload {
  ensureAboutRow(context);

  const row = context.sqlite
    .query(`SELECT hero_title, hero_subtitle, intro_paragraphs, narrative_sections, timeline_title, timeline_events FROM about_page WHERE id = 1`)
    .get() as {
      hero_title: string;
      hero_subtitle: string;
      intro_paragraphs: string;
      narrative_sections: string;
      timeline_title: string;
      timeline_events: string;
    } | null;

  const parse = (json: string, fallback: unknown) => {
    try { return JSON.parse(json); }
    catch { return fallback; }
  };

  return {
    heroTitle: row?.hero_title ?? '',
    heroSubtitle: row?.hero_subtitle ?? '',
    introParagraphs: parse(row?.intro_paragraphs ?? '[]', []) as string[],
    narrativeSections: parse(row?.narrative_sections ?? '[]', []) as ApiAboutPayload['narrativeSections'],
    timelineTitle: row?.timeline_title ?? '',
    timelineLabel: row?.timeline_title ?? '',
    timelineEvents: parse(row?.timeline_events ?? '[]', []) as ApiAboutPayload['timelineEvents']
  };
}

export function updateAbout(context: DatabaseContext, payload: ApiAboutPayload): ApiAboutPayload {
  const heroTitle = (payload.heroTitle ?? '').trim();
  const heroSubtitle = (payload.heroSubtitle ?? '').trim();
  const introParagraphs = Array.isArray(payload.introParagraphs) ? payload.introParagraphs : [];
  const narrativeSections = Array.isArray(payload.narrativeSections) ? payload.narrativeSections : [];
  const timelineTitle = (payload.timelineTitle ?? '').trim();
  const timelineLabel = payload.timelineLabel ?? 'Milestones';
  const timelineEvents = Array.isArray(payload.timelineEvents) ? payload.timelineEvents : [];

  if (!heroTitle) {
    throw new Error('Hero 标题不能为空');
  }

  context.sqlite
    .query(`
      INSERT INTO about_page (id, hero_title, hero_subtitle, intro_paragraphs, narrative_sections, timeline_title, timeline_events, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        hero_title = excluded.hero_title,
        hero_subtitle = excluded.hero_subtitle,
        intro_paragraphs = excluded.intro_paragraphs,
        narrative_sections = excluded.narrative_sections,
        timeline_title = excluded.timeline_title,
        timeline_events = excluded.timeline_events,
        updated_at = excluded.updated_at
    `)
    .run(
      heroTitle,
      heroSubtitle,
      JSON.stringify(introParagraphs),
      JSON.stringify(narrativeSections),
      timelineTitle,
      JSON.stringify(timelineEvents),
      new Date().toISOString()
    );

  return { heroTitle, heroSubtitle, introParagraphs, narrativeSections, timelineTitle, timelineLabel, timelineEvents };
}
