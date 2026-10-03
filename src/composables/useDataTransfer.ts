import { ref } from 'vue'
import { useCarStore } from './useCarStore'
import { useBackup } from './useBackup'
import { useToast } from './useToast'
import { currency } from '../utils/money/currency'
import { haptic } from '../utils/haptics'
import { confirmDialog } from '../utils/confirmDialog'
import { isVaultEnabled } from '../utils/security/vault'
import { askBackupSecret } from '../utils/security/secretPrompt'
import { resolveBackupData } from '../utils/backup/backupFile'
import { buildExpensesCsv } from '../utils/money/expensesCsv'
import { buildCostStructure } from '../utils/money/costStructure'
import { generateReportPdf } from '../utils/pdfReport'
import { buildMoyaMashinaCsv, parseMoyaMashinaCsv } from '../utils/carCsvFormat'
import { downloadTextFile, todayStamp } from '../utils/download'

/** Everything that moves data in or out of the app: backup, CSV tables, the PDF report, and their import errors. */
export function useDataTransfer() {
  const store = useCarStore()
  const { car, statuses, timelineEvents, totalFuelCost, totalServiceCost, totalExpensesCost, totalCost, totalBusinessKm, totalPersonalKm } = store
  const backup = useBackup()
  const toast = useToast()
  const importError = ref<string | null>(null)
  const importCsvError = ref<string | null>(null)

  /** CSV tables and the PDF report are plain files even with encryption on; make that explicit before saving one. */
  async function confirmPlainExport(): Promise<boolean> {
    if (!isVaultEnabled()) return true
    return confirmDialog('Эта выгрузка не шифруется: файл можно будет открыть без пароля. Продолжить?', { confirmText: 'Сохранить' })
  }

  async function exportPdf() {
    if (!(await confirmPlainExport())) return
    if (!car.value) return
    try {
      await generateReportPdf({
        car: car.value,
        statuses: statuses.value,
        totalFuelCost: totalFuelCost.value,
        totalServiceCost: totalServiceCost.value,
        totalExpensesCost: totalExpensesCost.value,
        totalCost: totalCost.value,
        expenses: store.expenses,
        trips: store.trips,
        totalBusinessKm: totalBusinessKm.value,
        totalPersonalKm: totalPersonalKm.value,
        recentHistory: store.historyEntries.slice().sort((a, b) => b.date - a.date),
        structure: buildCostStructure(store.fuelEntries, store.historyEntries, store.expenses),
      })
    } catch {
      toast.show('Не удалось создать PDF — попробуйте ещё раз')
    }
  }

  /** Encrypted with the vault key when encryption is on; saved to the chosen folder, the share sheet or a download. */
  async function exportBackup() {
    await backup.saveNow()
  }

  const csvEscape = (value: string): string => (/["\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

  async function exportExpensesCsv() {
    if (!(await confirmPlainExport())) return
    const csv = buildExpensesCsv(timelineEvents.value, currency.value, (id) => store.masters.find((m) => m.id === id)?.name)
    downloadTextFile(`rashody-${todayStamp()}.csv`, csv)
  }

  async function exportFuelCsv() {
    if (!(await confirmPlainExport())) return
    const rows = store.fuelEntries.slice().sort((a, b) => a.date - b.date)
    const header = ['Дата', 'Пробег, км', 'Литры', `Стоимость, ${currency.value}`, `Цена, ${currency.value}/л`, 'Вид топлива', 'Полный бак', 'АЗС', 'Комментарий']
    const lines = [header.join(',')]
    for (const e of rows) {
      const price = e.cost !== undefined && e.liters > 0 ? (e.cost / e.liters).toFixed(2) : ''
      lines.push(
        [
          new Date(e.date).toLocaleDateString('ru-RU'),
          String(e.mileage),
          String(e.liters),
          e.cost !== undefined ? String(e.cost) : '',
          price,
          csvEscape(e.fuelType ?? ''),
          e.isFullTank === false ? 'нет' : 'да',
          csvEscape(e.station ?? ''),
          csvEscape(e.comment ?? ''),
        ].join(','),
      )
    }
    downloadTextFile(`zapravki-${todayStamp()}.csv`, '﻿' + lines.join('\n'))
  }

  async function exportCarCsv() {
    if (!(await confirmPlainExport())) return
    if (!car.value) return
    const csv = buildMoyaMashinaCsv({ fuel: store.fuelEntries, history: store.historyEntries })
    downloadTextFile(`moya-mashina-${todayStamp()}.csv`, '﻿' + csv)
  }

  async function importBackupFile(file: File) {
    importError.value = null
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      importError.value = 'Не удалось прочитать файл — это не корректный JSON'
      return
    }

    const opened = await resolveBackupData(parsed, askBackupSecret)
    if (!opened.ok) {
      if (opened.error !== 'Отменено') importError.value = opened.error
      return
    }

    const confirmed = await confirmDialog(
      'Импорт полностью заменит текущие данные (машина, параметры ТО, заправки, история) содержимым файла. Продолжить?',
      { header: 'Импорт копии', confirmText: 'Заменить данные', destructive: true },
    )
    if (!confirmed) return

    const result = await store.importData(opened.data)
    if (!result.ok) importError.value = result.error
    else if (result.skipped > 0) toast.show(`Данные загружены. Пропущено повреждённых записей: ${result.skipped}`)
  }

  async function importCarCsv(file: File) {
    importCsvError.value = null
    if (!car.value) return

    let text: string
    try {
      text = await file.text()
    } catch {
      importCsvError.value = 'Не удалось прочитать файл'
      return
    }

    const parsed = parseMoyaMashinaCsv(text)
    if (parsed.fuel.length === 0 && parsed.service.length === 0 && parsed.parts.length === 0) {
      importCsvError.value = 'В файле не нашлось ни одной записи в формате «Моя машина» (Заправки/Сервис/Детали)'
      return
    }

    const summary = await store.importCarCsv(parsed)
    haptic('success')
    const added = summary.fuelAdded + summary.serviceAdded + summary.partsAdded
    const skipped = summary.fuelSkipped + summary.serviceSkipped
    const parts = [
      `Заправок добавлено: ${summary.fuelAdded}`,
      `Записей ТО добавлено: ${summary.serviceAdded + summary.partsAdded}`,
    ]
    if (skipped > 0) parts.push(`уже было: ${skipped}`)
    if (summary.partsSkippedNoDate > 0) parts.push(`деталей без даты установки пропущено: ${summary.partsSkippedNoDate}`)
    toast.show(added > 0 ? parts.join(', ') : 'Новых записей не найдено — похоже, файл уже импортирован')
  }

  return { importError, importCsvError, exportPdf, exportBackup, exportExpensesCsv, exportFuelCsv, exportCarCsv, importBackupFile, importCarCsv }
}
