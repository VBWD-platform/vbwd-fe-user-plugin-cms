<template>
  <!-- CMS-owned "Home" link injected into the fe-user sidebar logo block via
       the host brandActionsRegistry. Opens the public homepage in a new tab.
       Only present while the CMS plugin is active (it registers/unregisters
       this action), so core stays agnostic. -->
  <a
    class="cms-home-link"
    :href="homeUrl"
    target="_blank"
    rel="noopener"
    data-testid="cms-topbar-home"
    :title="t('cms.home')"
    :aria-label="t('cms.home')"
  >
    <!-- Icon-only per the sidebar-logo design; the accessible name lives on the
         anchor's title/aria-label above. -->
    <Icon name="home" />
  </a>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Icon } from 'vbwd-view-component';
import { brandActionsRegistry } from '@/plugins/brandActionsRegistry';

const { t } = useI18n();
const router = useRouter();

// Fallback when the named `home` route is not registered (e.g. CMS home route
// absent). The `public_home=1` flag tells the host navigation guard this is a
// deliberate public-home preview, so an authenticated user is NOT bounced to
// the dashboard.
const HOME_FALLBACK_HREF = '/?public_home=1';

// Resolve the URL from the ROUTER's named `home` route (the routing table's
// notion of "home") WITH the bypass flag — never hardcode `/` as the source.
const homeUrl = computed(() => {
  try {
    return router.resolve({ name: 'home', query: { public_home: '1' } }).href;
  } catch {
    return HOME_FALLBACK_HREF;
  }
});

// Publish the router-resolved home href to the generic host registry so core
// can wrap the brand name in a link to it — the resolved href stays in ONE
// place (this component), and core never learns what "home" means. Cleared on
// unmount so a disabled CMS leaves the brand name as plain text.
onMounted(() => {
  brandActionsRegistry.setBrandHref(homeUrl.value);
});

onUnmounted(() => {
  brandActionsRegistry.setBrandHref(null);
});
</script>

<style scoped>
.cms-home-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: inherit;
  text-decoration: none;
  font-size: 0.85rem;
  opacity: 0.85;
}

.cms-home-link:hover {
  opacity: 1;
}
</style>
