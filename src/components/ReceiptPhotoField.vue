<script setup lang="ts">
import { ref } from 'vue'
import { IonButton, IonIcon, IonSpinner, IonThumbnail } from '@ionic/vue'
import { cameraOutline, closeCircle } from 'ionicons/icons'
import { fileToDataUrl } from '../utils/photo'
import { useToast } from '../composables/useToast'

defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const toast = useToast()

async function handleFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  loading.value = true
  try {
    emit('update:modelValue', await fileToDataUrl(file))
  } catch {
    toast.show('Не удалось загрузить фото')
  } finally {
    loading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function remove() {
  emit('update:modelValue', undefined)
}
</script>

<template>
  <div class="receipt-field">
    <div v-if="modelValue" class="thumb-wrap">
      <ion-thumbnail class="thumb">
        <img :src="modelValue" alt="Чек" />
      </ion-thumbnail>
      <ion-button class="remove-btn" fill="clear" color="danger" size="small" aria-label="Удалить фото" @click="remove">
        <ion-icon slot="icon-only" :icon="closeCircle" />
      </ion-button>
    </div>
    <ion-button v-else fill="outline" size="small" :disabled="loading" @click="fileInput?.click()">
      <ion-spinner v-if="loading" slot="start" name="dots" />
      <ion-icon v-else slot="start" :icon="cameraOutline" />
      Фото чека
    </ion-button>
    <input ref="fileInput" type="file" accept="image/*" capture="environment" hidden @change="handleFile" />
  </div>
</template>

<style scoped>
.receipt-field {
  padding: 8px 16px;
}

.thumb-wrap {
  position: relative;
  display: inline-block;
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
</style>
