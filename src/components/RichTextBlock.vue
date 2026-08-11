<template>
  <div class="cms-richtext-root">
    <!-- eslint-disable vue/no-v-html -->
    <div
      ref="bodyEl"
      class="cms-richtext"
      v-html="html"
      @click="onBodyClick"
    />
    <!-- eslint-enable vue/no-v-html -->

    <!-- Image viewer. Rendered only while open, so the DOM stays clean and the
         keydown/scroll-lock side effects are strictly scoped to its lifetime. -->
    <div
      v-if="active"
      class="cms-lb"
      data-testid="cms-lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="`Image viewer: ${active.alt || 'image'}`"
      @click.self="close"
    >
      <div class="cms-lb__bar">
        <span class="cms-lb__title">{{ active.alt || 'Image' }}</span>
        <span
          class="cms-lb__zooms"
          role="group"
          aria-label="Zoom"
        >
          <button
            v-for="(level, index) in ZOOM_LEVELS"
            :key="level.label"
            type="button"
            class="cms-lb__zoom"
            :class="{ 'is-active': index === zoomIndex }"
            :aria-pressed="index === zoomIndex"
            data-testid="cms-lightbox-zoom"
            @click="zoomIndex = index"
          >{{ level.label }}</button>
        </span>
        <button
          ref="closeEl"
          type="button"
          class="cms-lb__close"
          aria-label="Close image viewer"
          data-testid="cms-lightbox-close"
          @click="close"
        >&times;</button>
      </div>

      <div
        ref="stageEl"
        class="cms-lb__stage"
        :class="{ 'is-pannable': zoomIndex > 0, 'is-dragging': dragging }"
        @pointerdown="startDrag"
        @pointermove="onDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <img
          :src="active.src"
          :alt="active.alt"
          :style="stageStyle"
          draggable="false"
        >
      </div>

      <p class="cms-lb__hint">
        {{ zoomIndex > 0 ? 'Drag or scroll to move across the image.' : 'Zoom in to inspect detail.' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * S47.3 — the built-in `richtext` content-type renderer (placement: inline).
 * A post with no blocks renders its `content_html` as one implicit richtext
 * block (back-compat) — `content_html` stays the crawlable body in the
 * prerender, so this is the same markup bots see.
 *
 * Because this renderer is shared by post bodies AND every entity page (see
 * EntityPageContent), the image viewer added here covers all CMS-authored body
 * copy site-wide from one place.
 *
 * The body arrives as an opaque HTML string through `v-html`, so the click
 * handler is *delegated* from the wrapper rather than bound to elements this
 * component never authored.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps<{ data: { html?: string | null } }>();
const html = computed(() => props.data?.html ?? '');

const ZOOM_LEVELS = [
  { label: 'Fit', scale: 0 },
  { label: '1×', scale: 1 },
  { label: '2×', scale: 2 },
  { label: '4×', scale: 4 },
] as const;

// Below this rendered width an image reads as an icon or badge, not something
// worth a full-screen viewer. Only applied when the browser can tell us a size.
const MIN_ZOOMABLE_PX = 80;

const bodyEl = ref<HTMLElement | null>(null);
const stageEl = ref<HTMLElement | null>(null);
const closeEl = ref<HTMLElement | null>(null);
const active = ref<{ src: string; alt: string } | null>(null);
const zoomIndex = ref(0);
const dragging = ref(false);

const stageStyle = computed(() => {
  const level = ZOOM_LEVELS[zoomIndex.value];
  return level.scale === 0
    ? 'max-width:100%;max-height:100%'
    : `width:${level.scale * 100}%;max-width:none;max-height:none`;
});

/** An image is zoomable unless the author signalled otherwise. */
function isZoomable(img: HTMLImageElement): boolean {
  if (img.hasAttribute('data-nozoom')) return false;
  // A wrapping link is the author's own intent for the click; don't hijack it.
  if (img.closest('a')) return false;
  const width = img.naturalWidth || img.offsetWidth || 0;
  return width === 0 || width >= MIN_ZOOMABLE_PX;
}

/** Tag eligible images so CSS can advertise them (cursor + hover affordance). */
function markImages(): void {
  const root = bodyEl.value;
  if (!root) return;
  root.querySelectorAll('img').forEach((img) => {
    img.classList.toggle('is-zoomable', isZoomable(img as HTMLImageElement));
  });
}

function onBodyClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target || target.tagName !== 'IMG') return;
  const img = target as HTMLImageElement;
  if (!isZoomable(img)) return;
  event.preventDefault();
  open(img);
}

