/**
 * Shared reader for the three per-widget archive display toggles.
 *
 * Every post-archive widget (PostArchive, TermArchive, Category/PostTermList,
 * TagArchive, SearchResults) stores three booleans in its config —
 * `show_categories`, `show_tags`, `show_article_size` — each defaulting ON.
 * This single helper maps those snake_case config keys onto the camelCase
 * `display` contract that PostList → PostCard consume, so the toggles behave
 * identically on every widget (DRY spine; single source of truth).
 *
 * Absence (or any non-`false` value) means the feature is shown — so existing
 * widgets that predate these keys keep rendering categories, tags and reading
 * time exactly as before.
 */
export interface ArchiveDisplayToggles {
  showCategories: boolean;
  showTags: boolean;
  showArticleSize: boolean;
}

interface ArchiveToggleConfig {
  show_categories?: unknown;
  show_tags?: unknown;
  show_article_size?: unknown;
}

export function readArchiveToggles(
  config: ArchiveToggleConfig | null | undefined,
): ArchiveDisplayToggles {
  return {
    showCategories: config?.show_categories !== false,
    showTags: config?.show_tags !== false,
    showArticleSize: config?.show_article_size !== false,
  };
}
