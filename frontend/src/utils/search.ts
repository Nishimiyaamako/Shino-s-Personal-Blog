import type { PostSummary } from '../types/content';
import type { SearchResultItem } from '../types/api';

/**
 * 搜索排序权重配置
 * - 文本相关性: 50% - 基于关键词匹配程度
 * - 发布时间衰减: 25% - 越新的文章得分越高
 * - 内容质量分: 15% - 基于阅读量、点赞数、评论数 (简化版：使用 featuredOrder 作为质量指标)
 * - 权威性/常青度: 10% - 置顶、精选标记
 */

// 时间衰减参数：1年（365天）半衰期
const DECAY_HALF_LIFE_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface SearchablePost extends PostSummary {
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
    isFeatured?: boolean;
}

interface ScoredPost {
    post: SearchablePost;
    relevanceScore: number;
    timeDecayScore: number;
    qualityScore: number;
    authorityScore: number;
    finalScore: number;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 分词：将查询字符串拆分为关键词
 */
function tokenizeQuery(query: string): string[] {
    return query
        .split(/[^\p{L}\p{N}_-]+/u)
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length > 0);
}

/**
 * 计算文本相关性得分 (0-1)
 * 基于关键词在标题和摘要中的匹配情况
 */
function calculateRelevanceScore(post: SearchablePost, tokens: string[]): number {
    if (tokens.length === 0) return 0;

    const title = post.title.toLowerCase();
    const summary = post.summary.toLowerCase();
    const tags = post.tags.map((t) => t.toLowerCase());

    let totalScore = 0;

    for (const token of tokens) {
        let tokenScore = 0;

        // 标题匹配权重最高：完全匹配 1.0，前缀匹配 0.8，包含匹配 0.6
        if (title === token) {
            tokenScore = 1.0;
        } else if (title.startsWith(token)) {
            tokenScore = 0.8;
        } else if (title.includes(token)) {
            tokenScore = 0.6;
        }

        // 摘要匹配：前缀匹配 0.5，包含匹配 0.3
        if (summary.startsWith(token)) {
            tokenScore = Math.max(tokenScore, 0.5);
        } else if (summary.includes(token)) {
            tokenScore = Math.max(tokenScore, 0.3);
        }

        // 标签匹配：完全匹配 0.9
        if (tags.some((tag) => tag === token)) {
            tokenScore = Math.max(tokenScore, 0.9);
        } else if (tags.some((tag) => tag.includes(token))) {
            tokenScore = Math.max(tokenScore, 0.7);
        }

        totalScore += tokenScore;
    }

    // 归一化到 0-1
    return Math.min(1, totalScore / tokens.length);
}

/**
 * 计算时间衰减得分 (0-1)
 * 使用指数衰减公式: score = exp(-ln(2) * days / halfLife)
 */
function calculateTimeDecayScore(dateStr: string): number {
    const publishDate = new Date(dateStr);
    if (Number.isNaN(publishDate.getTime())) return 0;

    const now = new Date();
    const daysSincePublished = (now.getTime() - publishDate.getTime()) / MS_PER_DAY;

    // 指数衰减: 半衰期1年，3年后得分约0.125
    return Math.exp(-Math.LN2 * daysSincePublished / DECAY_HALF_LIFE_DAYS);
}

/**
 * 计算内容质量分 (0-1)
 * 简化版：使用是否有 featuredOrder 作为质量指标
 * 实际项目中可以用 viewCount, likeCount, commentCount
 */
function calculateQualityScore(post: SearchablePost): number {
    // 如果有 featuredOrder，质量分更高
    if (typeof post.featuredOrder === 'number') {
        return 0.5 + (1 / post.featuredOrder) * 0.5;
    }
    return 0.3;
}

/**
 * 计算权威性/常青度得分 (0-1)
 * 置顶文章得1分，其他得0分
 */
function calculateAuthorityScore(post: SearchablePost): number {
    return typeof post.featuredOrder === 'number' ? 1 : 0;
}

/**
 * 计算最终排序得分
 * 权重分配:
 * - 文本相关性: 50%
 * - 时间衰减: 25%
 * - 内容质量: 15%
 * - 权威性: 10%
 */
function calculateFinalScore(
    relevanceScore: number,
    timeDecayScore: number,
    qualityScore: number,
    authorityScore: number
): number {
    return (
        relevanceScore * 0.5 +
        timeDecayScore * 0.25 +
        qualityScore * 0.15 +
        authorityScore * 0.10
    );
}

/**
 * 高亮文本中的匹配关键词
 */
function highlightText(text: string, tokens: string[]): string {
    if (tokens.length === 0) return text;

    const pattern = new RegExp(
        `(${tokens.map((t) => escapeRegExp(t)).join('|')})`,
        'gi'
    );

    return text.replace(pattern, '<mark>$1</mark>');
}

