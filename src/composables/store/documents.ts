import * as db from '../../db/database'
import type { CarDocument, DocumentStatus, DocumentType } from '../../types'
import { documentStatuses as buildDocumentStatuses } from '../../utils/documents'
import { computed } from 'vue'
import { car, documents, makeId, nowTs } from './state'

export async function addDocument(input: {
  type: DocumentType
  title?: string
  number?: string
  issuedDate?: number
  expiryDate?: number
  photos?: string[]
  note?: string
}): Promise<void> {
  if (!car.value) return
  const document: CarDocument = {
    id: makeId(),
    carId: car.value.id,
    type: input.type,
    title: input.title?.trim() || undefined,
    number: input.number?.trim() || undefined,
    issuedDate: input.issuedDate,
    expiryDate: input.expiryDate,
    photos: input.photos ?? [],
    note: input.note?.trim() || undefined,
    createdAt: nowTs(),
  }
  documents.push(document)
  await db.putDocument(document)
}

export async function updateDocument(
  id: string,
  patch: {
    type: DocumentType
    title?: string
    number?: string
    issuedDate?: number
    expiryDate?: number
    photos: string[]
    note?: string
  },
): Promise<void> {
  const document = documents.find((d) => d.id === id)
  if (!document) return
  document.type = patch.type
  document.title = patch.title?.trim() || undefined
  document.number = patch.number?.trim() || undefined
  document.issuedDate = patch.issuedDate
  document.expiryDate = patch.expiryDate
  document.photos = patch.photos
  document.note = patch.note?.trim() || undefined
  await db.putDocument({ ...document, photos: [...document.photos] })
}

export async function deleteDocument(id: string): Promise<CarDocument | null> {
  const index = documents.findIndex((d) => d.id === id)
  if (index === -1) return null
  const [removed] = documents.splice(index, 1)
  await db.deleteDocument(id)
  return removed
}

export async function restoreDocument(document: CarDocument): Promise<void> {
  if (documents.some((d) => d.id === document.id)) return
  documents.push(document)
  await db.putDocument(document)
}

/** Due/soon status for every document that has an expiry date, most urgent first. */
export const documentStatuses = computed<DocumentStatus[]>(() => buildDocumentStatuses(documents, Date.now()))

