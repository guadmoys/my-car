<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { IonApp } from '@ionic/vue'
import { useCarStore } from './composables/useCarStore'
import { useCloudSync } from './composables/useCloudSync'
import OnboardingView from './components/OnboardingView.vue'
import Dashboard from './components/Dashboard.vue'
import ToastHost from './components/ToastHost.vue'
import SplashSkeleton from './components/SplashSkeleton.vue'
import LockScreen from './components/LockScreen.vue'
import { isLockEnabled } from './utils/appLock'

const store = useCarStore()
const { cars, isLoaded } = store

const locked = ref(isLockEnabled())

/** Re-locks whenever the app comes back from being backgrounded/hidden — not
 * just on cold start — so the passcode actually gates re-entry, not just launch. */
function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && isLockEnabled()) locked.value = true
}

onMounted(() => {
  store.load()
  useCloudSync().initCloudSync()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
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
    <LockScreen v-if="locked" @unlock="locked = false" />
    <template v-else>
      <SplashSkeleton v-if="!isLoaded" />
      <OnboardingView v-else-if="cars.length === 0" @submit="handleOnboardingSubmit" />
      <Dashboard v-else />
    </template>
    <ToastHost />
  </ion-app>
</template>
