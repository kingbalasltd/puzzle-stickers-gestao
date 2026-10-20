import { useMemo, useState, type ReactNode } from 'react'
import { apagar, db, guardar, guardarFicheiro, novo, registar, uid, type Despesa, type Documento, type Fornecedor, type ItemEncomenda, type LinhaImpressao, type Requisicao, type Trabalho } from '../db'
import { baseDeTotal, diasEntre, estadoPagamento, faseRequisicao, FASES_REQ, hojeISO, m2Linha, numeroDoMes, pagoRequisicao, r2, saldoRequisicao, totaisRequisicao } from '../calc'
import { dataMedia, mt, num2, parseNum, waLink } from '../format'
import { useDados, useSessao } from '../state'
import { Field, Icon, Modal, Seg, Thumb, UploadZone, useToast, useVer } from '../ui'
import { Miniatura } from '../Visualizador'
import { chaveNome, lerFicheiro } from '../leitura'
import { imprimirLista } from '../print'
import { linhasComMaterial, nomeMaterial, precoM2, valorLinha } from '../requisicaoPdf'
import { metodos } from './comum'

const nomeFicheiro = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[—–-]+/g, ' ')
    .replace(/[^A-Za-z0-9.]+/g, '_')
    .replace(/^_+|_+$/g, '')

export function FaseBadge({ r }: { r: Requisicao }) {
  const f = FASES_REQ[faseRequisicao(r)]
  return <span className="badge"><i style={{ background: f.cor }} />{f.nome}</span>
}

type Aba = 'pedido' | 'circuito'

// Default material of a new order: Bundle Wrap when the supplier has it (most of the company's work is wrap).
function baseDe(f?: Fornecedor) {
  const imps = f?.materiais.filter((m) => m.tipo === 'impressao') || []
  const imp = imps.find((m) => /vinil de wrap/i.test(m.nome)) || imps[0]
  const lam = imp && /vinil de wrap/i.test(imp.nome) ? f?.materiais.find((m) => m.tipo === 'laminacao' && /de wrap/i.test(m.nome)) : undefined
  return { materialImpressao: imp?.nome || '', precoImpressaoM2: imp?.precoM2 || 0, materialLaminacao: lam?.nome || '', precoLaminacaoM2: lam?.precoM2 || 0 }
}
const materialDe = (b: Pick<Requisicao, 'materialImpressao' | 'precoImpressaoM2' | 'materialLaminacao' | 'precoLaminacaoM2'>) => ({ impressao: b.materialImpressao, precoImpressao: b.precoImpressaoM2, laminacao: b.materialLaminacao, precoLaminacao: b.precoLaminacaoM2 })
const linhaNova = (b: Pick<Requisicao, 'materialImpressao' | 'precoImpressaoM2' | 'materialLaminacao' | 'precoLaminacaoM2'>): LinhaImpressao => ({ qt: 1, ficheiro: '', largura: 0, comprimento: 0, ...materialDe(b) })
const preco = (v: number) => `${mt(v).replace(',00', '')}/m²`

