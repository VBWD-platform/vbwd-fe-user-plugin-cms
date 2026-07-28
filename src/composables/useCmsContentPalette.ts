import { computed, type ComputedRef } from 'vue';
import { useCmsStore } from '../stores/useCmsStore';

/**
 * Theme-aware CMS content palette.
 *
 * CMS content pages render server-generated markup wrapped in `.vbwd-page`,
 * whose CSS derives its border/surface roles from the CMS theme's `--color-*`
 * tokens (declared at `:root` in the resolved style — e.g. the default light
 * theme's `--color-border: #e2e8f0`). But the fe-user theme-switcher applies
 * its active preset as INLINE styles on `<html>` (including a legacy Tarot
 * `--color-border: #dddddd`). An inline declaration on `<html>` outranks the
 * CMS style's `:root` rule, so CMS content inherits the wrong border.
 *
 * The fix keeps the global `<html>` token intact (Tarot / app chrome depend on
 * it) and instead re-asserts the CMS theme's OWN `--color-*` palette on the CMS
 * content wrapper element. A custom property declared directly on the wrapper
 * beats the value inherited from `<html>`, so the `.vbwd-page` subtree resolves
 * `--color-border` from the CMS theme again — for the light default (#e2e8f0)
 * AND any dark theme (which declares its own darker border). Nothing hardcoded.
 */

// A rule whose selector list includes `:root`; capture only its declaration body.
const ROOT_RULE_PATTERN = /(?:^|})[^{}]*:root[^{}]*\{([^}]*)\}/g;
// A single `--color-*` custom-property declaration inside a rule body.
const COLOR_TOKEN_PATTERN = /(--color-[\w-]+)\s*:\s*([^;]+);?/g;

/**
 * Parse the `--color-*` custom properties declared at `:root` in a resolved CMS
 * style CSS string. Only the theme's colour palette is lifted; the
 * `.vbwd-page`-scoped `--vbwd-*` roles (which derive FROM this palette) are left
 * alone. Returns an inline-style object ready to bind on the content wrapper.
 */
export function extractCmsContentPalette(
  styleCss: string | null | undefined,
): Record<string, string> {
  const palette: Record<string, string> = {};
  if (!styleCss) return palette;

  ROOT_RULE_PATTERN.lastIndex = 0;
  let ruleMatch: RegExpExecArray | null;
  while ((ruleMatch = ROOT_RULE_PATTERN.exec(styleCss)) !== null) {
    const ruleBody = ruleMatch[1];
    COLOR_TOKEN_PATTERN.lastIndex = 0;
    let declarationMatch: RegExpExecArray | null;
    while ((declarationMatch = COLOR_TOKEN_PATTERN.exec(ruleBody)) !== null) {
      palette[declarationMatch[1]] = declarationMatch[2].trim();
    }
  }
  return palette;
}

/**
 * Reactive CMS content palette derived from the store's currently resolved
 * style CSS. Bind the returned object as `:style` on the CMS content wrapper
 * element so the theme palette wins within the CMS subtree.
 */
export function useCmsContentPalette(): ComputedRef<Record<string, string>> {
  const store = useCmsStore();
  return computed(() => extractCmsContentPalette(store.currentStyleCss));
}
