<script setup lang="ts">
import { onMounted } from 'vue'
import { IonApp } from '@ionic/vue'
import { useCarStore } from './composables/useCarStore'
import { useCloudSync } from './composables/useCloudSync'
import OnboardingView from './components/OnboardingView.vue'
import Dashboard from './components/Dashboard.vue'
import ToastHost from './components/ToastHost.vue'
import SplashSkeleton from './components/SplashSkeleton.vue'

const store = useCarStore()
const { cars, isLoaded } = store

onMounted(() => {
  store.load()
  useCloudSync().initCloudSync()
})

async function handleOnboardingSubmit(payload: {
  make: string
  model: string
  year: number
  initialMileage: number
}) {
  await store.createCar(payload)
}
</script>

<template>
  <ion-app>
    <SplashSkeleton v-if="!isLoaded" />
    <OnboardingView v-else-if="cars.length === 0" @submit="handleOnboardingSubmit" />
    <Dashboard v-else />
    <ToastHost />
  </ion-app>
</template>
