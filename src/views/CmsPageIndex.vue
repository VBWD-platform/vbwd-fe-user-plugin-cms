<template>
  <div class="cms-index">
    <div class="cms-index__categories">
      <button
        class="cms-index__cat-btn"
        :class="{ active: !activeCategory }"
        @click="selectCategory(null)"
      >
        {{ $t('cms.allCategories') }}
      </button>
      <button
        v-for="cat in store.categories"
        :key="cat.id"
        class="cms-index__cat-btn"
        :class="{ active: activeCategory === cat.slug }"
        @click="selectCategory(cat.slug)"
      >
        {{ cat.name }}
      </button>
    </div>

    <div
      v-if="store.loading"
      class="cms-index__loading"
    >
      {{ $t('cms.loading') }}
    </div>

    <div
      v-else-if="!store.pageList?.items?.length"
      class="cms-index__empty"
    >
      {{ $t('cms.noPages') }}
    </div>

    <ul
      v-else
      class="cms-index__list"
    >
      <li
        v-for="page in store.pageList.items"
        :key="page.id"
        class="cms-index__item"
      >
        <router-link :to="{ name: 'cms-page', params: { slug: page.slug } }">
          <strong>{{ page.name }}</strong>
        </router-link>
        <p
          v-if="page.meta_description"
          class="cms-index__desc"
        >
          {{ page.meta_description }}
        </p>
      </li>
    </ul>

    <div
      v-if="store.pageList && store.pageList.pages > 1"
      class="cms-index__pagination"
    >
      <button
        :disabled="currentPage <= 1"
        @click="changePage(currentPage - 1)"
      >
        ‹
      </button>
      <span>{{ currentPage }} / {{ store.pageList.pages }}</span>
      <button
        :disabled="currentPage >= store.pageList.pages"
        @click="changePage(currentPage + 1)"
      >
        ›
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCmsStore } from '../stores/useCmsStore';

const store = useCmsStore();
const activeCategory = ref<string | null>(null);
const currentPage = ref(1);

function load() {
  store.fetchPages({
    category: activeCategory.value ?? undefined,
    page: currentPage.value,
    per_page: 20,
  });
}

function selectCategory(slug: string | null) {
  activeCategory.value = slug;
  currentPage.value = 1;
  load();
}

function changePage(n: number) {
  currentPage.value = n;
  load();
}

onMounted(() => {
  store.fetchCategories();
  load();
});
</script>

<style scoped>
.cms-index { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
.cms-index__categories { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; }
.cms-index__cat-btn {
  padding: 0.35rem 0.9rem;
  border: 1px solid #ccc;
  border-radius: 20px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
}
.cms-index__cat-btn.active,
.cms-index__cat-btn:hover { background: var(--color-primary, #3b82f6); color: #fff; border-color: transparent; }
.cms-index__list { list-style: none; padding: 0; }
.cms-index__item { padding: 1rem 0; border-bottom: 1px solid #eee; }
.cms-index__item a { text-decoration: none; color: inherit; }
.cms-index__item a:hover { text-decoration: underline; }
.cms-index__desc { margin: 0.25rem 0 0; color: #666; font-size: 0.9rem; }
.cms-index__loading,
.cms-index__empty { color: #888; padding: 2rem 0; }
.cms-index__pagination { display: flex; align-items: center; gap: 1rem; margin-top: 1.5rem; }
.cms-index__pagination button { padding: 0.4rem 0.8rem; cursor: pointer; }
.cms-index__pagination button:disabled { opacity: 0.4; cursor: default; }
</style>
