<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import type { PassportData } from '../utils/carPassport'
import { generatePassportImage } from '../utils/carPassport'
import { haptic } from '../utils/haptics'

const props = defineProps<{
  data: PassportData
}>()

const emit = defineEmits<{
  close: []
}>()

const imageUrl = ref<string | null>(null)
const blob = ref<Blob | null>(null)
const error = ref<string | null>(null)

const canShareFiles = typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator

function fileName(): string {
  const { make, model } = props.data.car
  return `passport-${make}-${model}`.toLowerCase().replace(/\s+/g, '-') + '.png'
}

async function handleShare() {
  if (!blob.value) return
  haptic('tap')
  const file = new File([blob.value], fileName(), { type: 'image/png' })
  if (canShareFiles && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Паспорт автомобиля',
        text: `${props.data.car.make} ${props.data.car.model} ${props.data.car.year}`,
      })
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  } else {
    handleDownload()
  }
}

function handleDownload() {
  if (!imageUrl.value) return
  haptic('tap')
  const a = document.createElement('a')
  a.href = imageUrl.value
  a.download = fileName()
  a.click()
}

onMounted(async () => {
  try {
    const generated = await generatePassportImage(props.data)
    blob.value = generated
    imageUrl.value = URL.createObjectURL(generated)
  } catch {
    error.value = 'Не удалось сформировать изображение'
  }
})

onBeforeUnmount(() => {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Закрыть</ion-button>
        </ion-buttons>
        <ion-title>Паспорт машины</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="preview">
        <p v-if="error" class="hint error">{{ error }}</p>
        <ion-spinner v-else-if="!imageUrl" name="circular" />
        <img v-else :src="imageUrl" alt="Паспорт автомобиля" class="passport-image" />
      </div>

      <div class="actions">
        <ion-button v-if="canShareFiles" expand="block" :disabled="!blob" @click="handleShare">
          Поделиться
        </ion-button>
        <ion-button expand="block" fill="outline" :disabled="!imageUrl" @click="handleDownload">
          Скачать изображение
        </ion-button>
      </div>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 16px 0;
}

.passport-image {
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.hint.error {
  color: var(--ion-color-danger);
  text-align: center;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
