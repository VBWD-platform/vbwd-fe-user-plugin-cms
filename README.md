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

---

## Related

| | Repository |
|-|------------|
| 🖥 Backend | [vbwd-plugin-cms](https://github.com/VBWD-platform/vbwd-plugin-cms) |
| 🛠 Frontend (admin) | [vbwd-fe-admin-plugin-cms](https://github.com/VBWD-platform/vbwd-fe-admin-plugin-cms) |

**Core:** [vbwd-fe-user](https://github.com/VBWD-platform/vbwd-fe-user) · [vbwd-fe-core](https://github.com/VBWD-platform/vbwd-fe-core)
