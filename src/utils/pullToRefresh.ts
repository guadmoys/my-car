/**
 * Shared `ion-refresh` handler for the pull-to-refresh gesture on each tab —
 * simply reloads the page, which also lets a waiting service-worker update
 * (see utils/appUpdate.ts) take over the same way "Проверить обновления" does.
 */
export function handlePullToRefresh(): void {
  window.location.reload()
}
