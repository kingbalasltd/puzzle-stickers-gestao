import type { Table, Transaction } from 'dexie'
import { useSyncExternalStore } from 'react'
import { agora, db, type Nuvem } from './db'

// Cloud copy in the kb-academy project (private schema `puzzle`, see db/001_puzzle_nuvem.sql).
// The anon key is public by design: the data is only reachable through the
// puzzle_* functions, which need the company session token.
const API = 'https://oaijcdqrcqzdzpcnfdxo.supabase.co/rest/v1/rpc/'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9haWpjZHFyY3F6ZHpwY25mZHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MzQwMDMsImV4cCI6MjEwNjExMDAwM30.cCpEUzM3W79wJD_27y_PkFbc9_Wh3nC1pekruDrSYSs'

// Every table except the file blobs (ficheiros) and the device-only meta.
export const TABELAS = ['empresa', 'utilizadores', 'clientes', 'fornecedores', 'servicos', 'trabalhos', 'pagamentos', 'requisicoes', 'custos', 'documentos', 'cotacoes', 'registos', 'despesasFixas', 'despesas', 'relatorios', 'tarefas'] as const
const LOTE = 200
// Bump when a table is added: devices on an older app skipped those records while
// pulling, so they pull everything once more (only newer versions are applied).
const ESQUEMA = 2
const PAGINA = 500

// A record's version: last write wins on it.
const versao = (d: any): string => d?.updatedAt || d?.em || d?.createdAt || ''

class ErroNuvem extends Error {}

// Dev server only (stripped from builds): work on local sample data without the cloud.
export const devLocal = () => {
  if (!import.meta.env.DEV) return false
  try { return localStorage.getItem('pg_dev_local') === '1' } catch { return false }
}

// Node (the admin loader) has no navigator.onLine: treat unknown as online.
const semRede = () => (navigator as { onLine?: boolean }).onLine === false

async function rpc<T>(fn: string, body: object): Promise<T> {
  const r = await fetch(API + fn, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const txt = await r.text()
  if (!r.ok) {
    let m = txt
    try { m = JSON.parse(txt).message || txt } catch { /* keep text */ }
    throw new ErroNuvem(m)
  }
  return (txt ? JSON.parse(txt) : undefined) as T
}

// ---------- status, for the badge in the menu ----------

export type Fase = 'desligado' | 'parado' | 'a-sincronizar' | 'offline' | 'erro'
type Estado = { fase: Fase; ultimo?: string; erro?: string }
let estado: Estado = { fase: 'parado' }
const ouvintes = new Set<() => void>()
function mudar(p: Partial<Estado>) {
  estado = { ...estado, ...p }
  ouvintes.forEach((f) => f())
}
export const estadoNuvem = () => estado
export function useNuvem() {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f) } }, () => estado)
}

// ---------- local change stamps ----------
// Local writes get `_loc` (this device's clock) so the next push finds them.
// Writes that come from the cloud run in a transaction flagged __remoto and keep
// the version they arrived with, so they are never echoed back as new.

const doRemoto = (tx?: Transaction) => !!(tx as any)?.__remoto

let hooks = false
export function instalarHooks() {
  if (hooks) return
  hooks = true
  for (const t of TABELAS) {
    const tab = (db as any)[t] as Table<any, string>
    tab.hook('creating', (_k, obj, tx) => {
      if (doRemoto(tx)) return
      obj._loc = agora()
      agendar()
    })
    tab.hook('updating', (mods, _k, _obj, tx) => {
      if (doRemoto(tx) || !Object.keys(mods).length) return
      agendar()
      const t = agora()
      return { updatedAt: t, _loc: t }
    })
  }
}

// ---------- push / pull ----------

async function enviar(n: Nuvem) {
  const inicio = agora()
  const docs: { t: string; v: string; d: any }[] = []
  for (const t of TABELAS) {
    for (const r of await (db as any)[t].toArray()) {
      // The first push of a device sends everything; later ones only what changed here.
      if (n.marca && !(r._loc && r._loc >= n.marca)) continue
      const { _loc, ...d } = r
      const v = versao(d)
      if (v) docs.push({ t, v, d })
    }
  }
  for (let i = 0; i < docs.length; i += LOTE) await rpc('puzzle_enviar', { p_token: n.token, p_docs: docs.slice(i, i + LOTE) })
  n.marca = inicio
}

async function aplicar(docs: { t: string; d: any }[]) {
  const por = new Map<string, any[]>()
  for (const x of docs) {
    if (!(TABELAS as readonly string[]).includes(x.t) || !x.d?.id) continue
    if (!por.has(x.t)) por.set(x.t, [])
    por.get(x.t)!.push(x.d)
  }
  if (!por.size) return
  const tabs = [...por.keys()].map((t) => (db as any)[t] as Table<any, string>)
  await db.transaction('rw', tabs, async (tx) => {
    ;(tx as any).__remoto = true
    for (const [t, ds] of por) {
      const tab = (db as any)[t] as Table<any, string>
      const locais = await tab.bulkGet(ds.map((d) => d.id))
      const novos = ds.filter((d, i) => !locais[i] || versao(d) > versao(locais[i]))
      if (novos.length) await tab.bulkPut(novos)
    }
  })
}

