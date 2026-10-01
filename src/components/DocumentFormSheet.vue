<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonThumbnail,
  IonTitle,
  IonToggle,
  IonToolbar,
  type ToggleCustomEvent,
} from '@ionic/vue'
import { cameraOutline, closeCircle, trashOutline } from 'ionicons/icons'
import { DOCUMENT_TYPE_LABELS, type CarDocument, type DocumentType } from '../types'
import { fileToDataUrl } from '../utils/photo'
import { useToast } from '../composables/useToast'
import { haptic } from '../utils/haptics'

const props = defineProps<{
  document: CarDocument | null
  /** Pre-selected type for a new document (e.g. from a quick-add chip). */
  presetType?: DocumentType
}>()

const emit = defineEmits<{
  close: []
  save: [
    payload: {
      type: DocumentType
      title?: string
      number?: string
      issuedDate?: number
      expiryDate?: number
      photos: string[]
      note?: string
    },
  ]
  delete: [id: string]
}>()

const TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]
const toast = useToast()

const type = ref<DocumentType>(props.document?.type ?? props.presetType ?? 'sts')
const title = ref(props.document?.title ?? '')
const number = ref(props.document?.number ?? '')
const hasIssued = ref(props.document?.issuedDate !== undefined)
const issuedIso = ref(new Date(props.document?.issuedDate ?? Date.now()).toISOString())
const hasExpiry = ref(props.document?.expiryDate !== undefined)
const expiryIso = ref(new Date(props.document?.expiryDate ?? Date.now()).toISOString())
const photos = ref<string[]>([...(props.document?.photos ?? [])])
const note = ref(props.document?.note ?? '')
const viewing = ref<string | null>(null)
const loadingPhoto = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const heading = computed(() => (props.document ? 'Документ' : 'Новый документ'))

async function handleFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length === 0) return
  loadingPhoto.value = true
  try {
    for (const file of files) photos.value.push(await fileToDataUrl(file))
  } catch {
    toast.show('Не удалось загрузить фото')
  } finally {
    loadingPhoto.value = false
    input.value = ''
  }
}

function removePhoto(index: number) {
  haptic('tap')
  photos.value.splice(index, 1)
}

function handleSave() {
  emit('save', {
    type: type.value,
    title: title.value.trim() || undefined,
    number: number.value.trim() || undefined,
    issuedDate: hasIssued.value ? new Date(issuedIso.value).getTime() : undefined,
    expiryDate: hasExpiry.value ? new Date(expiryIso.value).getTime() : undefined,
    photos: photos.value,
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
        <ion-title>{{ heading }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" @click="handleSave">Готово</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list inset>
        <ion-item>
          <ion-select v-model="type" label="Тип" interface="action-sheet" :interface-options="{ cancelText: 'Отмена' }">
            <ion-select-option v-for="t in TYPES" :key="t" :value="t">{{ DOCUMENT_TYPE_LABELS[t] }}</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input
            v-model="title"
            label="Название (необязательно)"
            label-placement="stacked"
            :placeholder="DOCUMENT_TYPE_LABELS[type]"
          />
        </ion-item>
        <ion-item lines="none">
          <ion-input v-model="number" label="Серия и номер (необязательно)" label-placement="stacked" placeholder="—" />
        </ion-item>
      </ion-list>

      <ion-list inset>
        <ion-item :lines="hasIssued ? 'full' : 'none'">
          <ion-toggle :checked="hasIssued" @ion-change="(e: ToggleCustomEvent) => (hasIssued = e.detail.checked)">
            Дата выдачи
          </ion-toggle>
        </ion-item>
        <ion-item v-if="hasIssued" lines="none">
          <ion-label>Выдан</ion-label>
          <ion-datetime-button slot="end" datetime="doc-issued-date" />
        </ion-item>
      </ion-list>
      <ion-modal v-if="hasIssued" :keep-contents-mounted="true">
        <ion-datetime id="doc-issued-date" v-model="issuedIso" presentation="date" locale="ru-RU" />
      </ion-modal>

      <ion-list inset>
        <ion-item :lines="hasExpiry ? 'full' : 'none'">
          <ion-toggle :checked="hasExpiry" @ion-change="(e: ToggleCustomEvent) => (hasExpiry = e.detail.checked)">
            Есть срок действия
          </ion-toggle>
        </ion-item>
        <ion-item v-if="hasExpiry" lines="none">
          <ion-label>Действует до</ion-label>
          <ion-datetime-button slot="end" datetime="doc-expiry-date" />
        </ion-item>
      </ion-list>
      <ion-modal v-if="hasExpiry" :keep-contents-mounted="true">
        <ion-datetime id="doc-expiry-date" v-model="expiryIso" presentation="date" locale="ru-RU" />
      </ion-modal>
      <ion-note v-if="hasExpiry" color="medium" class="hint">
        Напомним за 30 дней до окончания срока
      </ion-note>

      <ion-list inset>
        <ion-list-header>
          <ion-label>Фото</ion-label>
        </ion-list-header>
        <ion-item lines="none">
          <div class="photo-row">
            <div v-for="(photo, index) in photos" :key="index" class="photo-wrap">
              <ion-thumbnail class="photo-thumb" @click="viewing = photo">
                <img :src="photo" alt="Фото документа" />
              </ion-thumbnail>
              <ion-button
                class="photo-remove"
                fill="clear"
                color="danger"
                size="small"
                aria-label="Удалить фото"
                @click="removePhoto(index)"
              >
                <ion-icon slot="icon-only" :icon="closeCircle" />
              </ion-button>
            </div>
            <ion-button
              fill="outline"
              color="medium"
              class="photo-add"
              aria-label="Добавить фото"
              :disabled="loadingPhoto"
              @click="fileInput?.click()"
            >
              <ion-spinner v-if="loadingPhoto" slot="icon-only" name="dots" />
              <ion-icon v-else slot="icon-only" :icon="cameraOutline" />
            </ion-button>
          </div>
        </ion-item>
        <input ref="fileInput" type="file" accept="image/*" multiple class="sr-only" @change="handleFiles" />
      </ion-list>

      <ion-list inset>
        <ion-item lines="none">
          <ion-textarea v-model="note" label="Заметка (необязательно)" label-placement="stacked" :auto-grow="true" placeholder="—" />
        </ion-item>
      </ion-list>

      <ion-button
        v-if="document"
        expand="block"
        fill="outline"
        color="danger"
        class="ion-margin"
        @click="emit('delete', document.id)"
      >
        <ion-icon slot="start" :icon="trashOutline" />
        Удалить документ
      </ion-button>

      <ion-modal :is-open="viewing !== null" @did-dismiss="viewing = null">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="end">
              <ion-button @click="viewing = null">Закрыть</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <img v-if="viewing" :src="viewing" alt="Фото документа" class="viewer-img" />
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.photo-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 0;
}

.photo-wrap {
  position: relative;
}

.photo-thumb {
  --size: 72px;
  --border-radius: 10px;
}

.photo-remove {
  position: absolute;
  top: -12px;
  right: -12px;
  --padding-start: 0;
  --padding-end: 0;
  margin: 0;
}

.photo-add {
  width: 72px;
  height: 72px;
  margin: 0;
  --border-style: dashed;
}

.hint {
  display: block;
  font-size: 12px;
  margin: 6px 32px;
}

.viewer-img {
  display: block;
  width: 100%;
  height: auto;
}
</style>
