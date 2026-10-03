import { computed, ref } from 'vue'
import { useCarStore } from './useCarStore'
import { useToast } from './useToast'
import { submitOnce } from './useSubmitOnce'
import { haptic } from '../utils/haptics'
import type { ExpenseItem, MaintenanceItem, Part } from '../types'

/** The maintenance-item editor, the «Выполнено» sheet and their handlers. */
export function useMaintenanceSheets() {
  const store = useCarStore()
  const toast = useToast()

  const markServicedItem = ref<MaintenanceItem | null>(null)
  const editingItem = ref<MaintenanceItem | null | 'new'>(null)
  const editModalItem = computed(() => (editingItem.value === 'new' ? null : editingItem.value))

  function openEdit(id: string) {
    const item = store.items.find((i) => i.id === id)
    if (item) editingItem.value = item
  }

  function closeEdit() {
    editingItem.value = null
  }

  function handleMarkServiced(id: string) {
    const item = store.items.find((i) => i.id === id)
    if (item) markServicedItem.value = item
  }

  async function handleConfirmMarkServiced(payload: { cost?: number; receiptPhoto?: string; items?: ExpenseItem[]; masterId?: string }) {
    const item = markServicedItem.value
    if (!item) return
    markServicedItem.value = null
    await submitOnce(async () => {
      let result: Awaited<ReturnType<typeof store.markServiced>>
      try {
        result = await store.markServiced(item.id, undefined, payload.cost, payload.receiptPhoto, undefined, payload.items, payload.masterId)
      } catch {
        toast.show('Не удалось сохранить — попробуйте ещё раз')
        return
      }
      if (!result) return
      haptic('success')
      toast.show(`«${item.name}» — выполнено`, {
        label: 'Отменить',
        onAction: () => store.undoMarkServiced(item.id, result),
      })
    })
  }

  async function handleSaveItem(payload: {
    name: string
    intervalKm: number
    intervalKmMax?: number
    intervalMonths?: number
    lastServiceMileage: number
    parts: Part[]
    notifyBeforeKm?: number
    notifyBeforeDays?: number
  }) {
    await submitOnce(async () => {
      if (editModalItem.value) {
        await store.updateItem(editModalItem.value.id, payload)
      }
      closeEdit()
    })
  }

  async function handleCreateItem(payload: {
    name: string
    intervalKm: number
    intervalKmMax?: number
    intervalMonths?: number
    parts: Part[]
    notifyBeforeKm?: number
    notifyBeforeDays?: number
  }) {
    await submitOnce(async () => {
      await store.addCustomItem(payload)
      closeEdit()
    })
  }

  async function handleDeleteItem(id: string) {
    const item = store.items.find((i) => i.id === id)
    const removed = await store.deleteItem(id)
    closeEdit()
    if (!removed) return
    haptic('delete')
    toast.show(item ? `«${item.name}» удалён` : 'Параметр удалён', {
      label: 'Отменить',
      onAction: () => store.restoreItem(removed),
    })
  }

  async function handleBulkDelete(ids: string[]) {
    if (ids.length === 0) return
    const removed = (await Promise.all(ids.map((id) => store.deleteItem(id)))).filter(
      (item): item is MaintenanceItem => item !== null,
    )
    if (removed.length === 0) return
    haptic('delete')
    toast.show(removed.length === 1 ? `«${removed[0].name}» удалён` : `Удалено параметров: ${removed.length}`, {
      label: 'Отменить',
      onAction: () => Promise.all(removed.map((item) => store.restoreItem(item))),
    })
  }

  async function handleUpdateHistory(
    id: string,
    payload: { itemName: string; mileage: number; date: number; cost?: number; receiptPhoto?: string; note?: string; items?: ExpenseItem[]; masterId?: string },
  ) {
    await submitOnce(() => store.updateHistoryEntry(id, payload))
  }

  return {
    markServicedItem,
    editingItem,
    editModalItem,
    openEdit,
    closeEdit,
    handleMarkServiced,
    handleConfirmMarkServiced,
    handleSaveItem,
    handleCreateItem,
    handleDeleteItem,
    handleBulkDelete,
    handleUpdateHistory,
  }
}
