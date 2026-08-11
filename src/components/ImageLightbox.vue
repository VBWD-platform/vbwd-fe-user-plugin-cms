<template>
  <div
    class="cms-lb"
    data-testid="cms-lightbox"
    role="dialog"
    aria-modal="true"
    :aria-label="`Image viewer: ${image.alt || 'image'}`"
    @click.self="$emit('close')"
  >
    <div class="cms-lb__bar">
      <span class="cms-lb__title">{{ image.alt || 'Image' }}</span>
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
          :class="{ 'is-active': index === modelValue }"
          :aria-pressed="index === modelValue"
          data-testid="cms-lightbox-zoom"
          @click="$emit('update:modelValue', index)"
        >{{ level.label }}</button>
      </span>
      <button
        ref="closeEl"
        type="button"
        class="cms-lb__close"
        aria-label="Close image viewer"
        data-testid="cms-lightbox-close"
        @click="$emit('close')"
      >&times;</button>
    </div>

    <div
      ref="stageEl"
      class="cms-lb__stage"
      :class="{ 'is-pannable': modelValue > 0, 'is-dragging': dragging }"
      @pointerdown="startDrag"
      @pointermove="onDrag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <img
        :src="image.src"
        :alt="image.alt"
        :style="stageStyle"
        draggable="false"
      >
    </div>

    <p class="cms-lb__hint">
      {{ modelValue > 0 ? 'Drag or scroll to move across the image.' : 'Zoom in to inspect detail.' }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * The full-screen image viewer: close, four zoom levels, and panning.
 *
 * Presentational only — the owning component decides *when* it appears (see
 * `useImageZoom`), so both CMS render paths share one implementation.
 */
import { computed, onMounted, ref } from 'vue';
import { ZOOM_LEVELS, type ActiveImage } from '../composables/useImageZoom';

const props = defineProps<{ image: ActiveImage; modelValue: number }>();
defineEmits<{ close: []; 'update:modelValue': [value: number] }>();

const stageEl = ref<HTMLElement | null>(null);
const closeEl = ref<HTMLElement | null>(null);
const dragging = ref(false);

const stageStyle = computed(() => {
  const level = ZOOM_LEVELS[props.modelValue];
  return level.scale === 0
    ? 'max-width:100%;max-height:100%'
    : `width:${level.scale * 100}%;max-width:none;max-height:none`;
});

// Focus the close button so the viewer is dismissible from the keyboard the
// moment it opens, and so focus is not left behind in the page underneath.
onMounted(() => closeEl.value?.focus());

// Drag-to-pan. Touch already pans natively via the stage's overflow; this is
// what gives mouse users the same gesture instead of hunting for scrollbars.
let originX = 0;
let originY = 0;
let scrollX = 0;
let scrollY = 0;

function startDrag(event: PointerEvent): void {
  if (props.modelValue === 0 || event.pointerType === 'touch') return;
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
</script>

<style scoped>
/* Mobile-first. The bar wraps rather than overflowing, so the close button can
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
