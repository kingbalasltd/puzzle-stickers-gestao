import type { Cliente, Cotacao, Empresa, ItemCotacao } from './db'
import { db } from './db'
import { comUrgencia, totaisCotacao } from './calc'
import { dataDoc, mt } from './format'

// The company's quote, rebuilt from its Illustrator file (reference quote, 14 Oct 2026):
// A4 in points (595.276 × 841.89), the original background artwork as an image, and
// every text in Gotham at the exact baseline/size/colour of the original.
// 17 Oct: materials in red, options, sections, discount, and pages that continue cleanly.

export const A4 = { w: 595.276, h: 841.89 }
const F = 'Gotham PS'

type Estilo = { peso: 300 | 400 | 500 | 700; italico?: boolean; tam: number; cor?: string; ls?: number }
const E = {
  light12: { peso: 300, tam: 12 },
  light10: { peso: 300, tam: 10 },
  book10: { peso: 400, tam: 10 },
  book12: { peso: 400, tam: 12 },
  med12: { peso: 500, tam: 12 },
  preco12: { peso: 500, tam: 12, ls: -0.42 },
  precoBook12: { peso: 400, tam: 12, ls: -0.43 },
  precoBold13: { peso: 700, tam: 13, ls: -0.51 },
  cliente12: { peso: 700, tam: 12, ls: -0.58 },
  med13: { peso: 500, tam: 13 },
  med14: { peso: 500, tam: 14 },
  numero: { peso: 400, tam: 10, cor: '#555555' },
  bold11: { peso: 700, tam: 11, ls: -0.3 },
  bold12: { peso: 700, tam: 12 },
  bold13: { peso: 700, tam: 13 },
  medIt9: { peso: 500, italico: true, tam: 9, cor: '#333333' },
  lightIt9: { peso: 300, italico: true, tam: 9, cor: '#333333', ls: -0.21 },
  descPrimeira: { peso: 500, italico: true, tam: 10, cor: '#333333', ls: -0.24 },
  descLinha: { peso: 300, italico: true, tam: 10, cor: '#333333', ls: -0.24 },
  descDestaque: { peso: 700, italico: true, tam: 10, cor: '#666666', ls: -0.24 },
  descMaterial: { peso: 400, italico: true, tam: 10, cor: '#ff0000', ls: -0.24 },
  descSufixo: { peso: 400, italico: true, tam: 10, cor: '#666666', ls: -0.24 },
  nota: { peso: 300, italico: true, tam: 10, cor: '#666666' },
  notaJust: { peso: 300, italico: true, tam: 10, cor: '#666666', ls: -0.24 },
  notaVermelha: { peso: 400, italico: true, tam: 10, cor: '#ff0000' },
  notaBook: { peso: 400, italico: true, tam: 10, cor: '#666666' },
  garantia: { peso: 300, italico: true, tam: 10, cor: '#1a1a1a' }
} satisfies Record<string, Estilo>

// Measured on the reference PDF.
const COL = { qtX0: 30.4, qtX1: 64.0, descX0: 67.9, descX1: 348.9, unitX0: 352.8, unitX1: 456.9, totX0: 460.8, totX1: 564.9 }
const ITEM = { altura: 39.4, base1: 17.46, base2: 32.0, primeiraDesc: 53.3, passo: 12, depois: 18.6, semDesc: 12 }
const SECAO = { altura: 26.5, base: 17.6, depois: 12 }
const TOPO_ITENS = 219.4
const LARGURA_DESC = COL.totX1 - 30.39
const NOTA_MATERIAL = 43 // the Taksim note sits above the totals block
const FIM_CONTINUA = 790 // a page that continues: items run down to its footer line

// The totals block of the reference file: box rows (SUB-TOTAL, IVA…) above the yellow TOTAL bar, which
// never moves. More rows (discount, options) stack upwards, and the items end higher.
const BLOCO = { ultimaLinha: 740.46, passo: 32.72, alturaLinha: 26.5, linhaTopo: 39.92, folga: 12.8 }
const CAIXAS: [number, number][] = [[359.98, 454.56], [459.79, 564.51]]
const AMARELO = '#e8c94f'

export type LinhaTotal = { rotulo: string; valor: string; vermelho?: boolean }

