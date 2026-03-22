import { renderPostList } from '../components/post-list';
import { loadPosts } from '../data/posts';
import type { PageRenderer } from '../types/router';

export const renderPostsPage: PageRenderer = () => {
  const posts = loadPosts();

  return `
<section class="page page-posts">
  <div class="post-theme-filter-shell" data-role="post-theme-filter-shell">
    <div class="posts-toolbar" data-role="posts-toolbar">
      <button
        type="button"
        class="post-date-sort-toggle"
        data-role="post-date-sort-toggle"
        aria-pressed="false"
        data-sort-direction="desc"
        aria-label="当前排序：倒序，点击切换为正序"
      >
        <span class="post-date-sort-caption" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" role="presentation">
            <circle cx="12" cy="12" r="8"></circle>
            <path d="M12 8.4V12.2L14.7 14"></path>
          </svg>
        </span>
        <span class="post-date-sort-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" role="presentation">
            <path d="M12 5v14"></path>
            <path d="m7.5 14.5 4.5 4.5 4.5-4.5"></path>
          </svg>
        </span>
      </button>
    </div>
    ${renderPostList(posts, { emptyHint: '暂无已发布文章。', variant: 'posts' })}
    <p class="empty-hint post-theme-empty-hint" data-role="post-theme-empty-hint" hidden>当前主题下暂无已发布文章。</p>
  </div>
</section>
`;
};
