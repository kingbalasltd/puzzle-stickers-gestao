import Dexie, { type Table } from 'dexie'

// Every record carries id + updatedAt + deleted so the v1 cloud sync can
// merge by last-write-wins without changing this schema.
export interface Base {
  id: string
  createdAt: string
  updatedAt: string
  deleted?: boolean
  demo?: boolean
}

export type Papel = 'dono' | 'gerente' | 'trabalhador'

export interface Utilizador extends Base {
  nome: string
  papel: Papel
  funcao: string
  telefone: string
  pin: string
  cor: string
  ativo: boolean
}

export interface Cliente extends Base {
  nome: string
  logoId?: string // printed under "Exmo (s)Sr(s)" on quotes
  contacto?: string
  telefone?: string
  email?: string
  nuit?: string
  cidade?: string
  notas?: string
}

// A product or service in a supplier's price list. `precoM2` is the price per
// `unidade` (the name stays from v1, when every item was priced per m²).
export interface MaterialFornecedor {
  nome: string
  tipo: 'impressao' | 'laminacao' | 'material' | 'servico' | 'outro'
  precoM2: number
  unidade?: string
  descricao?: string
}

export interface Fornecedor extends Base {
  nome: string
  categoria: string
  contacto?: string
  telefone?: string
  email?: string
  nuit?: string
  notas?: string
  logoId?: string
  materiais: MaterialFornecedor[]
  morada?: string
  site?: string
  condicao?: 'proforma' | 'credito' | 'entrega' | 'outra'
  temCredito?: boolean
  prazoEntrega?: string
  dadosBancarios?: string
}

export interface Servico extends Base {
  categoria: string
  nome: string
  preco: number
  diasMin: number
  diasMax: number
  inclui: string[]
  ativo: boolean
  ordem?: number // position in his printed catálogo
}

// Momad's phases (16 Oct): Pedido → Em negociação → Layout → Produção → Montagem → Entrega.
// 'entregue' is the job once the Entrega button was pressed.
export type Etapa = 'pedido' | 'negociacao' | 'layout' | 'producao' | 'montagem' | 'entrega' | 'entregue'

// Stage names used before 16 Oct; read-time only (normalizarEtapa), never written.
export type EtapaAntiga = 'entrada' | 'design' | 'cotacao' | 'aprovacao' | 'marcacao' | 'encomenda' | 'recebido' | 'acabamento' | 'pronto'

// 'producao' is the v1 name of branding; migrated at startup.
export type TipoTrabalho = 'branding' | 'criacao' | 'fornecimento' | 'montagem' | 'producao'

// A part of the job. Parts can be agreed by voice ("de boca") long before the
// single final quote that bundles everything.
export interface ItemTrabalho {
  descricao: string
  detalhe?: string
  qt: number
  precoUnit: number
  origem?: 'boca' | 'cotacao' | 'catalogo'
  servicoId?: string
}

export interface PassagemEtapa {
  etapa: Etapa
  em: string
  por: string
}

export interface NotaTrabalho {
  id: string
  em: string
  por: string
  texto: string
  ficheiroId?: string
}

export interface Trabalho extends Base {
  codigo: string
  titulo: string
  clienteId: string
  tipo: TipoTrabalho
  servicoId?: string
  descricao: string
  itens: ItemTrabalho[]
  comIva: boolean
  urgente: boolean
  etapa: Etapa
  etapas: PassagemEtapa[]
  dataEntrada: string
  prazo: string
  responsavelId?: string
  ficheiros: string[]
  notas: NotaTrabalho[]
  cancelado?: boolean
  cotacaoId?: string
  pagamentoPrometido?: string // date the client promised to pay the balance after delivery
  confirmadoEm?: string // client confirmed (end of negotiation): from here it counts in "a receber"
  layoutAprovadoEm?: string
  pedidoFornecedorEm?: string // day the order went to the supplier when it was not a requisição in the app
  montagemDe?: string
  montagemAte?: string
  prazos?: Partial<Record<Etapa, string>> // optional deadline of each phase; `prazo` is the delivery date
}

export type MetodoPagamento = 'M-Pesa' | 'e-Mola' | 'Transferência' | 'Numerário' | 'POS' | 'Cheque'

export interface Pagamento extends Base {
  trabalhoId: string
  data: string
  valor: number
  metodo: MetodoPagamento
  tipo: 'sinal' | 'parcial' | 'final'
  referencia?: string
  reciboId?: string // the receipt (Documento) that recorded it
}

export interface LinhaImpressao {
  qt: number
  ficheiro: string
  largura: number
  comprimento: number
  // Each print has its own material (16 Oct). Absent = the list's material (orders made before);
  // '' = explicitly none (e.g. lamination only).
  impressao?: string
  precoImpressao?: number
  laminacao?: string
  precoLaminacao?: number
}

export interface ItemEncomenda {
  descricao: string
  unidade: string
  qt: number
  precoUnit: number
}

export interface PagamentoFornecedor {
  id: string
  data: string
  valor: number
  metodo: string
  referencia?: string
}

