/**
 * Generic current-crumb label override seam for the CMS breadcrumb.
 *
 * Any CMS page or widget can set the display label for the CURRENT breadcrumb
 * crumb without changing the URL (e.g. a detail page whose URL only carries a
 * slug, but which wants to show the real entity name). Overrides are keyed by
 * route path so a label set on one page never leaks onto another.
 */
import { reactive } from 'vue';

const breadcrumbLabelOverrides = reactive<Record<string, string>>({});

export function setBreadcrumbLabel(path: string, label: string): void {
  breadcrumbLabelOverrides[path] = label;
}

export function clearBreadcrumbLabel(path: string): void {
  delete breadcrumbLabelOverrides[path];
}

export function getBreadcrumbLabel(path: string): string | undefined {
  return breadcrumbLabelOverrides[path];
}

export function useBreadcrumbLabel() {
  return { setBreadcrumbLabel, clearBreadcrumbLabel, getBreadcrumbLabel };
}
