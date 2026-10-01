<script setup lang="ts">
import { IonSpinner } from '@ionic/vue'
</script>

<template>
  <div class="update-screen" role="status" aria-live="polite">
    <ion-spinner name="crescent" color="primary" class="spinner" />
    <h1>Обновление</h1>
    <p>Устанавливаем новую версию — приложение скоро вернётся</p>
  </div>
</template>

<style scoped>
.update-screen {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  background: var(--ion-background-color);
  color: var(--ion-text-color);
}

.spinner {
  width: 44px;
  height: 44px;
  margin-bottom: 8px;
}

h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

p {
  margin: 0;
  max-width: 260px;
  font-size: 15px;
  color: var(--ion-color-medium);
}
</style>
