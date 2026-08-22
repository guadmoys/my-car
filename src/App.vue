<script setup lang="ts">
import { onMounted } from 'vue'
import { useCarStore } from './composables/useCarStore'
import OnboardingView from './components/OnboardingView.vue'
import Dashboard from './components/Dashboard.vue'
import ToastHost from './components/ToastHost.vue'
import SplashSkeleton from './components/SplashSkeleton.vue'

const store = useCarStore()
const { cars, isLoaded } = store

onMounted(() => {
  store.load()
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
  <SplashSkeleton v-if="!isLoaded" />
  <OnboardingView v-else-if="cars.length === 0" @submit="handleOnboardingSubmit" />
  <Dashboard v-else />
  <ToastHost />
</template>
