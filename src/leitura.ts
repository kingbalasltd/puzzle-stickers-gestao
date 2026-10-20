// Reads the company's own files so the user only has to upload them:
//  - Académica PDFs (Primavera): pró-forma, fatura, recibo
//  - the company's print lists, as the Excel sheet or the PDF exported from it
// Scanned documents have no text layer and return null (they would need OCR).

import type { LinhaImpressao } from './db'

export interface ItemTexto { str: string; hasEOL?: boolean }

// pdf.js gives text runs; rebuild visual lines and repair split accents.
export function linhasDeItens(items: ItemTexto[]): string[] {
  const out: string[] = []
  let cur = ''
  const push = () => {
    const l = cur.replace(/([̀-ͯ])\s+/g, '$1').normalize('NFC').replace(/\s+/g, ' ').trim()
    if (l) out.push(l)
    cur = ''
  }
  for (const it of items) {
    cur += it.str
    if (it.hasEOL) push()
  }
  push()
  return out
}

// "12 345,00", "1 234,00 MTn", "4,321.00", "12345.6" → number
export function numeroPt(s: string): number {
  const t = s.replace(/MTn?|MZN/gi, '').replace(/[\s ]/g, '').trim()
  if (!t) return NaN
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ''))
  if (/^-?\d+(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'))
  return Number(t.replace(',', '.'))
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
export const chaveNome = norm

// ---------- Académica ----------

export interface DocAcademica {
  tipo: 'proforma' | 'fatura' | 'recibo'
  numero: string
  data?: string
  base?: number
  iva?: number
  total?: number
  m2?: number
  prints: string[]
  nomeBase?: string
  texto: string
}

export function lerAcademica(linhas: string[]): DocAcademica | null {
  const texto = linhas.join('\n')
  let tipo: DocAcademica['tipo'] | null = null
  let numero = ''
  let m: RegExpMatchArray | null
  if ((m = texto.match(/Pr[óo]-?\s*Forma\s+N\.?\s*º?\s*(\d+\/\d{4})/i))) { tipo = 'proforma'; numero = m[1] }
  else if ((m = texto.match(/Recebimento\s+N\.?\s*º?\s*(\d+\/\d{4})/i))) { tipo = 'recibo'; numero = m[1] }
  else if ((m = texto.match(/Fa(?:c)?tura(?:-Recibo)?\s+N\.?\s*º?\s*(\d+\/\d{4})/i))) { tipo = 'fatura'; numero = m[1] }
  if (!tipo) return null

  const iso = texto.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  const dmy = texto.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/)
  const data = iso ? iso[0] : dmy ? `${dmy[3]}-${dmy[1]}-${dmy[2]}` : undefined

  const nums = (l: string) => (l.match(/-?\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{2})/g) || []).map(numeroPt).filter((n) => !isNaN(n))
  let total: number | undefined
  let base: number | undefined
  let iva: number | undefined
  for (const l of linhas) {
    if (/Total\s*\(\s*MT\s*\)/i.test(l) || /Total\s+Recebido\s*\(MT\)/i.test(l)) {
      const n = nums(l.replace(/.*\)/, ''))
      if (n.length) total = n[n.length - 1]
    }
    if (/^IVA\s*\(\s*16[.,]00\s*\)/i.test(l)) {
      const n = nums(l.replace(/^IVA\s*\([^)]*\)/i, ''))
      if (n.length >= 2) { base = n[0]; iva = n[1] }
    }
  }
  const m2m = texto.match(/METROS\s+QUADRADOS:\s*([\d.,]+)/i)

  // Print names may wrap: "…_Camiao_Modelo" + "_X_MATERIAL_PRINT_1".
  const juntas: string[] = []
  for (const l of linhas) {
    const ant = juntas[juntas.length - 1] || ''
    const continua = /^DIV\s/.test(ant) && !/_PRINT_?\d+$/i.test(ant) && !/METROS/i.test(ant) && !/^\d/.test(l) && !/^DIV\s/.test(l)
    if (juntas.length && (continua || /^_/.test(l))) juntas[juntas.length - 1] += l
    else juntas.push(l)
  }
  const prints = juntas
    .map((l) => l.replace(/^DIV\s+/, '').trim())
    .filter((l) => /_PRINT_?\d+$/i.test(l))
  const nomeBase = prints.length ? prints[prints.length - 1].replace(/_PRINT_?\d+$/i, '') : undefined

  return {
    tipo,
    numero,
    data,
    base,
    iva,
    total,
    m2: m2m ? numeroPt(m2m[1].replace(/M$/i, '')) : undefined,
    prints,
    nomeBase,
    texto
  }
}

