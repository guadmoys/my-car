import type { Car, CarDocument, DocumentStatus, DocumentType, Expense, ExpenseCategory } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

/** Days before expiry when a document flips to "soon". Renewing insurance takes a while, so this is wider than for expenses. */
export const DOCUMENT_SOON_DAYS = 30

export function documentStatus(document: CarDocument, now: number): DocumentStatus | null {
  if (document.expiryDate === undefined) return null
  const remainingDays = Math.ceil((document.expiryDate - now) / DAY_MS)
  return {
    document,
    isDue: remainingDays <= 0,
    isSoon: remainingDays > 0 && remainingDays <= DOCUMENT_SOON_DAYS,
    remainingDays,
  }
}

/** Statuses for every document that has an expiry date, most urgent first. */
export function documentStatuses(documents: CarDocument[], now: number): DocumentStatus[] {
  return documents
    .map((d) => documentStatus(d, now))
    .filter((s): s is DocumentStatus => s !== null)
    .sort((a, b) => a.remainingDays - b.remainingDays)
}

const EXPENSE_TO_DOCUMENT_TYPE: Record<ExpenseCategory, DocumentType> = {
  insurance: 'insurance',
  tax: 'tax',
  parking: 'other',
  fine: 'other',
  loan: 'other',
  other: 'other',
}

export interface LegacyMigration {
  /** New documents to store. */
  documents: CarDocument[]
  /** Cars whose legacy `stsNumber`/`photos` were moved and must be rewritten without them. */
  cars: Car[]
  /** Expenses whose `renewalDate` was moved and must be rewritten without it. */
  expenses: Expense[]
}

/**
 * Moves everything that is really a "document" out of the places it used to
 * live: the car's STS number and photo gallery, and the renewal dates
 * attached to expenses (insurance, tax, inspection). It works purely off
 * the data, so it is idempotent (ids derive from the source record, and
 * moved fields are cleared) and also handles old backups that get imported
 * later. Expense *costs* stay where they are; only their renewal tracking moves.
 */
export function migrateLegacyToDocuments(
  cars: Car[],
  expenses: Expense[],
  existing: CarDocument[],
  now: number,
): LegacyMigration {
  const existingIds = new Set(existing.map((d) => d.id))
  const documents: CarDocument[] = []
  const changedCars: Car[] = []
  const changedExpenses: Expense[] = []

  for (const car of cars) {
    const hasSts = !!car.stsNumber?.trim()
    const hasPhotos = !!car.photos && car.photos.length > 0
    if (!hasSts && !hasPhotos) continue
    if (hasSts) {
      const id = `doc-sts-${car.id}`
      if (!existingIds.has(id)) {
        documents.push({ id, carId: car.id, type: 'sts', number: car.stsNumber!.trim(), photos: [], createdAt: now })
      }
    }
    if (hasPhotos) {
      const id = `doc-photos-${car.id}`
      if (!existingIds.has(id)) {
        documents.push({
          id,
          carId: car.id,
          type: 'other',
          title: 'Фото машины и документов',
          photos: car.photos!,
          createdAt: now,
        })
      }
    }
    const { stsNumber: _sts, photos: _photos, ...rest } = car
    changedCars.push(rest)
  }

  for (const expense of expenses) {
    if (expense.renewalDate === undefined) continue
    const id = `doc-expense-${expense.id}`
    if (!existingIds.has(id)) {
      documents.push({
        id,
        carId: expense.carId,
        type: EXPENSE_TO_DOCUMENT_TYPE[expense.category],
        title: expense.title,
        issuedDate: expense.date,
        expiryDate: expense.renewalDate,
        photos: [],
        note: expense.note,
        createdAt: now,
      })
    }
    const { renewalDate: _renewal, ...rest } = expense
    changedExpenses.push(rest)
  }

  return { documents, cars: changedCars, expenses: changedExpenses }
}

/** Short status line for a dated document, e.g. "Осталось 12 дн." or "Просрочен на 3 дн.". */
export function expiryLabel(status: DocumentStatus): string {
  if (status.remainingDays < 0) return `Просрочен на ${-status.remainingDays} дн.`
  if (status.remainingDays === 0) return 'Истекает сегодня'
  return `Осталось ${status.remainingDays} дн.`
}

/** Ionic colour name for a status: danger when due, warning-ish tertiary when soon, otherwise undefined. */
export function statusColor(status: DocumentStatus | null): 'due' | 'soon' | undefined {
  if (!status) return undefined
  return status.isDue ? 'due' : status.isSoon ? 'soon' : undefined
}