export function RequisicaoForm({ trabalho: trab0, r, onClose, preset }: { trabalho?: Trabalho; r?: Requisicao; onClose: () => void; preset?: Partial<Requisicao> }) {
  const d = useDados()
  const { user, pode } = useSessao()
  const toast = useToast()
  const taxa = d.empresa.taxaIva
  const forn0 = d.fornecedores.find((x) => x.materiais.some((m) => m.tipo === 'impressao')) || d.fornecedores[0]
  const [f, setF] = useState<Requisicao>(() =>
    r
      ? (() => { const c = structuredClone(r); return c.tipo === 'encomenda' ? c : { ...c, linhas: linhasComMaterial(c) } })()
      : novo<Requisicao>({
          numero: numeroDoMes('REQ', d.requisicoes.map((x) => x.numero), hojeISO()),
          trabalhoId: trab0?.id || '',
          fornecedorId: forn0?.id || '',
          data: hojeISO(),
          tipo: 'lista',
          nomeTrabalho: trab0 ? nomeFicheiro(`${d.cliente(trab0.clienteId)?.nome || ''} ${trab0.titulo}`) + '_Material' : '',
          ...baseDe(forn0),
          linhas: [linhaNova(baseDe(forn0))],
          itens: [{ descricao: '', unidade: 'un', qt: 1, precoUnit: 0 }],
          comIva: true,
          estado: 'rascunho',
          pagamento: 'pendente',
          ...preset
        } as any)
  )
  const trabalho = d.trabalhos.find((t) => t.id === f.trabalhoId)
  const [aba, setAba] = useState<Aba>(() => (r && (r.enviadaEm || r.proforma || r.estado !== 'rascunho') ? 'circuito' : 'pedido'))
  const [guardada, setGuardada] = useState(!!r)
  const set = (p: Partial<Requisicao>) => setF((x) => ({ ...x, ...p }))
  const setL = (i: number, p: Partial<LinhaImpressao>) => set({ linhas: f.linhas.map((l, k) => (k === i ? { ...l, ...p } : l)) })
  const setI = (i: number, p: Partial<ItemEncomenda>) => set({ itens: (f.itens || []).map((l, k) => (k === i ? { ...l, ...p } : l)) })
  const tot = useMemo(() => totaisRequisicao(f, taxa), [f, taxa])
  const forn = d.fornecedor(f.fornecedorId)
  const lista = f.tipo !== 'encomenda'

  function trocarFornecedor(id: string) {
    const nf = d.fornecedor(id)
    const temImpressao = !!nf?.materiais.some((m) => m.tipo === 'impressao')
    set({ fornecedorId: id, ...(temImpressao ? baseDe(nf) : {}), ...(!temImpressao && nf?.materiais.length ? { tipo: 'encomenda' as const } : {}) })
  }

  // The base material: what new prints get, and what "aplicar a todos" copies.
  function escolherMaterial(tipo: 'impressao' | 'laminacao', nome: string) {
    const m = forn?.materiais.find((x) => x.nome === nome)
    if (tipo === 'impressao') set({ materialImpressao: nome, precoImpressaoM2: nome ? m?.precoM2 ?? 0 : 0 })
    else set({ materialLaminacao: nome, precoLaminacaoM2: nome ? m?.precoM2 ?? 0 : 0 })
  }
  const aplicarATodos = () => set({ linhas: f.linhas.map((l) => ({ ...l, ...materialDe(f) })) })
  const escolherNaLinha = (i: number, tipo: 'impressao' | 'laminacao', nome: string) => {
    const m = forn?.materiais.find((x) => x.nome === nome)
    setL(i, tipo === 'impressao' ? { impressao: nome, precoImpressao: nome ? m?.precoM2 ?? 0 : 0 } : { laminacao: nome, precoLaminacao: nome ? m?.precoM2 ?? 0 : 0 })
  }

  function limpo(x: Requisicao): Requisicao | null {
    if (!x.fornecedorId) { toast('Escolha o fornecedor'); return null }
    if (x.tipo === 'encomenda') {
      const itens = (x.itens || []).filter((i) => i.descricao.trim() && i.qt)
      if (!itens.length) { toast('Adicione pelo menos um item'); return null }
      return { ...x, itens }
    }
    // Keep QT 0 rows like the company's sheet does (PRINT_6/7 with Qt. 0), but need some m².
    const linhas = x.linhas.filter((l) => l.ficheiro.trim() || l.largura || l.comprimento)
    if (!linhas.some((l) => m2Linha(l) > 0)) { toast('Adicione pelo menos um print com medidas'); return null }
    return { ...x, linhas: linhas.map((l, i) => ({ ...l, ficheiro: l.ficheiro || `${x.nomeTrabalho}_PRINT_${i + 1}` })) }
  }

  async function persistir(patch: Partial<Requisicao> = {}, msg?: string) {
    const rec = limpo({ ...f, ...patch })
    if (!rec) return null
    await guardar(db.requisicoes, rec)
    if (!guardada) {
      await registar(user.id, `criou ${rec.numero}${trabalho ? ` para ${trabalho.codigo}` : ''}`, trabalho?.id || rec.id)
      setGuardada(true)
    }
    setF(rec)
    if (msg) toast(msg)
    return rec
  }

  const opcoesImp = forn?.materiais.filter((m) => m.tipo === 'impressao') || []
  const opcoesLam = forn?.materiais.filter((m) => m.tipo === 'laminacao') || []
  const fase = faseRequisicao(f)

  return (
    <Modal
      wide
      title={<span className="row wrap" style={{ gap: 8 }}><span className="hide-m">{lista ? 'Lista de impressão' : 'Encomenda'} ·</span> <span>{f.numero}</span> {guardada && <FaseBadge r={f} />}</span>}
      onClose={onClose}
      footer={
        <>
          {r && pode('apagar') && <button className="btn danger" onClick={async () => { await apagar(db.requisicoes, r.id); onClose() }} aria-label="Apagar"><Icon n="lixo" /></button>}
          <span className="spacer" />
          {lista && <button className="btn" onClick={async () => { const x = await persistir(); if (x) { toast('A preparar o PDF…'); await imprimirLista(x, d) } }}><Icon n="imprimir" /> PDF</button>}
          <button className="btn pri" onClick={async () => { if (await persistir({}, `${f.numero} guardada`)) onClose() }}><Icon n="check" /> Guardar</button>
        </>
      }
    >
      <div className="tabs" style={{ marginTop: -6 }}>
        <button className={aba === 'pedido' ? 'on' : ''} onClick={() => setAba('pedido')}>{lista ? 'Prints' : 'Itens'} <span className="n">{lista ? f.linhas.filter((l) => l.qt > 0).length : (f.itens || []).length}</span></button>
        <button className={aba === 'circuito' ? 'on' : ''} onClick={() => setAba('circuito')}><span className="hide-m">Pró-forma, pagamento e faturas</span><span className="so-m">Pagamento e faturas</span> <span className="n" style={{ background: FASES_REQ[fase].cor, color: '#111' }}>{FASES_REQ[fase].nome}</span></button>
      </div>

      {aba === 'pedido' ? (
        <>
          <div className="form-grid">
            <Field label="Trabalho" full>
              <select value={f.trabalhoId} onChange={(e) => set({ trabalhoId: e.target.value })}>
                <option value="">— sem trabalho (ex.: vários clientes) —</option>
                {d.trabalhos.filter((t) => !t.cancelado).map((t) => <option key={t.id} value={t.id}>{t.codigo} · {t.titulo} · {d.cliente(t.clienteId)?.nome}</option>)}
              </select>
            </Field>
            <Field label="Fornecedor">
              <select value={f.fornecedorId} onChange={(e) => trocarFornecedor(e.target.value)}>
                <option value="">— escolher —</option>
                {d.fornecedores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </Field>
            <Field label="Data">
              <input type="date" value={f.data} onChange={(e) => set({ data: e.target.value })} />
            </Field>
            {!f.enviadaEm && !f.proforma && (
              <div className="field full seg-wrap">
                <Seg value={lista ? 'lista' : 'encomenda'} onChange={(v) => set({ tipo: v as any })} options={[{ v: 'lista', l: 'Lista de impressão (m²)', i: 'imprimir' }, { v: 'encomenda', l: 'Encomenda (unidades)', i: 'caixa' }]} />
              </div>
            )}
            <Field label={lista ? 'Nome do trabalho' : 'Referência'} full hint={lista ? 'Usado no nome dos ficheiros: NOME_PRINT_1, NOME_PRINT_2…' : undefined}>
              <input value={f.nomeTrabalho} onChange={(e) => set({ nomeTrabalho: e.target.value })} />
            </Field>
            {lista && (
              <div className="field full">
                <span>Material base (os prints novos ficam com este)</span>
                <div className="mat-base">
                  <select value={f.materialImpressao} onChange={(e) => escolherMaterial('impressao', e.target.value)} aria-label="Impressão base">
                    <option value="">Sem impressão</option>
                    {opcoesImp.map((m) => <option key={m.nome} value={m.nome}>{m.nome} · {preco(m.precoM2)}</option>)}
                  </select>
                  <select value={f.materialLaminacao} onChange={(e) => escolherMaterial('laminacao', e.target.value)} aria-label="Laminação base">
                    <option value="">Sem laminação</option>
                    {opcoesLam.map((m) => <option key={m.nome} value={m.nome}>{m.nome} · {preco(m.precoM2)}</option>)}
                  </select>
                  <button type="button" className="btn sm" onClick={aplicarATodos}>Aplicar a todos os prints</button>
                </div>
                <small>{nomeMaterial({ impressao: f.materialImpressao, laminacao: f.materialLaminacao })} · {mt((f.precoImpressaoM2 || 0) + (f.precoLaminacaoM2 || 0))}/m² · preçário de {forn?.nome || 'fornecedor'}, sem IVA</small>
              </div>
            )}
          </div>

          {lista ? (
            <>
              <div style={{ margin: '18px 0 8px' }} className="row">
                <b>Prints</b>
                <span className="spacer" />
                <button className="btn sm ghost" onClick={() => set({ linhas: f.linhas.map((l, i) => ({ ...l, ficheiro: `${f.nomeTrabalho}_PRINT_${i + 1}` })) })}><Icon n="editar" /> Gerar nomes</button>
              </div>
              <div className="lr head"><span>Qt.</span><span>Print (nome do ficheiro)</span><span>Largura</span><span>Comprimento</span><span className="r">m²</span><span /></div>
              {f.linhas.map((l, i) => (
                <div key={i} className="lr" style={{ opacity: l.qt ? 1 : 0.55 }}>
                  <input className="qt" inputMode="numeric" value={String(l.qt ?? '')} onChange={(e) => setL(i, { qt: parseNum(e.target.value) })} aria-label="Quantidade" />
                  <input className="fic" value={l.ficheiro} placeholder={`${f.nomeTrabalho}_PRINT_${i + 1}`} onChange={(e) => setL(i, { ficheiro: e.target.value })} aria-label="Nome do ficheiro" />
                  <input className="lg" inputMode="decimal" placeholder="L (m)" defaultValue={l.largura ? num2(l.largura) : ''} onBlur={(e) => setL(i, { largura: parseNum(e.target.value) })} aria-label="Largura em metros" />
                  <input className="cp" inputMode="decimal" placeholder="C (m)" defaultValue={l.comprimento ? num2(l.comprimento) : ''} onBlur={(e) => setL(i, { comprimento: parseNum(e.target.value) })} aria-label="Comprimento em metros" />
                  <span className="m2 num">{num2(m2Linha(l))} m²</span>
                  <button className="x btn sm icon ghost" onClick={() => set({ linhas: f.linhas.filter((_, k) => k !== i) })} disabled={f.linhas.length === 1} aria-label="Remover print"><Icon n="x" /></button>
                  <div className="mat">
                    <select value={l.impressao ?? ''} onChange={(e) => escolherNaLinha(i, 'impressao', e.target.value)} aria-label="Material de impressão do print">
                      <option value="">Sem impressão</option>
                      {opcoesImp.map((m) => <option key={m.nome} value={m.nome}>{m.nome} · {preco(m.precoM2)}</option>)}
                    </select>
                    <select value={l.laminacao ?? ''} onChange={(e) => escolherNaLinha(i, 'laminacao', e.target.value)} aria-label="Laminação do print">
                      <option value="">Sem laminação</option>
                      {opcoesLam.map((m) => <option key={m.nome} value={m.nome}>{m.nome} · {preco(m.precoM2)}</option>)}
                    </select>
                  </div>
                  <span className="val"><b className="num">{mt(valorLinha(l))}</b><small>{nomeMaterial(l) === 'Bundle Wrap' ? 'Bundle Wrap · ' : ''}{preco(precoM2(l))}</small></span>
                </div>
              ))}
              <button className="btn sm" style={{ marginTop: 8 }} onClick={() => set({ linhas: [...f.linhas, linhaNova(f)] })}><Icon n="plus" /> Print</button>
              {f.linhas.some((l) => !l.qt && (l.largura || l.ficheiro)) && <div className="tiny muted" style={{ marginTop: 6 }}>Prints com Qt. 0 ficam na lista mas não contam para os m².</div>}
            </>
          ) : (
            <>
              <div style={{ margin: '18px 0 8px' }}><b>Itens</b></div>
              <datalist id="cat-forn">{forn?.materiais.map((m) => <option key={m.nome} value={m.nome}>{mt(m.precoM2)}/{m.unidade || 'm²'}</option>)}</datalist>
              <div className="col" style={{ gap: 8 }}>
                {(f.itens || []).map((it, i) => (
                  <div key={i} className="row item-row">
                    <input className="inp desc" style={{ flex: 3 }} list="cat-forn" placeholder="Produto ou serviço" value={it.descricao} onChange={(e) => { const m = forn?.materiais.find((x) => x.nome === e.target.value); setI(i, { descricao: e.target.value, ...(m ? { precoUnit: m.precoM2, unidade: m.unidade || 'm²' } : {}) }) }} />
                    <input className="inp num" style={{ width: 70, textAlign: 'right' }} inputMode="decimal" value={it.qt} onChange={(e) => setI(i, { qt: parseNum(e.target.value) })} aria-label="Quantidade" />
                    <input className="inp" style={{ width: 70 }} value={it.unidade} onChange={(e) => setI(i, { unidade: e.target.value })} aria-label="Unidade" />
                    <input className="inp num" style={{ width: 120, textAlign: 'right' }} inputMode="decimal" defaultValue={it.precoUnit ? num2(it.precoUnit) : ''} key={`ip${i}-${it.precoUnit}`} onBlur={(e) => setI(i, { precoUnit: parseNum(e.target.value) })} aria-label="Preço unitário" />
                    <button className="btn icon" onClick={() => set({ itens: (f.itens || []).filter((_, k) => k !== i) })} disabled={(f.itens || []).length === 1} aria-label="Remover item"><Icon n="x" /></button>
                  </div>
                ))}
                <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ itens: [...(f.itens || []), { descricao: '', unidade: 'un', qt: 1, precoUnit: 0 }] })}><Icon n="plus" /> Item</button>
              </div>
            </>
          )}

          <div className="grid g2" style={{ marginTop: 16 }}>
            <div className="col">
              <label className="check"><input type="checkbox" checked={f.comIva} onChange={(e) => set({ comIva: e.target.checked })} /> Fornecedor cobra IVA ({taxa}%)</label>
              <Field label="Notas"><textarea value={f.notas || ''} onChange={(e) => set({ notas: e.target.value })} style={{ minHeight: 60 }} /></Field>
            </div>
            <div className="req-total" style={{ alignSelf: 'start' }}>
              <dl className="kv">
                <dt>Sub-Total</dt><dd className="num">{mt(tot.subtotal)}</dd>
                <dt>IVA {f.comIva ? `${taxa}%` : '—'}</dt><dd className="num">{mt(tot.iva)}</dd>
                <dt className="b" style={{ color: 'var(--tx)' }}>TOTAL</dt><dd className="num b" style={{ fontSize: 18, color: 'var(--y)' }}>{mt(tot.total)}</dd>
              </dl>
              {lista && <div className="tiny muted" style={{ marginTop: 10 }}>Cada print: m² = Qt × Largura × Comprimento, vezes o preço do material dele.</div>}
            </div>
          </div>
        </>
      ) : (
        <Circuito f={f} tot={tot} trabalho={trabalho} persistir={persistir} />
      )}
    </Modal>
  )
}