async function puxar(n: Nuvem) {
  for (let volta = 0; volta < 100; volta++) {
    // Overlap the cursor a little: a write that committed late still gets picked up.
    const r = await rpc<{ docs: { t: string; d: any }[]; ate: number }>('puzzle_puxar', { p_token: n.token, p_desde: Math.max(0, n.cursor - 100), p_limite: PAGINA })
    await aplicar(r.docs)
    const avancou = r.ate > n.cursor
    if (avancou) n.cursor = r.ate
    if (r.docs.length < PAGINA || !avancou) break
  }
}

// ---------- the loop ----------

let corrida: Promise<void> | null = null
let outra = false
let timer: ReturnType<typeof setTimeout> | undefined

export function agendar(ms = 1500) {
  clearTimeout(timer)
  timer = setTimeout(() => { sincronizar() }, ms)
}

export function sincronizar(): Promise<void> {
  if (corrida) {
    outra = true
    return corrida
  }
  corrida = (async () => {
    const n = await db.meta.get('nuvem')
    if (!n?.token) return mudar({ fase: 'desligado' })
    if (semRede()) return mudar({ fase: 'offline' })
    mudar({ fase: 'a-sincronizar' })
    try {
      if ((n.esquema || 0) < ESQUEMA) Object.assign(n, { cursor: 0, esquema: ESQUEMA })
      await enviar(n)
      await puxar(n)
      await db.meta.put(n)
      mudar({ fase: 'parado', ultimo: agora(), erro: undefined })
    } catch (e: any) {
      if (e instanceof ErroNuvem && e.message === 'sessao') {
        // Password changed or session removed: keep the cursors so this device's
        // unsent changes still go up when it signs in again.
        await db.meta.put({ ...n, token: '' })
        mudar({ fase: 'desligado', erro: 'A sessão terminou. Entre outra vez.' })
      } else mudar({ fase: semRede() ? 'offline' : 'erro', erro: String(e?.message || e) })
    }
  })().finally(() => {
    corrida = null
    if (outra) {
      outra = false
      agendar(300)
    }
  })
  return corrida
}

let ligado = false
export function iniciarSincronizacao() {
  if (ligado) return
  ligado = true
  sincronizar()
  setInterval(() => sincronizar(), 30_000)
  window.addEventListener('online', () => sincronizar())
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sincronizar())
}

// ---------- session ----------

function aparelho() {
  const ua = navigator.userAgent
  const o = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1) ? 'iPad' : /Macintosh/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : 'Outro'
  const b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : ''
  return [o, b].filter(Boolean).join(' · ')
}

// Signs this device in and brings the cloud data down before anything is seeded.
export async function entrar(empresa: string, senha: string) {
  const r = await rpc<{ token?: string; empresa?: string; nome?: string; erro?: string }>('puzzle_entrar', { p_empresa: empresa, p_senha: senha, p_aparelho: aparelho() })
  if (!r.token) throw new Error(r.erro === 'bloqueado' ? 'Demasiadas tentativas. Tente outra vez daqui a 10 minutos.' : 'Código da empresa ou palavra-passe errados.')
  const antes = await db.meta.get('nuvem')
  let n: Nuvem
  if (antes) {
    // Same device coming back (session ended): send what changed here, then catch up.
    n = { ...antes, token: r.token, empresa: r.empresa!, nome: r.nome! }
    await enviar(n)
  } else {
    n = { id: 'nuvem', token: r.token, empresa: r.empresa!, nome: r.nome!, cursor: 0, marca: '', esquema: ESQUEMA }
    const temNuvem = (await rpc<{ docs: unknown[] }>('puzzle_puxar', { p_token: r.token, p_desde: 0, p_limite: 1 })).docs.length > 0
    if (temNuvem) {
      // The cloud is the company's copy. Old records of this device (from before the
      // cloud, with their own ids) would come back as duplicates, so they give way.
      // File blobs stay: cloud records still point at them.
      await db.transaction('rw', TABELAS.map((t) => (db as any)[t] as Table<any, string>), async () => {
        for (const t of TABELAS) await (db as any)[t].clear()
      })
      n.marca = agora()
    }
    // An empty cloud keeps marca '': this device's data becomes the first copy.
  }
  await puxar(n)
  await db.meta.put(n)
  mudar({ fase: 'parado', erro: undefined })
  return n
}

export async function desligar(enviarAntes = true) {
  if (enviarAntes) await sincronizar().catch(() => {})
  const n = await db.meta.get('nuvem')
  if (n?.token) await rpc('puzzle_sair', { p_token: n.token }).catch(() => {})
  await db.meta.delete('nuvem')
  mudar({ fase: 'desligado' })
}

// Leaves the app without unlinking the device: its data stays, and coming back only asks for
// the company password (a company with a single user has no PIN step).
export async function terminarSessao() {
  await sincronizar().catch(() => {})
  const n = await db.meta.get('nuvem')
  if (!n?.token) return
  await rpc('puzzle_sair', { p_token: n.token }).catch(() => {})
  await db.meta.put({ ...n, token: '' })
  mudar({ fase: 'desligado' })
}

export async function mudarSenha(atual: string, nova: string) {
  const n = await db.meta.get('nuvem')
  if (!n?.token) throw new Error('Este aparelho não está ligado à nuvem.')
  const r = await rpc<{ ok?: boolean; erro?: string }>('puzzle_mudar_senha', { p_token: n.token, p_atual: atual, p_nova: nova })
  if (!r.ok) throw new Error(r.erro === 'curta' ? 'A nova palavra-passe precisa de pelo menos 8 caracteres.' : 'A palavra-passe atual está errada.')
}
