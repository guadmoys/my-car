/**
 * The app's data store. This file is only the facade screens import; the state and the
 * logic live in ./store, one module per concern:
 *
 *   state        the reactive lists, the active car and tiny shared helpers
 *   car          loading, switching, creating and deleting cars, the odometer
 *   maintenance  service items, marking them done, the service history
 *   fuel         fill-ups
 *   expenses     other expenses, including recurring ones
 *   documents / reminders / masters / components / trips   one small module each
 *   derived      computed values: statuses, fuel figures, totals, the timeline
 *   backupData   export and import of the whole database
 *   csvImport    additive import from the third-party CSV
 *
 * Modules import `state` (and a few of each other) but never this file, so there are no cycles.
 */
import { exportData, importData } from './store/backupData'
import { createCar, deleteCar, load, switchCar, updateCarInfo, updateMileage } from './store/car'
import {
  addComponentCheck,
  deleteComponentCheck,
  latestComponentByType,
  restoreComponentCheck,
} from './store/components'
import { importCarCsv } from './store/csvImport'
import {
  averageConsumption,
  averageFuelPriceValue,
  costForecast,
  dueCount,
  estimatedRangeKm,
  fuelHistory,
  fuelInsights,
  hasAnyCost,
  monthDistanceKm,
  okCount,
  reminderStatuses,
  soonCount,
  statuses,
  timelineEvents,
  totalCo2KgValue,
  totalCost,
  totalExpensesCost,
  totalFuelCost,
  totalServiceCost,
} from './store/derived'
import {
  addDocument,
  deleteDocument,
  documentStatuses,
  restoreDocument,
  updateDocument,
} from './store/documents'
import { addExpense, deleteExpense, restoreExpense, updateExpense } from './store/expenses'
import { addFuelEntry, deleteFuelEntry, restoreFuelEntry, updateFuelEntry } from './store/fuel'
import {
  addCustomItem,
  deleteItem,
  getItemHistory,
  markServiced,
  restoreItem,
  undoMarkServiced,
  updateHistoryEntry,
  updateItem,
} from './store/maintenance'
import { addMaster, deleteMaster, restoreMaster, updateMaster } from './store/masters'
import { addReminder, deleteReminder, restoreReminder } from './store/reminders'
import {
  car,
  cars,
  componentChecks,
  documents,
  expenses,
  fuelEntries,
  historyEntries,
  isImporting,
  isLoaded,
  items,
  masters,
  reminders,
  trips,
} from './store/state'
import { addTrip, deleteTrip, restoreTrip, totalBusinessKm, totalPersonalKm } from './store/trips'

export type { CsvImportSummary } from './store/csvImport'
export type { MarkServicedResult } from './store/maintenance'

export function useCarStore() {
  return {
    cars,
    car,
    items,
    fuelEntries,
    historyEntries,
    reminders,
    masters,
    expenses,
    componentChecks,
    trips,
    isLoaded,
    isImporting,
    statuses,
    dueCount,
    soonCount,
    okCount,
    reminderStatuses,
    documents,
    documentStatuses,
    latestComponentByType,
    totalBusinessKm,
    totalPersonalKm,
    fuelHistory,
    averageConsumption,
    monthDistanceKm,
    timelineEvents,
    estimatedRangeKm,
    averageFuelPrice: averageFuelPriceValue,
    totalCo2Kg: totalCo2KgValue,
    fuelInsights,
    totalFuelCost,
    totalServiceCost,
    totalExpensesCost,
    totalCost,
    hasAnyCost,
    costForecast,
    load,
    switchCar,
    createCar,
    deleteCar,
    updateCarInfo,
    updateMileage,
    updateItem,
    markServiced,
    undoMarkServiced,
    addCustomItem,
    deleteItem,
    restoreItem,
    addReminder,
    deleteReminder,
    restoreReminder,
    addMaster,
    updateMaster,
    deleteMaster,
    restoreMaster,
    addExpense,
    updateExpense,
    deleteExpense,
    restoreExpense,
    addDocument,
    updateDocument,
    deleteDocument,
    restoreDocument,
    addComponentCheck,
    deleteComponentCheck,
    restoreComponentCheck,
    addTrip,
    deleteTrip,
    restoreTrip,
    addFuelEntry,
    deleteFuelEntry,
    restoreFuelEntry,
    updateFuelEntry,
    updateHistoryEntry,
    getItemHistory,
    exportData,
    importData,
    importCarCsv,
  }
}
