import type {
  Cotacao,
  ItemCotacao,
  Custo,
  Despesa,
  DespesaFixa,
  Documento,
  Etapa,
  LinhaImpressao,
  Pagamento,
  Requisicao,
  Tarefa,
  TipoTrabalho,
  Trabalho
} from './db'

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const ETAPAS: { id: Etapa; nome: string; curto: string; cor: string }[] = [
  { id: 'pedido', nome: 'Pedido', curto: 'Pedido', cor: '#8a8f98' },
  { id: 'negociacao', nome: 'Em negociação', curto: 'Negociação', cor: '#e84393' },
  { id: 'layout', nome: 'Layout', curto: 'Layout', cor: '#7c5cff' },
  { id: 'producao', nome: 'Produção', curto: 'Produção', cor: '#1e9bff' },
  { id: 'montagem', nome: 'Montagem', curto: 'Montagem', cor: '#00b3a4' },
  { id: 'entrega', nome: 'Entrega', curto: 'Entrega', cor: '#ffc406' },
  { id: 'entregue', nome: 'Entregue', curto: 'Entregue', cor: '#2bb673' }
]

// The 4 kinds of work the company does (14 Oct). Every job walks the same phases
// (16 Oct); each kind simply leaves out the ones it does not need.
export const TIPOS: { id: Exclude<TipoTrabalho, 'producao'>; nome: string; curto: string; desc: string; icone: string; seq: Etapa[] }[] = [
  { id: 'branding', nome: 'Branding / wrap', curto: 'BRANDING', icone: 'imprimir', desc: 'Viaturas e camiões: layout, produção na Académica e montagem.', seq: ['pedido', 'negociacao', 'layout', 'producao', 'montagem', 'entrega', 'entregue'] },
  { id: 'criacao', nome: 'Criação de imagem', curto: 'CRIAÇÃO', icone: 'editar', desc: 'Logotipos, identidade visual, editorial, eventos (catálogo).', seq: ['pedido', 'negociacao', 'layout', 'entrega', 'entregue'] },
  { id: 'fornecimento', nome: 'Fornecimento', curto: 'FORNECIMENTO', icone: 'caixa', desc: 'Ex.: camisetes estampadas. Crias o layout, encomendas ao fornecedor e revendes.', seq: ['pedido', 'negociacao', 'layout', 'producao', 'entrega', 'entregue'] },
  { id: 'montagem', nome: 'Montagem', curto: 'MONTAGEM', icone: 'raio', desc: 'Só mão de obra: o cliente traz o material (ex.: PPF) e tu aplicas.', seq: ['pedido', 'negociacao', 'montagem', 'entrega', 'entregue'] }
]
export const tipoInfo = (t: TipoTrabalho) => TIPOS.find((x) => x.id === (t === 'producao' ? 'branding' : t))!

const ROTULOS: Partial<Record<TipoTrabalho, Partial<Record<Etapa, string>>>> = {
  criacao: { layout: 'Design' },
  fornecimento: { producao: 'Encomenda' }
}

// Jobs saved before 16 Oct carry the old stage names; read them as the new phases.
const ANTIGAS: Record<string, Etapa> = {
  entrada: 'pedido', cotacao: 'negociacao', aprovacao: 'negociacao', design: 'layout', marcacao: 'montagem',
  encomenda: 'producao', recebido: 'producao', acabamento: 'montagem', pronto: 'entrega'
}
export const normalizarEtapa = (e: string): Etapa => (ANTIGAS[e] || e) as Etapa

const DEPOIS_DA_NEGOCIACAO: Etapa[] = ['layout', 'producao', 'montagem', 'entrega', 'entregue']
// Confirmed = the client said yes (button), paid something, or the job is already past negotiation.
export const confirmado = (t: Pick<Trabalho, 'etapa' | 'confirmadoEm'>, pago = 0) => !!t.confirmadoEm || pago > 0 || DEPOIS_DA_NEGOCIACAO.includes(t.etapa)
// "Total a receber" only counts confirmed or delivered work, never quotes still being negotiated.
export const contaParaReceber = (t: Pick<Trabalho, 'etapa' | 'confirmadoEm' | 'cancelado'>, r: Pick<ResumoTrabalho, 'total' | 'emDivida' | 'pago'>) =>
  !t.cancelado && r.total > 0 && r.emDivida > 0.005 && confirmado(t, r.pago)

