import { describe, it, expect } from 'vitest';
import { buildHeadSnippetNodes } from '../../src/utils/headSnippet';

describe('buildHeadSnippetNodes', () => {
  it('returns [] for empty / nullish input', () => {
    expect(buildHeadSnippetNodes(document, '')).toEqual([]);
    expect(buildHeadSnippetNodes(document, '   ')).toEqual([]);
    expect(buildHeadSnippetNodes(document, null)).toEqual([]);
    expect(buildHeadSnippetNodes(document, undefined)).toEqual([]);
  });

  it('rebuilds an inline <script> into an executable script node with body + attributes preserved', () => {
    const nodes = buildHeadSnippetNodes(
      document,
      '<script type="text/javascript" data-x="1">window.__headRan = 42;</script>',
    );
    const script = nodes.find((n) => (n as Element).tagName === 'SCRIPT') as HTMLScriptElement;
    expect(script).toBeTruthy();
    // A freshly-created element in the target document (not the inert parsed one).
    expect(script.ownerDocument).toBe(document);
    expect(script.getAttribute('type')).toBe('text/javascript');
    expect(script.getAttribute('data-x')).toBe('1');
    expect(script.textContent).toBe('window.__headRan = 42;');
  });

  it('carries src + async/defer for an external <script> and leaves the body empty', () => {
    const nodes = buildHeadSnippetNodes(
      document,
      '<script src="https://cdn.example/a.js" async defer></script>',
    );
    const script = nodes.find((n) => (n as Element).tagName === 'SCRIPT') as HTMLScriptElement;
    expect(script.getAttribute('src')).toBe('https://cdn.example/a.js');
    expect(script.hasAttribute('async')).toBe(true);
    expect(script.hasAttribute('defer')).toBe(true);
    expect(script.textContent === '' || script.textContent === null).toBe(true);
  });

  it('preserves non-script markup (<style>, <meta>) as-is', () => {
    const nodes = buildHeadSnippetNodes(
      document,
      '<style>.x{color:red}</style><meta name="robots" content="noindex">',
    );
    const style = nodes.find((n) => (n as Element).tagName === 'STYLE') as HTMLStyleElement;
    const meta = nodes.find((n) => (n as Element).tagName === 'META') as HTMLMetaElement;
    expect(style).toBeTruthy();
    expect(style.textContent).toBe('.x{color:red}');
    expect(meta).toBeTruthy();
    expect(meta.getAttribute('name')).toBe('robots');
    expect(meta.getAttribute('content')).toBe('noindex');
  });

  it('handles a mixed blob (script + meta together)', () => {
    const nodes = buildHeadSnippetNodes(
      document,
      '<meta name="a" content="b"><script>window.__mixed = 1;</script>',
    );
    const tags = nodes
      .filter((n) => n.nodeType === 1)
      .map((n) => (n as Element).tagName);
    expect(tags).toContain('META');
    expect(tags).toContain('SCRIPT');
  });
});
