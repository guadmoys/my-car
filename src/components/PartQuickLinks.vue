<script setup lang="ts">
import { computed } from 'vue'
import { IonChip } from '@ionic/vue'
import type { Part } from '../types'
import { PART_LINK_SITES, partSearchQuery } from '../utils/partLinks'

const props = defineProps<{
  part: Pick<Part, 'articleNumber' | 'name'>
}>()

const query = computed(() => partSearchQuery(props.part))

function openSite(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div v-if="query" class="quick-links">
    <ion-chip
      v-for="site in PART_LINK_SITES"
      :key="site.key"
      outline
      color="primary"
      @click="openSite(site.url(query))"
    >
      {{ site.label }}
    </ion-chip>
  </div>
</template>

<style scoped>
.quick-links {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
</style>
