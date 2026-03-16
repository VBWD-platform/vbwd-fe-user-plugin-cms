<template>
  <!-- Vue component widget: rendered from registry by component name -->
  <component
    :is="resolvedVueComponent"
    v-if="widget.widget_type === 'vue-component' && resolvedVueComponent"
    v-bind="(widget.content_json as any)?.props || {}"
    :config="{ ...(widget.config ?? {}), widget_slug: widget.slug }"
    class="cms-widget cms-widget--vue"
  />
  <div
    v-else-if="widget.widget_type === 'vue-component'"
    class="cms-widget cms-widget--vue cms-widget--vue-missing"
  />

  <!-- HTML widget: decoded from content_json.content (base64) + source_css -->
  <div
    v-if="widget.widget_type === 'html'"
    ref="htmlWidgetEl"
    class="cms-widget cms-widget--html"
  >
    <!-- eslint-disable-next-line vue/no-v-html -->
    <component
      :is="'style'"
      v-if="widgetCss"
    >
      {{ widgetCss }}
    </component>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-html="widgetHtml" />
  </div>

  <!-- Menu widget: render as nav (supports source_css for full burger-menu styling) -->
  <nav
    v-else-if="widget.widget_type === 'menu'"
    class="cms-widget cms-widget--menu"
    :class="widget.slug ? `cms-widget--${widget.slug}` : ''"
  >
    <component
      :is="'style'"
      v-if="widgetCss"
    >
      {{ widgetCss }}
    </component>
    <button
      class="cms-burger"
      :class="{ 'cms-burger--open': menuOpen }"
      type="button"
      aria-label="Toggle menu"
      @click="menuOpen = !menuOpen"
    >
      <span /><span /><span />
    </button>
    <div
      class="cms-menu-overlay"
      :class="{ 'cms-menu-overlay--open': menuOpen }"
      @click="menuOpen = false"
    />
    <ul
      class="cms-menu"
      :class="{ 'cms-menu--open': menuOpen }"
    >
      <li
        v-for="item in rootItems"
        :key="item.id"
        class="cms-menu__item"
        :class="{ 'cms-menu__item--has-children': childrenOf(item.id).length > 0 }"
      >
        <a
          :href="childrenOf(item.id).length ? '#' : itemHref(item)"
          :target="item.target || '_self'"
          class="cms-menu__link"
          @click="childrenOf(item.id).length ? toggleSub($event, item.id) : undefined"
        >
          {{ item.label }}
          <span
            v-if="childrenOf(item.id).length"
            class="cms-menu__arrow"
            :class="{ 'cms-menu__arrow--open': openSubs.includes(item.id) }"
          >▾</span>
        </a>
        <ul
          v-if="childrenOf(item.id).length"
          class="cms-menu__sub"
          :class="{ 'cms-menu__sub--open': openSubs.includes(item.id) }"
        >
          <li
            v-for="child in childrenOf(item.id)"
            :key="child.id"
            class="cms-menu__item"
          >
            <a
              :href="itemHref(child)"
              :target="child.target || '_self'"
              class="cms-menu__link"
            >
              {{ child.label }}
            </a>
          </li>
        </ul>
      </li>
    </ul>
  </nav>

  <!-- Slideshow widget: simple image carousel -->
  <div
    v-else-if="widget.widget_type === 'slideshow'"
    class="cms-widget cms-widget--slideshow"
  >
    <div
      v-if="!slideshowImages.length"
      class="cms-slideshow--empty"
    />
    <div
      v-else
      class="cms-slideshow"
    >
      <div
        v-for="(img, idx) in slideshowImages"
        :key="idx"
        class="cms-slide"
        :class="{ 'cms-slide--active': idx === activeSlide }"
      >
        <img
          :src="img.url"
          :alt="img.alt || ''"
          class="cms-slide__img"
        >
        <p
          v-if="img.caption"
          class="cms-slide__caption"
        >
          {{ img.caption }}
        </p>
      </div>
      <button
        v-if="slideshowImages.length > 1"
        class="cms-slide__prev"
        type="button"
        @click="prevSlide"
      >
        ‹
      </button>
      <button
        v-if="slideshowImages.length > 1"
        class="cms-slide__next"
        type="button"
        @click="nextSlide"
      >
        ›
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { Component } from 'vue';
import type { CmsWidgetData, CmsMenuItemData } from '../stores/useCmsStore';
import { resolveCmsVueComponent } from '../registry/vueComponentRegistry';

