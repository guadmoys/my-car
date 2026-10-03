<script setup lang="ts">
import { computed } from 'vue'
import {
  IonAvatar,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSegment,
  IonSegmentButton,
  IonToggle,
  type SegmentCustomEvent,
  type ToggleCustomEvent,
} from '@ionic/vue'
import { closeCircleOutline, cloudDownloadOutline, refreshOutline, syncOutline } from 'ionicons/icons'
import SettingsIconBadge from '../SettingsIconBadge.vue'
import HintButton from '../HintButton.vue'
import { askBackupSecret } from '../../utils/security/secretPrompt'
import { confirmDialog } from '../../utils/confirmDialog'
import { useToast } from '../../composables/useToast'
import { haptic } from '../../utils/haptics'
import { useCloudSync } from '../../composables/useCloudSync'
import type { CloudProvider } from '../../utils/backup/cloudSync'

const toast = useToast()
const cloudSync = useCloudSync()

const cloudProviders: { id: CloudProvider; label: string }[] = [
  { id: 'google', label: 'Google Диск' },
  { id: 'yandex', label: 'Яндекс.Диск' },
]

const activeAccount = computed(() => {
  const provider = cloudSync.state.activeProvider
  return provider ? cloudSync.state.accounts[provider] : null
})

const accountInitial = computed(() => {
  const name = activeAccount.value?.name || activeAccount.value?.email || '?'
  return name.charAt(0).toUpperCase()
})

const activeLastSync = computed(() => {
  const provider = cloudSync.state.activeProvider
  return provider ? cloudSync.state.lastSync[provider] : null
})

function formatSyncDate(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function handleSelectProvider(event: SegmentCustomEvent) {
  const provider = event.detail.value as CloudProvider
  if (!cloudSync.isProviderConfigured(provider) || cloudSync.state.activeProvider === provider) return
  void cloudSync.connect(provider)
}

function handleSyncNow() {
  haptic('tap')
  void cloudSync.syncNow()
}

async function handleRestoreFromCloud() {
  const provider = cloudSync.state.activeProvider
  if (!provider) return
  const confirmed = await confirmDialog(
    'Восстановление заменит текущие данные на устройстве резервной копией из облака. Продолжить?',
    { header: 'Восстановить из облака', confirmText: 'Восстановить', destructive: true },
  )
  if (!confirmed) return
  haptic('tap')
  const result = await cloudSync.restoreFromCloud(provider, askBackupSecret)
  toast.show(result.ok ? 'Данные восстановлены из облака' : result.error)
}

function handleDisconnectCloud() {
  const provider = cloudSync.state.activeProvider
  if (provider) cloudSync.disconnect(provider)
}
</script>

<template>
  <ion-list inset>
    <ion-list-header>
      <ion-label>Облако</ion-label>
      <HintButton
        text="Выберите облако и войдите в свой аккаунт, чтобы хранить резервную копию онлайн и синхронизировать её между устройствами"
      />
    </ion-list-header>
    <ion-item lines="none">
      <ion-segment :value="cloudSync.state.activeProvider ?? undefined" @ionChange="handleSelectProvider">
        <ion-segment-button
          v-for="p in cloudProviders"
          :key="p.id"
          :value="p.id"
          :disabled="!cloudSync.isProviderConfigured(p.id)"
        >
          <ion-label>{{ p.label }}</ion-label>
        </ion-segment-button>
      </ion-segment>
    </ion-item>
  </ion-list>

  <template v-if="activeAccount">
    <ion-list inset>
      <ion-item lines="full">
        <ion-avatar slot="start" class="cloud-avatar">{{ accountInitial }}</ion-avatar>
        <ion-label>
          <h2>{{ activeAccount.name }}</h2>
          <p v-if="activeAccount.email">{{ activeAccount.email }}</p>
        </ion-label>
      </ion-item>
      <ion-item lines="none">
        <SettingsIconBadge slot="start" :icon="syncOutline" color="success" />
        <ion-toggle justify="space-between" :checked="cloudSync.state.autoSync" @ion-change="(e: ToggleCustomEvent) => cloudSync.setAutoSync(e.detail.checked)">
          Автосинхронизация
        </ion-toggle>
      </ion-item>
    </ion-list>
    <ion-list inset>
      <ion-item button :detail="false" :disabled="cloudSync.state.syncing" @click="handleSyncNow">
        <SettingsIconBadge slot="start" :icon="refreshOutline" color="primary" />
        <ion-label color="primary">{{ cloudSync.state.syncing ? 'Синхронизация…' : 'Синхронизировать сейчас' }}</ion-label>
      </ion-item>
      <ion-item button :detail="false" :disabled="cloudSync.state.syncing" @click="handleRestoreFromCloud">
        <SettingsIconBadge slot="start" :icon="cloudDownloadOutline" color="tertiary" />
        <ion-label color="primary">Восстановить из облака</ion-label>
      </ion-item>
      <ion-item button :detail="false" lines="none" @click="handleDisconnectCloud">
        <SettingsIconBadge slot="start" :icon="closeCircleOutline" color="danger" />
        <ion-label color="danger">Отключить облако</ion-label>
      </ion-item>
    </ion-list>
    <p v-if="cloudSync.state.error" class="hint error">{{ cloudSync.state.error }}</p>
    <p v-else-if="activeLastSync" class="hint">
      Последняя синхронизация: {{ formatSyncDate(activeLastSync.savedAt) }} · версия {{ activeLastSync.appVersion }}
    </p>
    <p v-else class="hint">Ещё не синхронизировалось</p>
  </template>
</template>

<style scoped>
.hint {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin: 4px 32px 16px;
  line-height: 1.4;
}

.hint.error {
  color: var(--ion-color-danger);
}

.cloud-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
}
</style>
