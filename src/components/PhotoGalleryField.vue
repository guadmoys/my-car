<script setup lang="ts">
import { ref } from 'vue'
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonSpinner, IonThumbnail, IonTitle, IonToolbar } from '@ionic/vue'
import { cameraOutline, closeCircle } from 'ionicons/icons'
import { fileToDataUrl } from '../utils/photo'
import { useToast } from '../composables/useToast'

const props = defineProps<{
  modelValue: string[]
  label?: string
  max?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [photos: string[]]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const viewing = ref<string | null>(null)
const toast = useToast()
const limit = props.max ?? 8

async function handleFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  if (files.length === 0) return
  loading.value = true
  try {
    const next = [...props.modelValue]
    for (const file of files) {
      if (next.length >= limit) {
        toast.show(`Не больше ${limit} фото`)
        break
      }
      next.push(await fileToDataUrl(file))
    }
    emit('update:modelValue', next)
  } catch {
    toast.show('Не удалось загрузить фото')
  } finally {
    loading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function remove(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}
</script>

<template>
  <div class="gallery-field">
    <div class="thumbs">
      <div v-for="(photo, i) in modelValue" :key="i" class="thumb-wrap">
        <ion-thumbnail class="thumb" @click="viewing = photo">
          <img :src="photo" :alt="`Фото ${i + 1}`" />
        </ion-thumbnail>
        <ion-button class="remove-btn" fill="clear" color="danger" size="small" aria-label="Удалить фото" @click="remove(i)">
          <ion-icon slot="icon-only" :icon="closeCircle" />
        </ion-button>
      </div>
    </div>
    <ion-button v-if="modelValue.length < limit" fill="outline" size="small" :disabled="loading" @click="fileInput?.click()">
      <ion-spinner v-if="loading" slot="start" name="dots" />
      <ion-icon v-else slot="start" :icon="cameraOutline" />
      {{ label ?? 'Добавить фото' }}
    </ion-button>
    <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="handleFiles" />

    <ion-modal :is-open="viewing !== null" @did-dismiss="viewing = null">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button @click="viewing = null">Закрыть</ion-button>
          </ion-buttons>
          <ion-title>Фото</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <img v-if="viewing" :src="viewing" alt="Фото" class="full" />
      </ion-content>
    </ion-modal>
  </div>
</template>

<style scoped>
.gallery-field {
  padding: 8px 16px;
}

.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 8px;
}

.thumb-wrap {
  position: relative;
}

.thumb {
  --size: 84px;
  --border-radius: 10px;
}

.remove-btn {
  position: absolute;
  top: -12px;
  right: -12px;
  --padding-start: 0;
  --padding-end: 0;
  margin: 0;
}

.full {
  width: 100%;
  height: auto;
  display: block;
}
</style>