// What the totals block shows: sub-total and IVA, plus the discount when there is one.
// (The taxa de urgência is a line of its own; a quote with options prints one option at a time.)
export function blocoTotais(c: Pick<Cotacao, 'itens' | 'desconto'>, taxaIva: number, urgenciaPct: number) {
  const t = totaisCotacao(c, taxaIva, urgenciaPct)
  const linhas: LinhaTotal[] = [
    { rotulo: 'SUB-TOTAL', valor: mt(t.bruto) },
    ...(c.desconto ? [{ rotulo: `DESCONTO ${c.desconto}%`, valor: `-${mt(t.desconto)}`, vermelho: true }] : []),
    { rotulo: `IVA ${taxaIva}%`, valor: mt(t.iva) }
  ]
  return { linhas, barra: { rotulo: 'TOTAL', valor: mt(t.total) } }
}

const nLinhasTotais = (c: Pick<Cotacao, 'desconto'>) => (c.desconto ? 3 : 2)
// y of the yellow line that opens the totals block.
const topoBloco = (n: number) => BLOCO.ultimaLinha - BLOCO.passo * (n - 1) - BLOCO.linhaTopo

export type Medir = (texto: string, e: Estilo) => number

let canvas: HTMLCanvasElement | null = null
export const medirCanvas: Medir = (texto, e) => {
  canvas = canvas || document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `${e.italico ? 'italic ' : ''}${e.peso} ${e.tam}px "${F}"`
  return ctx.measureText(texto).width + (e.ls || 0) * texto.length
}

function quebrar(texto: string, e: Estilo, largura: number, medir: Medir): string[] {
  const out: string[] = []
  for (const par of texto.split('\n')) {
    if (!par.trim()) continue
    let linha = ''
    for (const palavra of par.split(/(\s+)/)) {
      const tentativa = linha + palavra
      if (linha && medir(tentativa.trimEnd(), e) > largura) {
        out.push(linha.trimEnd())
        linha = palavra.trimStart()
      } else linha = tentativa
    }
    if (linha.trim()) out.push(linha.trimEnd())
  }
  return out
}

// Wrap items open with a medium line; a list of bullets stays light throughout.
const estiloLinhaDesc = (l: string, i: number): Estilo => (/^\*\*\s*layout/i.test(l) ? E.descDestaque : i === 0 && !/^[•\-–]/.test(l.trim()) ? E.descPrimeira : E.descLinha)

// The warranty note only means something when the quote prints on material.
const comMaterial = (c: Pick<Cotacao, 'itens' | 'notaMaterial'>) =>
  !!c.notaMaterial || c.itens.some((it) => it.materiais?.length || /vin[iy]l|vynil|wrap|branding|lamina|ppf|taksim|mactac|avery|hexis/i.test(`${it.titulo} ${it.subtitulo} ${it.descricao}`))

// One printed line under an item. A material line is its name in red (underlined) plus a grey suffix.
type Linha = { t: string; e: Estilo; sufixo?: string }

function linhasDoItem(it: ItemCotacao, medir: Medir): Linha[] {
  const desc = quebrar(it.descricao || '', E.descLinha, LARGURA_DESC, medir).map((t, i) => ({ t, e: estiloLinhaDesc(t, i) }))
  const mats = (it.materiais || []).filter((m) => m.nome.trim()).flatMap((m): Linha[] => [
    { t: m.nome.trim(), e: E.descMaterial, sufixo: m.certificado ? ' - Certiﬁcado' : ` - Não Certiﬁcado${m.garantia?.trim() ? '' : ' (Sem garantias)'}` },
    ...(m.garantia?.trim() ? quebrar(`(A marca garante vida útil ${m.garantia.trim()} se usado e conservado dentro dos padrões recomendados)`, E.descLinha, LARGURA_DESC, medir).map((t) => ({ t, e: E.descLinha })) : [])
  ])
  const nota = quebrar(it.nota || '', E.descDestaque, LARGURA_DESC, medir).map((t) => ({ t, e: E.descDestaque }))
  return [...desc, ...mats, ...nota]
}

export interface ItemPos {
  y: number
  ordem: number // index of the item in the quote
  secao?: boolean
  qt: string
  titulo: string
  subtitulo?: string
  unit: string
  total: string
  linhas: Linha[]
}

