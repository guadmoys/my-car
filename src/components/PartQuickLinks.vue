<script setup lang="ts">
import { computed } from 'vue'
import type { Part } from '../types'
import { PART_LINK_SITES, partSearchQuery } from '../utils/partLinks'

const props = defineProps<{
  part: Pick<Part, 'articleNumber' | 'name'>
}>()

const query = computed(() => partSearchQuery(props.part))
</script>

<template>
  <div v-if="query" class="quick-links">
    <a
      v-for="site in PART_LINK_SITES"
      :key="site.key"
      :href="site.url(query)"
      target="_blank"
      rel="noopener noreferrer"
      class="quick-link"
      @click.stop
    >
      {{ site.label }}
    </a>
  </div>
</template>

<style scoped>
.quick-links {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.quick-link {
  font-size: 12px;
  font-weight: 600;
  color: var(--blue);
  background: color-mix(in srgb, var(--blue) 12%, transparent);
  padding: 5px 10px;
  border-radius: var(--radius-pill);
  text-decoration: none;
  white-space: nowrap;
}

.quick-link:active {
  opacity: 0.6;
}
</style>
