import { ref } from 'vue'
import { useCarStore } from './useCarStore'
import { useToast } from './useToast'
import { submitOnce } from './useSubmitOnce'
import { haptic } from '../utils/haptics'
import type { CarDocument, ComponentType, Expense, ExpensePayload, DocumentType, Master } from '../types'

/** Sheets that add, edit or delete one record (masters, other expenses, component checks, trips, documents) and their handlers. */
export function useRecordSheets() {
  const store = useCarStore()
  const toast = useToast()

  const editingMaster = ref<Master | null | 'new'>(null)
  const editingExpense = ref<Expense | null | 'new'>(null)
  const editingComponentType = ref<ComponentType | null>(null)
  const showTripForm = ref(false)
  const editingDocument = ref<CarDocument | null | 'new'>(null)
  const newDocumentType = ref<DocumentType | undefined>(undefined)

  async function handleSaveMaster(payload: {
    name: string
    phone?: string
    cardNumber?: string
    link?: string
    specialty?: string
  }) {
    await submitOnce(async () => {
      if (editingMaster.value && editingMaster.value !== 'new') {
        await store.updateMaster(editingMaster.value.id, payload)
      } else {
        await store.addMaster(payload)
      }
      editingMaster.value = null
    })
  }

  async function handleDeleteMaster(id: string) {
    const master = store.masters.find((m) => m.id === id)
    const removed = await store.deleteMaster(id)
    if (!removed) return
    haptic('delete')
    toast.show(master ? `«${master.name}» удалён` : 'Мастер удалён', {
      label: 'Отменить',
      onAction: () => store.restoreMaster(removed),
    })
  }

  async function handleSaveExpense(payload: ExpensePayload) {
    await submitOnce(async () => {
      const isNew = !editingExpense.value || editingExpense.value === 'new'
      if (editingExpense.value && editingExpense.value !== 'new') {
        await store.updateExpense(editingExpense.value.id, payload)
      } else {
        await store.addExpense(payload)
      }
      editingExpense.value = null
      if (isNew) {
        haptic('success')
        toast.show('Расход добавлен')
      }
    })
  }

  async function handleDeleteExpense(id: string) {
    const expense = store.expenses.find((e) => e.id === id)
    const removed = await store.deleteExpense(id)
    if (!removed) return
    haptic('delete')
    toast.show(expense ? 'Расход удалён' : 'Запись удалена', {
      label: 'Отменить',
      onAction: () => store.restoreExpense(removed),
    })
  }

  async function handleSaveComponentCheck(payload: {
    type: ComponentType
    season?: 'summer' | 'winter' | 'allseason'
    treadDepthMm?: number
    pressureFront?: number
    pressureRear?: number
    thicknessMm?: number
    installedDate?: number
    note?: string
  }) {
    await submitOnce(async () => {
      await store.addComponentCheck(payload)
      editingComponentType.value = null
      haptic('success')
      toast.show('Запись добавлена')
    })
  }

  async function handleSaveTrip(payload: {
    startMileage: number
    endMileage: number
    purpose: 'business' | 'personal'
    date?: number
    note?: string
  }) {
    await submitOnce(async () => {
      await store.addTrip(payload)
      showTripForm.value = false
      haptic('success')
      toast.show('Поездка добавлена')
    })
  }

  async function handleDeleteTrip(id: string) {
    const removed = await store.deleteTrip(id)
    if (!removed) return
    haptic('delete')
    toast.show('Поездка удалена', {
      label: 'Отменить',
      onAction: () => store.restoreTrip(removed),
    })
  }

  async function handleSaveDocument(payload: {
    type: DocumentType
    title?: string
    number?: string
    issuedDate?: number
    expiryDate?: number
    photos: string[]
    note?: string
  }) {
    await submitOnce(async () => {
      const editing = editingDocument.value
      if (editing && editing !== 'new') {
        await store.updateDocument(editing.id, payload)
        haptic('success')
      } else {
        await store.addDocument(payload)
        haptic('success')
        toast.show('Документ добавлен')
      }
      editingDocument.value = null
      newDocumentType.value = undefined
    })
  }

  async function handleDeleteDocument(id: string) {
    const document = store.documents.find((d) => d.id === id)
    const removed = await store.deleteDocument(id)
    if (!removed) return
    editingDocument.value = null
    haptic('delete')
    toast.show(document ? 'Документ удалён' : 'Запись удалена', {
      label: 'Отменить',
      onAction: () => store.restoreDocument(removed),
    })
  }

  function openNewDocument(type?: DocumentType) {
    newDocumentType.value = type
    editingDocument.value = 'new'
  }

  return {
    editingMaster,
    editingExpense,
    editingComponentType,
    showTripForm,
    editingDocument,
    newDocumentType,
    handleSaveMaster,
    handleDeleteMaster,
    handleSaveExpense,
    handleDeleteExpense,
    handleSaveComponentCheck,
    handleSaveTrip,
    handleDeleteTrip,
    handleSaveDocument,
    handleDeleteDocument,
    openNewDocument,
  }
}
