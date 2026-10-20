import { normalizarEtapa } from './calc'
import { db, type Cotacao, type Empresa, type Requisicao, type Servico, type Trabalho, type Utilizador } from './db'

// What every device starts from: the company profile, the price catalogue and the owner user.
// The example data of the first prototypes is removed once per device (Empresa.seedVersao < 3).

const T = (d: string, h = '09:00') => `${d}T${h}:00.000Z`
const meta = (data: string) => ({ createdAt: T(data), updatedAt: T(data) })
const SEED_VERSAO = 3

export const EMPRESA: Empresa = {
  id: 'empresa',
  nome: 'Puzzle Stickers',
  razaoSocial: 'PUZZLE STICKERS SOCIEDADE UNIPESSOAL, LIMITADA',
  nuit: '400944024',
  morada: 'Av. 24 de Julho Nº 1507 5º Andar',
  cidade: 'Maputo - Moçambique',
  telefones: '+258 82 277 7302 • +258 82 485 1985',
  email: 'puzzle.stickers@gmail.com',
  instagram: '@puzzle.stickers',
  taxaIva: 16,
  sinalPct: 50,
  urgenciaPct: 45,
  validadeCotacao: 30,
  notaCotacao:
    'Após a aprovação da cotação, será elaborado um cronograma detalhado com todas as fases do trabalho.\nNessa etapa, serão igualmente definidos os aspetos relativos às condições de pagamento.\nDe forma a assegurar total clareza e alinhamento entre as partes.',
  updatedAt: T('2026-10-01')
}

// Straight from "Catálogo Criação de Imagem 2026" (válido a partir de março de 2026).
export const CATALOGO: [string, string, number, number, number, string[]][] = [
  ['Logotipos', 'Logotipo Simples', 10000, 3, 5, ['1 Proposta', 'Revisões simples']],
  ['Logotipos', 'Logotipo Complexo', 18000, 5, 7, ['2 Propostas', 'Revisões simples']],
  ['Logotipos', 'Logotipo Artístico', 28000, 10, 15, ['Conceito exclusivo', 'Revisões criativas']],
  ['Identidade Visual', 'Identidade Visual Essencial', 35000, 10, 20, ['Paleta de cores', 'Tipografia institucional', 'Aplicações essenciais', 'Versões do logotipo']],
  ['Identidade Visual', 'Identidade Visual Completa', 65000, 15, 30, ['Paleta de cores', 'Tipografia institucional', 'Aplicações essenciais', 'Versões do logotipo', 'Guia básico']],
  ['Identidade Visual', 'Sistema de Identidade Institucional', 0, 0, 0, ['Proposta personalizada após estudo do projeto']],
  ['Projetos Editoriais', 'Editorial 10–15 páginas', 15000, 5, 7, ['Menus, catálogos, brochuras, perfis']],
  ['Projetos Editoriais', 'Editorial 20–40 páginas', 25000, 5, 10, ['Menus, catálogos, brochuras, perfis']],
  ['Projetos Editoriais', 'Editorial 50–100 páginas', 60000, 10, 20, ['Menus, catálogos, brochuras, perfis']],
  ['Projetos Editoriais', 'Editorial +100 páginas', 0, 0, 0, ['Por definir']],
  ['Imagem para Eventos', 'Pacote Evento Essencial', 15000, 3, 5, ['1 Layout p/ produção', '3 Cartazes promocionais']],
  ['Imagem para Eventos', 'Pacote Evento Intermédio', 20000, 5, 7, ['3 Layouts p/ produção', 'Imagem do evento', '5 Cartazes promocionais']],
  ['Imagem para Eventos', 'Pacote Evento Completo', 30000, 5, 10, ['5 Layouts p/ produção', 'Logotipo do evento', 'Imagem do evento', '6 Cartazes promocionais']],
  ['Extras', 'Alterações adicionais', 1000, 0, 0, ['Revisões extra após as incluídas no serviço']],
  ['Extras', '5 Páginas adicionais', 5000, 0, 0, ['Páginas além do limite do pacote']],
  ['Extras', '5 Cartazes adicionais', 10000, 0, 0, ['Cartazes extra além do incluído']],
  ['Extras', 'Tratamento de imagens', 5000, 0, 0, ['Edição, melhoria ou vectorização de logotipos']]
]


export async function semear() {
  const emp = await db.empresa.get('empresa')
  if (emp && (emp.seedVersao || 0) >= SEED_VERSAO) return correcoes()
  if (!emp) await db.empresa.put(EMPRESA)
  await apagarExemplos()
  await semearReal()
  await renumerar()
  await correcoes()
  const e = (await db.empresa.get('empresa'))!
  await db.empresa.put({ ...e, seedVersao: SEED_VERSAO })
}

