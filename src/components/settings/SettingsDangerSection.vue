<script setup lang="ts">
import { ref, watch } from 'vue'
import { IonItem, IonLabel, IonList, IonListHeader } from '@ionic/vue'
import { trashOutline } from 'ionicons/icons'
import SettingsIconBadge from '../SettingsIconBadge.vue'
import HintButton from '../HintButton.vue'

const props = defineProps<{
  carId: string
}>()

const emit = defineEmits<{
  deleteCar: []
}>()

const confirmingDelete = ref(false)

watch(
  () => props.carId,
  () => {
    confirmingDelete.value = false
  },
)

function handleDelete() {
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    return
  }
  emit('deleteCar')
}
</script>

<template>
  <ion-list inset>
    <ion-list-header>
      <ion-label>Опасная зона</ion-label>
      <HintButton
        text="Удалит эту машину, её параметры ТО, заправки и историю без возможности восстановления. Другие ваши машины не затронет"
      />
    </ion-list-header>
    <ion-item button :detail="false" lines="none" @click="handleDelete">
      <SettingsIconBadge slot="start" :icon="trashOutline" color="danger" />
      <ion-label color="danger">{{ confirmingDelete ? 'Точно удалить эту машину?' : 'Удалить эту машину' }}</ion-label>
    </ion-item>
  </ion-list>
</template>
