// Trims the last 3 digits off the current mileage so a new-odometer-reading
// input can start pre-filled with just the higher-order digits — the user
// only needs to type the missing low digits instead of erasing the whole
// value first. Below 1000 km there's nothing meaningful left to seed with,
// so the field starts blank.
export function mileageInputSeed(currentMileage: number): string {
  return currentMileage >= 1000 ? String(Math.floor(currentMileage / 1000)) : ''
}
