<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
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
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <div class="handle" />
      <div class="header">
        <button class="cancel" @click="emit('close')">Закрыть</button>
        <h2>Паспорт машины</h2>
        <span class="spacer" />
      </div>

      <div class="preview">
        <p v-if="error" class="hint error">{{ error }}</p>
        <div v-else-if="!imageUrl" class="loading">
          <div class="spinner" />
        </div>
        <img v-else :src="imageUrl" alt="Паспорт автомобиля" class="passport-image" />
      </div>

      <div class="actions">
        <button v-if="canShareFiles" class="share-btn" :disabled="!blob" @click="handleShare">
          Поделиться
        </button>
        <button class="download-btn" :disabled="!imageUrl" @click="handleDownload">
          Скачать изображение
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  z-index: 200;
  animation: fade-in 0.15s ease;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.sheet {
  width: 100%;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-grouped);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 8px 0 calc(20px + var(--safe-bottom));
  animation: slide-up 0.25s var(--motion-spring);
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.handle {
  width: 36px;
  height: 5px;
  border-radius: 3px;
  background: var(--text-tertiary);
  margin: 6px auto 4px;
  opacity: 0.5;
  flex-shrink: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 4px;
  flex-shrink: 0;
}

.header h2 {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
}

.cancel {
  font-size: 17px;
  color: var(--blue);
}

.spacer {
  width: 56px;
}

.preview {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading {
  padding: 80px 0;
}

.spinner {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid var(--fill-secondary);
  border-top-color: var(--blue);
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.passport-image {
  width: 100%;
  max-width: 420px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
}

.hint.error {
  color: var(--red);
  padding: 40px 16px;
  text-align: center;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 16px 0;
  flex-shrink: 0;
}

.share-btn {
  width: 100%;
  padding: 14px;
  border-radius: var(--radius-pill);
  background: var(--blue);
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  text-align: center;
}

.share-btn:active {
  opacity: 0.7;
}

.share-btn:disabled {
  opacity: 0.5;
}

.download-btn {
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-pill);
  padding: 13px;
  color: var(--blue);
  font-size: 17px;
  font-weight: 500;
  text-align: center;
}

.download-btn:active {
  opacity: 0.6;
}

.download-btn:disabled {
  opacity: 0.5;
}
</style>
