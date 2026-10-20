import { useMemo, useState } from 'react'
import { Page } from '../App'
import { apagar, db, guardar, guardarFicheiro, novo, registar, type Documento, type TipoDocumento } from '../db'
import { baseDeTotal, contaParaIva, hojeISO, ivaDeBase, r2 } from '../calc'
import { dataMedia, mesNome, mt, num2, parseNum } from '../format'
import { useDados, useSessao } from '../state'
import { abrirFicheiro, DemoTag, Empty, Field, Icon, Modal, Seg, Thumb, UploadZone, useToast } from '../ui'

export const TIPOS_DOC: { v: TipoDocumento; l: string }[] = [
  { v: 'fatura', l: 'Fatura' },
  { v: 'fatura-recibo', l: 'Fatura-recibo' },
  { v: 'venda-dinheiro', l: 'Venda a dinheiro' },
  { v: 'recibo', l: 'Recibo' },
  { v: 'nota-credito', l: 'Nota de crédito' },
  { v: 'outro', l: 'Outro' }
]
const nomeTipo = (t: TipoDocumento) => TIPOS_DOC.find((x) => x.v === t)?.l || t

export function DocLinha({ doc, onClick }: { doc: Documento; onClick?: () => void }) {
  const d = useDados()
  const [abrir, setAbrir] = useState(false)
  const job = d.trabalhos.find((t) => t.id === doc.trabalhoId)
  const contaIva = contaParaIva(doc.tipo)
  return (
    <>
      <div className="li" onClick={onClick || (() => setAbrir(true))}>
        <div className="avatar" style={{ background: doc.direcao === 'emitido' ? 'color-mix(in srgb, var(--y) 16%, transparent)' : 'color-mix(in srgb, var(--info) 16%, transparent)', color: doc.direcao === 'emitido' ? 'var(--y)' : 'var(--info)' }}>
          <Icon n={doc.direcao === 'emitido' ? 'upload' : 'download'} />
        </div>
        <div className="main-t">
          <b>{nomeTipo(doc.tipo)} {doc.numero} <DemoTag demo={doc.demo} /></b>
          <span>{dataMedia(doc.data)} · {doc.entidade}{job ? ` · ${job.codigo}` : ''}{doc.despesaId ? ' · despesa' : ''}{doc.ficheiroId ? ' · 📎' : ''}</span>
        </div>
        <div className="right">
          <b className="num nowrap">{mt(doc.total)}</b>
          <div className="tiny muted num">{contaIva ? `IVA ${mt(doc.iva)}` : 'não conta p/ IVA'}</div>
        </div>
      </div>
      {abrir && <DocumentoForm doc={doc} onClose={() => setAbrir(false)} />}
    </>
  )
}

