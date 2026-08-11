import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue';

/**
 * Make every image inside a `v-html` container open in a zoom/pan viewer.
 *
 * CMS body copy reaches the browser as an opaque HTML string, so this delegates
 * one click listener from the container rather than binding to elements the
 * component never authored. Shared by both render paths — RichTextBlock (entity
 * pages, `richtext` blocks) and CmsWidgetRenderer (html widgets, which is how
 * post bodies are laid out) — so the behaviour is defined once.
 */

export const ZOOM_LEVELS = [
  { label: 'Fit', scale: 0 },
  { label: '1×', scale: 1 },
  { label: '2×', scale: 2 },
  { label: '4×', scale: 4 },
] as const;

// Below this rendered width an image reads as an icon or badge, not something
// worth a full-screen viewer. Only applied when the browser can tell us a size.
const MIN_ZOOMABLE_PX = 80;

export interface ActiveImage {
  src: string;
  alt: string;
}

/** An image is zoomable unless the author signalled otherwise. */
export function isZoomable(img: HTMLImageElement): boolean {
  if (img.hasAttribute('data-nozoom')) return false;
  // A wrapping link is the author's own intent for the click; don't hijack it.
  if (img.closest('a')) return false;
  const width = img.naturalWidth || img.offsetWidth || 0;
  return width === 0 || width >= MIN_ZOOMABLE_PX;
}

export function useImageZoom(container: Ref<HTMLElement | null>, source: Ref<unknown>) {
  const active = ref<ActiveImage | null>(null);
  const zoomIndex = ref(0);
  let lastFocused: HTMLElement | null = null;

  /** Tag eligible images so CSS can advertise them (cursor + hover affordance). */
  function markImages(): void {
    const root = container.value;
    if (!root) return;
    root.querySelectorAll('img').forEach((img) => {
      img.classList.toggle('is-zoomable', isZoomable(img as HTMLImageElement));
    });
  }

  function onContainerClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target || target.tagName !== 'IMG') return;
    const img = target as HTMLImageElement;
    if (!isZoomable(img)) return;
    event.preventDefault();
    // Containers nest (layout body > html widget), and both delegate. Stop here
    // so one click opens exactly one viewer.
    event.stopPropagation();
    open(img);
  }

  function open(img: HTMLImageElement): void {
    lastFocused = document.activeElement as HTMLElement | null;
    active.value = { src: img.currentSrc || img.src, alt: img.alt || '' };
    zoomIndex.value = 0;
    document.addEventListener('keydown', onKeydown);
    document.body.style.overflow = 'hidden';
  }

  function close(): void {
    active.value = null;
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

  watch(source, () => nextTick(markImages), { immediate: true });
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = '';
  });

  return { active, zoomIndex, onContainerClick, close, markImages };
}