export interface ProForma {
  numero: string
  data: string
  valor: number // total com IVA, como vem na pró-forma
  ficheiroId?: string
}

// The supplier cycle he described: list → pró-forma → paid (or on credit) →
// fatura + recibo → collected. Each step is optional and dated.
export interface Requisicao extends Base {
  numero: string
  trabalhoId: string // '' = not linked to a job (e.g. "Várias" on the credit map)
  fornecedorId: string
  data: string
  tipo?: 'lista' | 'encomenda'
  nomeTrabalho: string
  materialImpressao: string
  precoImpressaoM2: number
  materialLaminacao: string
  precoLaminacaoM2: number
  linhas: LinhaImpressao[]
  itens?: ItemEncomenda[]
  comIva: boolean
  estado: 'rascunho' | 'enviada' | 'recebida'
  anexoId?: string
  notas?: string
  enviadaEm?: string
  proforma?: ProForma
  pagamento?: 'pendente' | 'pago' | 'credito'
  pagamentos?: PagamentoFornecedor[] // supplier payments (partial allowed)
  creditoDesde?: string
  pagoEm?: string
  metodoPagamento?: string
  refPagamento?: string
  faturaDocId?: string
  reciboDocId?: string
  levantadaEm?: string
  despesaLevantamentoId?: string
}

export interface Custo extends Base {
  trabalhoId: string
  data: string
  descricao: string
  valor: number
}

export type TipoDocumento = 'fatura' | 'fatura-recibo' | 'venda-dinheiro' | 'recibo' | 'nota-credito' | 'outro'

export interface Documento extends Base {
  direcao: 'emitido' | 'recebido'
  tipo: TipoDocumento
  numero: string
  data: string
  entidade: string
  nuit?: string
  clienteId?: string
  fornecedorId?: string
  trabalhoId?: string
  base: number
  iva: number
  total: number
  ficheiroId?: string
  notas?: string
  despesaId?: string
  requisicaoId?: string
  trabalhoIds?: string[] // an invoice can cover several jobs (trabalhoId = the first)
  faturaId?: string // a receipt points at its invoice; several receipts = paid in instalments
}

// A recurring company cost (salário, renda, EDM, internet, Adobe…). Each month it
// shows up as due until a Despesa with this fixaId and mes is registered.
export interface DespesaFixa extends Base {
  nome: string
  categoria: string
  valor: number
  dia: number // last day to pay
  abre?: number // first day to pay; when it comes after `dia`, the deadline is next month (25 → 5)
  entidade?: string
  utilizadorId?: string
  inicio: string // YYYY-MM
  ativo: boolean
  notas?: string
}

export interface Despesa extends Base {
  data: string
  descricao: string
  categoria: string
  valor: number // total pago, com IVA
  iva: number // IVA dedutível incluído no valor (0 se não houver fatura)
  entidade?: string
  metodo?: string
  fixaId?: string
  mes?: string // YYYY-MM a que a despesa fixa se refere
  ficheiroId?: string
  notas?: string
  documento?: 'fatura' | 'venda-dinheiro' | 'recibo' | 'nenhum' // what the shop handed over
  numeroDoc?: string
  pessoal?: boolean // the owner's personal spending with company money (leaves the caixa, not a cost)
  // How it was settled (Momad, 18 Oct): paid back to the company, or accepted as his own use.
  pessoalEstado?: 'reposto' | 'autorizado'
  pessoalEm?: string // date it was paid back / authorised
}

// A material printed under a quote item, as in Momad's quotes: the name in red, then
// "- Certificado" / "- Não Certificado" and the brand's lifespan (17 Oct).
export interface MaterialCotacao {
  nome: string
  certificado: boolean
  garantia?: string // "até 2 anos" → "(A marca garante vida útil até 2 anos se usado…)"; empty = sem garantias
  marca?: string // how an option made with it is titled: OPÇÃO 1 - Taksim®
}

export interface ItemCotacao {
  qt: number
  titulo: string
  subtitulo?: string
  descricao?: string
  precoUnit: number
  materiais?: MaterialCotacao[]
  nota?: string // last line in bold italic, e.g. "** Layout já definido pelo cliente"
  // Alternatives the client chooses from (Taksim / Mactac / Avery, or packages). Items without
  // an option go into every option's total.
  opcao?: number
  secao?: boolean // a heading row (e.g. PROJECTO GESTÃO MENSAL): only the title prints
  extra?: boolean // a charge such as Deslocação: goes with the job, never becomes a job of its own
  urgente?: boolean // taxa de urgência on this item only, printed as its own line after it
  gerada?: boolean // a line the app writes (the urgency line); never saved
}

export interface Cotacao extends Base {
  numero: string
  data: string
  clienteId: string
  itens: ItemCotacao[]
  validadeDias: number
  notas: string
  estado: 'rascunho' | 'enviada' | 'aceite' | 'recusada'
  trabalhoId?: string
  origemTrabalhoId?: string // quote made from inside a job
  notaMaterial?: boolean // print the Taksim material note at the bottom (reference quote layout)
  desconto?: number // % off before IVA
  opcaoAceite?: number // the option the client chose
}

