import { useMemo, useState } from 'react'
import { agora, db, guardarFicheiro, novo, registar, type Cliente, type Documento, type MetodoPagamento, type Pagamento, type TipoTrabalho, type Trabalho } from '../db'
import { confirmado, hojeISO, ivaDeBase, r2, semDocumento, TIPOS } from '../calc'
import { mt, num2, parseNum } from '../format'
import { proximoCodigo, useDados, useSessao } from '../state'
import { Field, Icon, Modal, Seg, Thumb, UploadZone, useToast } from '../ui'
import { metodos } from './comum'

// The quick buttons of the home screen (16 Oct): Novo pedido · Fatura · Recibo.

// A client asked for something and nothing is quoted yet: write it down so it is not forgotten.
export function NovoPedido({ onClose }: { onClose: () => void }) {
  const d = useDados()
  const { user } = useSessao()
  const toast = useToast()
  const [cliNome, setCliNome] = useState('')
  const [tipo, setTipo] = useState<TipoTrabalho>('branding')
  const [pedido, setPedido] = useState('')
  const [ate, setAte] = useState('')
  async function salvar() {
    if (!cliNome.trim()) return toast('Escreva o nome do cliente')
    if (!pedido.trim()) return toast('Escreva o que o cliente pediu')
    let cli = d.clientes.find((c) => c.nome.trim().toLowerCase() === cliNome.trim().toLowerCase())
    if (!cli) {
      cli = novo<Cliente>({ nome: cliNome.trim() })
      await db.clientes.put(cli)
    }
    const primeira = pedido.trim().split('\n')[0]
    const t = novo<Trabalho>({
      codigo: proximoCodigo('T', d.trabalhos.map((x) => x.codigo)),
      titulo: primeira.length > 70 ? primeira.slice(0, 67) + '…' : primeira,
      clienteId: cli.id,
      tipo,
      descricao: pedido.trim(),
      itens: [],
      comIva: true,
      urgente: false,
      etapa: 'pedido',
      etapas: [{ etapa: 'pedido', em: agora(), por: user.id }],
      dataEntrada: hojeISO(),
      prazo: '',
      prazos: ate ? { pedido: ate } : undefined,
      ficheiros: [],
      notas: []
    })
    await db.trabalhos.put(t)
    await registar(user.id, `registou o pedido ${t.codigo} (${cli.nome})`, t.id)
    toast(`Pedido ${t.codigo} registado — está na agenda`)
    onClose()
  }
  return (
    <Modal title="Novo pedido" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" onClick={salvar}><Icon n="check" /> Guardar pedido</button></>}>
      <div className="form-grid">
        <Field label="Cliente" full hint={cliNome.trim() && !d.clientes.some((c) => c.nome.toLowerCase() === cliNome.trim().toLowerCase()) ? 'Cliente novo — fica registado' : undefined}>
          <input autoFocus list="cli-pedido" value={cliNome} onChange={(e) => setCliNome(e.target.value)} placeholder="Nome do cliente" autoComplete="off" />
          <datalist id="cli-pedido">{d.clientes.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
        </Field>
        <Field label="O que pediu" full><textarea value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="Ex.: ver a imagem da empresa, branding de 2 camiões, 50 camisetes…" style={{ minHeight: 90 }} /></Field>
        <Field label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTrabalho)}>
            {TIPOS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </Field>
        <Field label="Responder até (opcional)"><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

const ehFatura = (x: Documento) => x.direcao === 'emitido' && (x.tipo === 'fatura' || x.tipo === 'fatura-recibo' || x.tipo === 'venda-dinheiro')
const cobre = (x: Documento, id: string) => x.trabalhoId === id || !!x.trabalhoIds?.includes(id)

// Payments of these jobs still without a document go to `docId`, oldest first, up to `valor`.
async function documentarPagamentos(pagamentos: Pagamento[], jobs: string[], docId: string, valor: number) {
  let resto = valor
  for (const p of semDocumento(pagamentos).filter((x) => jobs.includes(x.trabalhoId))) {
    if (resto <= 0.005) break
    await db.pagamentos.put({ ...p, reciboId: docId, updatedAt: agora() })
    resto = r2(resto - p.valor)
  }
}

// Invoice from the company's own invoice book: the app never numbers invoices, it keeps the book's number and the file.
export function EmitirFatura({ onClose, trabalhoId, tipoInicial }: { onClose: () => void; trabalhoId?: string; tipoInicial?: 'fatura' | 'fatura-recibo' }) {
  const d = useDados()
  const { user } = useSessao()
  const toast = useToast()
  const taxa = d.empresa.taxaIva
  const candidatos = useMemo(
    () => d.trabalhos.filter((t) => { const r = d.resumo(t); return !t.cancelado && r.total > 0 && confirmado(t, r.pago) && !d.documentos.some((x) => ehFatura(x) && cobre(x, t.id)) }),
    [d]
  )
  const clientes = [...new Set(candidatos.map((t) => t.clienteId))].map((id) => d.cliente(id)).filter(Boolean) as Cliente[]
  const inicial = trabalhoId ? d.trabalhos.find((t) => t.id === trabalhoId)?.clienteId : clientes[0]?.id
  const [cliId, setCliId] = useState(inicial || '')
  const dele = candidatos.filter((t) => t.clienteId === cliId)
  const [sel, setSel] = useState<string[]>(() => (trabalhoId ? [trabalhoId] : candidatos.filter((t) => t.clienteId === (inicial || '')).map((t) => t.id)))
  const [tipo, setTipo] = useState<'fatura' | 'fatura-recibo'>(tipoInicial || 'fatura')
  const jaPago = r2(semDocumento(d.pagamentos).filter((p) => sel.includes(p.trabalhoId)).reduce((s, p) => s + p.valor, 0))
  const [numero, setNumero] = useState('')
  const [data, setData] = useState(hojeISO())
  const [ficheiroId, setFicheiroId] = useState<string>()
  const baseAuto = r2(sel.reduce((s, id) => { const t = d.trabalhos.find((x) => x.id === id); return s + (t ? d.resumo(t).subtotal : 0) }, 0))
  const [base, setBase] = useState<number | null>(null)
  const b = base ?? baseAuto
  const iva = ivaDeBase(b, taxa)

  const escolherCliente = (id: string) => { setCliId(id); setSel(candidatos.filter((t) => t.clienteId === id).map((t) => t.id)); setBase(null) }
  async function salvar() {
    const cli = d.cliente(cliId)
    if (!cli || !sel.length) return toast('Escolha o trabalho')
    if (!numero.trim()) return toast('Escreva o número da fatura')
    const doc = novo<Documento>({ direcao: 'emitido', tipo, numero: numero.trim(), data, entidade: cli.nome, nuit: cli.nuit, clienteId: cli.id, trabalhoId: sel[0], trabalhoIds: sel, base: b, iva, total: r2(b + iva), ficheiroId })
    await db.documentos.put(doc)
    // A fatura-recibo is the document of the money already received.
    if (tipo === 'fatura-recibo') await documentarPagamentos(d.pagamentos, sel, doc.id, doc.total)
    await registar(user.id, `fatura ${doc.numero} para ${cli.nome}`, sel[0])
    toast(`Fatura ${doc.numero} registada · ${mt(doc.total)}`)
    onClose()
  }
  return (
    <Modal wide title={tipo === 'fatura-recibo' ? 'Fatura-recibo' : 'Emitir fatura'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" onClick={salvar}><Icon n="check" /> Guardar fatura</button></>}>
      {candidatos.length === 0 ? (
        <div className="small muted">Não há trabalhos confirmados por faturar. Um trabalho entra aqui depois de "Cliente confirmou".</div>
      ) : (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="col">
            <Field label="Cliente">
              <select value={cliId} onChange={(e) => escolherCliente(e.target.value)}>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Field>
            <div className="field"><span>Trabalhos desta fatura</span></div>
            <div className="list">
              {dele.map((t) => {
                const on = sel.includes(t.id)
                return (
                  <label key={t.id} className="li" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => { setSel(on ? sel.filter((x) => x !== t.id) : [...sel, t.id]); setBase(null) }} />
                    <div className="main-t"><b>{t.titulo}</b><span>{t.codigo}</span></div>
                    <b className="num nowrap">{mt(d.resumo(t).total)}</b>
                  </label>
                )
              })}
            </div>
          </div>
          <div className="form-grid">
            <div className="field full seg-wrap">
              <span>Documento</span>
              <Seg value={tipo} onChange={setTipo} options={[{ v: 'fatura', l: 'Fatura' }, { v: 'fatura-recibo', l: 'Fatura-recibo (já pago)' }]} />
              {tipo === 'fatura-recibo' && <small>{jaPago > 0 ? `Fica como documento dos ${mt(jaPago)} já recebidos.` : 'Ainda não há pagamento registado nestes trabalhos — carregue primeiro em "Pago" no trabalho.'}</small>}
            </div>
            <Field label="Número" hint="O número do seu livro de faturas — a app não cria números"><input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Nº do seu livro" /></Field>
            <Field label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
            <Field label="Valor sem IVA" full><input inputMode="decimal" key={baseAuto} defaultValue={num2(b)} onBlur={(e) => setBase(parseNum(e.target.value))} /></Field>
            <div className="req-total small full">
              <div className="row"><span className="muted">IVA {taxa}%</span><span className="spacer" /><span className="num">{mt(iva)}</span></div>
              <div className="row b"><span>Total</span><span className="spacer" /><span className="num">{mt(r2(b + iva))}</span></div>
            </div>
            <div className="field full">
              <span>Ficheiro da fatura</span>
              {ficheiroId ? <div className="thumbs" style={{ gridTemplateColumns: '1fr' }}><Thumb id={ficheiroId} onRemove={() => setFicheiroId(undefined)} /></div> : <UploadZone multiple={false} text="Foto ou PDF da fatura" onFiles={async (fs) => fs[0] && setFicheiroId(await guardarFicheiro(fs[0]))} />}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

// Receipt for an invoice. Several receipts on one invoice = paid in instalments.
export function EmitirRecibo({ onClose, faturaId: faturaInicial }: { onClose: () => void; faturaId?: string }) {
  const d = useDados()
  const { user } = useSessao()
  const toast = useToast()
  const pagoDe = (f: Documento) => r2(d.documentos.filter((x) => x.tipo === 'recibo' && x.faturaId === f.id).reduce((s, x) => s + x.total, 0))
  const abertas = d.documentos.filter((x) => ehFatura(x) && x.tipo === 'fatura' && x.total - pagoDe(x) > 0.005)
  const [faturaId, setFaturaId] = useState(faturaInicial || abertas[0]?.id || '')
  const fatura = abertas.find((x) => x.id === faturaId)
  const saldo = fatura ? r2(fatura.total - pagoDe(fatura)) : 0
  const [valor, setValor] = useState<number | null>(null)
  const v = valor ?? saldo
  const [numero, setNumero] = useState('')
  const [data, setData] = useState(hojeISO())
  const [metodo, setMetodo] = useState<MetodoPagamento>('M-Pesa')
  const jobsDa = (f?: Documento) => ((f?.trabalhoIds?.length ? f.trabalhoIds : [f?.trabalhoId]).filter(Boolean) as string[])
  const semRecibo = r2(semDocumento(d.pagamentos).filter((p) => jobsDa(fatura).includes(p.trabalhoId)).reduce((s, p) => s + p.valor, 0))
  // Money already recorded with "Pago" just needs its receipt: do not record it twice.
  const [jaEscolhido, setJaRegistado] = useState<boolean | null>(null)
  const jaRegistado = jaEscolhido ?? semRecibo > 0
  const [ficheiroId, setFicheiroId] = useState<string>()

  async function salvar() {
    if (!fatura) return toast('Escolha a fatura')
    if (!numero.trim()) return toast('Escreva o número do recibo')
    if (v <= 0) return toast('Indique o valor recebido')
    const jobs = jobsDa(fatura)
    const rec = novo<Documento>({ direcao: 'emitido', tipo: 'recibo', numero: numero.trim(), data, entidade: fatura.entidade, nuit: fatura.nuit, clienteId: fatura.clienteId, trabalhoId: jobs[0], trabalhoIds: jobs, faturaId: fatura.id, base: 0, iva: 0, total: v, ficheiroId, notas: `Recibo da fatura ${fatura.numero}` })
    await db.documentos.put(rec)
    if (jaRegistado) await documentarPagamentos(d.pagamentos, jobs, rec.id, v)
    // The money goes on the job(s), oldest debt first.
    if (!jaRegistado) {
      let resto = v
      for (const [i, id] of jobs.entries()) {
        const t = d.trabalhos.find((x) => x.id === id)
        if (!t || resto <= 0.005) continue
        const falta = d.resumo(t).emDivida
        const parte = i === jobs.length - 1 ? resto : Math.min(resto, falta)
        if (parte <= 0.005) continue
        await db.pagamentos.put(novo<Pagamento>({ trabalhoId: id, data, valor: r2(parte), metodo, tipo: parte + 0.005 >= falta ? 'final' : 'parcial', referencia: `Recibo ${rec.numero}`, reciboId: rec.id }))
        resto = r2(resto - parte)
      }
    }
    await registar(user.id, `recibo ${rec.numero} (${mt(v)}) da fatura ${fatura.numero}`, jobs[0])
    toast(v + 0.005 >= saldo ? `Fatura ${fatura.numero} paga` : `Recibo ${rec.numero} · falta ${mt(r2(saldo - v))} da fatura ${fatura.numero}`)
    onClose()
  }
  return (
    <Modal title="Emitir recibo" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" onClick={salvar}><Icon n="check" /> Guardar recibo</button></>}>
      {abertas.length === 0 ? (
        <div className="small muted">Não há faturas por pagar. O recibo vai sempre ligado a uma fatura — registe primeiro a fatura.</div>
      ) : (
        <div className="form-grid">
          <Field label="Fatura" full>
            <select value={faturaId} onChange={(e) => { setFaturaId(e.target.value); setValor(null) }}>
              {abertas.map((f) => <option key={f.id} value={f.id}>{f.numero} · {f.entidade} · falta {mt(r2(f.total - pagoDe(f)))}</option>)}
            </select>
          </Field>
          <Field label="Valor recebido" hint={fatura ? `Total ${mt(fatura.total)} · já recebido ${mt(pagoDe(fatura))}` : undefined}><input inputMode="decimal" key={faturaId} defaultValue={num2(v)} onBlur={(e) => setValor(parseNum(e.target.value))} /></Field>
          <Field label="Número do recibo" hint="O do seu livro"><input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Nº do seu livro" /></Field>
          <Field label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
          <Field label="Método">
            <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPagamento)}>{metodos.map((m) => <option key={m}>{m}</option>)}</select>
          </Field>
          <label className="check full"><input type="checkbox" checked={jaRegistado} onChange={(e) => setJaRegistado(e.target.checked)} /> Já carreguei em "Pago" — é só o recibo{semRecibo > 0 ? ` (${mt(semRecibo)} sem recibo)` : ''}</label>
          <div className="field full">
            <span>Ficheiro do recibo</span>
            {ficheiroId ? <div className="thumbs" style={{ gridTemplateColumns: '1fr' }}><Thumb id={ficheiroId} onRemove={() => setFicheiroId(undefined)} /></div> : <UploadZone multiple={false} text="Foto ou PDF do recibo" onFiles={async (fs) => fs[0] && setFicheiroId(await guardarFicheiro(fs[0]))} />}
          </div>
        </div>
      )}
    </Modal>
  )
}