// The date the job has to meet now: the current phase's deadline (Montagem: its last day; Entrega: the delivery date).
export function prazoAtual(t: Pick<Trabalho, 'etapa' | 'prazo' | 'prazos' | 'montagemAte' | 'montagemDe'>) {
  if (t.etapa === 'entregue') return undefined
  if (t.etapa === 'entrega') return t.prazo || undefined
  if (t.etapa === 'montagem') return t.montagemAte || t.montagemDe || t.prazos?.montagem || undefined
  return t.prazos?.[t.etapa] || undefined
}

export function etapasDoTipo(tipo: TipoTrabalho): Etapa[] {
  return tipoInfo(tipo).seq
}

export const etapaInfo = (e: Etapa, tipo?: TipoTrabalho) => {
  const base = ETAPAS.find((x) => x.id === e) || ETAPAS[0]
  const r = tipo && ROTULOS[tipo]?.[e]
  return r ? { ...base, nome: r, curto: r } : base
}

export function proximaEtapa(t: Pick<Trabalho, 'tipo' | 'etapa'>): Etapa | null {
  const seq = etapasDoTipo(t.tipo)
  const i = seq.indexOf(t.etapa)
  return i >= 0 && i < seq.length - 1 ? seq[i + 1] : null
}

export function etapaAnterior(t: Pick<Trabalho, 'tipo' | 'etapa'>): Etapa | null {
  const seq = etapasDoTipo(t.tipo)
  const i = seq.indexOf(t.etapa)
  return i > 0 ? seq[i - 1] : null
}

// ---------- Lista de impressão (same maths as the company's Excel sheet) ----------

export const m2Linha = (l: LinhaImpressao) => (l.qt || 0) * (l.largura || 0) * (l.comprimento || 0)

export function totaisRequisicao(r: Pick<Requisicao, 'linhas' | 'precoImpressaoM2' | 'precoLaminacaoM2' | 'comIva'> & Partial<Pick<Requisicao, 'tipo' | 'itens'>>, taxaIva: number) {
  if (r.tipo === 'encomenda') {
    const subtotal = r2((r.itens || []).reduce((s, i) => s + (i.qt || 0) * (i.precoUnit || 0), 0))
    const iva = r.comIva ? r2(subtotal * (taxaIva / 100)) : 0
    return { m2: 0, precoM2: 0, subtotal, iva, total: r2(subtotal + iva) }
  }
  // The sheet multiplies the unrounded m² by the price, then rounds money.
  const m2 = r.linhas.reduce((s, l) => s + m2Linha(l), 0)
  const base = (r.precoImpressaoM2 || 0) + (r.precoLaminacaoM2 || 0)
  // Each print can have its own material (16 Oct); a print without one uses the list's material.
  const precoDe = (l: LinhaImpressao) => (l.impressao !== undefined || l.laminacao !== undefined ? (l.precoImpressao || 0) + (l.precoLaminacao || 0) : base)
  const precos = new Set(r.linhas.filter((l) => m2Linha(l) > 0).map(precoDe))
  const precoM2 = precos.size <= 1 ? ([...precos][0] ?? base) : 0
  const subtotal = r2(precos.size <= 1 ? m2 * precoM2 : r.linhas.reduce((s, l) => s + m2Linha(l) * precoDe(l), 0))
  const iva = r.comIva ? r2(subtotal * (taxaIva / 100)) : 0
  return { m2, precoM2, subtotal, iva, total: r2(subtotal + iva) }
}

// ---------- Cotação ----------