// ---------- Lista de impressão ----------

export interface ListaLida {
  nomeTrabalho: string
  data?: string
  materialImpressao?: string
  precoImpressaoM2?: number
  materialLaminacao?: string
  precoLaminacaoM2?: number
  linhas: LinhaImpressao[]
  totalLido?: number
}

const MESES: Record<string, string> = { janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' }

function dataPorExtenso(s: string) {
  const m = norm(s).match(/(\d{1,2})de([a-z]+)de(\d{4})/)
  if (!m || !MESES[m[2]]) return undefined
  return `${m[3]}-${MESES[m[2]]}-${m[1].padStart(2, '0')}`
}

const LABEL = /^(QT\.|PRINT|Nome do trabalho:|Data:|Material Impress[ãa]o:|Material Lamina[çc][ãa]o:|Pre[çc]o .*|Sub-Total|IVA.*|TOTAL.*|Total de Metros.*|LISTA DE IMPRESS[ÃA]O)$/i

export function lerListaPdf(linhas: string[]): ListaLida | null {
  if (!linhas.some((l) => /LISTA DE IMPRESS[ÃA]O/i.test(l))) return null
  const rows: LinhaImpressao[] = []
  for (const l of linhas) {
    const m = l.match(/^(\d+)\s+(?:(.+?)\s+)?(\d+,\d{2})\s+(\d+,\d{2})\s+(\d+,\d{2})$/)
    if (!m) continue
    const [, qt, nome, L, C] = m
    if (!nome && Number(qt) === 0) continue // empty template rows
    rows.push({ qt: Number(qt), ficheiro: (nome || '').trim(), largura: numeroPt(L), comprimento: numeroPt(C) })
  }
  if (!rows.length) return null

  let precoImp: number | undefined
  let precoLam: number | undefined
  linhas.forEach((l, i) => {
    if (!/^Pre[çc]o por metro quadrado:?$/i.test(l)) return
    const v = numeroPt(linhas[i + 1] || '')
    if (isNaN(v)) return
    const antes = linhas[i - 1] || ''
    if (/lamina/i.test(antes)) precoLam = v
    else if (/impress/i.test(antes)) precoImp = v
    else if (precoImp === undefined) precoImp = v
    else precoLam = v
  })
  const candidatos = linhas.filter((l) => !LABEL.test(l) && !/:|QT\.|ficheiro/i.test(l) && !/\d/.test(l.replace(/\(.*\)/, '')) && !/_PRINT/i.test(l) && !/-feira|s[áa]bado|domingo/i.test(l))
  const materialLaminacao = candidatos.find((l) => /lamina/i.test(l))
  const materialImpressao = candidatos.find((l) => !/lamina/i.test(l))
  const dataL = linhas.find((l) => /\d{1,2} de [a-zçãé]+ de \d{4}/i.test(l))
  const primeiro = rows.find((r) => r.ficheiro)?.ficheiro || linhas.find((l) => /_PRINT$/i.test(l)) || 'Lista'
  const total = linhas.map((l) => l.match(/^TOTAL\s+([\d .,]+)\s*MTn?$/i)).find(Boolean)
  return {
    nomeTrabalho: primeiro.replace(/_PRINT(_?\d+)?$/i, ''),
    data: dataL ? dataPorExtenso(dataL) : undefined,
    materialImpressao,
    precoImpressaoM2: precoImp,
    materialLaminacao,
    precoLaminacaoM2: precoLam,
    linhas: rows,
    totalLido: total ? numeroPt(total[1]) : undefined
  }
}

// Excel: find the labels instead of fixed cells, so moved rows still work.
export function lerListaGrelha(get: (r: number, c: number) => unknown, maxR: number, maxC: number): ListaLida | null {
  const str = (v: unknown) => (v instanceof Date ? '' : v == null ? '' : String(v).trim())
  const acha = (re: RegExp, desde = 0): [number, number] | null => {
    for (let r = desde; r <= maxR; r++) for (let c = 0; c <= maxC; c++) if (re.test(str(get(r, c)))) return [r, c]
    return null
  }
  const abaixo = (p: [number, number] | null) => (p ? get(p[0] + 1, p[1]) : undefined)
  const hdr = acha(/^QT\.?$/i)
  if (!hdr) return null
  const pImp = acha(/^Material Impress[ãa]o:?$/i)
  const pLam = acha(/^Material Lamina[çc][ãa]o:?$/i)
  const precos: [number, number][] = []
  for (let r = 0; r <= maxR; r++) for (let c = 0; c <= maxC; c++) if (/^Pre[çc]o por metro quadrado:?$/i.test(str(get(r, c)))) precos.push([r, c])
  const precoApos = (p: [number, number] | null) => {
    const x = p && precos.find(([r]) => r > p[0])
    const v = x ? Number(get(x[0] + 1, x[1])) : NaN
    return isNaN(v) ? undefined : v
  }
  const rows: LinhaImpressao[] = []
  for (let r = hdr[0] + 1; r <= maxR; r++) {
    if (/Total de Metros/i.test([0, 1, 2, 3, 4].map((c) => str(get(r, hdr[1] + c))).join(' '))) break
    const qt = Number(get(r, hdr[1])) || 0
    const ficheiro = str(get(r, hdr[1] + 1))
    const largura = Number(get(r, hdr[1] + 2)) || 0
    const comprimento = Number(get(r, hdr[1] + 3)) || 0
    if (!ficheiro && !qt) continue
    rows.push({ qt, ficheiro, largura, comprimento })
  }
  if (!rows.length) return null
  const d = abaixo(acha(/^Data:?$/i))
  const data = d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : typeof d === 'string' ? dataPorExtenso(d) : undefined
  const nome = str(abaixo(acha(/^Nome do trabalho:?$/i))) || rows.find((r) => r.ficheiro)?.ficheiro || 'Lista'
  return {
    nomeTrabalho: nome.replace(/_PRINT(_?\d+)?$/i, ''),
    data,
    materialImpressao: str(abaixo(pImp)) || undefined,
    precoImpressaoM2: precoApos(pImp),
    materialLaminacao: str(abaixo(pLam)) || undefined,
    precoLaminacaoM2: precoApos(pLam),
    linhas: rows
  }
}

// ---------- Browser side ----------

let pdfjs: Promise<typeof import('pdfjs-dist')> | null = null
export function carregarPdfjs() {
  if (!pdfjs)
    pdfjs = Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([m, w]) => {
      m.GlobalWorkerOptions.workerSrc = (w as any).default
      return m
    })
  return pdfjs
}