// The whole quote, page by page. With options (17 Oct, as in the company's own quotes) each option
// gets its own pages with its own SUB-TOTAL / IVA / TOTAL: the items common to all, then that option.
export function paginasCotacao<C extends Cotacao>(semUrgencia: C, medir: Medir, urgenciaPct: number): { c: C; itens: ItemPos[]; ultima: boolean }[] {
  const c = { ...semUrgencia, itens: comUrgencia(semUrgencia.itens, urgenciaPct) }
  const opcoes = [...new Set(c.itens.filter((i) => !i.secao && i.opcao).map((i) => i.opcao!))].sort((a, b) => a - b)
  const grupos = opcoes.length > 1 ? opcoes.map((o) => ({ ...c, itens: c.itens.filter((i) => !i.opcao || i.opcao === o) })) : [c]
  return grupos.flatMap((g) => {
    const ps = paginar(g, medir)
    return ps.map((itens, i) => ({ c: g, itens, ultima: i === ps.length - 1 }))
  })
}

// The standard footer text, broken exactly as in the reference file.
const NOTA_PADRAO_LINHAS = [
  'Após a aprovação da cotação, será elaborado um cronograma detal-',
  'hado com todas as fases do trabalho.',
  'Nessa etapa, serão igualmente deﬁnidos os aspetos relativos às ',
  'condições de pagamento.',
  'De forma a assegurar total clareza e alinhamento entre as partes.'
]
const NOTA_LARGURAS = [317.63, 173.88, 320.42, 120.77, 302.34]
const NOTA_LARGURA = 320.42
// The terms are justified: full lines stretch the spaces, never the letters.
const justificada = (l: string, alvo: number, medir: Medir) => {
  const t = l.trim()
  const espacos = (t.match(/ /g) || []).length
  return espacos ? (alvo - medir(t, E.notaJust)) / espacos : 0
}
const normal = (s: string) => s.replace(/ﬁ/g, 'fi').replace(/\s+/g, ' ').replace(/-\s+/g, '').trim()

// The closing text sits beside the totals boxes, as in the reference file. When it is too long for that
// column (a project quote), it runs full width above the totals block instead.
function termos(c: Pick<Cotacao, 'notas'>, n: number, medir: Medir) {
  if (normal(c.notas) === normal(NOTA_PADRAO_LINHAS.join(' '))) return { lado: NOTA_PADRAO_LINHAS, cheio: [] as string[], altura: 0, padrao: true }
  const cabe = Math.floor((770 - (topoBloco(n) + 47.24)) / 12) + 1
  const lado = quebrar(c.notas || '', E.notaJust, NOTA_LARGURA, medir)
  if (lado.length <= cabe) return { lado, cheio: [] as string[], altura: 0, padrao: false }
  const cheio = quebrar(c.notas, E.notaJust, LARGURA_DESC, medir)
  return { lado: [] as string[], cheio, altura: cheio.length * 12 + 12, padrao: false }
}

const alturaItem = (linhas: Linha[]) => ITEM.altura + (linhas.length ? ITEM.primeiraDesc - ITEM.altura + (linhas.length - 1) * ITEM.passo + ITEM.depois : ITEM.semDesc)

