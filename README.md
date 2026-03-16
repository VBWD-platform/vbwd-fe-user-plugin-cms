# cms (fe-user plugin)

Renders CMS pages, layouts, and widgets fetched from the backend CMS API.

## Routes

| Path | Component |
|------|-----------|
| `/:slug` | CMS page renderer (dynamic slug at root) |

## Store

`src/stores/useCmsStore.ts` — fetches categories, pages, layouts, styles, and widget assignments.

## Key components

- `CmsLayoutRenderer.vue` — renders a full layout with widget areas
- `CmsWidgetRenderer.vue` — dispatches to html/menu/slideshow/vue-component widgets

## Backend counterpart

`vbwd-backend/plugins/cms/` — `/api/v1/cms/*`

## Admin counterpart

`vbwd-fe-admin/plugins/cms-admin/`