export async function textoPdf(blob: Blob): Promise<string[]> {
  const lib = await carregarPdfjs()
  const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  const out: string[] = []
  for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
    const tc = await (await doc.getPage(i)).getTextContent()
    out.push(...linhasDeItens(tc.items as ItemTexto[]))
  }
  return out
}

export async function lerListaExcel(blob: Blob): Promise<ListaLida | null> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
  return lerListaGrelha((r, c) => ws[XLSX.utils.encode_cell({ r, c })]?.v, ref.e.r, ref.e.c)
}

export type Lido =
  | { tipo: 'lista'; lista: ListaLida }
  | { tipo: 'academica'; doc: DocAcademica }
  | { tipo: 'nada'; motivo: string }

export async function lerFicheiro(f: Blob & { name?: string }): Promise<Lido> {
  const nome = (f.name || '').toLowerCase()
  try {
    if (/\.xlsx?$/.test(nome) || /sheet|excel/.test(f.type)) {
      const lista = await lerListaExcel(f)
      return lista ? { tipo: 'lista', lista } : { tipo: 'nada', motivo: 'Não encontrei uma lista de impressão nesta folha de Excel.' }
    }
    if (f.type === 'application/pdf' || nome.endsWith('.pdf')) {
      const linhas = await textoPdf(f)
      if (linhas.length < 3) return { tipo: 'nada', motivo: 'Este PDF é uma imagem digitalizada (scan) — sem texto para ler. Preencha os campos à mão.' }
      const lista = lerListaPdf(linhas)
      if (lista) return { tipo: 'lista', lista }
      const doc = lerAcademica(linhas)
      if (doc) return { tipo: 'academica', doc }
      return { tipo: 'nada', motivo: 'Não reconheci este documento (não é uma lista de impressão nem um documento da Académica).' }
    }
    return { tipo: 'nada', motivo: 'Fotos ainda não são lidas automaticamente — preencha os campos à mão.' }
  } catch {
    return { tipo: 'nada', motivo: 'Não consegui abrir o ficheiro.' }
  }
}
