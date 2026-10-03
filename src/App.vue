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
import VaultUnlockScreen from './components/VaultUnlockScreen.vue'
import UpdateScreen from './components/UpdateScreen.vue'
import { isLockEnabled } from './utils/appLock'
import { isUpdating } from './utils/appUpdate'
import { getAutoLockMinutes, isVaultEnabled, isVaultUnlocked, lockVault, onVaultStateChange } from './utils/vault'
import { resumeInterruptedMigration } from './utils/vaultActions'

const store = useCarStore()
const { cars, isLoaded } = store

const locked = ref(isLockEnabled() && !isVaultEnabled())
/** True while encryption is on and the key isn't in memory: nothing is read from storage until it is. */
const vaultLocked = ref(isVaultEnabled() && !isVaultUnlocked())

let started = false

/** Loads data and starts background work. With encryption on, this waits for the unlock. */
async function startApp() {
  if (started) return
  started = true
  await resumeInterruptedMigration().catch(() => {})
  void store.load()
  useCloudSync().initCloudSync()
}

function handleVaultUnlocked() {
  vaultLocked.value = false
  void startApp()
}

let hiddenAt: number | null = null

/** Re-locks whenever the app comes back from being backgrounded/hidden — not
 * just on cold start — so the passcode actually gates re-entry, not just launch.
 * With encryption on, the key is dropped once the app has been away longer
 * than the chosen auto-lock delay. */
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now()
    return
  }
  if (isVaultEnabled()) {
    const away = hiddenAt === null ? 0 : Date.now() - hiddenAt
    if (isVaultUnlocked() && away >= getAutoLockMinutes() * 60_000) lockVault()
  } else if (isLockEnabled()) {
    locked.value = true
  }
  hiddenAt = null
}

let stopVaultWatch: (() => void) | undefined

onMounted(() => {
  stopVaultWatch = onVaultStateChange(() => {
    // Only ever *raises* the lock here. The unlock screen must stay up until it says it is done
    // (after a recovery-code login it still has to ask for a new passphrase), so lowering the
    // flag is that screen's job (handleVaultUnlocked), not a reaction to the key appearing.
    if (isVaultEnabled() && !isVaultUnlocked()) vaultLocked.value = true
    // Encryption was just turned on or off from Settings: the PIN gate no longer applies / is back.
    locked.value = false
  })
  if (!isVaultEnabled()) void startApp()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  stopVaultWatch?.()
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
    <UpdateScreen v-if="isUpdating" />
    <VaultUnlockScreen v-else-if="vaultLocked" @unlock="handleVaultUnlocked" />
    <LockScreen v-else-if="locked" @unlock="locked = false" />
    <template v-else>
      <SplashSkeleton v-if="!isLoaded" />
      <OnboardingView v-else-if="cars.length === 0" @submit="handleOnboardingSubmit" />
      <Dashboard v-else />
    </template>
    <ToastHost />
  </ion-app>
</template>
