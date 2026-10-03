import * as db from '../../db/database'
import type { Master } from '../../types'
import { car, makeId, masters, nowTs } from './state'

export async function addMaster(input: {
  name: string
  phone?: string
  cardNumber?: string
  link?: string
  specialty?: string
}): Promise<void> {
  if (!car.value) return
  const master: Master = {
    id: makeId(),
    carId: car.value.id,
    name: input.name.trim(),
    phone: input.phone?.trim() || undefined,
    cardNumber: input.cardNumber?.trim() || undefined,
    link: input.link?.trim() || undefined,
    specialty: input.specialty?.trim() || undefined,
    createdAt: nowTs(),
  }
  masters.push(master)
  await db.putMaster(master)
}

export async function updateMaster(
  id: string,
  patch: { name: string; phone?: string; cardNumber?: string; link?: string; specialty?: string },
): Promise<void> {
  const master = masters.find((m) => m.id === id)
  if (!master) return
  master.name = patch.name.trim()
  master.phone = patch.phone?.trim() || undefined
  master.cardNumber = patch.cardNumber?.trim() || undefined
  master.link = patch.link?.trim() || undefined
  master.specialty = patch.specialty?.trim() || undefined
  await db.putMaster({ ...master })
}

export async function deleteMaster(id: string): Promise<Master | null> {
  const index = masters.findIndex((m) => m.id === id)
  if (index === -1) return null
  const [removed] = masters.splice(index, 1)
  await db.deleteMaster(id)
  return removed
}

export async function restoreMaster(master: Master): Promise<void> {
  if (masters.some((m) => m.id === master.id)) return
  masters.push(master)
  await db.putMaster(master)
}