export function paginar(c: Pick<Cotacao, 'itens' | 'notaMaterial' | 'desconto' | 'notas'>, medir: Medir): ItemPos[][] {
  const n = nLinhasTotais(c)
  const fimUltima = topoBloco(n) - BLOCO.folga - (c.notaMaterial ? NOTA_MATERIAL : 0) - termos(c, n, medir).altura
  const blocos = c.itens.map((it, ordem) => {
    if (it.secao) return { altura: SECAO.altura + SECAO.depois, folga: SECAO.depois, pos: { y: 0, ordem, secao: true, qt: '', titulo: it.titulo, unit: '', total: '', linhas: [] } as ItemPos }
    const linhas = linhasDoItem(it, medir)
    return {
      altura: alturaItem(linhas),
      folga: linhas.length ? ITEM.depois : 0,
      pos: {
        y: 0,
        ordem,
        qt: String(it.qt).padStart(2, '0'),
        titulo: it.opcao && !it.gerada ? `OPÇÃO ${it.opcao} - ${it.titulo}` : it.titulo,
        subtitulo: it.subtitulo || undefined,
        unit: mt(it.precoUnit),
        total: mt(it.qt * it.precoUnit),
        linhas
      } as ItemPos
    }
  })
  const fimDe = (p: ItemPos) => p.y + blocos[p.ordem].altura - blocos[p.ordem].folga
  // From a list of items, fill pages that end at `fim`; a heading never stays alone at the foot of a page.
  const dispor = (xs: ItemPos[], fim: number) => {
    const paginas: ItemPos[][] = [[]]
    let y = TOPO_ITENS
    xs.forEach((p, k) => {
      const b = blocos[p.ordem]
      const seguinte = xs[k + 1] && blocos[xs[k + 1].ordem]
      const precisa = b.altura - b.folga + (p.secao && seguinte ? seguinte.altura - seguinte.folga : 0)
      if (y + precisa > fim && paginas[paginas.length - 1].length) {
        paginas.push([])
        y = TOPO_ITENS
      }
      paginas[paginas.length - 1].push({ ...p, y })
      y += b.altura
    })
    return paginas
  }
  // Every page but the last runs down to its footer; the last one must leave room for the totals.
  const paginas = dispor(blocos.map((b) => b.pos), FIM_CONTINUA)
  for (let guarda = 0; guarda < 50; guarda++) {
    const ultima = paginas[paginas.length - 1]
    if (!ultima.length || fimDe(ultima[ultima.length - 1]) <= fimUltima) break
    // This page becomes a full continuation page; only its last item (with its heading) goes on
    // to the new last page, so the totals never stand alone and no page is left half empty.
    let k = ultima.length - 1
    while (k > 0 && ultima[k - 1].secao) k--
    if (k === 0) {
      paginas.push([])
      break
    }
    paginas.push(...dispor(ultima.splice(k), FIM_CONTINUA))
  }
  return paginas
}

function T({ x, y, e, children, anchor, w, ws }: { x: number; y: number; e: Estilo; children: string; anchor?: 'end' | 'middle'; w?: number; ws?: number }) {
  return (
    <text x={x} y={y} fontFamily={F} fontWeight={e.peso} fontStyle={e.italico ? 'italic' : 'normal'} fontSize={e.tam} fill={e.cor || '#000'} textAnchor={anchor} letterSpacing={e.ls} wordSpacing={ws} textLength={w} lengthAdjust={w ? 'spacing' : undefined} xmlSpace="preserve">
      {children}
    </text>
  )
}

// A description line; a material gets its name in red with a red underline, then the grey suffix.
function LinhaDesc({ l, y, medir }: { l: Linha; y: number; medir: Medir }) {
  if (!l.sufixo) return <T x={30.39} y={y} e={l.e}>{l.t}</T>
  const w = medir(l.t, l.e)
  return (
    <g>
      <T x={30.39} y={y} e={l.e}>{l.t}</T>
      <line x1={30.39} x2={30.39 + w} y1={y + 1} y2={y + 1} stroke="#ff0000" strokeWidth={0.5} />
      <T x={30.39 + w + 2.5} y={y} e={E.descSufixo}>{l.sufixo.trim()}</T>
    </g>
  )
}

