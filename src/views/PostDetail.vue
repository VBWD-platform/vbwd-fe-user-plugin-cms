<template>
  <article class="post-detail">
    <nav
      v-if="breadcrumbs.length"
      class="post-detail__breadcrumb"
      aria-label="breadcrumb"
      data-testid="post-breadcrumb"
    >
      <template
        v-for="(crumb, index) in breadcrumbs"
        :key="crumb.to"
      >
        <router-link
          v-if="!crumb.current"
          :to="crumb.to"
          class="post-detail__crumb"
        >
          {{ crumb.label }}
        </router-link>
        <span
          v-else
          class="post-detail__crumb post-detail__crumb--current"
        >{{ crumb.label }}</span>
        <span
          v-if="index < breadcrumbs.length - 1"
          class="post-detail__crumb-sep"
          aria-hidden="true"
        >/</span>
      </template>
    </nav>

    <h1
      v-if="title"
      class="post-detail__title"
    >
      {{ title }}
    </h1>

    <div class="post-detail__body">
      <template
        v-for="(block, index) in orderedBlocks"
        :key="`${block.type}-${index}`"
      >
        <component
          :is="resolveComponent(block.type)"
          v-if="resolveComponent(block.type)"
          :data="block.data"
        />
        <div
          v-else
          class="post-detail__unsupported"
          data-testid="unsupported-block"
        >
          {{ $t('cms.postDetail.unsupportedBlock', 'Unsupported content block.') }}
        </div>
      </template>
    </div>
  </article>
</template>

<script setup lang="ts">
/**
 * S47.3 — unified post detail (NEW; not wired to the live `/:slug` route yet).
 *
 * Mounts from the 47.2 `__POST__` hand-off when present (no redundant API call);
 * otherwise fetches via `usePosts.bySlug`. The body is an ordered block list
 * rendered through the content-type registry — `top` blocks first, then
 * `inline` (by `position`), then `bottom`. A post with no blocks renders its
 * `content_html` as one implicit `richtext` block (back-compat). Unknown block
 * → quiet fallback (Liskov). SEO meta is injected/de-duped via `injectSeoMeta`.
 */
import { computed, onMounted, ref, watch } from 'vue';
import {
  resolvePostContentType,
  type PostContentPlacement,
} from '../registry/contentTypeRegistry';
import { usePosts, type PostSummary } from '../composables/usePosts';
import {
  readSeoHandoff,
  injectSeoMeta,
  type SeoMetaSource,
} from '../composables/useSeoHandoff';

interface ContentBlock {
  type: string;
  data: Record<string, unknown>;
  position: number;
}

const PLACEMENT_ORDER: Record<PostContentPlacement, number> = {
  top: 0,
  inline: 1,
  bottom: 2,
};

const props = defineProps<{ slug: string; type?: string }>();

const posts = usePosts();
const post = ref<PostSummary | null>(null);
const handoffContentHtml = ref<string | null>(null);

const title = computed(() => post.value?.title ?? '');

function blocksFromContent(source: {
  content_json?: Record<string, unknown> | null;
  content_html?: string | null;
}): ContentBlock[] {
  const rawBlocks = (source.content_json?.blocks ?? null) as
    | Array<Record<string, unknown>>
    | null;

  if (Array.isArray(rawBlocks) && rawBlocks.length) {
    return rawBlocks.map((block, index) => ({
      type: String(block.type ?? 'richtext'),
      data: (block.data as Record<string, unknown>) ?? {},
      position: typeof block.position === 'number' ? block.position : index,
    }));
  }

  // Back-compat: no blocks → render content_html as one implicit richtext block.
  const html = source.content_html ?? '';
  if (!html) return [];
  return [{ type: 'richtext', data: { html }, position: 0 }];
}

const orderedBlocks = computed<ContentBlock[]>(() => {
  const source = post.value
    ? post.value
    : { content_json: null, content_html: handoffContentHtml.value };
  const blocks = blocksFromContent(source);

  return [...blocks].sort((left, right) => {
    const leftPlacement = resolvePostContentType(left.type)?.placement ?? 'inline';
    const rightPlacement = resolvePostContentType(right.type)?.placement ?? 'inline';
    const placementDelta =
      PLACEMENT_ORDER[leftPlacement] - PLACEMENT_ORDER[rightPlacement];
    if (placementDelta !== 0) return placementDelta;
    return left.position - right.position;
  });
});

function resolveComponent(type: string) {
  return resolvePostContentType(type)?.component;
}

interface Crumb {
  label: string;
  to: string;
  current: boolean;
}

const breadcrumbs = computed<Crumb[]>(() => {
  const ancestors = post.value?.ancestors;
  if (!Array.isArray(ancestors) || !ancestors.length) return [];
  const crumbs: Crumb[] = ancestors.map((ancestor) => ({
    label: ancestor.title,
    to: `/${ancestor.slug}`,
    current: false,
  }));
  crumbs.push({
    label: post.value?.title ?? '',
    to: `/${post.value?.slug ?? ''}`,
    current: true,
  });
  return crumbs;
});

function applySeo(): void {
  const source = post.value;
  if (source) {
    injectSeoMeta({
      name: source.title,
      meta_title: source.meta_title ?? source.title,
      meta_description: source.meta_description,
      robots: source.robots,
      og_title: source.og_title,
      og_description: source.og_description,
      og_image_url: source.og_image_url,
      canonical_url: source.canonical_url,
      schema_json: source.schema_json ?? null,
    } as SeoMetaSource);
  }
}

async function load(): Promise<void> {
  const handoff = readSeoHandoff();
  if (handoff && handoff.slug === props.slug) {
    // Mount synchronously from the prerendered payload — no API round-trip.
    post.value = {
      id: handoff.slug,
      type: props.type ?? 'page',
      slug: handoff.slug,
      title: handoff.title,
      content_html: handoff.content_html,
      content_json: null,
      meta_description: handoff.seo?.meta_description ?? null,
      canonical_url: handoff.seo?.canonical_url ?? null,
      robots: handoff.seo?.robots ?? null,
    };
    handoffContentHtml.value = handoff.content_html;
    applySeo();
    return;
  }

  const fetched = await posts.bySlug(props.type ?? 'page', props.slug);
  post.value = fetched;
  if (fetched) applySeo();
}

watch(() => props.slug, () => { load(); });

onMounted(() => { load(); });
</script>

<style scoped>
.post-detail {
  margin: 0 auto;
  padding: 0.5rem 1rem;
}
.post-detail__breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--color-text-muted, #64748b);
  margin-bottom: 1rem;
}
.post-detail__crumb {
  color: var(--color-accent, #2563eb);
  text-decoration: none;
}
.post-detail__crumb--current {
  color: var(--color-heading, #0f172a);
  font-weight: 500;
}
.post-detail__crumb-sep {
  color: var(--color-text-muted, #94a3b8);
}
.post-detail__title {
  margin: 0 0 1.25rem;
}
.post-detail__unsupported {
  display: none;
}
</style>
