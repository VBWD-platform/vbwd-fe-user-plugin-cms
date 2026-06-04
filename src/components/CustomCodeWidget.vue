<!--
  Custom Code widget: an admin drops this `vue-component` widget onto any cms
  page and pastes a raw HTML/JS blob (e.g. the Google gtag analytics block) into
  its config. The pasted code is read from `content_json.code` (delivered via the
  widget renderer's `:config` bind) and its `<script>` tags are built and
  EXECUTED programmatically by the shared `buildCustomCodeScripts` helper —
  inline → <script> textContent, external → <script src> (+ async/defer) — and
  appended to a ref container. NEVER via `v-html`, because a script injected as
  parsed markup would not execute anyway (and `vue/no-v-html` stays clean).

  Async embeds (gtag) work fine here even when the widget sits in the body.
-->
<template>
  <div
    ref="host"
    class="cms-custom-code"
    data-testid="cms-custom-code"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { buildCustomCodeScripts } from '../utils/customCode';

interface CustomCodeConfig {
  code?: string | null;
  widget_slug?: string;
}

const props = defineProps<{ config?: CustomCodeConfig | null }>();

const host = ref<HTMLElement | null>(null);
// The script nodes this widget appended, so unmount can remove exactly its own
// (the ref may already be detached by the time onUnmounted runs).
let injectedScripts: HTMLScriptElement[] = [];
// The code currently injected; guards against double-injecting the same block on
// a re-render (idempotency key).
let injectedCode: string | null = null;

function currentCode(): string {
  return props.config?.code ?? '';
}

function clearInjected(): void {
  for (const script of injectedScripts) {
    script.remove();
  }
  injectedScripts = [];
}

function render(): void {
  const container = host.value;
  if (!container) return;

  const code = currentCode();
  if (code === injectedCode) return; // already injected — no-op

  clearInjected();
  injectedScripts = buildCustomCodeScripts(document, code);
  for (const script of injectedScripts) {
    container.appendChild(script);
  }
  injectedCode = code;
}

onMounted(render);
watch(() => props.config, render, { deep: true });
onUnmounted(() => {
  clearInjected();
  injectedCode = null;
});
</script>

<style scoped>
.cms-custom-code {
  display: contents;
}
</style>