const resolvedVueComponent = computed<Component | undefined>(() => {
  if (props.widget.widget_type !== 'vue-component') return undefined;
  // Support both storage conventions: content_json.component (canonical) and config.component_name (legacy)
  const name = (props.widget.content_json as any)?.component
    ?? (props.widget.config as any)?.component_name;
  return name ? resolveCmsVueComponent(name) : undefined;
});

const props = defineProps<{
  widget: CmsWidgetData;
}>();

// ── HTML widget helpers ────────────────────────────────────────────────────────

const htmlWidgetEl = ref<HTMLElement | null>(null);

const widgetHtml = computed(() => {
  const b64 = (props.widget.content_json as any)?.content;
  if (!b64) return '';
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return b64;
  }
});

// Re-execute <script> tags that v-html silently drops
function runScripts(container: HTMLElement) {
  container.querySelectorAll('script').forEach(old => {
    const s = document.createElement('script');
    if (old.src) {
      Array.from(old.attributes).forEach(a => s.setAttribute(a.name, a.value));
    } else {
      s.textContent = old.textContent;
    }
    old.replaceWith(s);
  });
}

// onMounted handles the initial render (immediate watch fires before DOM exists)
onMounted(async () => {
  await nextTick();
  if (htmlWidgetEl.value) runScripts(htmlWidgetEl.value);
});

// watch handles subsequent content changes (e.g. widget updated while page is open)
watch(widgetHtml, async () => {
  await nextTick();
  if (htmlWidgetEl.value) runScripts(htmlWidgetEl.value);
});

const widgetCss = computed(() => props.widget.source_css ?? '');

// ── Menu helpers ───────────────────────────────────────────────────────────────

const menuItems = computed<CmsMenuItemData[]>(() => props.widget.menu_items ?? []);
const rootItems = computed(() => menuItems.value.filter(i => !i.parent_id));
const menuOpen = ref(false);
const openSubs = ref<string[]>([]);

function childrenOf(parentId: string) {
  return menuItems.value.filter(i => i.parent_id === parentId);
}

function itemHref(item: CmsMenuItemData) {
  if (item.url) return item.url;
  if (item.page_slug) return `/${item.page_slug}`;
  return '#';
}

function toggleSub(e: Event, id: string) {
  e.preventDefault();
  const idx = openSubs.value.indexOf(id);
  if (idx > -1) openSubs.value.splice(idx, 1);
  else openSubs.value.push(id);
}

function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') { menuOpen.value = false; openSubs.value = []; } }
function onDocClick(e: MouseEvent) {
  const nav = (e.target as Element).closest('.cms-widget--menu');
  if (!nav) { openSubs.value = []; menuOpen.value = false; }
}
onMounted(() => { document.addEventListener('keydown', onEsc); document.addEventListener('click', onDocClick); });
onUnmounted(() => { document.removeEventListener('keydown', onEsc); document.removeEventListener('click', onDocClick); });

// ── Slideshow helpers ──────────────────────────────────────────────────────────

const slideshowImages = computed<{ url: string; alt: string; caption: string }[]>(() => {
  const images = (props.widget.content_json as any)?.images;
  if (!Array.isArray(images)) return [];
  return images.map((i: any) => ({ url: i.url ?? '', alt: i.alt ?? '', caption: i.caption ?? '' }));
});

const activeSlide = ref(0);
function prevSlide() {
  activeSlide.value = (activeSlide.value - 1 + slideshowImages.value.length) % slideshowImages.value.length;
}
function nextSlide() {
  activeSlide.value = (activeSlide.value + 1) % slideshowImages.value.length;
}
</script>

<!-- Global defaults for menu widgets.
     These are intentionally non-scoped so widget source_css (injected later
     in the body) can override them at the same specificity via cascade order. -->
