<script setup lang="ts">
import { ref } from 'vue'
import { IonButton, IonIcon, IonSpinner } from '@ionic/vue'
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
      <img :src="modelValue" alt="Чек" class="thumb" />
      <button type="button" class="remove-btn" aria-label="Удалить фото" @click="remove">
        <ion-icon :icon="closeCircle" />
      </button>
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
  width: 84px;
  height: 84px;
  object-fit: cover;
  border-radius: 10px;
  display: block;
}

.remove-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: none;
  border: none;
  padding: 0;
  line-height: 0;
  color: var(--ion-color-danger);
  font-size: 22px;
}
</style>
