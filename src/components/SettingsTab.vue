<script setup lang="ts">
import { IonContent, IonHeader, IonRefresher, IonRefresherContent, IonTitle, IonToolbar } from '@ionic/vue'
import type { Car } from '../types'
import { handlePullToRefresh } from '../utils/pullToRefresh'
import SettingsCarSection from './settings/SettingsCarSection.vue'
import SettingsNotificationsSection from './settings/SettingsNotificationsSection.vue'
import SettingsPrivacySection from './settings/SettingsPrivacySection.vue'
import SettingsAppearanceSection from './settings/SettingsAppearanceSection.vue'
import SettingsSnapshotsSection from './settings/SettingsSnapshotsSection.vue'
import SettingsAboutSection from './settings/SettingsAboutSection.vue'
import SettingsBackupSection from './settings/SettingsBackupSection.vue'
import SettingsCloudSection from './settings/SettingsCloudSection.vue'
import SettingsDangerSection from './settings/SettingsDangerSection.vue'

defineProps<{
  car: Car
  carCount: number
  masterCount: number
  expenseCount: number
  documentCount: number
  tripCount: number
  importError: string | null
  importCsvError: string | null
}>()

const emit = defineEmits<{
  save: [
    payload: {
      make: string
      model: string
      year: number
      tankCapacity?: number
      vin?: string
      licensePlate?: string
      referenceConsumptionL100km?: number
    },
  ]
  deleteCar: []
  export: []
  exportPdf: []
  import: [file: File]
  exportCsv: []
  importCsv: [file: File]
  openCarSwitcher: []
  openMasters: []
  openExpenses: []
  openComponents: []
  openTrips: []
  openDocuments: []
  sharePassport: []
  notificationsEnabled: []
}>()
</script>

<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-title>Настройки</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content :fullscreen="true">
    <ion-refresher slot="fixed" @ionRefresh="handlePullToRefresh">
      <ion-refresher-content></ion-refresher-content>
    </ion-refresher>

    <ion-header collapse="condense">
      <ion-toolbar>
        <ion-title size="large">Настройки</ion-title>
      </ion-toolbar>
    </ion-header>

    <SettingsCarSection
      :car="car"
      :car-count="carCount"
      :master-count="masterCount"
      :expense-count="expenseCount"
      :document-count="documentCount"
      :trip-count="tripCount"
      @save="emit('save', $event)"
      @open-car-switcher="emit('openCarSwitcher')"
      @open-masters="emit('openMasters')"
      @open-expenses="emit('openExpenses')"
      @open-components="emit('openComponents')"
      @open-trips="emit('openTrips')"
      @open-documents="emit('openDocuments')"
      @share-passport="emit('sharePassport')"
    />
    <SettingsNotificationsSection @notifications-enabled="emit('notificationsEnabled')" />
    <SettingsPrivacySection />
    <SettingsAppearanceSection />
    <SettingsSnapshotsSection />
    <SettingsAboutSection />
    <SettingsBackupSection
      :import-error="importError"
      :import-csv-error="importCsvError"
      @export-pdf="emit('exportPdf')"
      @import="emit('import', $event)"
      @export-csv="emit('exportCsv')"
      @import-csv="emit('importCsv', $event)"
    />
    <SettingsCloudSection />
    <SettingsDangerSection :car-id="car.id" @delete-car="emit('deleteCar')" />
  </ion-content>
</template>
