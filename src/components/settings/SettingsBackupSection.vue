<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IonItem, IonLabel, IonList, IonListHeader, IonSelect, IonSelectOption } from '@ionic/vue'
import {
  cloudDownloadOutline,
  cloudUploadOutline,
  documentAttachOutline,
  documentOutline,
  downloadOutline,
  folderOutline,
} from 'ionicons/icons'
import SettingsIconBadge from '../SettingsIconBadge.vue'
import HintButton from '../HintButton.vue'
import { useBackup } from '../../composables/useBackup'
import { BACKUP_INTERVAL_OPTIONS, describeLastBackup } from '../../utils/backup/backupSchedule'
import { useToast } from '../../composables/useToast'
import { haptic } from '../../utils/haptics'

defineProps<{
  importError: string | null
  importCsvError: string | null
}>()

const emit = defineEmits<{
  export: []
  exportPdf: []
  import: [file: File]
  exportCsv: []
  importCsv: [file: File]
}>()

const toast = useToast()
const backup = useBackup()
const intervalValue = computed(() => String(backup.state.intervalDays))
const fileInput = ref<HTMLInputElement | null>(null)
const csvFileInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  void backup.refresh()
})

async function handleBackupInterval(e: CustomEvent) {
  haptic('tap')
  await backup.setInterval(Number(e.detail.value))
}

async function handleSaveBackupNow() {
  haptic('tap')
  await backup.saveNow()
}

async function handlePickFolder() {
  haptic('tap')
  if (await backup.pickFolder()) toast.show('Папка выбрана — копии будут сохраняться в неё сами')
}

function triggerImport() {
  fileInput.value?.click()
}

function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('import', file)
  input.value = ''
}

function triggerImportCsv() {
  csvFileInput.value?.click()
}

function handleCsvFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('importCsv', file)
  input.value = ''
}
</script>

<template>
  <ion-list inset>
    <ion-list-header>
      <ion-label>Резервная копия</ion-label>
      <HintButton
        text="Экспорт сохраняет все машины, параметры ТО, заправки и историю в файл. Импорт полностью заменит текущие данные содержимым файла. CSV-пункты — для обмена данными с приложением «Моя машина» (сторонним, не путать с этим): импорт добавляет заправки и записи ТО к текущим, не удаляя ничего"
      />
    </ion-list-header>
    <ion-item button :detail="false" @click="handleSaveBackupNow">
      <SettingsIconBadge slot="start" :icon="downloadOutline" color="success" />
      <ion-label color="primary" class="ion-text-wrap">
        Сохранить копию данных
        <p>Последняя: {{ describeLastBackup(backup.state.lastAt) }}</p>
      </ion-label>
    </ion-item>
    <ion-item>
      <ion-select
        label="Напоминать о копии"
        :value="intervalValue"
        interface="action-sheet"
        :interface-options="{ cancelText: 'Отмена' }"
        @ion-change="handleBackupInterval"
      >
        <ion-select-option v-for="o in BACKUP_INTERVAL_OPTIONS" :key="o.days" :value="String(o.days)">{{ o.label }}</ion-select-option>
      </ion-select>
    </ion-item>
    <ion-item v-if="backup.state.folderSupported" button :detail="false" @click="backup.state.folderName ? backup.clearFolder() : handlePickFolder()">
      <SettingsIconBadge slot="start" :icon="folderOutline" color="warning" />
      <ion-label class="ion-text-wrap">
        <template v-if="backup.state.folderName">Автосохранение в папку «{{ backup.state.folderName }}»<p>Нажмите, чтобы отключить</p></template>
        <template v-else>Автосохранение копий в папку<p>Выберите папку один раз — копии будут сохраняться сами, когда придёт срок</p></template>
      </ion-label>
    </ion-item>
    <ion-item button :detail="false" @click="emit('exportPdf')">
      <SettingsIconBadge slot="start" :icon="documentOutline" color="danger" />
      <ion-label color="primary">Экспортировать отчёт (PDF)</ion-label>
    </ion-item>
    <ion-item button :detail="false" @click="triggerImport">
      <SettingsIconBadge slot="start" :icon="cloudUploadOutline" color="tertiary" />
      <ion-label color="primary">Импортировать резервную копию</ion-label>
    </ion-item>
    <input
      ref="fileInput"
      type="file"
      accept="application/json"
      class="sr-only"
      @change="handleFileSelected"
    />
    <ion-item button :detail="false" @click="emit('exportCsv')">
      <SettingsIconBadge slot="start" :icon="cloudDownloadOutline" color="success" />
      <ion-label color="primary">Экспортировать в CSV («Моя машина»)</ion-label>
    </ion-item>
    <ion-item button :detail="false" lines="none" @click="triggerImportCsv">
      <SettingsIconBadge slot="start" :icon="documentAttachOutline" color="tertiary" />
      <ion-label color="primary">Импортировать CSV («Моя машина»)</ion-label>
    </ion-item>
    <input
      ref="csvFileInput"
      type="file"
      accept=".csv,text/csv"
      class="sr-only"
      @change="handleCsvFileSelected"
    />
  </ion-list>
  <p v-if="importError" class="hint error">{{ importError }}</p>
  <p v-if="importCsvError" class="hint error">{{ importCsvError }}</p>
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
</style>