export function DocumentoForm({ doc, preset, onClose }: { doc?: Documento; preset?: Partial<Documento>; onClose: () => void }) {
  const d = useDados()
  const { user, pode } = useSessao()
  const toast = useToast()
  const taxa = d.empresa.taxaIva
  const [f, setF] = useState<Partial<Documento>>(() =>
    doc ? structuredClone(doc) : { direcao: 'recebido', tipo: 'fatura', numero: '', data: hojeISO(), entidade: '', base: 0, iva: 0, total: 0, ...preset }
  )
  const [modo, setModo] = useState<'base' | 'total'>('base')
  const set = (p: Partial<Documento>) => setF((x) => ({ ...x, ...p }))
  const contaIva = contaParaIva(f.tipo!)

  function porBase(v: number) {
    const iva = contaIva ? ivaDeBase(v, taxa) : 0
    set({ base: v, iva, total: r2(v + iva) })
  }
  function porTotal(v: number) {
    const base = contaIva ? baseDeTotal(v, taxa) : v
    set({ total: v, base, iva: r2(v - base) })
  }

  async function salvar() {
    if (!f.entidade?.trim()) return toast('Indique o cliente ou fornecedor')
    if (!f.total) return toast('Indique o valor')
    const cli = d.clientes.find((c) => c.nome === f.entidade)
    const forn = d.fornecedores.find((c) => c.nome === f.entidade)
    const rec = {
      ...f,
      numero: f.numero?.trim() || 's/n',
      clienteId: f.direcao === 'emitido' ? f.clienteId || cli?.id : undefined,
      fornecedorId: f.direcao === 'recebido' ? f.fornecedorId || forn?.id : undefined
    }
    if (doc) await guardar(db.documentos, rec as Documento)
    else {
      const n = novo<Documento>(rec as any)
      await db.documentos.put(n)
      await registar(user.id, `carregou ${nomeTipo(n.tipo)} ${n.numero}`, n.id)
    }
    toast('Documento guardado')
    onClose()
  }

  const entidades = f.direcao === 'emitido' ? d.clientes.map((c) => c.nome) : d.fornecedores.map((c) => c.nome)

  return (
    <Modal
      wide
      title={doc ? `${nomeTipo(doc.tipo)} ${doc.numero}` : 'Carregar fatura ou recibo'}
      onClose={onClose}
      footer={
        <>
          {doc && pode('apagar') && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={async () => { await apagar(db.documentos, doc.id); onClose() }}><Icon n="lixo" /> Apagar</button>}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn pri" onClick={salvar}><Icon n="check" /> Guardar</button>
        </>
      }
    >
      {doc?.despesaId && <div className="banner"><Icon n="despesa" /> Esta fatura vem de uma despesa da empresa. Para mudar o valor, edite-a em <a href="#/despesas" onClick={onClose}>Despesas</a>.</div>}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="col">
          <div className="small b tx2">Foto, scan ou PDF</div>
          {f.ficheiroId ? (
            <div className="thumbs" style={{ gridTemplateColumns: '1fr' }}><Thumb id={f.ficheiroId} onRemove={() => set({ ficheiroId: undefined })} /></div>
          ) : (
            <UploadZone multiple={false} text="Tirar foto ou escolher ficheiro" onFiles={async (fs) => fs[0] && set({ ficheiroId: await guardarFicheiro(fs[0]) })} />
          )}
          <div className="tiny muted">O sistema não emite faturas: guarda e organiza as do seu programa oficial e as dos fornecedores.</div>
        </div>
        <div className="form-grid">
          <div className="field full">
            <span>Direção</span>
            <Seg value={f.direcao!} onChange={(v) => set({ direcao: v, entidade: '', clienteId: undefined, fornecedorId: undefined })} options={[{ v: 'emitido', l: 'Emitido por mim', i: 'upload' }, { v: 'recebido', l: 'Recebido', i: 'download' }]} />
          </div>
          <Field label="Tipo">
            <select value={f.tipo} onChange={(e) => { const tipo = e.target.value as TipoDocumento; const conta = contaParaIva(tipo); setF((x) => ({ ...x, tipo, iva: conta ? ivaDeBase(x.base || 0, taxa) : 0, total: conta ? r2((x.base || 0) + ivaDeBase(x.base || 0, taxa)) : x.total })) }}>
              {TIPOS_DOC.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Field>
          <Field label="Número"><input value={f.numero} onChange={(e) => set({ numero: e.target.value })} placeholder="FT 2026/120" /></Field>
          <Field label={f.direcao === 'emitido' ? 'Cliente' : 'Fornecedor / entidade'} full>
            <input list="ents" value={f.entidade} onChange={(e) => set({ entidade: e.target.value })} />
            <datalist id="ents">{entidades.map((x) => <option key={x} value={x} />)}</datalist>
          </Field>
          <Field label="Data"><input type="date" value={f.data} onChange={(e) => set({ data: e.target.value })} /></Field>
          <Field label="NUIT (opcional)"><input inputMode="numeric" value={f.nuit || ''} onChange={(e) => set({ nuit: e.target.value })} /></Field>
          <div className="field full">
            <span>Valores</span>
            {contaIva && <Seg value={modo} onChange={setModo} options={[{ v: 'base', l: 'Sei o valor sem IVA' }, { v: 'total', l: 'Sei o total' }]} />}
            <div className="row" style={{ marginTop: 6 }}>
              {(modo === 'base' && contaIva) ? (
                <label className="field" style={{ flex: 1 }}><span>Sem IVA</span><input inputMode="decimal" defaultValue={f.base ? num2(f.base) : ''} key={`b${f.tipo}${modo}`} onBlur={(e) => porBase(parseNum(e.target.value))} /></label>
              ) : (
                <label className="field" style={{ flex: 1 }}><span>Total</span><input inputMode="decimal" defaultValue={f.total ? num2(f.total) : ''} key={`t${f.tipo}${modo}`} onBlur={(e) => porTotal(parseNum(e.target.value))} /></label>
              )}
              {contaIva && <label className="field" style={{ width: 130 }}><span>IVA</span><input inputMode="decimal" value={num2(f.iva || 0)} onChange={(e) => { const iva = parseNum(e.target.value); set({ iva, total: r2((f.base || 0) + iva) }) }} /></label>}
            </div>
            <div className="req-total small" style={{ marginTop: 8 }}>
              <div className="row"><span className="muted">Sem IVA</span><span className="spacer" /><span className="num">{mt(f.base || 0)}</span></div>
              <div className="row"><span className="muted">IVA</span><span className="spacer" /><span className="num">{mt(f.iva || 0)}</span></div>
              <div className="row b"><span>Total</span><span className="spacer" /><span className="num">{mt(f.total || 0)}</span></div>
            </div>
            <small>{contaIva ? (f.direcao === 'emitido' ? 'Conta como IVA liquidado (a entregar ao Estado).' : 'Conta como IVA dedutível (abate no IVA a pagar).') : 'Recibos não entram na relação do IVA — o IVA está na fatura.'}</small>
          </div>
          <Field label="Trabalho (opcional)" full>
            <select value={f.trabalhoId || ''} onChange={(e) => set({ trabalhoId: e.target.value || undefined })}>
              <option value="">— nenhum —</option>
              {d.trabalhos.map((t) => <option key={t.id} value={t.id}>{t.codigo} · {t.titulo}</option>)}
            </select>
          </Field>
          <Field label="Notas" full><input value={f.notas || ''} onChange={(e) => set({ notas: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  )
}

export default function Documentos() {
  const d = useDados()
  const [dir, setDir] = useState<'todos' | 'emitido' | 'recebido'>('todos')
  const [mes, setMes] = useState('')
  const [q, setQ] = useState('')
  const [novoDoc, setNovoDoc] = useState(false)
  const meses = [...new Set(d.documentos.map((x) => x.data.slice(0, 7)))].sort().reverse()
  const lista = useMemo(
    () => d.documentos.filter((x) => (dir === 'todos' || x.direcao === dir) && (!mes || x.data.startsWith(mes)) && (!q || `${x.numero} ${x.entidade} ${x.notas || ''}`.toLowerCase().includes(q.toLowerCase()))),
    [d.documentos, dir, mes, q]
  )
  const grupos = useMemo(() => {
    const g = new Map<string, Documento[]>()
    for (const x of lista) g.set(x.data.slice(0, 7), [...(g.get(x.data.slice(0, 7)) || []), x])
    return [...g.entries()]
  }, [lista])
  const semFicheiro = d.documentos.filter((x) => !x.ficheiroId).length

  return (
    <Page title="Faturas e recibos" sub={`${d.documentos.length} documentos arquivados`} actions={<button className="btn pri" onClick={() => setNovoDoc(true)}><Icon n="camera" /> <span className="hide-m">Carregar</span></button>}>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <Seg value={dir} onChange={setDir} options={[{ v: 'todos', l: 'Todos' }, { v: 'emitido', l: 'Emitidos' }, { v: 'recebido', l: 'Recebidos' }]} />
        <select className="inp" style={{ width: 'auto' }} value={mes} onChange={(e) => setMes(e.target.value)}>
          <option value="">Todos os meses</option>
          {meses.map((m) => <option key={m} value={m}>{mesNome(m)}</option>)}
        </select>
        <div className="search"><Icon n="search" /><input className="inp" placeholder="Número, cliente, fornecedor…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {semFicheiro > 0 && <div className="banner"><Icon n="camera" /> {semFicheiro} documento{semFicheiro > 1 ? 's' : ''} sem foto/scan anexado. Abra e carregue a imagem para ficar tudo arquivado.</div>}
      {grupos.length === 0 ? (
        <div className="card"><Empty icon="recibo" title="Sem documentos" text="Carregue a primeira fatura ou recibo." /></div>
      ) : (
        grupos.map(([m, xs]) => (
          <div key={m} className="card pad" style={{ marginBottom: 14 }}>
            <h3>{mesNome(m)} <span className="right small tx2">{xs.length} doc · <a href={`#/iva?mes=${m}`}>Relação do IVA →</a></span></h3>
            <div className="list">{xs.map((x) => <DocLinha key={x.id} doc={x} />)}</div>
          </div>
        ))
      )}
      {novoDoc && <DocumentoForm onClose={() => setNovoDoc(false)} />}
    </Page>
  )
}

export { abrirFicheiro }
