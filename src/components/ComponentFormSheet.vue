<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { COMPONENT_TYPE_LABELS, type ComponentType } from '../types'

const props = defineProps<{
  type: ComponentType
}>()

const emit = defineEmits<{
  close: []
  save: [
    payload: {
      type: ComponentType
      season?: 'summer' | 'winter' | 'allseason'
      treadDepthMm?: number
      pressureFront?: number
      pressureRear?: number
      thicknessMm?: number
      installedDate?: number
      note?: string
    },
  ]
}>()

const SEASONS: { key: 'summer' | 'winter' | 'allseason'; label: string }[] = [
  { key: 'summer', label: 'Летние' },
  { key: 'winter', label: 'Зимние' },
  { key: 'allseason', label: 'Всесезонные' },
]

const season = ref<'summer' | 'winter' | 'allseason'>('summer')
const treadDepthMm = ref('')
const pressureFront = ref('')
const pressureRear = ref('')
const thicknessMm = ref('')
const installedDateIso = ref(new Date().toISOString())
const note = ref('')

function num(v: string): number | undefined {
  if (v.trim() === '') return undefined
  const n = Number(v.replace(/\s/g, '').replace(',', '.'))
  return Number.isNaN(n) ? undefined : n
}

const isValid = computed(() => {
  if (props.type === 'tires') return treadDepthMm.value.trim() !== '' || pressureFront.value.trim() !== '' || pressureRear.value.trim() !== ''
  if (props.type === 'battery') return true
  return thicknessMm.value.trim() !== ''
})

function handleSave() {
  if (!isValid.value) return
  emit('save', {
    type: props.type,
    season: props.type === 'tires' ? season.value : undefined,
    treadDepthMm: props.type === 'tires' ? num(treadDepthMm.value) : undefined,
    pressureFront: props.type === 'tires' ? num(pressureFront.value) : undefined,
    pressureRear: props.type === 'tires' ? num(pressureRear.value) : undefined,
    thicknessMm: props.type === 'brakePads' ? num(thicknessMm.value) : undefined,
    installedDate: props.type === 'battery' ? new Date(installedDateIso.value).getTime() : undefined,
    note: note.value.trim() || undefined,
  })
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Отмена</ion-button>
        </ion-buttons>
        <ion-title>{{ COMPONENT_TYPE_LABELS[type] }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <template v-if="type === 'tires'">
        <ion-list inset>
          <ion-item lines="full">
            <ion-label class="ion-text-wrap">
              <p>Комплект</p>
              <div class="chips">
                <ion-chip
                  v-for="s in SEASONS"
                  :key="s.key"
                  :color="season === s.key ? 'primary' : undefined"
                  :outline="season !== s.key"
                  @click="season = s.key"
                >
                  {{ s.label }}
                </ion-chip>
              </div>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-input v-model="treadDepthMm" label="Глубина протектора, мм" label-placement="stacked" inputmode="decimal" placeholder="—" />
          </ion-item>
          <ion-item>
            <ion-input v-model="pressureFront" label="Давление, перед, бар" label-placement="stacked" inputmode="decimal" placeholder="—" />
          </ion-item>
          <ion-item lines="none">
            <ion-input v-model="pressureRear" label="Давление, зад, бар" label-placement="stacked" inputmode="decimal" placeholder="—" />
          </ion-item>
        </ion-list>
      </template>

      <template v-else-if="type === 'battery'">
        <ion-list inset>
          <ion-item lines="none">
            <ion-label>Дата установки</ion-label>
            <ion-datetime-button slot="end" datetime="battery-installed-date" />
          </ion-item>
        </ion-list>
        <ion-modal :keep-contents-mounted="true">
          <ion-datetime id="battery-installed-date" v-model="installedDateIso" presentation="date" locale="ru-RU" />
        </ion-modal>
      </template>

      <template v-else>
        <ion-list inset>
          <ion-item lines="none">
            <ion-input v-model="thicknessMm" label="Толщина колодок, мм" label-placement="stacked" inputmode="decimal" placeholder="—" />
          </ion-item>
        </ion-list>
      </template>

      <ion-list inset>
        <ion-item lines="none">
          <ion-input v-model="note" label="Комментарий (необязательно)" label-placement="stacked" placeholder="—" />
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
</style>
