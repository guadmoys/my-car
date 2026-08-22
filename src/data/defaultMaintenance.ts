import type { MaintenanceItem } from '../types'

export interface MaintenanceTemplate {
  name: string
  intervalKm: number
  intervalKmMax?: number
}

export const DEFAULT_MAINTENANCE_TEMPLATES: MaintenanceTemplate[] = [
  { name: 'Замена масла и фильтра', intervalKm: 5_000 },
  { name: 'Дворники', intervalKm: 5_000 },
  { name: 'Перестановка шин', intervalKm: 10_000 },
  { name: 'Регулировка задних тормозов', intervalKm: 20_000 },
  { name: 'Аккумулятор и система зарядки', intervalKm: 20_000 },
  { name: 'Передние и задние дисковые тормоза', intervalKm: 20_000 },
  { name: 'Свечи зажигания', intervalKm: 20_000 },
  { name: 'Воздушный фильтр', intervalKm: 25_000 },
  { name: 'Топливный фильтр', intervalKm: 25_000 },
  { name: 'Ремни и шланги', intervalKm: 25_000 },
  { name: 'Фильтр салона', intervalKm: 25_000 },
  { name: 'Сход-развал колёс', intervalKm: 40_000 },
  { name: 'Проверка кондиционера', intervalKm: 40_000 },
  { name: 'Промывка системы охлаждения', intervalKm: 50_000 },
  { name: 'Обслуживание трансмиссии', intervalKm: 50_000 },
  { name: 'Промывка тормозной жидкости', intervalKm: 50_000 },
  { name: 'Обслуживание заднего моста', intervalKm: 65_000 },
  { name: 'Промывка гидроусилителя руля', intervalKm: 80_000 },
  { name: 'Комплексная проверка / тюнинг', intervalKm: 80_000, intervalKmMax: 115_000 },
  { name: 'Ремень ГРМ', intervalKm: 95_000, intervalKmMax: 160_000 },
]

export function buildDefaultItems(initialMileage: number, carId: string): MaintenanceItem[] {
  return DEFAULT_MAINTENANCE_TEMPLATES.map((tpl, index) => ({
    id: `${carId}-default-${index}`,
    carId,
    name: tpl.name,
    intervalKm: tpl.intervalKm,
    intervalKmMax: tpl.intervalKmMax,
    enabled: true,
    lastServiceMileage: initialMileage,
    lastServiceDate: Date.now(),
    isCustom: false,
    order: index,
    parts: [],
  }))
}