export function PaginaCotacao({ c, cliente, empresa, itens, ultima, pagina, total, logoCliente, medir }: {
  c: Cotacao; cliente?: Cliente; empresa: Empresa; itens: ItemPos[]; ultima: boolean; pagina: number; total: number; logoCliente?: string; medir: Medir
}) {
  const bloco = blocoTotais(c, empresa.taxaIva, empresa.urgenciaPct)
  const n = bloco.linhas.length
  // Plain sub-total + IVA is the original artwork, untouched; anything else is drawn on the clean page.
  const original = ultima && n === 2
  const H = topoBloco(n)
  const tx = termos(c, n, medir)
  const terms = tx.lado
  const padrao = tx.padrao
  const contactos = [empresa.telefones, empresa.email, empresa.instagram, empresa.cidade]
  return (
    <svg viewBox={`0 0 ${A4.w} ${A4.h}`} xmlns="http://www.w3.org/2000/svg">
      <image href={original ? '/img/cotacao-fundo.jpg' : '/img/cotacao-fundo-livre.jpg'} x={0} y={0} width={A4.w} height={A4.h} preserveAspectRatio="none" />
      <image href="/img/logo.svg" x={343.76} y={31.18} width={218.92} height={51.17} preserveAspectRatio="none" />

      <T x={30.39} y={43.08} e={E.med14}>Cotação</T>
      {c.numero && <T x={30.39 + medir('Cotação', E.med14) + 7} y={43.08} e={E.numero}>{c.numero}</T>}
      <T x={30.39} y={57.07} e={E.medIt9}>**Não serve de comprovativo ﬁscal</T>
      <T x={30.39} y={69.69} e={E.lightIt9}>{`Válida por ${c.validadeDias} dias${total > 1 ? ` · página ${pagina}/${total}` : ''}`}</T>
      <T x={30.39} y={91.77} e={E.med13}>{dataDoc(c.data)}</T>
      <T x={30.39} y={114.54} e={E.light12}>Exmo (s)Sr(s):</T>
      <T x={118.08} y={114.54} e={E.cliente12}>{cliente?.nome || ''}</T>
      {logoCliente && <image href={logoCliente} x={30.9} y={116.4} width={83.4} height={32.2} preserveAspectRatio="xMinYMid meet" />}
      {cliente?.cidade && <T x={30.39} y={logoCliente ? 158.73 : 130} e={E.light10}>{cliente.cidade}</T>}
      {contactos.map((t, i) => <T key={i} x={550.5} y={104.05 + i * 13.4} e={E.book10} anchor="end">{t}</T>)}

      <T x={36.89} y={196.5} e={E.bold12}>Qt.</T>
      <T x={76.15} y={196.5} e={E.bold12}>Descrição</T>
      <T x={365.19} y={196.5} e={E.bold12} w={78.25}>Valor Unitário</T>
      <T x={481.89} y={196.5} e={E.bold12} w={60.98}>Valor Total</T>

      {itens.map((it, k) =>
        it.secao ? (
          <g key={k}>
            <rect x={COL.qtX0} y={it.y} width={COL.totX1 - COL.qtX0} height={SECAO.altura} fill="#e6e6e6" />
            <line x1={COL.qtX0} x2={COL.totX1} y1={it.y} y2={it.y} stroke={AMARELO} strokeWidth={0.6} />
            <line x1={COL.qtX0} x2={COL.totX1} y1={it.y + SECAO.altura} y2={it.y + SECAO.altura} stroke={AMARELO} strokeWidth={0.6} />
            <T x={40.4} y={it.y + SECAO.base} e={E.bold12}>{it.titulo.toUpperCase()}</T>
          </g>
        ) : (
          <g key={k}>
            {[[COL.qtX0, COL.qtX1], [COL.descX0, COL.descX1], [COL.unitX0, COL.unitX1], [COL.totX0, COL.totX1]].map(([a, b], j) => (
              <rect key={j} x={a} y={it.y} width={b - a} height={ITEM.altura} fill="#f2f2f2" stroke="#9d9d9c" strokeWidth={0.198} />
            ))}
            <T x={46.2} y={it.y + ITEM.base1} e={E.med12} anchor="middle">{it.qt}</T>
            <T x={76.15} y={it.y + ITEM.base1} e={E.book12}>{it.titulo}</T>
            {it.subtitulo && <T x={76.15} y={it.y + ITEM.base2} e={E.bold12}>{it.subtitulo}</T>}
            <T x={448.05} y={it.y + ITEM.base1} e={E.preco12} anchor="end">{it.unit}</T>
            <T x={556.04} y={it.y + ITEM.base1} e={E.preco12} anchor="end">{it.total}</T>
            {it.linhas.map((l, i) => <LinhaDesc key={i} l={l} y={it.y + ITEM.primeiraDesc + i * ITEM.passo} medir={medir} />)}
          </g>
        )
      )}

      {ultima ? (
        <>
          {c.notaMaterial && (
            <g transform={`translate(0 ${-tx.altura})`}>
              <T x={30.39} y={H - 36.6} e={E.nota} w={544.25}>Todos os Materiais serão impressos em vynil  com aplicação do respectivo protector material 100% dedicado a wrap. </T>
              <T x={30.39} y={H - 24.6} e={E.notaVermelha} w={187.03}>TAKSIM® STX570 + STX571 (60 Microns)</T>
              <line x1={30.4} x2={217.2} y1={H - 23.6} y2={H - 23.6} stroke="#ff0000" strokeWidth={0.5} />
              <T x={219.92} y={H - 24.6} e={E.notaBook} w={80.9}>- Não Certiﬁcado</T>
              <T x={30.39} y={H - 12.6} e={E.nota} w={454.95}>(A marca garante vida útil  até 2 anos se usado e conservado dentro dos padrões recomendados)</T>
            </g>
          )}
          {tx.cheio.map((l, i) => {
            const y = H - tx.altura + 10 + i * 12
            return i < tx.cheio.length - 1
              ? <T key={`c${i}`} x={30.39} y={y} e={E.notaJust} ws={justificada(l, LARGURA_DESC, medir)}>{l.trim()}</T>
              : <T key={`c${i}`} x={30.39} y={y} e={E.notaJust}>{l}</T>
          })}
          {!original && (
            <>
              <line x1={31.4} x2={564.2} y1={H} y2={H} stroke={AMARELO} strokeWidth={0.66} />
              {bloco.linhas.map((_, i) => {
                const y = BLOCO.ultimaLinha - BLOCO.passo * (n - 1 - i)
                return (
                  <g key={i}>
                    {CAIXAS.map(([a, b], j) => <rect key={j} x={a} y={y} width={b - a} height={BLOCO.alturaLinha} fill="#e6e6e6" />)}
                    {CAIXAS.map(([a, b], j) => <g key={`l${j}`} stroke={AMARELO} strokeWidth={0.45}><line x1={a} x2={b} y1={y} y2={y} /><line x1={a} x2={b} y1={y + BLOCO.alturaLinha} y2={y + BLOCO.alturaLinha} /></g>)}
                  </g>
                )
              })}
              <image href="/img/cotacao-barra-total.jpg" x={0} y={770.887} width={A4.w} height={45.808} preserveAspectRatio="none" />
            </>
          )}
          {comMaterial(c) && (
            <>
              <T x={43.49} y={H + 12.68} e={E.garantia} w={525.3}>** As garantias sobre a duração e qualidade do material serão dadas com base nos certiﬁcados, a Puzzle Stickers</T>
              <T x={42.68} y={H + 24.68} e={E.garantia} w={288.1}>não oferece nenhuma garantia para materias não certiﬁcados.</T>
            </>
          )}
          {terms.map((l, i) => {
            const cheia = padrao ? i === 0 || i === 2 : i < terms.length - 1
            return cheia
              ? <T key={i} x={32.36} y={H + 47.24 + i * 12} e={E.notaJust} ws={justificada(l, padrao ? NOTA_LARGURAS[i] : NOTA_LARGURA, medir)}>{l.trim()}</T>
              : <T key={i} x={32.36} y={H + 47.24 + i * 12} e={padrao ? E.nota : E.notaJust} w={padrao ? NOTA_LARGURAS[i] : undefined}>{l}</T>
          })}
          {bloco.linhas.map((l, i) => {
            const y = BLOCO.ultimaLinha - BLOCO.passo * (n - 1 - i) + 18.69
            const ultimaLinha = i === n - 1
            return (
              <g key={i}>
                <T x={443.44} y={y} e={ultimaLinha ? E.med12 : E.book12} anchor="end">{l.rotulo}</T>
                <T x={556.03} y={y} e={{ ...(ultimaLinha ? E.preco12 : E.precoBook12), cor: l.vermelho ? '#ff0000' : undefined }} anchor="end">{l.valor}</T>
              </g>
            )
          })}
          <T x={440.44} y={799.31} e={E.bold13} anchor="end" w={44.27}>{bloco.barra.rotulo}</T>
          <T x={556.03} y={799.31} e={E.precoBold13} anchor="end">{bloco.barra.valor}</T>
        </>
      ) : (
        <>
          <line x1={31.4} x2={564.2} y1={812.77} y2={812.77} stroke={AMARELO} strokeWidth={0.66} />
          <T x={564.2} y={804} e={E.notaBook} anchor="end">{`continua na página ${pagina + 1} →`}</T>
        </>
      )}
    </svg>
  )
}

export async function carregarFontes() {
  const pesos: [number, boolean][] = [[300, false], [300, true], [400, false], [400, true], [500, false], [500, true], [700, false], [700, true]]
  await Promise.all(pesos.map(([p, i]) => document.fonts.load(`${i ? 'italic ' : ''}${p} 12px "${F}"`)))
}

export async function logoDoCliente(cliente?: Cliente) {
  if (!cliente?.logoId) return undefined
  const f = await db.ficheiros.get(cliente.logoId)
  return f ? URL.createObjectURL(f.blob) : undefined
}
