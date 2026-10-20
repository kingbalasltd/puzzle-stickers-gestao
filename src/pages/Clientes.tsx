import { useEffect, useMemo, useState } from 'react'
import { Page } from '../App'
import { agora, apagar, db, guardar, novo, uid, type Cliente } from '../db'
import { dataMedia, juntarMorada, mt, separarMorada, waLink } from '../format'
import { contaParaReceber } from '../calc'
import { ir, useDados, useSessao } from '../state'
import { Avatar, DemoTag, Empty, Field, Icon, Modal, useToast } from '../ui'
import { EtapaBadge, PrazoBadge } from './comum'
import { DocLinha } from './Documentos'
import { TrabalhoForm } from './TrabalhoForm'

function useStatsCliente() {
  const d = useDados()
  return useMemo(() => {
    const m = new Map<string, { jobs: number; ativos: number; faturado: number; divida: number; ultimo: string }>()
    for (const t of d.trabalhos) {
      if (t.cancelado) continue
      const r = d.resumo(t)
      const x = m.get(t.clienteId) || { jobs: 0, ativos: 0, faturado: 0, divida: 0, ultimo: '' }
      x.jobs++
      if (t.etapa !== 'entregue') x.ativos++
      x.faturado += r.total
      if (contaParaReceber(t, r)) x.divida += r.emDivida
      if (t.dataEntrada > x.ultimo) x.ultimo = t.dataEntrada
      m.set(t.clienteId, x)
    }
    return m
  }, [d])
}

// The client's logo goes on the quote under "Exmo (s)Sr(s)". Kept as PNG so transparent logos stay transparent.
async function guardarLogo(file: File): Promise<string> {
  let blob: Blob = file
  try {
    const bmp = await createImageBitmap(file)
    const s = Math.min(1, 800 / Math.max(bmp.width, bmp.height))
    if (s < 1 || file.size > 600_000) {
      const cv = document.createElement('canvas')
      cv.width = Math.round(bmp.width * s)
      cv.height = Math.round(bmp.height * s)
      cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height)
      blob = await new Promise<Blob>((res) => cv.toBlob((b) => res(b || file), 'image/png'))
    }
  } catch { /* svg or unreadable: keep the original */ }
  const id = uid()
  await db.ficheiros.put({ id, nome: file.name, mime: blob.type || file.type, tamanho: blob.size, blob, createdAt: agora() })
  return id
}

export function LogoCliente({ id, onChange }: { id?: string; onChange: (id?: string) => void }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let u: string | undefined
    if (id) db.ficheiros.get(id).then((f) => { if (f) { u = URL.createObjectURL(f.blob); setUrl(u) } })
    else setUrl(undefined)
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [id])
  return (
    <div className="row" style={{ gap: 12, alignItems: 'center' }}>
      {url ? <img src={url} alt="" style={{ height: 48, maxWidth: 140, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 4 }} /> : <span className="small muted">Sem logotipo</span>}
      <label className="btn sm"><Icon n="upload" /> {url ? 'Trocar' : 'Carregar'}<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await guardarLogo(f)); e.target.value = '' }} /></label>
      {url && <button type="button" className="btn sm ghost" onClick={() => onChange(undefined)}><Icon n="lixo" /></button>}
    </div>
  )
}

