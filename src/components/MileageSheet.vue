<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonList, IonModal, IonNote, IonTitle, IonToolbar } from '@ionic/vue'
import { mileageInputSeed } from '../utils/mileage'

const props = defineProps<{
  currentMileage: number
}>()

const emit = defineEmits<{
  close: []
  save: [mileage: number]
}>()

const value = ref(mileageInputSeed(props.currentMileage))
// The seeded value is deliberately below currentMileage (only the trailing
// digits are missing) — don't flag it as "too low" until the user actually
// types something.
const touched = ref(false)

const number = computed(() => Number(value.value.replace(/\s/g, '')))
const isValid = computed(
  () => value.value.trim().length > 0 && !Number.isNaN(number.value) && number.value >= props.currentMileage,
)

function handleSave() {
  if (!isValid.value) return
  emit('save', Math.round(number.value))
}
</script>

<template>
  <ion-modal :is-open="true" :breakpoints="[0, 1]" :initial-breakpoint="1" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Отмена</ion-button>
        </ion-buttons>
        <ion-title>Пробег</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="!isValid" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item lines="none">
          <ion-input
            v-model="value"
            label="Текущий пробег, км"
            label-placement="stacked"
            type="text"
            inputmode="numeric"
            autofocus
            @ion-input="touched = true"
          />
        </ion-item>
      </ion-list>
      <ion-note v-if="touched && !isValid" color="medium" class="hint">
        Новый пробег не может быть меньше текущего ({{ currentMileage.toLocaleString('ru-RU') }} км)
      </ion-note>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.hint {
  display: block;
  font-size: 13px;
  margin: 8px 32px 0;
}
</style>
