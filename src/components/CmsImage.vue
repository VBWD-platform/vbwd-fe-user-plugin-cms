<template>
  <picture class="cms-image">
    <source
      v-if="avifSrc"
      :srcset="avifSrc"
      type="image/avif"
    >
    <source
      v-if="webpSrc"
      :srcset="webpSrc"
      type="image/webp"
    >
    <img
      class="cms-image__img"
      :src="src"
      :alt="alt"
      :width="width"
      :height="height"
      :loading.attr="hero ? 'eager' : 'lazy'"
      :fetchpriority="hero ? 'high' : 'auto'"
      decoding="async"
    >
  </picture>
</template>

<script setup lang="ts">
/**
 * S47.3 — Core-Web-Vitals-correct image.
 *
 * AVIF + WebP `<picture>` with an original fallback, ALWAYS explicit
 * width/height (dims are stored on the image model → prevents CLS), lazy by
 * default; the hero (LCP path) is eager + high fetchpriority. The markup is
 * deliberately the same shape the 47.1 prerender emits in `content_html`, so
 * the 47.2 CSR swap is byte-stable (no layout shift on takeover).
 */
defineProps<{
  src: string;
  avifSrc?: string | null;
  webpSrc?: string | null;
  width: number | string;
  height: number | string;
  alt: string;
  /** Hero/LCP image → eager + fetchpriority=high + (preload handled upstream). */
  hero?: boolean;
}>();
</script>

<style scoped>
.cms-image {
  display: block;
}
.cms-image__img {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>
