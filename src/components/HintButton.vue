<script setup lang="ts">
import { ref } from 'vue'
import { IonButton, IonContent, IonIcon, IonPopover } from '@ionic/vue'
import { helpCircleOutline } from 'ionicons/icons'
import { haptic } from '../utils/haptics'

defineProps<{
  text: string
}>()

const isOpen = ref(false)
const triggerEvent = ref<Event>()

function present(e: Event) {
  haptic('tap')
  triggerEvent.value = e
  isOpen.value = true
}
</script>

<template>
  <ion-button fill="clear" size="small" class="hint-button" @click="present">
    <ion-icon slot="icon-only" :icon="helpCircleOutline" color="medium" />
  </ion-button>
  <ion-popover :is-open="isOpen" :event="triggerEvent" :show-backdrop="false" @did-dismiss="isOpen = false">
    <ion-content class="hint-popover-content">
      <p>{{ text }}</p>
    </ion-content>
  </ion-popover>
</template>

<style scoped>
.hint-button {
  margin: 0;
  height: 24px;
  --padding-start: 4px;
  --padding-end: 4px;
}

.hint-popover-content {
  --padding-top: 12px;
  --padding-bottom: 12px;
  --padding-start: 14px;
  --padding-end: 14px;
}

.hint-popover-content p {
  margin: 0;
  max-width: 260px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ion-text-color);
}
</style>
