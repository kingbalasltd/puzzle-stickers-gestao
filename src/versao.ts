// Build stamp, so we can tell at a glance which version a phone is running.
declare const __VERSAO__: string

export const VERSAO = typeof __VERSAO__ === 'string' ? __VERSAO__ : 'dev'

// "15/10 09:40" in Maputo time (UTC+2).
export function versaoCurta(v = VERSAO) {
  const d = new Date(v)
  if (isNaN(+d)) return v
  const m = new Date(d.getTime() + 2 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(m.getUTCDate())}/${p(m.getUTCMonth() + 1)} ${p(m.getUTCHours())}:${p(m.getUTCMinutes())}`
}

// Asks the server which build is live, past the service worker and every cache.
export async function versaoNoServidor(): Promise<string | undefined> {
  try {
    const r = await fetch(`/versao.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return undefined
    return (await r.json()).v
  } catch {
    return undefined
  }
}

// Drops the service worker and its caches, then reloads from the server.
// The data lives in IndexedDB, which this never touches.
export async function atualizarApp() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) || []
    await Promise.all(regs.map((r) => r.unregister()))
    const ks = await caches.keys()
    await Promise.all(ks.map((k) => caches.delete(k)))
  } catch { /* reload anyway */ }
  location.reload()
}