// Taxa de urgência (18 Oct): the % of ONE unit of the urgent item (qt 1 — on 5 cars it is
// not charged 5 times), written as its own line right after it, like the Deslocação. The line
// belongs to the item's option.
export function comUrgencia(itens: ItemCotacao[], pct: number): ItemCotacao[] {
  if (!pct || itens.some((i) => i.gerada)) return itens
  return itens.flatMap((it) =>
    it.urgente && !it.secao
      ? [it, { qt: 1, titulo: `Taxa de urgência (${pct}%)`, subtitulo: it.subtitulo || it.titulo, precoUnit: r2((it.precoUnit || 0) * (pct / 100)), opcao: it.opcao, extra: true, gerada: true }]
      : [it]
  )
}

// Every quote includes IVA (17 Oct); the discount comes off before IVA. With options
// (Taksim / Mactac / Avery…) the client picks one, so each option has its own total: its
// items plus the items that belong to no option.
export function totaisCotacao(c: Pick<Cotacao, 'itens'> & { desconto?: number }, taxaIva: number, urgenciaPct = 0) {
  const itens = comUrgencia(c.itens, urgenciaPct).filter((i) => !i.secao)
  const conta = (xs: typeof itens) => {
    const bruto = r2(xs.reduce((s, i) => s + (i.qt || 0) * (i.precoUnit || 0), 0))
    const desconto = r2(bruto * ((c.desconto || 0) / 100))
    const sub = r2(bruto - desconto)
    const iva = r2(sub * (taxaIva / 100))
    return { bruto, desconto, sub, iva, total: r2(sub + iva) }
  }
  const numeros = [...new Set(itens.map((i) => i.opcao).filter((o): o is number => !!o))].sort((a, b) => a - b)
  const opcoes = numeros.map((opcao) => ({ opcao, ...conta(itens.filter((i) => !i.opcao || i.opcao === opcao)) }))
  // The quote's headline value: the whole quote, or the cheapest option.
  const geral = opcoes.length ? opcoes.reduce((a, b) => (b.total < a.total ? b : a)) : conta(itens)
  return { ...geral, opcoes }
}

// ---------- Trabalho ----------

export function totaisTrabalho(t: Pick<Trabalho, 'itens' | 'comIva' | 'urgente'>, taxaIva: number, urgenciaPct: number) {
  const base = r2(t.itens.reduce((s, i) => s + (i.qt || 0) * (i.precoUnit || 0), 0))
  const urgencia = t.urgente ? r2(base * (urgenciaPct / 100)) : 0
  const subtotal = r2(base + urgencia)
  const iva = t.comIva ? r2(subtotal * (taxaIva / 100)) : 0
  return { base, urgencia, subtotal, iva, total: r2(subtotal + iva) }
}

export interface ResumoTrabalho {
  subtotal: number
  iva: number
  total: number
  pago: number
  emDivida: number
  sinalEsperado: number
  sinalPago: boolean
  custoRequisicoes: number
  custoOutros: number
  custoTotal: number
  lucro: number
  margem: number
  m2: number
  dias: number | null
  atrasado: boolean
}

const DIA = 86_400_000

export const diaISO = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}

export const hojeISO = () => diaISO(new Date())

export function diasEntre(a: string, b: string) {
  const da = new Date(a.slice(0, 10) + 'T00:00:00')
  const dbb = new Date(b.slice(0, 10) + 'T00:00:00')
  return Math.round((dbb.getTime() - da.getTime()) / DIA)
}

export function addDias(iso: string, n: number) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return diaISO(d)
}

// Working days (Mon–Fri), since the catálogo quotes "dias úteis".
export function addDiasUteis(iso: string, n: number) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  let left = n
  while (left > 0) {
    d.setDate(d.getDate() + 1)
    const w = d.getDay()
    if (w !== 0 && w !== 6) left--
  }
  return diaISO(d)
}

