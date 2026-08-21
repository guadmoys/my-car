<script setup lang="ts">
import { onMounted } from 'vue'
import { useCarStore } from './composables/useCarStore'
import OnboardingView from './components/OnboardingView.vue'
import Dashboard from './components/Dashboard.vue'

const store = useCarStore()
const { car, isLoaded } = store

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
  <div v-if="!isLoaded" class="splash" />
  <OnboardingView v-else-if="!car" @submit="handleOnboardingSubmit" />
  <Dashboard v-else />
</template>

<style scoped>
.splash {
  min-height: 100dvh;
}
</style>
