import { describe, expect, it } from 'vitest'
import type { FuelEntry, HistoryEntry } from '../../types'
import { buildMoyaMashinaCsv, parseMoyaMashinaCsv } from '../carCsvFormat'

const fuel = [
  {
    id: 'f1',
    carId: 'c',
    mileage: 12000,
    liters: 40,
    cost: 2400,
    date: new Date(2025, 4, 10, 12, 0).getTime(),
    station: 'Лукойл',
    isFullTank: true,
  },
] as FuelEntry[]

const history = [
  {
    id: 'h1',
    carId: 'c',
    itemId: 'i',
    itemName: 'Замена масла',
    mileage: 11000,
    date: new Date(2025, 3, 1, 10, 0).getTime(),
    cost: 5000,
    note: 'Обычное; с точкой с запятой',
  },
] as HistoryEntry[]

describe('Моя машина CSV round trip', () => {
  const parsed = parseMoyaMashinaCsv(buildMoyaMashinaCsv({ fuel, history }))

  it('restores fuel rows', () => {
    expect(parsed.fuel).toHaveLength(1)
    expect(parsed.fuel[0]).toMatchObject({ mileage: 12000, liters: 40, cost: 2400, station: 'Лукойл', isFullTank: true })
  })

  it('restores service rows, including quoted separators', () => {
    expect(parsed.service).toHaveLength(1)
    expect(parsed.service[0]).toMatchObject({ name: 'Замена масла', mileage: 11000, cost: 5000 })
    expect(parsed.service[0].comment).toBe('Обычное; с точкой с запятой')
  })

  it('reports no skipped parts', () => {
    expect(parsed.parts).toHaveLength(0)
    expect(parsed.skippedPartsCount).toBe(0)
  })
})

describe('parseMoyaMashinaCsv', () => {
  it('tolerates a BOM and empty input', () => {
    expect(parseMoyaMashinaCsv('﻿').fuel).toEqual([])
  })
})