export function resumoTrabalho(
  t: Trabalho,
  pagamentos: Pagamento[],
  requisicoes: Requisicao[],
  custos: Custo[],
  cfg: { taxaIva: number; urgenciaPct: number; sinalPct: number },
  hoje = hojeISO()
): ResumoTrabalho {
  const { subtotal, iva, total } = totaisTrabalho(t, cfg.taxaIva, cfg.urgenciaPct)
  const pago = r2(pagamentos.filter((p) => p.trabalhoId === t.id && !p.deleted).reduce((s, p) => s + p.valor, 0))
  const reqs = requisicoes.filter((r) => r.trabalhoId === t.id && !r.deleted)
  // Cost is measured without IVA: the IVA on supplier invoices is recovered in the monthly declaration.
  const custoRequisicoes = r2(reqs.reduce((s, r) => s + totaisRequisicao(r, cfg.taxaIva).subtotal, 0))
  const m2 = reqs.reduce((s, r) => s + totaisRequisicao(r, cfg.taxaIva).m2, 0)
  const custoOutros = r2(custos.filter((c) => c.trabalhoId === t.id && !c.deleted).reduce((s, c) => s + c.valor, 0))
  const custoTotal = r2(custoRequisicoes + custoOutros)
  const lucro = r2(subtotal - custoTotal)
  const sinalEsperado = r2(total * (cfg.sinalPct / 100))
  const entregue = t.etapas.find((e) => e.etapa === 'entregue')
  const fim = entregue ? entregue.em : hoje
  const limite = prazoAtual(t)
  return {
    subtotal,
    iva,
    total,
    pago,
    emDivida: t.cancelado ? 0 : r2(Math.max(0, total - pago)),
    sinalEsperado,
    sinalPago: pago + 0.005 >= sinalEsperado,
    custoRequisicoes,
    custoOutros,
    custoTotal,
    lucro,
    margem: subtotal > 0 ? lucro / subtotal : 0,
    m2,
    dias: diasEntre(t.dataEntrada, fim),
    atrasado: !t.cancelado && t.etapa !== 'entregue' && ((!!t.prazo && t.prazo < hoje) || (!!limite && limite < hoje))
  }
}

// ---------- IVA mensal (regime normal) ----------

// Documents that carry IVA: invoices, invoice-receipts, "venda a dinheiro" and credit notes (receipts do not).
export const contaParaIva = (tipo: Documento['tipo']) => tipo === 'fatura' || tipo === 'fatura-recibo' || tipo === 'venda-dinheiro' || tipo === 'nota-credito'
const contaIva = (d: Documento) => contaParaIva(d.tipo)
const sinal = (d: Documento) => (d.tipo === 'nota-credito' ? -1 : 1)

export function ivaDoMes(docs: Documento[], mes: string /* YYYY-MM */) {
  const doMes = docs.filter((d) => !d.deleted && d.data.slice(0, 7) === mes)
  const emitidos = doMes.filter((d) => d.direcao === 'emitido' && contaIva(d))
  const recebidos = doMes.filter((d) => d.direcao === 'recebido' && contaIva(d))
  const soma = (xs: Documento[], k: 'base' | 'iva' | 'total') => r2(xs.reduce((s, d) => s + sinal(d) * (d[k] || 0), 0))
  const liquidado = soma(emitidos, 'iva')
  const dedutivel = soma(recebidos, 'iva')
  const saldo = r2(liquidado - dedutivel)
  return {
    emitidos,
    recebidos,
    baseVendas: soma(emitidos, 'base'),
    baseCompras: soma(recebidos, 'base'),
    liquidado,
    dedutivel,
    apagar: saldo > 0 ? saldo : 0,
    credito: saldo < 0 ? -saldo : 0,
    ignorados: doMes.filter((d) => !contaIva(d))
  }
}

export function ivaDeBase(base: number, taxa: number) {
  return r2(base * (taxa / 100))
}

export function baseDeTotal(total: number, taxa: number) {
  return r2(total / (1 + taxa / 100))
}

// ---------- Despesas da empresa ----------

export const CATEGORIAS_DESPESA = [
  'Salários',
  'Renda',
  'Energia (EDM)',
  'Água',
  'Internet e telefone',
  'Subscrições e software',
  'Transporte e combustível',
  'Material de escritório',
  'Manutenção e equipamento',
  'Marketing e publicidade',
  'Impostos e taxas',
  'Outros'
]