// Small fixes that must reach devices already on the current seed version.
async function correcoes() {
  await catalogoComIdsFixos()
  // Catálogo in the same order as the company's PDF (Logotipos → Identidade → Editorial → Eventos → Extras).
  for (const sv of await db.servicos.toArray()) {
    const i = CATALOGO.findIndex(([, nome]) => nome === sv.nome)
    const ordem = i >= 0 ? i : 100
    if (sv.ordem !== ordem) await db.servicos.put({ ...sv, ordem })
  }
  // v1 "produção" jobs are Branding / wrap (14 Oct).
  for (const t of await db.trabalhos.toArray())
    if (t.tipo === 'producao') await db.trabalhos.put({ ...t, tipo: 'branding', etapa: normalizarEtapa(t.etapa) })
}

// The same catálogo service gets the same id on every device, so syncing never duplicates it.
const idCatalogo = (nome: string) =>
  'srv-' + nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Devices seeded before 15 Oct have random catálogo ids: move them to the fixed ones
// (these ids never left the device) and point the jobs at the new ids.
async function catalogoComIdsFixos() {
  const troca = new Map<string, string>()
  for (const sv of await db.servicos.toArray()) {
    if (sv.id.startsWith('srv-') || !CATALOGO.some(([, nome]) => nome === sv.nome)) continue
    const id = idCatalogo(sv.nome)
    if (!(await db.servicos.get(id))) await db.servicos.put({ ...sv, id })
    await db.servicos.delete(sv.id)
    troca.set(sv.id, id)
  }
  if (!troca.size) return
  for (const t of await db.trabalhos.toArray()) {
    const itens = t.itens.map((it) => (it.servicoId && troca.has(it.servicoId) ? { ...it, servicoId: troca.get(it.servicoId) } : it))
    const servicoId = t.servicoId && troca.has(t.servicoId) ? troca.get(t.servicoId) : t.servicoId
    if (servicoId !== t.servicoId || itens.some((it, i) => it !== t.itens[i])) await db.trabalhos.put({ ...t, servicoId, itens })
  }
}

// What a brand-new company starts with. The company's real clients, jobs and documents
// live in the cloud (kb-academy · puzzle), never in this public code.
async function semearReal() {
  if ((await db.servicos.count()) === 0)
    await db.servicos.bulkPut(
      CATALOGO.map(([categoria, nome, preco, diasMin, diasMax, inclui], ordem): Servico => ({ id: idCatalogo(nome), ...meta('2026-10-01'), categoria, nome, preco, diasMin, diasMax, inclui, ativo: true, ordem }))
    )
  if (!(await db.utilizadores.count()))
    await db.utilizadores.put({ id: 'real-user-momad', ...meta('2026-10-01'), nome: 'Momad', papel: 'dono', funcao: 'Diretor criativo', telefone: '+258 82 277 7302', pin: '1234', cor: '#ffc406', ativo: true } as Utilizador)
}

// Sequential codes in date order (T-2026-001…, REQ-2026-001…, COT-2026-001…).
async function renumerar() {
  async function seq<X extends { id: string; deleted?: boolean; createdAt: string }>(tabela: any, data: (x: X) => string, campo: 'codigo' | 'numero', prefixo: string) {
    const xs = ((await tabela.toArray()) as X[]).filter((x) => !x.deleted).sort((a, b) => data(a).localeCompare(data(b)) || a.createdAt.localeCompare(b.createdAt))
    const conta: Record<string, number> = {}
    for (const x of xs) {
      const ano = data(x).slice(0, 4)
      conta[ano] = (conta[ano] || 0) + 1
      const novo = `${prefixo}-${ano}-${String(conta[ano]).padStart(3, '0')}`
      if ((x as any)[campo] !== novo) await tabela.put({ ...x, [campo]: novo })
    }
  }
  await seq<Trabalho>(db.trabalhos, (x) => x.dataEntrada, 'codigo', 'T')
  await seq<Requisicao>(db.requisicoes, (x) => x.data, 'numero', 'REQ')
  await seq<Cotacao>(db.cotacoes, (x) => x.data, 'numero', 'COT')
}

// Removes the example records of the first prototypes (flag demo).
export async function apagarExemplos() {
  const tabelas = [db.utilizadores, db.clientes, db.fornecedores, db.trabalhos, db.pagamentos, db.requisicoes, db.custos, db.documentos, db.cotacoes, db.despesasFixas, db.despesas] as const
  for (const t of tabelas) {
    const ids = (await (t as any).toArray()).filter((x: any) => x.demo).map((x: any) => x.id)
    await (t as any).bulkDelete(ids)
  }
}

export async function repor() {
  await db.delete()
  location.reload()
}
