<template>
  <!-- Renders nothing (collapses) when the owner has no published entity page,
       when the endpoint 404s, or when any fetch fails — so a host detail page
       is never broken by an absent/unpublished attachment (Liskov). -->
  <div
    v-if="hasContent"
    :class="['entity-page-content', wrapperClass]"
    data-testid="entity-page-content"
  >
    <!-- Page-level source_css, scoped to this component's subtree via @scope so
         it can never leak to the rest of the detail page. -->
    <component
      :is="'style'"
      v-if="scopedPageCss"
    >
      {{ scopedPageCss }}
    </component>

    <!-- The entity page body — rendered through the same RichTextBlock the CMS
         post body uses (DRY), so operators get identical markup handling. -->
    <RichTextBlock
      v-if="contentHtml"
      class="entity-page-content__body"
      :data="{ html: contentHtml }"
    />

    <!-- The ordered content blocks (by sort_order). Each block carries its own
         scoped source_css and an area hook, and renders its body through the
         same RichTextBlock renderer. -->
    <div
      v-for="block in orderedBlocks"
      :key="block.id"
      class="entity-page-block"
      :class="blockClass(block)"
      :data-area="block.area_name"
      data-testid="entity-page-block"
    >
      <component
        :is="'style'"
        v-if="block.source_css"
      >
        {{ scopeCss(block.source_css, '.' + blockClass(block)) }}
      </component>
      <RichTextBlock :data="{ html: block.content_html ?? '' }" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * S128 — EntityPageContent.
 *
 * A reusable public component that renders an entity's attached CMS page (body
 * + ordered content_blocks + scoped CSS) on any fe-user detail page. Adopter
 * plugins (dataset/shop/booking) drop it under their existing description:
 *
 *   <EntityPageContent :owner-type="'dataset'" :owner-id="dataset.id" />
 *   <EntityPageContent :owner-type="'shop'" :owner-id="product.id" slot="sidebar"
 *                      @loaded="onEntityPageLoaded" />
 *
 * It is purely presentational: it fetches the public projection through the
 * shared @/api client on mount and, on 404 / empty / any error, collapses to
 * nothing rather than surfacing an error into the host page. On a 200 it emits
 * `loaded` with the fetched SEO so a host page MAY set meta tags — the
 * component itself never hard-depends on a head library.
 */
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api';
import RichTextBlock from './RichTextBlock.vue';

interface EntityPageBlock {
  id: string;
  area_name: string;
  content_html: string | null;
  source_css: string | null;
  sort_order: number;
  content_json: unknown;
}

interface EntityPageProjection {
  post_id: string;
  content_html: string | null;
  content_json: unknown;
  source_css: string | null;
  content_blocks: EntityPageBlock[];
  seo: Record<string, unknown>;
}

const props = withDefaults(
  defineProps<{
    ownerType: string;
    ownerId: string;
    slot?: string;
  }>(),
  { slot: 'main' },
);

const emit = defineEmits<{
  (event: 'loaded', payload: { seo: Record<string, unknown> }): void;
}>();

// A per-instance wrapper class used as the @scope root, so this instance's
// source_css (and each block's) is confined to its own subtree.
let instanceCounter = 0;
const wrapperClass = `entity-page-content--${(instanceCounter += 1)}`;

const projection = ref<EntityPageProjection | null>(null);

const contentHtml = computed(() => projection.value?.content_html ?? '');

const orderedBlocks = computed<EntityPageBlock[]>(() => {
  const blocks = projection.value?.content_blocks ?? [];
  return [...blocks].sort((left, right) => left.sort_order - right.sort_order);
});

// The component renders only when there is something to show: a body or at
// least one block. An unlinked/unpublished owner (404) or an empty projection
// collapses the component entirely.
const hasContent = computed(
  () => !!contentHtml.value || orderedBlocks.value.length > 0,
);

// Wrap raw source_css in an @scope block rooted at the given selector so the
// rules can only match inside this component's subtree — no global leak.
function scopeCss(css: string, selector: string): string {
  return `@scope (${selector}) {\n${css}\n}`;
}

const scopedPageCss = computed(() => {
  const css = projection.value?.source_css;
  if (!css) return '';
  return scopeCss(css, `.${wrapperClass}`);
});

function blockClass(block: EntityPageBlock): string {
  return `${wrapperClass}__block-${block.id}`;
}

onMounted(async () => {
  try {
    const path = `/cms/entity-pages/${props.ownerType}/${props.ownerId}/${props.slot}`;
    const data = await api.get<EntityPageProjection>(path);
    if (!data) return;
    projection.value = data;
    emit('loaded', { seo: data.seo ?? {} });
  } catch {
    // Unlinked / unpublished (404) or any transport failure: stay collapsed.
    // A detail page must never break because its entity page is absent.
    projection.value = null;
  }
});
</script>

<style scoped>
.entity-page-content {
  width: 100%;
}
.entity-page-block + .entity-page-block {
  margin-top: 1rem;
}
</style>
