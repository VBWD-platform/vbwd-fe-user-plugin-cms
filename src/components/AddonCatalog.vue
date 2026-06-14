<template>
  <div
    class="addon-catalog"
    data-testid="addon-catalog"
  >
    <h2
      v-if="heading"
      class="addon-catalog__heading"
    >
      {{ heading }}
    </h2>

    <div
      v-if="loading"
      class="addon-catalog__loading"
      data-testid="addon-catalog-loading"
    >
      {{ $t('cms.addonCatalog.loading') }}
    </div>

    <div
      v-else-if="error"
      class="addon-catalog__error"
      data-testid="addon-catalog-error"
    >
      {{ error }}
    </div>

    <div
      v-else-if="addons.length === 0"
      class="addon-catalog__empty"
      data-testid="addon-catalog-empty"
    >
      {{ $t('cms.addonCatalog.empty') }}
    </div>

    <div
      v-else
      class="addon-catalog__grid"
      data-testid="addon-catalog-grid"
    >
      <div
        v-for="addon in addons"
        :key="addon.id"
        class="addon-card"
        data-testid="addon-card"
      >
        <h3
          class="addon-card__name"
          data-testid="addon-card-name"
        >
          {{ addon.name }}
        </h3>
        <p
          v-if="addon.description"
          class="addon-card__description"
        >
          {{ addon.description }}
        </p>
        <p
          class="addon-card__price"
          data-testid="addon-card-price"
        >
          <PriceDisplay
            :net-amount="addon.price_info?.net_amount ?? addon.price"
            :gross-amount="addon.price_info?.gross_amount ?? addon.price"
            :currency="addon.price_info?.price?.currency"
          />
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Public CMS add-on catalogue widget.
 *
 * A `vue-component` widget an admin drops onto a cms page/layout vue area. It
 * fetches the public add-on list and renders a card per add-on. Price is
 * rendered through the shared <PriceDisplay> fed by the S85 ``price_info`` block
 * — the widget does NO tax arithmetic (D1, that lives in the backend
 * PriceFactory). Mirrors the structure of the shop ProductCatalog widget:
 * config-driven heading, theme-aware via --vbwd-* custom properties, and
 * loading / empty / error states.
 */
import { ref, computed, onMounted } from 'vue';
import { api } from '@/api';
import PriceDisplay from '@/components/PriceDisplay.vue';

interface AddonPriceInfo {
  net_amount: string;
  gross_amount: string;
  price?: { currency?: string };
}

interface AddonListItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number | string;
  price_info?: AddonPriceInfo;
}

const props = defineProps<{
  config?: Record<string, unknown>;
}>();

const heading = computed(() => (props.config?.heading as string | undefined) ?? '');

const loading = ref(true);
const error = ref<string | null>(null);
const addons = ref<AddonListItem[]>([]);

async function fetchAddons() {
  loading.value = true;
  error.value = null;
  try {
    const response = (await api.get('/addons/')) as { addons: AddonListItem[] };
    addons.value = response.addons ?? [];
  } catch (fetchError) {
    error.value = (fetchError as Error).message || 'Failed to load add-ons';
  } finally {
    loading.value = false;
  }
}

onMounted(fetchAddons);
</script>

<style scoped>
.addon-catalog {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

.addon-catalog__heading {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.addon-catalog__loading,
.addon-catalog__error,
.addon-catalog__empty {
  padding: 2rem;
  text-align: center;
  color: var(--vbwd-text-secondary, #666);
}

.addon-catalog__error {
  color: var(--vbwd-color-danger, #dc3545);
}

.addon-catalog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
}

.addon-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 8px;
  padding: 1rem 1.25rem 1.25rem;
  transition: box-shadow 0.15s;
}

.addon-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.addon-card__name {
  font-size: 1.0625rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  line-height: 1.3;
}

.addon-card__description {
  font-size: 0.9375rem;
  color: var(--vbwd-text-secondary, #666);
  margin: 0 0 0.75rem;
  flex: 1;
}

.addon-card__price {
  font-size: 1rem;
  font-weight: 700;
  color: var(--vbwd-color-primary, #333);
  margin: 0;
}

@media (max-width: 640px) {
  .addon-catalog__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
}
</style>