export function addMeses(mes: string, n: number) {
  const [y, m] = mes.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

const diaDoMes = (mes: string, dia: number) => {
  const [y, m] = mes.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return `${mes}-${String(Math.min(Math.max(1, dia || 1), ultimo)).padStart(2, '0')}`
}

// When the fixed expenses of `mes` are paid. They are paid from the 25th of the month to
// the 5th of the next one: a window that opens after its closing day ends next month.
export function janelaFixa(f: Pick<DespesaFixa, 'dia' | 'abre'>, mes: string) {
  const fecha = f.abre && f.abre > f.dia ? addMeses(mes, 1) : mes
  return { abre: f.abre ? diaDoMes(mes, f.abre) : undefined, vencimento: diaDoMes(fecha, f.dia) }
}

export const vencimentoFixa = (f: Pick<DespesaFixa, 'dia' | 'abre'>, mes: string) => janelaFixa(f, mes).vencimento

export type EstadoFixa = { fixa: DespesaFixa; abre?: string; vencimento: string; paga?: Despesa; estado: 'paga' | 'pendente' | 'a-pagar' | 'atrasada' }

export function fixasDoMes(fixas: DespesaFixa[], despesas: Despesa[], mes: string, hoje = hojeISO()): EstadoFixa[] {
  return fixas
    .filter((f) => !f.deleted && (f.inicio || '0000-00') <= mes && (f.ativo || despesas.some((d) => d.fixaId === f.id && d.mes === mes && !d.deleted)))
    .map((fixa) => {
      const { abre, vencimento } = janelaFixa(fixa, mes)
      const paga = despesas.find((d) => !d.deleted && d.fixaId === fixa.id && d.mes === mes)
      const estado = paga ? 'paga' : vencimento < hoje ? 'atrasada' : abre && hoje >= abre ? 'a-pagar' : 'pendente'
      return { fixa, abre, vencimento, paga, estado } as EstadoFixa
    })
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
}

export const despesaSemIva = (d: Pick<Despesa, 'valor' | 'iva'>) => r2((d.valor || 0) - (d.iva || 0))

// Month result (sem IVA): what was invoiced − what the jobs cost − company expenses.
export function resultadoDoMes(
  mes: string,
  docs: Documento[],
  requisicoes: Requisicao[],
  custos: Custo[],
  despesas: Despesa[],
  taxaIva: number
) {
  const vendas = r2(
    docs
      .filter((d) => !d.deleted && d.direcao === 'emitido' && d.data.slice(0, 7) === mes && contaParaIva(d.tipo))
      .reduce((s, d) => s + (d.tipo === 'nota-credito' ? -1 : 1) * d.base, 0)
  )
  const custosTrabalhos = r2(
    requisicoes.filter((r) => !r.deleted && r.data.slice(0, 7) === mes && faseRequisicao(r, taxaIva) !== 'rascunho').reduce((s, r) => s + totaisRequisicao(r, taxaIva).subtotal, 0) +
      custos.filter((c) => !c.deleted && c.data.slice(0, 7) === mes).reduce((s, c) => s + c.valor, 0)
  )
  // Personal spending is not a cost of the business.
  const doMes = despesas.filter((d) => !d.deleted && !d.pessoal && (d.mes || d.data.slice(0, 7)) === mes)
  const totalDespesas = r2(doMes.reduce((s, d) => s + despesaSemIva(d), 0))
  const porCategoria = new Map<string, number>()
  for (const d of doMes) porCategoria.set(d.categoria, r2((porCategoria.get(d.categoria) || 0) + despesaSemIva(d)))
  return { vendas, custosTrabalhos, despesas: totalDespesas, resultado: r2(vendas - custosTrabalhos - totalDespesas), porCategoria }
}

// ---------- Ciclo do fornecedor ----------

export type FaseReq = 'rascunho' | 'enviada' | 'proforma' | 'credito' | 'paga' | 'faturada' | 'levantada'

export const FASES_REQ: Record<FaseReq, { nome: string; cor: string }> = {
  rascunho: { nome: 'Rascunho', cor: '#8a8f98' },
  enviada: { nome: 'Lista enviada', cor: '#1e9bff' },
  proforma: { nome: 'Pró-forma por pagar', cor: '#ff8a00' },
  credito: { nome: 'A crédito', cor: '#e84393' },
  paga: { nome: 'Paga', cor: '#7c5cff' },
  faturada: { nome: 'Faturada', cor: '#00b3a4' },
  levantada: { nome: 'Levantada', cor: '#2bb673' }
}

export const valorRequisicao = (r: Requisicao, taxaIva = 16) => r.proforma?.valor || totaisRequisicao(r, taxaIva).total

// v1 records marked 'pago' without a payment list count as fully paid.
export function pagoRequisicao(r: Requisicao, taxaIva = 16) {
  if (r.pagamentos?.length) return r2(r.pagamentos.reduce((s, p) => s + p.valor, 0))
  return r.pagamento === 'pago' ? valorRequisicao(r, taxaIva) : 0
}
export const saldoRequisicao = (r: Requisicao, taxaIva = 16) => r2(Math.max(0, valorRequisicao(r, taxaIva) - pagoRequisicao(r, taxaIva)))
export function estadoPagamento(r: Requisicao, taxaIva = 16): 'Pendente' | 'Parcial' | 'Pago' {
  const pago = pagoRequisicao(r, taxaIva)
  if (pago <= 0) return 'Pendente'
  return saldoRequisicao(r, taxaIva) > 0.005 ? 'Parcial' : 'Pago'
}

// Where the requisição stands. Old v1 records ("recebida") count as collected.
export function faseRequisicao(r: Requisicao, taxaIva = 16): FaseReq {
  const saldo = saldoRequisicao(r, taxaIva)
  const temValor = !!r.proforma || r.pagamento === 'credito' || !!r.pagamentos?.length
  const pago = temValor && saldo <= 0.005
  if (r.levantadaEm || r.estado === 'recebida') return temValor && !pago ? 'credito' : 'levantada'
  if (r.faturaDocId && pago) return 'faturada'
  if (pago) return 'paga'
  if (r.pagamento === 'credito') return 'credito'
  if (r.proforma) return 'proforma'
  if (r.enviadaEm || r.estado === 'enviada') return 'enviada'
  return 'rascunho'
}


// Money owed to suppliers: pró-formas not fully paid, and anything taken on credit.
export function contasAPagar(reqs: Requisicao[], taxaIva: number) {
  return reqs
    .filter((r) => !r.deleted && (r.proforma || r.pagamento === 'credito') && saldoRequisicao(r, taxaIva) > 0.005)
    .map((r) => ({ r, valor: saldoRequisicao(r, taxaIva), total: valorRequisicao(r, taxaIva), pago: pagoRequisicao(r, taxaIva), desde: r.creditoDesde || r.proforma?.data || r.data, credito: r.pagamento === 'credito' }))
    .sort((a, b) => a.desde.localeCompare(b.desde) || (a.r.proforma?.numero || a.r.numero).localeCompare(b.r.proforma?.numero || b.r.numero))
}

// The company's "Mapa de controlo de crédito": every supplier job with value, paid and balance.
export function mapaCredito(reqs: Requisicao[], taxaIva: number) {
  const linhas = reqs
    .filter((r) => !r.deleted && (r.proforma || r.pagamento === 'credito' || r.pagamentos?.length || r.pagamento === 'pago'))
    .map((r) => ({ r, valor: valorRequisicao(r, taxaIva), pago: pagoRequisicao(r, taxaIva), saldo: saldoRequisicao(r, taxaIva), estado: estadoPagamento(r, taxaIva), fase: faseRequisicao(r, taxaIva) }))
    .sort((a, b) => a.r.data.localeCompare(b.r.data) || (a.r.proforma?.numero || '').localeCompare(b.r.proforma?.numero || ''))
  const tot = linhas.reduce((t, l) => ({ valor: t.valor + l.valor, pago: t.pago + l.pago, saldo: t.saldo + l.saldo }), { valor: 0, pago: 0, saldo: 0 })
  return { linhas, total: r2(tot.valor), pago: r2(tot.pago), aberto: r2(tot.saldo) }
}

// ---------- Agenda: dates and tasks in one list ----------

export type ItemAgenda = {
  id: string
  tipo: 'tarefa' | 'fase' | 'montagem' | 'entrega' | 'pedido'
  texto: string
  data?: string // day it shows on
  ate?: string // Montagem: last day of the interval
  trabalhoId?: string
  tarefa?: Tarefa
  etapa?: Etapa
}

// What the agenda shows: every open task, and the dates of the phases still ahead
// (the current one included) of each job; a Pedido without a date stays visible too.
export function itensAgenda(trabalhos: Trabalho[], tarefas: Tarefa[]): ItemAgenda[] {
  const out: ItemAgenda[] = []
  for (const t of trabalhos) {
    if (t.cancelado || t.etapa === 'entregue') continue
    const seq = etapasDoTipo(t.tipo)
    for (const e of seq.slice(Math.max(0, seq.indexOf(t.etapa)))) {
      if (e === 'entregue') continue
      if (e === 'montagem' && (t.montagemDe || t.montagemAte)) out.push({ id: `${t.id}:montagem`, tipo: 'montagem', texto: 'Montagem', data: t.montagemDe || t.montagemAte, ate: t.montagemAte, trabalhoId: t.id, etapa: e })
      else if (e === 'entrega' && t.prazo) out.push({ id: `${t.id}:entrega`, tipo: 'entrega', texto: 'Entrega prevista', data: t.prazo, trabalhoId: t.id, etapa: e })
      else if (t.prazos?.[e]) out.push({ id: `${t.id}:${e}`, tipo: 'fase', texto: e === 'pedido' ? 'Responder ao pedido' : `${etapaInfo(e, t.tipo).nome} — data limite`, data: t.prazos[e], trabalhoId: t.id, etapa: e })
    }
    if (t.etapa === 'pedido' && !t.prazos?.pedido) out.push({ id: `${t.id}:pedido`, tipo: 'pedido', texto: 'Pedido por tratar', trabalhoId: t.id, etapa: 'pedido' })
  }
  for (const k of tarefas) if (!k.feitaEm && !k.deleted) out.push({ id: k.id, tipo: 'tarefa', texto: k.texto, data: k.data, trabalhoId: k.trabalhoId, tarefa: k })
  return out
}

export type SecaoAgenda = 'atrasado' | 'hoje' | 'semana' | 'depois' | 'semData'
// Montagem stays in "Hoje" while the interval is running.
export function secaoAgenda(i: ItemAgenda, hoje: string): SecaoAgenda {
  if (!i.data) return 'semData'
  const fim = i.ate || i.data
  if (fim < hoje) return 'atrasado'
  if (i.data <= hoje) return 'hoje'
  if (i.data <= addDias(hoje, 7)) return 'semana'
  return 'depois'
}

// Money received that still has no fatura-recibo / recibo: the document still has to be issued.
export const semDocumento = (pagamentos: Pagamento[], trabalhoId?: string) =>
  pagamentos.filter((p) => !p.deleted && !p.reciboId && (!trabalhoId || p.trabalhoId === trabalhoId)).sort((a, b) => a.data.localeCompare(b.data))

// Numbering (16 Oct) for quotes and supplier orders: COT-002-OUT/26, REQ-001-OUT/26.
// The count restarts every month. These are not invoices: invoices keep the number of the company's book.
const MESES_NUM = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
export function numeroDoMes(prefixo: 'COT' | 'REQ', existentes: string[], data: string) {
  const sufixo = `${MESES_NUM[Number(data.slice(5, 7)) - 1]}/${data.slice(2, 4)}`
  const fim = `-${sufixo}`
  const max = existentes.reduce((m, c) => (c.startsWith(`${prefixo}-`) && c.endsWith(fim) ? Math.max(m, Number(c.slice(prefixo.length + 1, c.length - fim.length)) || 0) : m), 0)
  return `${prefixo}-${String(max + 1).padStart(3, '0')}${fim}`
}

// ---------- Caixa: money in and out (16 Oct) ----------
// In: what clients paid. Out: purchases, paid fixed expenses and payments to suppliers,
// each kept apart. Cash view: a supplier counts when it is paid, not when the order goes.

export type Movimento = { data: string; em?: string; tipo: 'entrada' | 'saida'; origem: 'cliente' | 'compra' | 'fixa' | 'fornecedor' | 'pessoal' | 'reposicao'; valor: number; texto: string; ref?: string }

export function movimentosCaixa(pagamentos: Pagamento[], despesas: Despesa[], requisicoes: Requisicao[], taxaIva = 16): Movimento[] {
  const out: Movimento[] = []
  for (const p of pagamentos) if (!p.deleted) out.push({ data: p.data, em: p.createdAt, tipo: 'entrada', origem: 'cliente', valor: p.valor, texto: p.referencia || 'Pagamento de cliente', ref: p.trabalhoId })
  for (const x of despesas) {
    if (x.deleted) continue
    out.push({ data: x.data, em: x.createdAt, tipo: 'saida', origem: x.pessoal ? 'pessoal' : x.fixaId ? 'fixa' : 'compra', valor: x.valor, texto: x.descricao, ref: x.id })
    // A personal expense paid back: the money comes back into the caixa that day.
    if (x.pessoal && x.pessoalEstado === 'reposto' && x.pessoalEm) out.push({ data: x.pessoalEm, em: x.updatedAt, tipo: 'entrada', origem: 'reposicao', valor: x.valor, texto: `Reposição: ${x.descricao}`, ref: x.id })
  }
  for (const r of requisicoes) {
    if (r.deleted) continue
    for (const p of r.pagamentos || []) out.push({ data: p.data, tipo: 'saida', origem: 'fornecedor', valor: p.valor, texto: `${r.numero} · ${r.nomeTrabalho}`, ref: r.id })
    if (!r.pagamentos?.length && r.pagamento === 'pago' && r.pagoEm) out.push({ data: r.pagoEm, tipo: 'saida', origem: 'fornecedor', valor: valorRequisicao(r, taxaIva), texto: `${r.numero} · ${r.nomeTrabalho}`, ref: r.id })
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || (a.em || '').localeCompare(b.em || ''))
}

// The balance the user typed, plus everything that moved after it.
export function saldoCaixa(movs: Movimento[], caixa?: { valor: number; data: string; em: string }) {
  if (!caixa) return undefined
  const depois = movs.filter((m) => m.data > caixa.data || (m.data === caixa.data && !!m.em && m.em > caixa.em))
  return r2(depois.reduce((s, m) => s + (m.tipo === 'entrada' ? m.valor : -m.valor), caixa.valor))
}

export function resumoCaixaMes(movs: Movimento[], mes: string) {
  const movimentos = movs.filter((m) => m.data.slice(0, 7) === mes)
  const soma = (f: (m: Movimento) => boolean) => r2(movimentos.filter(f).reduce((s, m) => s + m.valor, 0))
  const entrou = soma((m) => m.tipo === 'entrada')
  const reposicoes = soma((m) => m.origem === 'reposicao')
  const compras = soma((m) => m.origem === 'compra')
  const fixas = soma((m) => m.origem === 'fixa')
  const fornecedores = soma((m) => m.origem === 'fornecedor')
  const pessoal = soma((m) => m.origem === 'pessoal')
  const saiu = r2(compras + fixas + fornecedores + pessoal)
  return { entrou, reposicoes, compras, fixas, fornecedores, pessoal, saiu, saldo: r2(entrou - saiu), movimentos }
}
