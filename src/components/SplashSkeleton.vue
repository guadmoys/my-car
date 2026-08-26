<script setup lang="ts">
import { IonSkeletonText } from '@ionic/vue'
</script>

<template>
  <div class="skeleton-page">
    <ion-skeleton-text :animated="true" class="sk-title" />
    <ion-skeleton-text :animated="true" class="sk-hero" />
    <div class="quick-row">
      <ion-skeleton-text :animated="true" class="sk-quick" />
      <ion-skeleton-text :animated="true" class="sk-quick" />
    </div>
    <ion-skeleton-text :animated="true" class="sk-label" />
    <ion-skeleton-text :animated="true" class="sk-card" />
  </div>
</template>

<style scoped>
.skeleton-page {
  min-height: 100dvh;
  max-width: 560px;
  margin: 0 auto;
  padding: calc(24px + var(--ion-safe-area-top, 0px)) 16px;
}

.sk-title {
  width: 140px;
  height: 30px;
  border-radius: 8px;
  margin: 8px 0 20px;
}

.sk-hero {
  height: 150px;
  border-radius: 16px;
  margin-bottom: 28px;
}

.quick-row {
  display: flex;
  gap: 12px;
  margin-bottom: 28px;
}

.sk-quick {
  flex: 1;
  height: 76px;
  border-radius: 16px;
}

.sk-label {
  width: 120px;
  height: 14px;
  border-radius: 6px;
  margin-bottom: 10px;
}

.sk-card {
  height: 130px;
  border-radius: 16px;
}
</style>
