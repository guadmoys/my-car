<script setup lang="ts">
import { computed } from 'vue'
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  add,
  cardOutline,
  clipboardOutline,
  documentTextOutline,
  folderOutline,
  imageOutline,
  receiptOutline,
  shieldCheckmarkOutline,
  trash,
} from 'ionicons/icons'
import { DOCUMENT_TYPE_LABELS, type CarDocument, type DocumentStatus, type DocumentType } from '../types'
import { expiryLabel, statusColor } from '../utils/documents'
function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const props = defineProps<{
  documents: CarDocument[]
  statuses: DocumentStatus[]
}>()

const emit = defineEmits<{
  close: []
  add: [type?: DocumentType]
  edit: [document: CarDocument]
  delete: [id: string]
}>()

const TYPE_ICONS: Record<DocumentType, string> = {
  sts: documentTextOutline,
  pts: documentTextOutline,
  license: cardOutline,
  insurance: shieldCheckmarkOutline,
  inspection: clipboardOutline,
  tax: receiptOutline,
  other: folderOutline,
}

/** Types offered as one-tap shortcuts when the list is empty, in the order people usually need them. */
const QUICK_TYPES: DocumentType[] = ['sts', 'pts', 'insurance', 'inspection', 'license']

const TYPE_ORDER = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]

function statusOf(document: CarDocument): DocumentStatus | null {
  return props.statuses.find((s) => s.document.id === document.id) ?? null
}

const attention = computed(() => props.statuses.filter((s) => s.isDue || s.isSoon).map((s) => s.document))

const others = computed(() => {
  const attentionIds = new Set(attention.value.map((d) => d.id))
  return props.documents
    .filter((d) => !attentionIds.has(d.id))
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.createdAt - b.createdAt)
})

function titleOf(document: CarDocument): string {
  return document.title || DOCUMENT_TYPE_LABELS[document.type]
}

function detailLines(document: CarDocument): string[] {
  const lines: string[] = []
  if (document.title) lines.push(DOCUMENT_TYPE_LABELS[document.type])
  if (document.number) lines.push(`№ ${document.number}`)
  if (document.expiryDate !== undefined) lines.push(`до ${fmtDate(document.expiryDate)}`)
  return lines
}
</script>

<template>
  <ion-modal :is-open="true" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">Закрыть</ion-button>
        </ion-buttons>
        <ion-title>Документы</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="Добавить документ" @click="emit('add')">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <template v-if="documents.length === 0">
        <ion-list inset>
          <ion-item lines="none">
            <ion-icon slot="start" :icon="folderOutline" color="medium" />
            <ion-label class="ion-text-wrap" color="medium">
              Храните здесь СТС, ПТС, страховку, техосмотр и права — с фото и сроками действия. Напомним, когда срок
              подойдёт.
            </ion-label>
          </ion-item>
        </ion-list>
        <div class="quick-types">
          <ion-chip v-for="t in QUICK_TYPES" :key="t" outline color="primary" @click="emit('add', t)">
            <ion-icon :icon="add" />
            <ion-label>{{ DOCUMENT_TYPE_LABELS[t] }}</ion-label>
          </ion-chip>
        </div>
      </template>

      <ion-list v-if="attention.length > 0" inset>
        <ion-list-header>
          <ion-label>Требуют внимания</ion-label>
          <ion-note>{{ attention.length }}</ion-note>
        </ion-list-header>
        <ion-item-sliding v-for="d in attention" :key="d.id">
          <ion-item button :detail="false" @click="emit('edit', d)">
            <ion-icon slot="start" :icon="TYPE_ICONS[d.type]" :color="statusColor(statusOf(d))" />
            <ion-label class="ion-text-wrap">
              <h2>{{ titleOf(d) }}</h2>
              <p v-for="line in detailLines(d)" :key="line">{{ line }}</p>
              <p v-if="statusOf(d)" :class="statusOf(d)?.isDue ? 'due-text' : 'soon-text'">{{ expiryLabel(statusOf(d)!) }}</p>
            </ion-label>
            <ion-badge v-if="d.photos.length > 0" slot="end" color="medium">
              <ion-icon :icon="imageOutline" /> {{ d.photos.length }}
            </ion-badge>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" aria-label="Удалить документ" @click="emit('delete', d.id)">
              <ion-icon slot="icon-only" :icon="trash" />
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <ion-list v-if="others.length > 0" inset>
        <ion-list-header>
          <ion-label>{{ attention.length > 0 ? 'Остальные' : 'Все документы' }}</ion-label>
          <ion-note>{{ others.length }}</ion-note>
        </ion-list-header>
        <ion-item-sliding v-for="d in others" :key="d.id">
          <ion-item button :detail="false" @click="emit('edit', d)">
            <ion-icon slot="start" :icon="TYPE_ICONS[d.type]" color="medium" />
            <ion-label class="ion-text-wrap">
              <h2>{{ titleOf(d) }}</h2>
              <p v-for="line in detailLines(d)" :key="line">{{ line }}</p>
              <p v-if="statusOf(d)">{{ expiryLabel(statusOf(d)!) }}</p>
            </ion-label>
            <ion-badge v-if="d.photos.length > 0" slot="end" color="medium">
              <ion-icon :icon="imageOutline" /> {{ d.photos.length }}
            </ion-badge>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" aria-label="Удалить документ" @click="emit('delete', d.id)">
              <ion-icon slot="icon-only" :icon="trash" />
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <ion-button expand="block" fill="outline" class="ion-margin" @click="emit('add')">
        <ion-icon slot="start" :icon="add" />
        Добавить документ
      </ion-button>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.due-text {
  color: var(--ion-color-danger);
}

.soon-text {
  color: var(--ion-color-tertiary);
}

.quick-types {
  display: flex;
  flex-wrap: wrap;
  padding: 0 16px;
}
</style>
