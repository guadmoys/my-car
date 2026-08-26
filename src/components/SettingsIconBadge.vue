<script setup lang="ts">
import { IonIcon } from '@ionic/vue'

const props = defineProps<{
  icon: string
  /** One of the app's Ionic color tokens (primary/secondary/tertiary/success/warning/danger/medium/dark). */
  color: string
}>()
</script>

<template>
  <span class="icon-badge">
    <ion-icon :icon="props.icon" />
  </span>
</template>

<style scoped>
/* Background/foreground pull from the app's own Ionic color tokens (never a
   hardcoded hex), so a badge automatically gets a contrast-safe icon color
   whatever token it's given — including light backgrounds like `secondary`. */
.icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  background: v-bind('`var(--ion-color-${props.color})`');
  color: v-bind('`var(--ion-color-${props.color}-contrast)`');
}

.icon-badge ion-icon {
  font-size: 16px;
}
</style>
