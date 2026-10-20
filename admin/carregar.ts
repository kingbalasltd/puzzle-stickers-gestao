// Loads a batch of Momad's real data straight into the cloud with the app's own code,
// so real records never go into the public site. Runs like one more device:
// signs in, pulls everything into an in-memory database, runs the data script,
// pushes the changes and signs out.
//
//   PUZZLE_SENHA=... npx vite-node admin/carregar.ts admin/dados/<script>.ts [--seco]
//
// --seco runs the script and prints what would go up, without sending anything.
import 'fake-indexeddb/auto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PUBLICO = fileURLToPath(new URL('../public/', import.meta.url))
const fetchOriginal = globalThis.fetch
// The seed fetches /seed/... files; serve them from public/ like the dev server would.
globalThis.fetch = (async (u: any, init?: any) => {
  const url = typeof u === 'string' ? u : u.url
  if (url.startsWith('/')) {
    try { return new Response(await readFile(resolve(PUBLICO, url.slice(1).split('?')[0]))) } catch { return new Response(null, { status: 404 }) }
  }
  return fetchOriginal(u, init)
}) as typeof fetch

const { db } = await import('../src/db')
const nuvem = await import('../src/nuvem')
const { semear } = await import('../src/seed')

// File blobs stay on the devices (not synced yet); keep them out of this run.
;(db.ficheiros as any).put = async (f: { id: string }) => f.id
;(db.ficheiros as any).get = async () => undefined

const senha = process.env.PUZZLE_SENHA
if (!senha) throw new Error('Falta PUZZLE_SENHA')
const script = process.argv.slice(2).find((a) => !a.startsWith('--'))
const seco = process.argv.includes('--seco')

nuvem.instalarHooks()
const n = await nuvem.entrar('puzzle', senha)
try {
const contar = async () => Object.fromEntries(await Promise.all(nuvem.TABELAS.map(async (t) => [t, await (db as any)[t].count()])))
console.log('nuvem antes:', JSON.stringify(await contar()))
await semear()

if (script) {
  const mod = await import(pathToFileURL(resolve(script)).href)
  await mod.default()
}

const pendentes: string[] = []
for (const t of nuvem.TABELAS)
  for (const r of await (db as any)[t].toArray())
    if (r._loc && (!n.marca || r._loc >= n.marca)) pendentes.push(`${t}/${r.id}${r.deleted ? ' (apagado)' : ''}`)
console.log(`a enviar: ${pendentes.length}`)
console.log(pendentes.slice(0, 80).join('\n'))

if (!seco) {
  await nuvem.sincronizar()
  console.log('estado:', JSON.stringify(nuvem.estadoNuvem()))
}
} finally {
  // Always close this run's session, even when the script fails.
  await nuvem.desligar(!seco)
}
process.exit(0)
