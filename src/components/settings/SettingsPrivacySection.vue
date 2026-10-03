<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { IonItem, IonLabel, IonList, IonListHeader, IonNote, IonToggle, type ToggleCustomEvent } from '@ionic/vue'
import { fingerPrintOutline, keyOutline, lockClosedOutline, shieldCheckmarkOutline } from 'ionicons/icons'
import SettingsIconBadge from '../SettingsIconBadge.vue'
import HintButton from '../HintButton.vue'
import AppLockSheet from '../AppLockSheet.vue'
import VaultSetupSheet from '../VaultSetupSheet.vue'
import VaultManageSheet from '../VaultManageSheet.vue'
import { isVaultEnabled } from '../../utils/security/vault'
import {
  disableBiometric,
  disableLock,
  isBiometricEnabled,
  isLockEnabled,
  isPlatformAuthenticatorAvailable,
  registerBiometric,
} from '../../utils/security/appLock'

const lockOn = ref(isLockEnabled())
const vaultOn = ref(isVaultEnabled())
const showVaultSetup = ref(false)
const showVaultManage = ref(false)
const biometricOn = ref(isBiometricEnabled())
const biometricSupported = ref(false)
const showAppLockSheet = ref(false)

onMounted(async () => {
  biometricSupported.value = await isPlatformAuthenticatorAvailable()
})

function handleVaultSetupDone() {
  showVaultSetup.value = false
  vaultOn.value = isVaultEnabled()
  // Turning encryption on disables the screen PIN (see commitEncryption).
  lockOn.value = isLockEnabled()
  biometricOn.value = isBiometricEnabled()
}

function handleVaultDisabled() {
  showVaultManage.value = false
  vaultOn.value = false
}

function handleTogglePasscode(checked: boolean) {
  if (checked) {
    showAppLockSheet.value = true
    return
  }
  disableLock()
  lockOn.value = false
  biometricOn.value = false
}

function handleAppLockSaved() {
  showAppLockSheet.value = false
  lockOn.value = true
}

async function handleToggleBiometric(checked: boolean) {
  if (!checked) {
    disableBiometric()
    biometricOn.value = false
    return
  }
  const ok = await registerBiometric()
  biometricOn.value = ok
}
</script>

<template>
  <ion-list inset>
    <ion-list-header>
      <ion-label>Конфиденциальность</ion-label>
      <HintButton
        text="Шифрование защищает сами данные: без пароля их не прочитать даже с доступом к памяти устройства. Код-пароль только блокирует экран — данные остаются в открытом виде"
      />
    </ion-list-header>
    <ion-item button :detail="true" :lines="vaultOn ? 'none' : 'full'" @click="vaultOn ? (showVaultManage = true) : (showVaultSetup = true)">
      <SettingsIconBadge slot="start" :icon="shieldCheckmarkOutline" :color="vaultOn ? 'success' : 'medium'" />
      <ion-label>Шифрование данных</ion-label>
      <ion-note slot="end" :color="vaultOn ? 'success' : undefined">{{ vaultOn ? 'Включено' : 'Выключено' }}</ion-note>
    </ion-item>
    <ion-item v-if="!vaultOn" :lines="lockOn && biometricSupported ? 'full' : 'none'">
      <SettingsIconBadge slot="start" :icon="lockClosedOutline" color="medium" />
      <ion-toggle
        justify="space-between"
        :checked="lockOn"
        @ion-change="(e: ToggleCustomEvent) => handleTogglePasscode(e.detail.checked)"
      >
        Код-пароль
      </ion-toggle>
    </ion-item>
    <ion-item v-if="!vaultOn && lockOn && biometricSupported" lines="none">
      <SettingsIconBadge slot="start" :icon="fingerPrintOutline" color="dark" />
      <ion-toggle
        justify="space-between"
        :checked="biometricOn"
        @ion-change="(e: ToggleCustomEvent) => handleToggleBiometric(e.detail.checked)"
      >
        Face ID / отпечаток
      </ion-toggle>
    </ion-item>
    <ion-item v-if="!vaultOn && lockOn" button :detail="false" lines="none" @click="showAppLockSheet = true">
      <SettingsIconBadge slot="start" :icon="keyOutline" color="medium" />
      <ion-label color="primary">Изменить код-пароль</ion-label>
    </ion-item>
  </ion-list>

  <VaultSetupSheet v-if="showVaultSetup" @close="showVaultSetup = false" @done="handleVaultSetupDone" />
  <VaultManageSheet v-if="showVaultManage" @close="showVaultManage = false" @disabled="handleVaultDisabled" />

  <AppLockSheet
    v-if="showAppLockSheet"
    @close="showAppLockSheet = false"
    @saved="handleAppLockSaved"
  />
</template>
