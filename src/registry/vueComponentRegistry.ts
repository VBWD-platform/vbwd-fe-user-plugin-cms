import type { Component } from 'vue';

const registry = new Map<string, Component>();

export function registerCmsVueComponent(name: string, component: Component): void {
  registry.set(name, component);
}

export function resolveCmsVueComponent(name: string): Component | undefined {
  return registry.get(name);
}
