<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { IonAlert, IonItem, IonLabel, IonList, IonListHeader } from '@ionic/vue'
import { timeOutline } from 'ionicons/icons'
import SettingsIconBadge from '../SettingsIconBadge.vue'
import HintButton from '../HintButton.vue'
import { listSnapshots, type Snapshot } from '../../utils/backup/autoBackup'
import { useCarStore } from '../../composables/useCarStore'
import { useToast } from '../../composables/useToast'
import { haptic } from '../../utils/haptics'

const toast = useToast()
const store = useCarStore()

const snapshots = ref<Snapshot[]>([])
const snapshotToRestore = ref<Snapshot | null>(null)

async function refreshSnapshots() {
  try {
    snapshots.value = await listSnapshots()
  } catch {
    snapshots.value = []
  }
}

function snapshotLabel(s: Snapshot): string {
  const when = new Date(s.savedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const kind = s.reason === 'daily' ? 'Ежедневная' : s.reason === 'before-migration' ? 'Перед обновлением данных' : 'Перед импортом'
  return `${kind} · ${when}`
}

function snapshotSummary(s: Snapshot): string {
  const b = s.backup
  return `${b.cars.length} авто · ${b.fuelEntries.length} заправок · ${b.historyEntries.length} работ`
}

const restoreAlertButtons = [
  { text: 'Отмена', role: 'cancel' },
  {
    text: 'Восстановить',
    role: 'destructive',
    handler: async () => {
      const snap = snapshotToRestore.value
      if (!snap) return
      const result = await store.importData(snap.backup)
      if (result.ok) {
        haptic('success')
        toast.show('Данные восстановлены из копии')
      } else {
        toast.show(result.error)
      }
      await refreshSnapshots()
    },
  },
]

onMounted(refreshSnapshots)
</script>

<template>
  <ion-list v-if="snapshots.length > 0" inset>
    <ion-list-header>
      <ion-label>Автокопии на этом устройстве</ion-label>
      <HintButton
        text="Приложение само хранит несколько последних копий данных на этом устройстве, а также копию перед каждым импортом или восстановлением из облака. Нажмите на копию, чтобы вернуть данные"
      />
    </ion-list-header>
    <ion-item
      v-for="(snap, index) in snapshots"
      :key="snap.savedAt"
      button
      :detail="false"
      :lines="index === snapshots.length - 1 ? 'none' : undefined"
      @click="snapshotToRestore = snap"
    >
      <SettingsIconBadge slot="start" :icon="timeOutline" color="medium" />
      <ion-label>
        <h3>{{ snapshotLabel(snap) }}</h3>
        <p>{{ snapshotSummary(snap) }}</p>
      </ion-label>
    </ion-item>
  </ion-list>
  <ion-alert
    :is-open="snapshotToRestore !== null"
    header="Восстановить данные?"
    message="Текущие данные будут заменены этой копией. Перед заменой сохранится ещё одна копия, так что действие можно отменить."
    :buttons="restoreAlertButtons"
    @did-dismiss="snapshotToRestore = null"
  />
</template>