// A to-do in the agenda, with or without a date, loose or tied to a job.
export interface Tarefa extends Base {
  texto: string
  data?: string
  trabalhoId?: string
  feitaEm?: string
  por: string
}

// Device-only state (never synced): the cloud session and sync cursors.
export interface Nuvem {
  id: 'nuvem'
  token: string
  empresa: string
  nome: string
  cursor: number
  marca: string
  esquema?: number // data layout this device last pulled with (see nuvem.ts ESQUEMA)
}

// Daily report written by a worker (or by Momad himself).
export interface Relatorio extends Base {
  data: string
  utilizadorId: string
  feito: string
  aFazer?: string
  problemas?: string
  trabalhosIds: string[]
  fotos: string[]
}

export interface Ficheiro {
  id: string
  nome: string
  mime: string
  tamanho: number
  blob: Blob
  createdAt: string
}

export interface Registo {
  id: string
  em: string
  por: string
  acao: string
  alvo?: string
}

export interface Empresa {
  id: 'empresa'
  nome: string
  razaoSocial: string
  nuit: string
  morada: string
  cidade: string
  telefones: string
  email: string
  instagram: string
  taxaIva: number
  sinalPct: number
  urgenciaPct: number
  validadeCotacao: number
  notaCotacao: string
  updatedAt: string
  seedVersao?: number
  caixa?: { valor: number; data: string; em: string } // the real balance he typed once ("acertar caixa")
}

class PuzzleDB extends Dexie {
  utilizadores!: Table<Utilizador, string>
  clientes!: Table<Cliente, string>
  fornecedores!: Table<Fornecedor, string>
  servicos!: Table<Servico, string>
  trabalhos!: Table<Trabalho, string>
  pagamentos!: Table<Pagamento, string>
  requisicoes!: Table<Requisicao, string>
  custos!: Table<Custo, string>
  documentos!: Table<Documento, string>
  cotacoes!: Table<Cotacao, string>
  ficheiros!: Table<Ficheiro, string>
  registos!: Table<Registo, string>
  empresa!: Table<Empresa, string>
  despesasFixas!: Table<DespesaFixa, string>
  despesas!: Table<Despesa, string>
  relatorios!: Table<Relatorio, string>
  meta!: Table<Nuvem, string>
  tarefas!: Table<Tarefa, string>

  constructor() {
    super('puzzle-gestao')
    this.version(1).stores({
      utilizadores: 'id, papel',
      clientes: 'id, nome',
      fornecedores: 'id, nome',
      servicos: 'id, categoria',
      trabalhos: 'id, codigo, clienteId, etapa, prazo, responsavelId',
      pagamentos: 'id, trabalhoId, data',
      requisicoes: 'id, trabalhoId, fornecedorId, data',
      custos: 'id, trabalhoId, data',
      documentos: 'id, data, direcao, trabalhoId, clienteId, fornecedorId',
      cotacoes: 'id, clienteId, data',
      ficheiros: 'id',
      registos: 'id, em',
      empresa: 'id'
    })
    this.version(2).stores({
      despesasFixas: 'id, categoria',
      despesas: 'id, data, fixaId, mes, categoria'
    })
    this.version(3).stores({
      relatorios: 'id, data, utilizadorId'
    })
    this.version(4).stores({
      meta: 'id'
    })
    this.version(5).stores({
      tarefas: 'id, data, trabalhoId'
    })
  }
}

export const db = new PuzzleDB()

export const uid = () =>
  (crypto as any).randomUUID
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)

export const agora = () => new Date().toISOString()

export function novo<T extends Base>(data: Omit<T, keyof Base> & Partial<Base>): T {
  const t = agora()
  return { id: uid(), createdAt: t, updatedAt: t, ...data } as T
}

export async function guardar<T extends Base>(table: Table<T, string>, rec: T) {
  rec.updatedAt = agora()
  await table.put(rec)
  return rec
}

export async function apagar<T extends Base>(table: Table<T, string>, id: string) {
  const r = await table.get(id)
  if (!r) return
  r.deleted = true
  r.updatedAt = agora()
  await table.put(r)
}

export const vivos = <T extends Base>(xs: T[]) => xs.filter((x) => !x.deleted)

export async function registar(por: string, acao: string, alvo?: string) {
  await db.registos.put({ id: uid(), em: agora(), por, acao, alvo })
}

export async function guardarFicheiro(file: File | Blob, nome?: string): Promise<string> {
  const blob = file.type.startsWith('image/') ? await comprimirImagem(file) : file
  const id = uid()
  await db.ficheiros.put({
    id,
    nome: nome || (file as File).name || 'ficheiro',
    mime: blob.type || file.type,
    tamanho: blob.size,
    blob,
    createdAt: agora()
  })
  return id
}

// Phone photos of invoices are 3-5 MB; 2000 px JPEG keeps them legible at ~400 KB.
async function comprimirImagem(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const max = 2000
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
    if (s === 1 && file.size < 900_000) return file
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * s)
    c.height = Math.round(bmp.height * s)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.82))
  } catch {
    return file
  }
}
