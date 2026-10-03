<script setup lang="ts">
import { IonItem, IonList, IonSelect, IonSelectOption } from '@ionic/vue'
import { useCarStore } from '../composables/useCarStore'

defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string | undefined]
}>()

const store = useCarStore()
</script>

<template>
  <ion-list v-if="store.masters.length > 0" inset>
    <ion-item lines="none">
      <ion-select
        label="Мастер / сервис"
        :value="modelValue ?? ''"
        interface="action-sheet"
        :interface-options="{ cancelText: 'Отмена' }"
        @ion-change="emit('update:modelValue', $event.detail.value || undefined)"
      >
        <ion-select-option value="">Не указан</ion-select-option>
        <ion-select-option v-for="m in store.masters" :key="m.id" :value="m.id">{{ m.name }}</ion-select-option>
      </ion-select>
    </ion-item>
  </ion-list>
</template>
