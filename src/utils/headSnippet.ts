/**
 * Layout `<head>` snippet element-builder.
 *
 * An admin attaches a raw HTML blob to a CMS layout (see the layout editor's
 * "<head>" block). Every page using that layout injects the blob before
 * `</head>`. The blob may carry `<script>`, `<style>`, `<meta>`, `<link>`, etc.
 *
 * A `<script>` injected as parsed markup (via `innerHTML` / `v-html`) is NEVER
 * executed by the browser, so — exactly like `buildCustomCodeScripts` in
 * `customCode.ts` — we parse the blob and rebuild each top-level `<script>`
 * programmatically (inline body → `textContent`, external → real `src` element,
 * every attribute copied), while non-script nodes (`<style>`, `<meta>`,
 * `<link>`, …) are cloned as-is.
 *
 * Single responsibility + DI: the caller passes a `documentTarget` (the real
 * `document` in the app, a happy-dom document in tests) so the builder is
 * trivially testable without touching the global document.
 */

/**
 * Parse a raw HTML blob and return the top-level nodes to append to `<head>` in
 * the given document. `<script>` elements are rebuilt so they execute; every
 * other node is deep-cloned into the target document unchanged. Returns an empty
 * array for empty / missing input (no crash).
 */
export function buildHeadSnippetNodes(
  documentTarget: Document,
  rawHtml: string | null | undefined,
): Node[] {
  if (!rawHtml || !rawHtml.trim()) return [];

  const template = documentTarget.createElement('template');
  template.innerHTML = rawHtml;

  const builtNodes: Node[] = [];
  template.content.childNodes.forEach((node) => {
    if (isScriptElement(node)) {
      builtNodes.push(rebuildScript(documentTarget, node));
    } else {
      builtNodes.push(node.cloneNode(true));
    }
  });
  return builtNodes;
}

function isScriptElement(node: Node): node is HTMLScriptElement {
  return node.nodeType === 1 && (node as Element).tagName === 'SCRIPT';
}

/**
 * Rebuild one parsed (inert) `<script>` into an executable element in the target
 * document, copying every attribute so `src`, `async`, `defer`, `type`, `nonce`,
 * data-* etc. are preserved. Inline bodies are copied via `textContent`.
 */
function rebuildScript(
  documentTarget: Document,
  parsed: HTMLScriptElement,
): HTMLScriptElement {
  const script = documentTarget.createElement('script');
  for (const attribute of Array.from(parsed.attributes)) {
    script.setAttribute(attribute.name, attribute.value);
  }
  if (!parsed.getAttribute('src')) {
    script.textContent = parsed.textContent;
  }
  return script;
}