<style>
/* ── Base: shared across all screen sizes ─────────────────── */
.cms-widget--menu { display: flex; align-items: center; position: relative; z-index: 200; }
.cms-menu { list-style: none; margin: 0; padding: 0; }
.cms-menu__item { position: relative; }
.cms-menu__link { display: flex; align-items: center; gap: 0.25rem; padding: 0.5rem 1rem; color: inherit; text-decoration: none; font-weight: 500; white-space: nowrap; cursor: pointer; user-select: none; }
.cms-menu__link:hover { opacity: 0.75; }
.cms-menu__sub { display: none; list-style: none; margin: 0; padding: 0.25rem 0; }
.cms-menu__sub--open { display: block; }
.cms-menu__sub .cms-menu__link { padding: 0.45rem 1rem; font-size: 0.9rem; }
.cms-menu__arrow { font-size: 0.7rem; opacity: 0.55; transition: transform 0.2s; display: inline-block; }
.cms-menu__arrow--open { transform: rotate(180deg); }

/* Burger spans */
.cms-burger { background: transparent; border: none; cursor: pointer; padding: 6px; border-radius: 6px; color: inherit; display: none; flex-direction: column; justify-content: center; gap: 5px; width: 40px; height: 40px; flex-shrink: 0; }
.cms-burger span { display: block; width: 22px; height: 2px; background: currentColor; border-radius: 2px; transition: transform 0.25s, opacity 0.2s; transform-origin: center; }
.cms-burger--open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
.cms-burger--open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
.cms-burger--open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

/* Overlay */
.cms-menu-overlay { display: none; }
.cms-menu-overlay--open { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 250; }

/* ── Desktop: horizontal row ──────────────────────────────── */
@media (min-width: 769px) {
  .cms-menu { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; }
  .cms-menu__sub { position: absolute; top: 100%; left: 0; background: var(--color-surface, #fff); border: 1px solid var(--color-border, #e5e7eb); border-radius: 6px; min-width: 160px; z-index: 300; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
}

/* ── Mobile: burger drawer ────────────────────────────────── */
@media (max-width: 768px) {
  .cms-burger { display: flex; }
  .cms-menu { display: flex; flex-direction: column; align-items: stretch; position: fixed; top: 0; right: -100%; width: min(300px, 85vw); height: 100dvh; background: var(--color-bg, #fff); padding: 4rem 0 2rem; overflow-y: auto; z-index: 300; transition: right 0.28s ease; box-shadow: -4px 0 20px rgba(0,0,0,0.15); }
  .cms-menu--open { right: 0; }
  .cms-menu__item { position: static; border-bottom: 1px solid var(--color-border, #e5e7eb); }
  .cms-menu__link { padding: 0.9rem 1.5rem; font-size: 1rem; justify-content: space-between; white-space: normal; }
  .cms-menu__sub { position: static; box-shadow: none; border: none; border-radius: 0; max-height: 0; overflow: hidden; display: block; transition: max-height 0.25s ease; }
  .cms-menu__sub--open { max-height: 400px; }
  .cms-menu__sub .cms-menu__link { padding-left: 2.5rem; font-size: 0.9rem; opacity: 0.85; }
}
</style>

<style scoped>
.cms-widget--html { width: 100%; }
/* Menu scoped — structural containment only */
.cms-widget--menu { width: 100%; }
.cms-menu { list-style: none; margin: 0; padding: 0; }
.cms-menu__sub { list-style: none; margin: 0; padding: 0; }

/* Slideshow */
.cms-slideshow { position: relative; overflow: hidden; }
.cms-slide { display: none; }
.cms-slide--active { display: block; }
.cms-slide__img { width: 100%; height: auto; display: block; }
.cms-slide__caption { text-align: center; font-size: 0.875rem; padding: 0.5rem; opacity: 0.7; }
.cms-slide__prev,
.cms-slide__next { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.4); color: #fff; border: none; font-size: 2rem; cursor: pointer; padding: 0.25rem 0.75rem; border-radius: 3px; line-height: 1; }
.cms-slide__prev { left: 0.5rem; }
.cms-slide__next { right: 0.5rem; }
</style>
