<template>
  <div class="cms-page">
    <div
      v-if="store.loading"
      class="cms-page__loading"
    >
      {{ $t('cms.loading') }}
    </div>

    <div
      v-else-if="store.accessDenied"
      class="cms-page__access-denied"
    >
      <h2>{{ isAuthenticated ? $t('cms.accessDenied', 'Access Denied') : $t('cms.loginRequired', 'Login Required') }}</h2>
      <p>{{ isAuthenticated ? $t('cms.upgradePlan', 'Upgrade your plan to access this content.') : $t('cms.loginToView', 'Please log in to view this page.') }}</p>
      <router-link
        v-if="!isAuthenticated"
        to="/login"
        class="cms-page__login-link"
      >
        {{ $t('common.login', 'Log In') }}
      </router-link>
    </div>

    <div
      v-else-if="store.error || !store.currentPage"
      class="cms-page__not-found"
    >
      {{ $t('cms.notFound') }}
    </div>

    <!-- Layout-based rendering -->
    <template v-else-if="store.currentLayout">
      <CmsLayoutRenderer
        :layout="store.currentLayout"
        :content-html="renderedHtml"
        :content-blocks="pageContentBlocks"
        :page-assignments="pageWidgetAssignments"
      />
    </template>

    <!-- Fallback: simple article rendering (no layout) -->
    <article
      v-else
      class="cms-page__content"
    >
      <h1 class="cms-page__title">
        {{ store.currentPage.name }}
      </h1>
      <!-- eslint-disable vue/no-v-html -->
      <div
        class="cms-page__body"
        v-html="renderedHtml"
      />
      <!-- eslint-enable vue/no-v-html -->
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useCmsStore } from '../stores/useCmsStore';
import { isAuthenticated as checkAuth } from '@/api';
import CmsLayoutRenderer from '../components/CmsLayoutRenderer.vue';

const isAuthenticated = checkAuth();

const props = defineProps<{ slug?: string }>();

const route = useRoute();
const store = useCmsStore();

const effectiveSlug = computed(() => props.slug ?? (route.params.slug as string));

// Multi-content blocks from page data (keyed by area name)
const pageContentBlocks = computed(() => {
  const page = store.currentPage as Record<string, unknown> | null;
  if (!page) return {};
  return (page.content_blocks as Record<string, { content_html?: string; source_css?: string }>) || {};
});

// Page-level widget assignments (override layout widgets for same area)
const pageWidgetAssignments = computed(() => {
  const page = store.currentPage as Record<string, unknown> | null;
  if (!page) return [];
  return (page.page_assignments as Array<Record<string, unknown>>) || [];
});

// ── TipTap JSON → HTML renderer (no external dependency) ─────────────────────

type TNode = { type: string; text?: string; marks?: TMark[]; content?: TNode[]; attrs?: Record<string, unknown> };
type TMark = { type: string; attrs?: Record<string, unknown> };

function renderNode(node: TNode): string {
  if (!node) return '';

  if (node.type === 'text') {
    let text = escHtml(node.text ?? '');
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        else if (mark.type === 'italic') text = `<em>${text}</em>`;
        else if (mark.type === 'underline') text = `<u>${text}</u>`;
        else if (mark.type === 'strike') text = `<s>${text}</s>`;
        else if (mark.type === 'code') text = `<code>${text}</code>`;
        else if (mark.type === 'link') {
          const href = escAttr(String(mark.attrs?.href ?? ''));
          const target = mark.attrs?.target ? ` target="${escAttr(String(mark.attrs.target))}"` : '';
          text = `<a href="${href}"${target}>${text}</a>`;
        }
      }
    }
    return text;
  }

  const children = (node.content ?? []).map(renderNode).join('');

  switch (node.type) {
    case 'doc':         return children;
    case 'paragraph':   return `<p>${children || '&nbsp;'}</p>`;
    case 'heading': {
      const level = Number(node.attrs?.level ?? 2);
      return `<h${level}>${children}</h${level}>`;
    }
    case 'bulletList':  return `<ul>${children}</ul>`;
    case 'orderedList': return `<ol>${children}</ol>`;
    case 'listItem':    return `<li>${children}</li>`;
    case 'blockquote':  return `<blockquote>${children}</blockquote>`;
    case 'codeBlock':   return `<pre><code>${children}</code></pre>`;
    case 'hardBreak':   return '<br>';
    case 'horizontalRule': return '<hr>';
    case 'image': {
      const src = escAttr(String(node.attrs?.src ?? ''));
      const alt = escAttr(String(node.attrs?.alt ?? ''));
      return `<img src="${src}" alt="${alt}" style="max-width:100%">`;
    }
    default:            return children;
  }
}

function escHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str: string) {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const renderedHtml = computed(() => {
  // Prefer raw content_html (set via HTML tab) so embedded scripts / iframes are preserved
  const raw = (store.currentPage as any)?.content_html;
  if (raw) return raw;
  const doc = store.currentPage?.content_json;
  if (!doc || typeof doc !== 'object') return '';
  return renderNode(doc as TNode);
});

// ── SEO meta injection ────────────────────────────────────────────────────────

const injectedTags: HTMLElement[] = [];

function injectMeta(name: string, content: string, property?: string) {
  if (!content) return;
  const el = document.createElement('meta');
  if (property) el.setAttribute('property', property);
  else el.setAttribute('name', name);
  el.setAttribute('content', content);
  document.head.appendChild(el);
  injectedTags.push(el);
}

function injectLink(rel: string, href: string) {
  if (!href) return;
  const el = document.createElement('link');
  el.setAttribute('rel', rel);
  el.setAttribute('href', href);
  document.head.appendChild(el);
  injectedTags.push(el);
}

function applyPageSeo(page: NonNullable<typeof store.currentPage>) {
  // Remove previously injected tags
  injectedTags.forEach(el => el.remove());
  injectedTags.length = 0;

  const title = page.meta_title || page.name;
  document.title = title;

  if (page.meta_description) injectMeta('description', page.meta_description);
  if (page.robots)            injectMeta('robots', page.robots);
  if (page.og_title)          injectMeta('', page.og_title || title, 'og:title');
  if (page.og_description)    injectMeta('', page.og_description || '', 'og:description');
  if (page.og_image_url)      injectMeta('', page.og_image_url, 'og:image');
  if (page.canonical_url)     injectLink('canonical', page.canonical_url);

  if (page.schema_json) {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(page.schema_json);
    document.head.appendChild(el);
    injectedTags.push(el);
  }
}

let styleTag: HTMLStyleElement | null = null;

function applyPageStyle(css: string | null) {
  if (styleTag) { styleTag.remove(); styleTag = null; }
  if (!css) return;
  styleTag = document.createElement('style');
  styleTag.setAttribute('data-cms-page-style', '');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);
}

watch(() => store.currentPage, (page) => {
  if (page) applyPageSeo(page);
});

watch(() => store.currentStyleCss, (css) => {
  applyPageStyle(css ?? null);
});

const previewToken = computed(() => route.query.preview_token as string | undefined);

watch(effectiveSlug, (slug) => {
  store.fetchPage(slug, previewToken.value);
});

onMounted(() => {
  store.fetchPage(effectiveSlug.value, previewToken.value);
});

onUnmounted(() => {
  injectedTags.forEach(el => el.remove());
  injectedTags.length = 0;
  if (styleTag) { styleTag.remove(); styleTag = null; }
});
</script>

<style scoped>
.cms-page { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
.cms-page__loading,
.cms-page__not-found { color: var(--color-text-muted, #888); padding: 2rem 0; }
.cms-page__title { margin-bottom: 1.5rem; }
.cms-page__body :deep(img) { max-width: 100%; height: auto; }
.cms-page__body :deep(pre) { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
.cms-page__body :deep(blockquote) { border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #666; }
</style>
