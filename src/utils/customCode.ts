/**
 * Custom Code widget element-builder.
 *
 * An admin pastes a raw HTML/JS blob (e.g. the Google gtag analytics block) into
 * the Custom Code widget. A `<script>` injected as parsed markup via
 * `innerHTML` / `v-html` is NEVER executed by the browser, so we parse the blob
 * and rebuild each `<script>` programmatically: inline scripts get their body as
 * `textContent`; external scripts get a real `src` element (+ async/defer flag).
 *
 * Single responsibility + DI: callers pass a `documentTarget` (the real
 * `document` in the app, a happy-dom document in tests) so the builder is
 * trivially testable without touching the global document.
 */

/**
 * Parse a raw HTML/JS blob and return live `<script>` elements built in the given
 * document — inline scripts carry their body in `textContent`, external scripts
 * carry `src` plus any `async` / `defer` flag. Non-script markup is ignored (a
 * Custom Code widget is for executable embeds; visible markup belongs in an HTML
 * widget). Returns an empty array for empty / missing code (no crash).
 */
export function buildCustomCodeScripts(
  documentTarget: Document,
  rawCode: string | null | undefined,
): HTMLScriptElement[] {
  if (!rawCode || !rawCode.trim()) return [];

  const template = documentTarget.createElement('template');
  template.innerHTML = rawCode;
  const parsedScripts = template.content.querySelectorAll('script');

  const builtScripts: HTMLScriptElement[] = [];
  parsedScripts.forEach((parsed) => {
    builtScripts.push(rebuildScript(documentTarget, parsed));
  });
  return builtScripts;
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
