import { describe, it, expect } from 'vitest';
import { scopeToType, resolveScope, resolveSearchTypes } from '../../src/utils/searchScope';

describe('searchScope helper (S121 scope→request-type mapping)', () => {
  it('maps the explicit scope values to the backend post-type filter', () => {
    expect(scopeToType('pages')).toBe('page');
    expect(scopeToType('posts')).toBe('post');
    expect(scopeToType('both')).toBeUndefined();
  });

  it('defaults to "both" (no type filter) when scope is missing or unknown', () => {
    expect(scopeToType(undefined)).toBeUndefined();
    expect(scopeToType(null)).toBeUndefined();
    expect(scopeToType('nonsense' as unknown as 'both')).toBeUndefined();
  });

  it('derives scope from the legacy `type` field when scope is absent', () => {
    // legacy SearchResults config used a free-text `type` (page|post|"").
    expect(scopeToType(undefined, 'page')).toBe('page');
    expect(scopeToType(undefined, 'post')).toBe('post');
    expect(scopeToType(undefined, '')).toBeUndefined();
    expect(scopeToType(undefined, 'article')).toBeUndefined();
  });

  it('prefers an explicit scope over the legacy type', () => {
    expect(scopeToType('both', 'page')).toBeUndefined();
    expect(scopeToType('posts', 'page')).toBe('post');
  });

  it('resolveScope normalises scope/legacy into a canonical scope value', () => {
    expect(resolveScope('pages')).toBe('pages');
    expect(resolveScope(undefined, 'post')).toBe('posts');
    expect(resolveScope(undefined, undefined)).toBe('both');
  });
});

describe('resolveSearchTypes (multi-type scope for SearchResults)', () => {
  it('returns the configured types array when non-empty', () => {
    expect(resolveSearchTypes({ types: ['page', 'post'] })).toEqual(['page', 'post']);
  });

  it('returns an empty array when `types` is absent', () => {
    expect(resolveSearchTypes({})).toEqual([]);
    expect(resolveSearchTypes({ types: undefined })).toEqual([]);
  });

  it('returns an empty array when `types` is an empty array', () => {
    expect(resolveSearchTypes({ types: [] })).toEqual([]);
  });

  it('drops blank/whitespace entries and trims survivors', () => {
    expect(resolveSearchTypes({ types: [' page ', '', '  ', 'post'] })).toEqual([
      'page',
      'post',
    ]);
  });
});