let lastFocused: HTMLElement | null = null;

function open(img: HTMLImageElement): void {
  lastFocused = document.activeElement as HTMLElement | null;
  active.value = { src: img.currentSrc || img.src, alt: img.alt || '' };
  zoomIndex.value = 0;
  document.addEventListener('keydown', onKeydown);
  document.body.style.overflow = 'hidden';
  nextTick(() => closeEl.value?.focus());
}

function close(): void {
  active.value = null;
  dragging.value = false;
  document.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
  // Return focus where the reader left it, not to the top of the document.
  lastFocused?.focus?.();
  lastFocused = null;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
  } else if (event.key === '+' || event.key === '=') {
    zoomIndex.value = Math.min(zoomIndex.value + 1, ZOOM_LEVELS.length - 1);
  } else if (event.key === '-') {
    zoomIndex.value = Math.max(zoomIndex.value - 1, 0);
  }
}

// Drag-to-pan. Touch already pans natively via the stage's overflow; this is
// what gives mouse users the same gesture instead of hunting for scrollbars.
let originX = 0;
let originY = 0;
let scrollX = 0;
let scrollY = 0;

function startDrag(event: PointerEvent): void {
  if (zoomIndex.value === 0 || event.pointerType === 'touch') return;
  const stage = stageEl.value;
  if (!stage) return;
  dragging.value = true;
  originX = event.clientX;
  originY = event.clientY;
  scrollX = stage.scrollLeft;
  scrollY = stage.scrollTop;
  (event.target as Element).setPointerCapture?.(event.pointerId);
}

function onDrag(event: PointerEvent): void {
  if (!dragging.value) return;
  const stage = stageEl.value;
  if (!stage) return;
  stage.scrollLeft = scrollX - (event.clientX - originX);
  stage.scrollTop = scrollY - (event.clientY - originY);
}

function endDrag(): void {
  dragging.value = false;
}

watch(html, () => nextTick(markImages), { immediate: true });
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.cms-richtext :deep(img) {
  max-width: 100%;
  height: auto;
}
.cms-richtext :deep(pre) {
  overflow-x: auto;
}
.cms-richtext :deep(img.is-zoomable) {
  cursor: zoom-in;
}

/* ── Image viewer ─────────────────────────────────────────────────────────
   Mobile-first. The bar wraps rather than overflowing, so the close button can
   never be pushed off a narrow screen and trap the reader. */
.cms-lb {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  background: #0b0f19;
}
.cms-lb__bar {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.5rem;
  padding: 0.5rem 0.65rem;
  background: #111827;
  border-bottom: 1px solid #263045;
}
.cms-lb__title {
  flex: 1 1 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e5e7eb;
  font-size: 0.85rem;
}
.cms-lb__zooms {
  display: flex;
  gap: 4px;
}
.cms-lb__zoom,
.cms-lb__close {
  min-width: 44px;
  min-height: 44px;
  display: grid;
  place-items: center;
  padding: 0 0.5rem;
  border: 0;
  border-radius: 8px;
  background: #1f2937;
  color: #d1d5db;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.cms-lb__zoom.is-active {
  background: #2563eb;
  color: #fff;
}
.cms-lb__close {
  margin-left: auto;
  font-size: 1.4rem;
  line-height: 1;
  color: #f3f4f6;
}
.cms-lb__close:hover {
  background: #b91c1c;
  color: #fff;
}
.cms-lb__zoom:focus-visible,
.cms-lb__close:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
}

/* The stage's own overflow IS the pan: native one-finger drag on touch. */
.cms-lb__stage {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
  touch-action: pan-x pan-y;
  display: block;
  text-align: center;
  padding: 0.5rem;
}
.cms-lb__stage.is-pannable {
  text-align: left;
  cursor: grab;
}
.cms-lb__stage.is-dragging {
  cursor: grabbing;
  user-select: none;
}
.cms-lb__stage img {
  display: inline-block;
  vertical-align: middle;
}
.cms-lb__hint {
  flex: 0 0 auto;
  margin: 0;
  padding: 0.4rem 0.65rem;
  background: #111827;
  border-top: 1px solid #263045;
  color: #9ca3af;
  font-size: 0.75rem;
  text-align: center;
}

@media (min-width: 640px) {
  .cms-lb__title {
    flex: 1 1 auto;
    font-size: 0.95rem;
  }
}
</style>