export function ClienteForm({ c, onClose }: { c?: Cliente; onClose: (id?: string) => void }) {
  const toast = useToast()
  const [f, setF] = useState<Partial<Cliente>>(c ? { ...c } : { nome: '' })
  const set = (p: Partial<Cliente>) => setF((x) => ({ ...x, ...p }))
  // Quotes print "Cidade, País" under the client (Momad, 18 Oct): two fields, saved together.
  const [mor, setMor] = useState(() => { const m = separarMorada(c?.cidade); return { cidade: m.cidade, pais: m.pais || 'Moçambique' } })
  async function salvar() {
    if (!f.nome?.trim()) return toast('Escreva o nome')
    const cidade = mor.cidade.trim() ? juntarMorada(mor.cidade, mor.pais) : ''
    const rec = c ? await guardar(db.clientes, { ...c, ...f, cidade } as Cliente) : novo<Cliente>({ ...f, cidade } as any)
    if (!c) await db.clientes.put(rec)
    toast('Cliente guardado')
    onClose(rec.id)
  }
  return (
    <Modal title={c ? 'Editar cliente' : 'Novo cliente'} onClose={() => onClose()} footer={<><button className="btn" onClick={() => onClose()}>Cancelar</button><button className="btn pri" onClick={salvar}><Icon n="check" /> Guardar</button></>}>
      <div className="form-grid">
        <Field label="Nome / empresa" full><input autoFocus value={f.nome} onChange={(e) => set({ nome: e.target.value })} /></Field>
        <Field label="Pessoa de contacto"><input value={f.contacto || ''} onChange={(e) => set({ contacto: e.target.value })} /></Field>
        <Field label="Telefone / WhatsApp"><input inputMode="tel" value={f.telefone || ''} onChange={(e) => set({ telefone: e.target.value })} placeholder="84 000 0000" /></Field>
        <Field label="Email"><input inputMode="email" value={f.email || ''} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="NUIT"><input inputMode="numeric" value={f.nuit || ''} onChange={(e) => set({ nuit: e.target.value })} /></Field>
        <Field label="Cidade" hint="Aparece na cotação: Cidade, País"><input value={mor.cidade} onChange={(e) => setMor({ ...mor, cidade: e.target.value })} placeholder="Maputo" /></Field>
        <Field label="País"><input value={mor.pais} onChange={(e) => setMor({ ...mor, pais: e.target.value })} placeholder="Moçambique" /></Field>
        <div className="field full"><span>Logotipo do cliente</span><LogoCliente id={f.logoId} onChange={(logoId) => set({ logoId })} /><small>Aparece na cotação, por baixo do nome do cliente</small></div>
        <Field label="Notas" full><textarea value={f.notas || ''} onChange={(e) => set({ notas: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

export function Clientes() {
  const d = useDados()
  const { pode } = useSessao()
  const stats = useStatsCliente()
  const [q, setQ] = useState('')
  const [novoC, setNovoC] = useState(false)
  const fin = pode('financas')
  const lista = d.clientes.filter((c) => !q || `${c.nome} ${c.contacto || ''} ${c.telefone || ''} ${c.cidade || ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <Page title="Clientes" sub={`${d.clientes.length} clientes`} actions={<button className="btn pri" onClick={() => setNovoC(true)}><Icon n="plus" /> <span className="hide-m">Novo cliente</span></button>}>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="search" style={{ maxWidth: 420 }}><Icon n="search" /><input className="inp" placeholder="Procurar cliente…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="card">
        {lista.length === 0 ? <Empty icon="clientes" title="Sem clientes" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Cliente</th><th>Contacto</th><th className="r">Trabalhos</th>{fin && <th className="r">Faturado</th>}{fin && <th className="r">Em dívida</th>}</tr></thead>
              <tbody>
                {lista.map((c) => {
                  const s = stats.get(c.id)
                  return (
                    <tr key={c.id} className="click" onClick={() => ir(`/clientes/${c.id}`)}>
                      <td><div className="row"><Avatar nome={c.nome} cor="neutro" /><div><b>{c.nome}</b> <DemoTag demo={c.demo} /><div className="tiny muted">{c.cidade || ''}</div></div></div></td>
                      <td className="tx2 small">{c.contacto || ''}{c.telefone ? <div>{c.telefone}</div> : null}</td>
                      <td className="r num">{s?.jobs || 0}{s?.ativos ? <span className="muted small"> · {s.ativos} em curso</span> : null}</td>
                      {fin && <td className="r num nowrap">{mt(s?.faturado || 0)}</td>}
                      {fin && <td className="r num nowrap b" style={{ color: s?.divida ? 'var(--warn)' : 'var(--tx3)' }}>{mt(s?.divida || 0)}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {novoC && <ClienteForm onClose={(id) => { setNovoC(false); if (id) ir(`/clientes/${id}`) }} />}
    </Page>
  )
}

export function ClienteDetalhe({ id }: { id: string }) {
  const d = useDados()
  const { pode } = useSessao()
  const stats = useStatsCliente()
  const c = d.cliente(id)
  const [edit, setEdit] = useState(false)
  const [novoT, setNovoT] = useState(false)
  if (!c) return <Page title="Cliente" back="/clientes"><Empty title="Cliente não encontrado" /></Page>
  const s = stats.get(c.id)
  const jobs = d.trabalhos.filter((t) => t.clienteId === c.id)
  const docs = d.documentos.filter((x) => x.clienteId === c.id)
  const cots = d.cotacoes.filter((x) => x.clienteId === c.id)
  const fin = pode('financas')
  return (
    <Page
      back="/clientes"
      title={c.nome}
      sub={c.cidade}
      actions={
        <>
          {c.telefone && <a className="btn" href={waLink(c.telefone, `Olá ${c.nome.split(' ')[0]}! Aqui é da Puzzle Stickers. `)} target="_blank" rel="noreferrer"><Icon n="whatsapp" /> <span className="hide-m">WhatsApp</span></a>}
          <button className="btn" onClick={() => setEdit(true)}><Icon n="editar" /> <span className="hide-m">Editar</span></button>
          <button className="btn pri" onClick={() => setNovoT(true)}><Icon n="plus" /> <span className="hide-m">Trabalho</span></button>
        </>
      }
    >
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi"><div className="lbl">Trabalhos</div><div className="val">{s?.jobs || 0}</div><div className="foot">{s?.ativos || 0} em curso</div></div>
        {fin && <div className="card kpi"><div className="lbl">Faturado</div><div className="val">{mt(s?.faturado || 0).replace(',00', '')}</div><div className="foot">com IVA</div></div>}
        {fin && <div className={`card kpi ${s?.divida ? 'warn' : ''}`}><div className="lbl">Em dívida</div><div className="val">{mt(s?.divida || 0).replace(',00', '')}</div></div>}
        <div className="card kpi"><div className="lbl">Último trabalho</div><div className="val" style={{ fontSize: 18 }}>{s?.ultimo ? dataMedia(s.ultimo) : '—'}</div></div>
      </div>
      <div className="grid g-main">
        <div className="card pad">
          <h3>Trabalhos</h3>
          {jobs.length === 0 ? <Empty icon="quadro" title="Ainda sem trabalhos" /> : (
            <div className="list">
              {jobs.map((t) => {
                const r = d.resumo(t)
                return (
                  <div key={t.id} className="li" onClick={() => ir(`/trabalhos/${t.id}`)}>
                    <div className="main-t"><b>{t.titulo}</b><span>{t.codigo} · entrou {dataMedia(t.dataEntrada)}</span></div>
                    <EtapaBadge e={t.etapa} tipo={t.tipo} />
                    <span className="hide-m"><PrazoBadge t={t} /></span>
                    {fin && <div className="right"><b className="num nowrap">{mt(r.total)}</b>{r.emDivida > 0 && <div className="tiny" style={{ color: 'var(--warn)' }}>falta {mt(r.emDivida)}</div>}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="card pad">
            <h3>Contactos</h3>
            <dl className="kv">
              <dt>Contacto</dt><dd>{c.contacto || '—'}</dd>
              <dt>Telefone</dt><dd>{c.telefone || '—'}</dd>
              <dt>Email</dt><dd className="ellipsis">{c.email || '—'}</dd>
              <dt>NUIT</dt><dd>{c.nuit || '—'}</dd>
            </dl>
            {c.notas && <><div className="hr" /><div className="small tx2 pre">{c.notas}</div></>}
          </div>
          {fin && cots.length > 0 && (
            <div className="card pad">
              <h3>Cotações</h3>
              <div className="list">{cots.map((x) => <a key={x.id} className="li" href={`#/cotacoes/${x.id}`}><div className="main-t"><b>{x.numero}</b><span>{dataMedia(x.data)}</span></div><span className="badge">{x.estado}</span></a>)}</div>
            </div>
          )}
          {fin && docs.length > 0 && (
            <div className="card pad">
              <h3>Faturas e recibos</h3>
              <div className="list">{docs.map((x) => <DocLinha key={x.id} doc={x} />)}</div>
            </div>
          )}
          {pode('apagar') && jobs.length === 0 && <button className="btn danger" onClick={async () => { await apagar(db.clientes, c.id); ir('/clientes') }}><Icon n="lixo" /> Apagar cliente</button>}
        </div>
      </div>
      {edit && <ClienteForm c={c} onClose={() => setEdit(false)} />}
      {novoT && <TrabalhoForm preset={{ clienteId: c.id }} onClose={() => setNovoT(false)} />}
    </Page>
  )
}
