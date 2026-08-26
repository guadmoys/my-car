<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { checkmark } from 'ionicons/icons'

const props = defineProps<{
  title: string
  items: string[]
  selected?: string
  placeholder?: string
  /** Label for the row that lets the user use their own typed value instead of picking one from the list. */
  customLabel: string
}>()

const emit = defineEmits<{
  close: []
  select: [value: string]
}>()

const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.items
  return props.items.filter((item) => item.toLowerCase().includes(q))
})

const exactMatch = computed(() =>
  props.items.some((item) => item.toLowerCase() === search.value.trim().toLowerCase())
)

function pick(value: string) {
  emit('select', value)
  emit('close')
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Закрыть</ion-button>
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="search" :placeholder="placeholder" autocapitalize="words" />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item v-if="search.trim() && !exactMatch" button :detail="false" @click="pick(search.trim())">
          <ion-label color="primary">{{ customLabel }} «{{ search.trim() }}»</ion-label>
        </ion-item>
        <ion-item v-for="item in filtered" :key="item" button :detail="false" @click="pick(item)">
          <ion-label>{{ item }}</ion-label>
          <ion-icon v-if="item === selected" slot="end" :icon="checkmark" color="primary" />
        </ion-item>
        <ion-item v-if="!filtered.length && !search.trim()" lines="none">
          <ion-label color="medium" class="ion-text-center">Список пуст</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>
