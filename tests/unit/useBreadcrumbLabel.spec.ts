/**
 * Generic current-crumb label override seam. A CMS page/widget can set the
 * display label for the CURRENT breadcrumb crumb (keyed by route path) without
 * changing the URL. Keying by path prevents a stale label leaking onto another
 * page.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  setBreadcrumbLabel,
  clearBreadcrumbLabel,
  getBreadcrumbLabel,
} from '../../src/composables/useBreadcrumbLabel';

describe('useBreadcrumbLabel — current-crumb override seam', () => {
  beforeEach(() => {
    clearBreadcrumbLabel('/category/backend/tarot');
    clearBreadcrumbLabel('/category/backend/other');
  });

  it('returns the label set for a given path', () => {
    setBreadcrumbLabel('/category/backend/tarot', 'Tarot');
    expect(getBreadcrumbLabel('/category/backend/tarot')).toBe('Tarot');
  });

  it('keys overrides by path so one page does not leak onto another', () => {
    setBreadcrumbLabel('/category/backend/tarot', 'Tarot');
    expect(getBreadcrumbLabel('/category/backend/other')).toBeUndefined();
  });

  it('clears the override for a path', () => {
    setBreadcrumbLabel('/category/backend/tarot', 'Tarot');
    clearBreadcrumbLabel('/category/backend/tarot');
    expect(getBreadcrumbLabel('/category/backend/tarot')).toBeUndefined();
  });
});
