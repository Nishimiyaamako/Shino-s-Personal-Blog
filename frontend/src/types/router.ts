export type RouteParams = Record<string, string>;

export interface PageRenderContext {
  params: RouteParams;
  pathname: string;
}

export type PageRenderer = (context: PageRenderContext) => string;

export interface RouteRecord {
  path: string;
  title: string;
  render: PageRenderer;
}