/**
 * 生成搜索结果片段
 */
function generateSnippet(post: SearchablePost, tokens: string[]): string {
    const summary = post.summary;

    if (tokens.length === 0) {
        return summary.length > 150 ? summary.slice(0, 150) + '...' : summary;
    }

    // 查找第一个匹配关键词的位置
    const summaryLower = summary.toLowerCase();
    let firstMatchIndex = -1;

    for (const token of tokens) {
        const index = summaryLower.indexOf(token.toLowerCase());
        if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
            firstMatchIndex = index;
        }
    }

    if (firstMatchIndex === -1) {
        return summary.length > 150 ? summary.slice(0, 150) + '...' : summary;
    }

    // 提取片段，以匹配位置为中心
    const snippetStart = Math.max(0, firstMatchIndex - 60);
    const snippetEnd = Math.min(summary.length, firstMatchIndex + 90);
    let snippet = summary.slice(snippetStart, snippetEnd);

    if (snippetStart > 0) {
        snippet = '...' + snippet;
    }
    if (snippetEnd < summary.length) {
        snippet = snippet + '...';
    }

    return highlightText(snippet, tokens);
}

/**
 * 本地搜索文章
 * @param posts 文章列表
 * @param query 搜索关键词
 * @param limit 返回结果数量限制
 * @returns 搜索结果列表
 */
export function searchPosts(
    posts: SearchablePost[],
    query: string,
    limit = 10
): SearchResultItem[] {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        return [];
    }

    const tokens = tokenizeQuery(normalizedQuery);

    if (tokens.length === 0) {
        return [];
    }

    // 计算每篇文章的得分
    const scoredPosts: ScoredPost[] = posts.map((post) => {
        const relevanceScore = calculateRelevanceScore(post, tokens);
        const timeDecayScore = calculateTimeDecayScore(post.date);
        const qualityScore = calculateQualityScore(post);
        const authorityScore = calculateAuthorityScore(post);
        const finalScore = calculateFinalScore(
            relevanceScore,
            timeDecayScore,
            qualityScore,
            authorityScore
        );

        return {
            post,
            relevanceScore,
            timeDecayScore,
            qualityScore,
            authorityScore,
            finalScore
        };
    });

    // 按最终得分降序排序
    scoredPosts.sort((a, b) => b.finalScore - a.finalScore);

    // 过滤掉相关性为0的结果，并限制返回数量
    const filteredPosts = scoredPosts
        .filter((sp) => sp.relevanceScore > 0)
        .slice(0, limit);

    if (filteredPosts.length === 0) {
        return [];
    }

    // 转换为 SearchResultItem 格式
    return filteredPosts.map((sp) => ({
        slug: sp.post.slug,
        title: highlightText(sp.post.title, tokens),
        summary: sp.post.summary,
        tags: sp.post.tags,
        snippet: generateSnippet(sp.post, tokens),
        publishedAt: sp.post.date
    }));
}

/**
 * 简单的模糊匹配搜索（用于降级场景）
 * @param posts 文章列表
 * @param query 搜索关键词
 * @param limit 返回结果数量限制
 * @returns 搜索结果列表
 */
export function fuzzySearchPosts(
    posts: SearchablePost[],
    query: string,
    limit = 10
): SearchResultItem[] {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
        return [];
    }

    const tokens = tokenizeQuery(normalizedQuery);

    // 筛选匹配的文章
    const matchedPosts = posts.filter((post) => {
        const title = post.title.toLowerCase();
        const summary = post.summary.toLowerCase();
        const tags = post.tags.map((t) => t.toLowerCase());

        return (
            title.includes(normalizedQuery) ||
            summary.includes(normalizedQuery) ||
            tags.some((tag) => tag.includes(normalizedQuery))
        );
    });

    if (matchedPosts.length === 0) {
        return [];
    }

    // 计算得分并排序
    const scoredPosts: ScoredPost[] = matchedPosts.map((post) => {
        const relevanceScore = 0.5; // 模糊搜索默认中等相关性
        const timeDecayScore = calculateTimeDecayScore(post.date);
        const qualityScore = calculateQualityScore(post);
        const authorityScore = calculateAuthorityScore(post);
        const finalScore = calculateFinalScore(
            relevanceScore,
            timeDecayScore,
            qualityScore,
            authorityScore
        );

        return {
            post,
            relevanceScore,
            timeDecayScore,
            qualityScore,
            authorityScore,
            finalScore
        };
    });

    scoredPosts.sort((a, b) => b.finalScore - a.finalScore);

    return scoredPosts.slice(0, limit).map((sp) => ({
        slug: sp.post.slug,
        title: highlightText(sp.post.title, tokens),
        summary: sp.post.summary,
        tags: sp.post.tags,
        snippet: generateSnippet(sp.post, tokens),
        publishedAt: sp.post.date
    }));
}
