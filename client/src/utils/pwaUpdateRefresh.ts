import { registerSW } from 'virtual:pwa-register'

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000
const CHANNEL_NAME = 'ramadan-tournament-client-update'

export function installPwaUpdateRefresh(): void {
  if (!('serviceWorker' in navigator)) return

  let registration: ServiceWorkerRegistration | undefined
  let refreshing = false
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null

  const reloadOnce = () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  }

  channel?.addEventListener('message', (event) => {
    if (event.data === 'reload-for-client-update') reloadOnce()
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    channel?.postMessage('reload-for-client-update')
    reloadOnce()
  })

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true)
    },
    onRegisteredSW(_serviceWorkerUrl, activeRegistration) {
      registration = activeRegistration
      void registration?.update()
    },
  })

  const checkForUpdate = () => {
    if (document.visibilityState === 'visible') {
      void registration?.update()
    }
  }

  window.addEventListener('focus', checkForUpdate)
  document.addEventListener('visibilitychange', checkForUpdate)
  window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
}
