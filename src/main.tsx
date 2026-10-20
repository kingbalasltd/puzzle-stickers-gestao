import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import App from './App'
import { db } from './db'
import { devLocal, iniciarSincronizacao, instalarHooks } from './nuvem'
import { semear } from './seed'

// Check for a new version every minute and whenever the app comes back to the
// front, so an installed iPhone app never stays on an old build.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    setInterval(() => reg.update().catch(() => {}), 60_000)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}))
  }
})

// Stamp local changes before anything writes, so they reach the cloud.
instalarHooks()

// A device that already has data runs its start-up fixes; a new one first
// signs in to the cloud and only seeds if the cloud is empty.
async function arrancar() {
  if (devLocal() || (await db.empresa.get('empresa'))) await semear()
}

arrancar()
  .catch(() => {})
  .finally(() => {
    iniciarSincronizacao()
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  })
