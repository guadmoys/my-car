import { computed, onMounted, ref } from 'vue'
import { useCarStore } from './useCarStore'
import { useToast } from './useToast'
import { submitOnce } from './useSubmitOnce'
import { haptic } from '../utils/haptics'
import type { FuelEntry } from '../types'

/** Mileage, fuel and reminder sheets (quick entry from the home screen) plus the fuel-entry editor. */
export function useFuelSheets() {
  const store = useCarStore()
  const toast = useToast()

  const showMileageSheet = ref(false)
  const showFuelSheet = ref(false)
  const showReminderSheet = ref(false)
  const editingFuelEntryId = ref<string | null>(null)
  const editingFuelEntry = computed<FuelEntry | null>(
    () => store.fuelEntries.find((e) => e.id === editingFuelEntryId.value) ?? null,
  )

  // Opens the matching sheet when launched from a PWA shortcut (manifest.shortcuts
  // links to "?action=fuel"/"?action=mileage"), then strips the param so a
  // later reload of the same tab doesn't reopen it.
  onMounted(() => {
    const url = new URL(window.location.href)
    const action = url.searchParams.get('action')
    if (action === 'fuel') showFuelSheet.value = true
    else if (action === 'mileage') showMileageSheet.value = true
    if (action) {
      url.searchParams.delete('action')
      window.history.replaceState({}, '', url)
    }
  })

  async function handleSaveMileage(mileage: number, date: number, isRollback: boolean) {
    await submitOnce(async () => {
      const applied = await store.updateMileage(mileage, date, { allowDecrease: isRollback })
      showMileageSheet.value = false
      if (!applied) {
        toast.show('Уже есть более поздняя запись пробега — текущий пробег не изменён')
        return
      }
      haptic('success')
      toast.show('Пробег обновлён')
    })
  }

  async function handleSaveFuel(payload: {
    mileage: number
    liters: number
    date?: number
    cost?: number
    fuelType?: string
    isFullTank?: boolean
    remainingLiters?: number
    station?: string
    comment?: string
    receiptPhoto?: string
  }) {
    await submitOnce(async () => {
      await store.addFuelEntry(payload)
      showFuelSheet.value = false
      haptic('success')
      toast.show('Заправка добавлена')
    })
  }

  async function handleSaveReminder(payload: {
    text: string
    dueMileage?: number
    dueDate?: number
    hasTime?: boolean
  }) {
    await submitOnce(async () => {
      await store.addReminder(payload)
      showReminderSheet.value = false
      haptic('success')
      toast.show('Напоминание добавлено')
    })
  }

  async function handleDeleteReminder(id: string) {
    const removed = await store.deleteReminder(id)
    if (!removed) return
    haptic('success')
    toast.show(`«${removed.text}» — готово`, {
      label: 'Отменить',
      onAction: () => store.restoreReminder(removed),
    })
  }

  async function handleDeleteFuel(id: string) {
    const removed = await store.deleteFuelEntry(id)
    if (!removed) return
    haptic('delete')
    toast.show('Заправка удалена', {
      label: 'Отменить',
      onAction: () => store.restoreFuelEntry(removed),
    })
  }

  async function handleSaveFuelEntry(payload: {
    mileage: number
    liters: number
    date?: number
    cost?: number
    fuelType?: string
    isFullTank?: boolean
    remainingLiters?: number
    station?: string
    comment?: string
    receiptPhoto?: string
  }) {
    if (!editingFuelEntryId.value) return
    const entry = editingFuelEntry.value
    await submitOnce(async () => {
      await store.updateFuelEntry(editingFuelEntryId.value!, {
        ...payload,
        date: payload.date ?? entry?.date ?? Date.now(),
      })
      editingFuelEntryId.value = null
    })
  }

  return {
    showMileageSheet,
    showFuelSheet,
    showReminderSheet,
    editingFuelEntryId,
    editingFuelEntry,
    handleSaveMileage,
    handleSaveFuel,
    handleSaveReminder,
    handleDeleteReminder,
    handleDeleteFuel,
    handleSaveFuelEntry,
  }
}