function Passo({ n, titulo, feito, ativo, children, quando }: { n: number; titulo: string; feito: boolean; ativo: boolean; children: ReactNode; quando?: string }) {
  return (
    <div className="passo" data-estado={feito ? 'feito' : ativo ? 'ativo' : 'espera'}>
      <div className="passo-n">{feito ? <Icon n="check" /> : n}</div>
      <div className="passo-c">
        <div className="row" style={{ marginBottom: feito && !ativo ? 0 : 10 }}>
          <b>{titulo}</b>
          <span className="spacer" />
          {quando && <span className="small muted">{quando}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}

function Circuito({ f, tot, trabalho, persistir }: { f: Requisicao; tot: ReturnType<typeof totaisRequisicao>; trabalho?: Trabalho; persistir: (p?: Partial<Requisicao>, msg?: string) => Promise<Requisicao | null> }) {
  const d = useDados()
  const { pode } = useSessao()
  const toast = useToast()
  const ver = useVer()
  const taxa = d.empresa.taxaIva
  const forn = d.fornecedor(f.fornecedorId)
  const cli = d.cliente(trabalho?.clienteId)
  const [lendo, setLendo] = useState(false)

  // Upload + automatic reading of Académica PDFs (digital, not scans).
  async function carregarLido(fs: File[], quer: 'proforma' | 'fatura') {
    const file = fs[0]
    if (!file) return
    setLendo(true)
    const id = await guardarFicheiro(file)
    const l = await lerFicheiro(file)
    setLendo(false)
    if (quer === 'proforma') setPf((x) => ({ ...x, ficheiroId: id }))
    else setFat((x) => ({ ...x, ficheiroId: id }))
    if (l.tipo !== 'academica') return toast(l.tipo === 'nada' ? l.motivo : 'Ficheiro guardado')
    const doc = l.doc
    if (doc.nomeBase && chaveNome(doc.nomeBase) !== chaveNome(f.nomeTrabalho)) toast(`Atenção: este documento é de ${doc.nomeBase}`)
    if (quer === 'proforma' && doc.tipo === 'proforma') {
      setPf((x) => ({ ...x, numero: doc.numero, data: doc.data || x.data, valor: doc.total ? num2(doc.total) : x.valor }))
      toast(`Li a pró-forma ${doc.numero}: ${doc.total ? mt(doc.total) : ''}${doc.m2 ? ` · ${num2(doc.m2)} m²` : ''}`)
    } else if (quer === 'fatura' && doc.tipo !== 'proforma') {
      if (doc.tipo === 'fatura') setFat((x) => ({ ...x, numero: doc.numero, data: doc.data || x.data }))
      else setRec((x) => ({ ...x, numero: doc.numero, data: doc.data || x.data }))
      toast(`Li ${doc.tipo === 'fatura' ? 'a fatura' : 'o recibo'} ${doc.numero}`)
    } else toast(`Este ficheiro é ${doc.tipo === 'proforma' ? 'uma pró-forma' : doc.tipo === 'fatura' ? 'uma fatura' : 'um recibo'} (${doc.numero})`)
  }
  const hoje = hojeISO()
  const [pf, setPf] = useState({ numero: f.proforma?.numero || '', data: f.proforma?.data || hoje, valor: f.proforma ? num2(f.proforma.valor) : num2(tot.total), ficheiroId: f.proforma?.ficheiroId })
  const [pag, setPag] = useState({ data: hoje, metodo: 'Transferência', ref: '', valor: '' })
  const [fat, setFat] = useState({ numero: '', data: hoje, ficheiroId: undefined as string | undefined })
  const [rec, setRec] = useState({ numero: '', data: hoje, ficheiroId: undefined as string | undefined, mesmo: true })
  const [lev, setLev] = useState({ data: hoje, custo: '' })
  const fatDoc = d.documentos.find((x) => x.id === f.faturaDocId)
  const recDoc = d.documentos.find((x) => x.id === f.reciboDocId)
  const valor = f.proforma?.valor || tot.total
  const diff = f.proforma ? r2(f.proforma.valor - tot.total) : r2(parseNum(pf.valor) - tot.total)
  const clientePagou = !!trabalho && d.resumo(trabalho).total > 0 && d.resumo(trabalho).emDivida <= 0
  const pago = pagoRequisicao(f, taxa)
  const saldo = saldoRequisicao(f, taxa)
  const estadoPag = estadoPagamento(f, taxa)
  const docBase = { direcao: 'recebido' as const, entidade: forn?.nome || '', nuit: forn?.nuit, fornecedorId: f.fornecedorId, trabalhoId: trabalho?.id, requisicaoId: f.id }

  const textoWa = `Bom dia! Segue a requisição de prints *${f.numero}* — ${f.nomeTrabalho.replace(/_/g, ' ')} (${f.linhas.filter((l) => l.qt).length} prints). Aguardo a pró-forma. Obrigado — Puzzle Stickers`

  async function guardarFatura() {
    if (!fat.numero.trim()) return toast('Nº da fatura')
    const base = f.comIva ? baseDeTotal(valor, taxa) : valor
    const doc = novo<Documento>({ ...docBase, tipo: 'fatura', numero: fat.numero.trim(), data: fat.data, base, iva: r2(valor - base), total: valor, ficheiroId: fat.ficheiroId, notas: `${f.numero} · ${f.nomeTrabalho}` })
    await db.documentos.put(doc)
    let reciboId: string | undefined
    if (rec.numero.trim()) {
      const r = novo<Documento>({ ...docBase, tipo: 'recibo', numero: rec.numero.trim(), data: rec.data, base: 0, iva: 0, total: valor, ficheiroId: rec.mesmo ? fat.ficheiroId : rec.ficheiroId, notas: `Recibo da fatura ${fat.numero.trim()}` })
      await db.documentos.put(r)
      reciboId = r.id
    }
    await persistir({ faturaDocId: doc.id, reciboDocId: reciboId }, 'Fatura registada · conta no IVA dedutível')
  }

  async function guardarRecibo() {
    if (!rec.numero.trim()) return toast('Nº do recibo')
    const r = novo<Documento>({ ...docBase, tipo: 'recibo', numero: rec.numero.trim(), data: rec.data, base: 0, iva: 0, total: valor, ficheiroId: rec.mesmo ? fatDoc?.ficheiroId : rec.ficheiroId, notas: fatDoc ? `Recibo da fatura ${fatDoc.numero}` : '' })
    await db.documentos.put(r)
    await persistir({ reciboDocId: r.id }, 'Recibo registado')
  }

  async function levantar() {
    let despesaId: string | undefined
    const custo = parseNum(lev.custo)
    if (custo > 0) {
      const desp = novo<Despesa>({ data: lev.data, descricao: `Levantamento ${f.numero} — ${forn?.nome || ''}`, categoria: 'Transporte e combustível', valor: custo, iva: 0, metodo: 'M-Pesa', entidade: 'Delivery' })
      await db.despesas.put(desp)
      despesaId = desp.id
    }
    await persistir({ levantadaEm: lev.data, estado: 'recebida', despesaLevantamentoId: despesaId }, custo > 0 ? `Levantada · ${mt(custo)} nas despesas` : 'Marcada como levantada')
  }

  const DocChip = ({ doc, onRemove }: { doc: Documento; onRemove: () => void }) => (
    <div className="row small" style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px' }}>
      <Icon n="recibo" />
      <span style={{ flex: 1, minWidth: 0 }} className="ellipsis"><b>{doc.tipo === 'fatura' ? 'Fatura' : 'Recibo'} {doc.numero}</b> · {dataMedia(doc.data)} · {mt(doc.total)}{doc.iva ? ` (IVA ${mt(doc.iva)})` : ''}</span>
      {doc.ficheiroId && <button className="btn sm ghost" onClick={() => ver(doc.ficheiroId!)}><Icon n="olho" /> Ver</button>}
      {pode('apagar') && <button className="btn sm ghost icon" onClick={onRemove} aria-label="Remover"><Icon n="x" /></button>}
    </div>
  )

  return (
    <div className="passos">
      {f.notas && /aten[cç][aã]o/i.test(f.notas) && <div className="banner" style={{ marginBottom: 16 }}><Icon n="alerta" /> <span>{f.notas}</span></div>}
      <Passo n={1} titulo="Lista enviada" feito={!!f.enviadaEm} ativo={!f.enviadaEm} quando={f.enviadaEm && dataMedia(f.enviadaEm)}>
        {!f.enviadaEm ? (
          <div className="row wrap">
            {f.tipo !== 'encomenda' && <button className="btn sm" onClick={async () => { const x = await persistir(); if (x) imprimirLista(x, d) }}><Icon n="imprimir" /> PDF da lista</button>}
            {forn?.telefone ? (
              <a className="btn sm" href={waLink(forn.telefone, textoWa)} target="_blank" rel="noreferrer"><Icon n="whatsapp" /> WhatsApp {forn.nome.split(' ')[0]}</a>
            ) : (
              <span className="tiny muted">Registe o WhatsApp do fornecedor para enviar daqui.</span>
            )}
            <button className="btn sm pri" onClick={() => persistir({ enviadaEm: hoje, estado: 'enviada' }, 'Lista marcada como enviada')}><Icon n="check" /> Marcar como enviada</button>
          </div>
        ) : (
          <button className="btn sm ghost" onClick={() => persistir({ enviadaEm: undefined, estado: 'rascunho' })}>Desfazer</button>
        )}
      </Passo>

      <Passo n={2} titulo="Pró-forma" feito={!!f.proforma} ativo={!!f.enviadaEm && !f.proforma} quando={f.proforma && `${f.proforma.numero} · ${dataMedia(f.proforma.data)}`}>
        {f.proforma ? (
          <div className="col" style={{ gap: 8 }}>
            <div className="row wrap small">
              <span>Valor da pró-forma <b className="num">{mt(f.proforma.valor)}</b></span>
              {Math.abs(diff) < 0.5 ? <span className="badge ok"><Icon n="check" style={{ width: 13, height: 13 }} /> Igual à lista</span> : <span className="badge bad">Diferença de {mt(diff)} face à lista</span>}
              <span className="spacer" />
              {f.proforma.ficheiroId && <button className="btn sm ghost" onClick={() => ver(f.proforma!.ficheiroId!)}><Icon n="olho" /> Ver original</button>}
              <button className="btn sm ghost" onClick={() => persistir({ proforma: undefined })}>Editar</button>
            </div>
            {f.proforma.ficheiroId && <div><Miniatura id={f.proforma.ficheiroId} alto={170} /></div>}
          </div>
        ) : (
          <div className="form-grid">
            <Field label="Nº da pró-forma"><input value={pf.numero} onChange={(e) => setPf({ ...pf, numero: e.target.value })} placeholder="0000/2026" /></Field>
            <Field label="Data"><input type="date" value={pf.data} onChange={(e) => setPf({ ...pf, data: e.target.value })} /></Field>
            <Field label="Valor total (com IVA)" hint={Math.abs(diff) < 0.5 ? 'Igual à lista ✓' : `Lista: ${mt(tot.total)} · diferença ${mt(diff)}`}><input inputMode="decimal" value={pf.valor} onChange={(e) => setPf({ ...pf, valor: e.target.value })} /></Field>
            <div className="field">
              <span>Ficheiro da pró-forma</span>
              {pf.ficheiroId ? <Thumb id={pf.ficheiroId} onRemove={() => setPf({ ...pf, ficheiroId: undefined })} /> : <UploadZone multiple={false} text={lendo ? 'A ler…' : 'Carregar a pró-forma (PDF)'} onFiles={(fs) => carregarLido(fs, 'proforma')} />}
              <small>O sistema lê sozinho o número, a data e o valor.</small>
            </div>
            <div className="full row">
              <span className="tiny muted" style={{ flex: 1 }}>A pró-forma não conta para o IVA — só a fatura.</span>
              <button className="btn sm pri" onClick={() => { if (!pf.numero.trim()) return toast('Nº da pró-forma'); persistir({ proforma: { numero: pf.numero.trim(), data: pf.data, valor: parseNum(pf.valor), ficheiroId: pf.ficheiroId }, enviadaEm: f.enviadaEm || pf.data, estado: f.estado === 'rascunho' ? 'enviada' : f.estado }, 'Pró-forma registada') }}><Icon n="check" /> Guardar pró-forma</button>
            </div>
          </div>
        )}
      </Passo>

      <Passo
        n={3}
        titulo="Pagamento ao fornecedor"
        feito={estadoPag === 'Pago' && (!!f.proforma || f.pagamento === 'credito')}
        ativo={(!!f.proforma || f.pagamento === 'credito') && estadoPag !== 'Pago'}
        quando={estadoPag === 'Pago' ? 'Pago' : f.pagamento === 'credito' ? `A crédito desde ${dataMedia(f.creditoDesde || f.proforma?.data || f.data)}` : estadoPag === 'Parcial' ? 'Parcial' : undefined}
      >
        {!f.proforma && f.pagamento !== 'credito' ? (
          <div className="col" style={{ gap: 8 }}>
            <div className="tiny muted">Primeiro registe a pró-forma{forn?.temCredito ? ', ou ponha a crédito' : ''}.</div>
            {forn?.temCredito && <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => persistir({ pagamento: 'credito', creditoDesde: hoje }, 'Fica a crédito')}><Icon n="relogio" /> Ficar a crédito</button>}
          </div>
        ) : (
          <div className="col" style={{ gap: 10 }}>
            <div className="req-total small">
              <div className="row"><span className="muted">Valor</span><span className="spacer" /><b className="num">{mt(valor)}</b></div>
              {(f.pagamentos || []).map((p) => (
                <div key={p.id} className="row">
                  <span className="muted">Pago {dataMedia(p.data)} · {p.metodo}{p.referencia ? ` · ${p.referencia}` : ''}</span>
                  <span className="spacer" />
                  <span className="num" style={{ color: 'var(--ok)' }}>− {mt(p.valor)}</span>
                  {pode('apagar') && <button className="btn sm ghost icon" style={{ width: 24, height: 24 }} onClick={() => persistir({ pagamentos: (f.pagamentos || []).filter((x) => x.id !== p.id) })} aria-label="Remover pagamento"><Icon n="x" /></button>}
                </div>
              ))}
              {!f.pagamentos?.length && f.pagamento === 'pago' && <div className="row"><span className="muted">Pago {f.pagoEm ? dataMedia(f.pagoEm) : ''}</span><span className="spacer" /><span className="num" style={{ color: 'var(--ok)' }}>− {mt(pago)}</span></div>}
              <div className="row b"><span>Saldo</span><span className="spacer" /><span className="num" style={{ color: saldo > 0 ? 'var(--warn)' : 'var(--ok)' }}>{mt(saldo)}</span></div>
            </div>
            {f.pagamento === 'credito' && saldo > 0 && (
              <div className={`alert ${clientePagou ? 'warn' : 'info'}`} style={{ cursor: 'default' }}>
                <Icon n={clientePagou ? 'alerta' : 'relogio'} />
                <div>
                  <b>A crédito há {diasEntre(f.creditoDesde || f.proforma?.data || f.data, hoje)} dias</b>
                  <span>{!trabalho ? 'Sem trabalho associado.' : clientePagou ? `${cli?.nome} já pagou o trabalho — pode liquidar este crédito.` : `Liquida quando ${cli?.nome || 'o cliente'} pagar o trabalho ${trabalho.codigo}.`}</span>
                </div>
              </div>
            )}
            {saldo > 0 && (
              <>
                <div className="form-grid">
                  <Field label="Valor a pagar" hint="Pode pagar só uma parte"><input inputMode="decimal" value={pag.valor} placeholder={num2(saldo)} onChange={(e) => setPag({ ...pag, valor: e.target.value })} /></Field>
                  <Field label="Data"><input type="date" value={pag.data} onChange={(e) => setPag({ ...pag, data: e.target.value })} /></Field>
                  <Field label="Método">
                    <select value={pag.metodo} onChange={(e) => setPag({ ...pag, metodo: e.target.value })}>{metodos.map((m) => <option key={m}>{m}</option>)}</select>
                  </Field>
                  <Field label="Referência (opcional)"><input value={pag.ref} onChange={(e) => setPag({ ...pag, ref: e.target.value })} placeholder="Ex.: Transferência BIM" /></Field>
                </div>
                <div className="row wrap">
                  {f.pagamento !== 'credito' && (forn?.temCredito ?? true) && (
                    <button className="btn sm" onClick={() => persistir({ pagamento: 'credito', creditoDesde: f.proforma?.data || hoje }, 'Fica a crédito · aparece no mapa de crédito')}><Icon n="relogio" /> Ficar a crédito</button>
                  )}
                  <span className="spacer" />
                  <button
                    className="btn sm pri"
                    onClick={() => {
                      const v = pag.valor.trim() ? parseNum(pag.valor) : saldo
                      if (!(v > 0)) return toast('Valor inválido')
                      const base = f.pagamentos?.length ? f.pagamentos : f.pagamento === 'pago' ? [{ id: uid(), data: f.pagoEm || hoje, valor: pago, metodo: f.metodoPagamento || '—' }] : []
                      persistir({ pagamentos: [...base, { id: uid(), data: pag.data, valor: r2(Math.min(v, saldo)), metodo: pag.metodo, referencia: pag.ref || undefined }], pagoEm: pag.data }, v >= saldo - 0.005 ? 'Pago na totalidade' : `Pagamento parcial de ${mt(v)}`)
                      setPag({ ...pag, valor: '', ref: '' })
                    }}
                  >
                    <Icon n="dinheiro" /> Registar pagamento · {mt(pag.valor.trim() ? parseNum(pag.valor) : saldo)}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Passo>

      <Passo n={4} titulo="Fatura e recibo do fornecedor" feito={!!fatDoc && !!recDoc} ativo={!!f.proforma && !(fatDoc && recDoc)}>
        <div className="col" style={{ gap: 10 }}>
          {fatDoc ? (
            <DocChip doc={fatDoc} onRemove={async () => { await apagar(db.documentos, fatDoc.id); await persistir({ faturaDocId: undefined }) }} />
          ) : (
            <div className="form-grid">
              <Field label="Nº da fatura"><input value={fat.numero} onChange={(e) => setFat({ ...fat, numero: e.target.value })} placeholder="0000/2026" /></Field>
              <Field label="Data"><input type="date" value={fat.data} onChange={(e) => setFat({ ...fat, data: e.target.value })} /></Field>
              <div className="field full">
                <span>Ficheiro (fatura, ou fatura + recibo no mesmo PDF)</span>
                {fat.ficheiroId ? <Thumb id={fat.ficheiroId} onRemove={() => setFat({ ...fat, ficheiroId: undefined })} /> : <UploadZone multiple={false} text={lendo ? 'A ler…' : 'Carregar a fatura (PDF ou foto)'} onFiles={(fs) => carregarLido(fs, 'fatura')} />}
              </div>
              <Field label="Nº do recibo (se já tiver)"><input value={rec.numero} onChange={(e) => setRec({ ...rec, numero: e.target.value })} placeholder="0000/2026" /></Field>
              <Field label="Data do recibo"><input type="date" value={rec.data} onChange={(e) => setRec({ ...rec, data: e.target.value })} /></Field>
              <div className="full row">
                <span className="tiny muted" style={{ flex: 1 }}>Valor {mt(valor)} · IVA {mt(r2(valor - (f.comIva ? baseDeTotal(valor, taxa) : valor)))} entra no IVA dedutível de {dataMedia(fat.data).split(' ').slice(1).join(' ')}.</span>
                <button className="btn sm pri" onClick={guardarFatura}><Icon n="check" /> Guardar fatura</button>
              </div>
            </div>
          )}
          {fatDoc && (recDoc ? (
            <DocChip doc={recDoc} onRemove={async () => { await apagar(db.documentos, recDoc.id); await persistir({ reciboDocId: undefined }) }} />
          ) : (
            <div className="form-grid">
              <Field label="Nº do recibo"><input value={rec.numero} onChange={(e) => setRec({ ...rec, numero: e.target.value })} placeholder="0000/2026" /></Field>
              <Field label="Data"><input type="date" value={rec.data} onChange={(e) => setRec({ ...rec, data: e.target.value })} /></Field>
              <label className="check full"><input type="checkbox" checked={rec.mesmo} onChange={(e) => setRec({ ...rec, mesmo: e.target.checked })} /> Vem no mesmo ficheiro da fatura</label>
              {!rec.mesmo && <div className="full">{rec.ficheiroId ? <Thumb id={rec.ficheiroId} onRemove={() => setRec({ ...rec, ficheiroId: undefined })} /> : <UploadZone multiple={false} text="Ficheiro do recibo" onFiles={async (fs) => fs[0] && setRec({ ...rec, ficheiroId: await guardarFicheiro(fs[0]) })} />}</div>}
              <div className="full row"><span className="spacer" /><button className="btn sm pri" onClick={guardarRecibo}><Icon n="check" /> Guardar recibo</button></div>
            </div>
          ))}
        </div>
      </Passo>

      <Passo n={5} titulo={f.tipo === 'encomenda' ? 'Recebida / levantada' : 'Impressão levantada'} feito={!!f.levantadaEm || f.estado === 'recebida'} ativo={!!f.proforma && !f.levantadaEm} quando={f.levantadaEm && dataMedia(f.levantadaEm)}>
        {f.levantadaEm || f.estado === 'recebida' ? (
          <div className="row small">
            <span>{f.despesaLevantamentoId ? `Delivery: ${mt(d.despesas.find((x) => x.id === f.despesaLevantamentoId)?.valor || 0)} (em Despesas)` : 'Sem custo de delivery registado'}</span>
            <span className="spacer" />
            <button className="btn sm ghost" onClick={async () => { if (f.despesaLevantamentoId) await apagar(db.despesas, f.despesaLevantamentoId); persistir({ levantadaEm: undefined, estado: f.enviadaEm ? 'enviada' : 'rascunho', despesaLevantamentoId: undefined }) }}>Desfazer</button>
          </div>
        ) : (
          <div className="form-grid">
            <Field label="Data"><input type="date" value={lev.data} onChange={(e) => setLev({ ...lev, data: e.target.value })} /></Field>
            <Field label="Custo do delivery (opcional)" hint="Vai para Despesas → Transporte"><input inputMode="decimal" value={lev.custo} onChange={(e) => setLev({ ...lev, custo: e.target.value })} placeholder="0,00" /></Field>
            <div className="full row"><span className="spacer" /><button className="btn sm pri" onClick={levantar}><Icon n="check" /> Marcar como levantada</button></div>
          </div>
        )}
      </Passo>
    </div>
  )
}
