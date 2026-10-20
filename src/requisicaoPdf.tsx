import type { Empresa, Fornecedor, LinhaImpressao, MaterialFornecedor, Requisicao } from './db'
import { m2Linha, r2 } from './calc'
import { dataDoc, mt, num2 } from './format'

// The supplier order (requisição) as a document, redesigned 16 Oct: every print line
// carries its own material, priced from the Académica 2026 price list (per m², sem IVA).

export type LinhaMaterial = LinhaImpressao

// Orders made before 16 Oct keep one material for the whole list: give it to each print.
export const linhasComMaterial = (r: Pick<Requisicao, 'linhas' | 'materialImpressao' | 'precoImpressaoM2' | 'materialLaminacao' | 'precoLaminacaoM2'>): LinhaMaterial[] =>
  r.linhas.map((l) =>
    l.impressao !== undefined || l.laminacao !== undefined
      ? l
      : { ...l, impressao: nomeOficial(r.materialImpressao) || '', precoImpressao: r.materialImpressao ? r.precoImpressaoM2 : 0, laminacao: nomeOficial(r.materialLaminacao) || '', precoLaminacao: r.materialLaminacao ? r.precoLaminacaoM2 : 0 }
  )

// Académica price list 2026, with the names of the price list (Momad, 16 Oct): per m², sem IVA.
// Laminations are lamination only and can go over any vinyl.
export const PRECARIO_ACADEMICA_2026: MaterialFornecedor[] = [
  { nome: 'Impressão com material da Puzzle Stickers', tipo: 'impressao', precoM2: 800, unidade: 'm²', descricao: 'Só a impressão — o material é nosso' },
  { nome: 'Vinil comum', tipo: 'impressao', precoM2: 950, unidade: 'm²', descricao: 'Material comum, sem laminação' },
  { nome: 'Vinil comum laminado', tipo: 'impressao', precoM2: 1400, unidade: 'm²', descricao: 'Material comum, já com laminação' },
  { nome: 'Vinil de wrap', tipo: 'impressao', precoM2: 1150, unidade: 'm²', descricao: 'Com laminação de wrap = Bundle Wrap (2.000/m²)' },
  { nome: 'Vinil branco premium', tipo: 'impressao', precoM2: 1050, unidade: 'm²', descricao: 'Vinil premium bubble free' },
  { nome: 'Vinil transparente premium', tipo: 'impressao', precoM2: 950, unidade: 'm²' },
  { nome: 'ContraVision', tipo: 'impressao', precoM2: 1150, unidade: 'm²' },
  { nome: 'Banner', tipo: 'impressao', precoM2: 950, unidade: 'm²' },
  { nome: 'Laminação de wrap', tipo: 'laminacao', precoM2: 850, unidade: 'm²', descricao: 'Só a laminação' },
  { nome: 'Laminação transparente premium', tipo: 'laminacao', precoM2: 450, unidade: 'm²', descricao: 'Só a laminação — sobre qualquer vinil' }
]

// His old Excel lists say "Taksim Wrap" and "Laminação (PREMIUM)": read them as the price-list names.
export function nomeOficial(nome?: string) {
  if (!nome) return nome
  if (/taksim|vinil de wrap|vynil de wrap/i.test(nome)) return 'Vinil de wrap'
  if (/lamina/i.test(nome) && /transparente/i.test(nome)) return 'Laminação transparente premium'
  if (/lamina/i.test(nome) && /(premium|wrap)/i.test(nome)) return 'Laminação de wrap'
  return nome
}

// Momad: "vinil de wrap + laminação de wrap" ordered together is the "Bundle Wrap".
export const nomeMaterial = (l: Pick<LinhaMaterial, 'impressao' | 'laminacao'>) =>
  /vinil de wrap/i.test(l.impressao || '') && /lamina[cç][aã]o de wrap/i.test(l.laminacao || '') ? 'Bundle Wrap' : [l.impressao, l.laminacao].filter(Boolean).join(' + ') || '—'
export const precoM2 = (l: Pick<LinhaMaterial, 'precoImpressao' | 'precoLaminacao'>) => (l.precoImpressao || 0) + (l.precoLaminacao || 0)
export const valorLinha = (l: LinhaMaterial) => r2(m2Linha(l) * precoM2(l))

export function totaisLinhas(linhas: LinhaMaterial[], taxaIva: number) {
  const usadas = linhas.filter((l) => l.qt > 0 && l.largura > 0 && l.comprimento > 0)
  const porMaterial = new Map<string, { m2: number; valor: number; preco: number }>()
  for (const l of usadas) {
    const k = nomeMaterial(l)
    const x = porMaterial.get(k) || { m2: 0, valor: 0, preco: precoM2(l) }
    x.m2 += m2Linha(l)
    x.valor = r2(x.valor + valorLinha(l))
    porMaterial.set(k, x)
  }
  const subtotal = r2(usadas.reduce((s, l) => s + valorLinha(l), 0))
  const iva = r2(subtotal * (taxaIva / 100))
  return { usadas, porMaterial, m2: usadas.reduce((s, l) => s + m2Linha(l), 0), subtotal, iva, total: r2(subtotal + iva) }
}

const logoFornecedor = (f?: Pick<Fornecedor, 'nome'>) => (f && /acad[eé]mica/i.test(f.nome) ? '/img/academica.png' : undefined)

export function PaginaRequisicao({ numero, data, nomeTrabalho, fornecedor, empresa, linhas, notas }: { numero: string; data: string; nomeTrabalho: string; fornecedor?: Fornecedor; empresa: Empresa; linhas: LinhaMaterial[]; notas?: string }) {
  const t = totaisLinhas(linhas, empresa.taxaIva)
  return (
    <div className="rq">
      <div className="rq-top">
        <img className="rq-logo" src="/img/logo-doc.svg" alt="Puzzle Stickers" />
        <div className="rq-tit">
          <div className="rq-h">REQUISIÇÃO DE PRINTS</div>
          <div className="rq-num">{numero}</div>
          <div className="rq-data">{dataDoc(data)}</div>
        </div>
      </div>

      <div className="rq-info">
        {/* Momad: the supplier box is just the supplier's logo. */}
        <div className="rq-para">
          {logoFornecedor(fornecedor) ? <img src={logoFornecedor(fornecedor)} alt={fornecedor?.nome} /> : <b>{fornecedor?.nome || '—'}</b>}
        </div>
        <div>
          <span>Trabalho</span>
          <b className="rq-nome">{nomeTrabalho.replace(/_/g, ' ')}</b>
          <i>{t.usadas.length} print{t.usadas.length === 1 ? '' : 's'}</i>
        </div>
      </div>

      <table className="rq-t">
        <colgroup><col style={{ width: '7mm' }} /><col style={{ width: '64mm' }} /><col style={{ width: '33mm' }} /><col style={{ width: '8mm' }} /><col style={{ width: '21mm' }} /><col style={{ width: '10mm' }} /><col style={{ width: '20mm' }} /><col style={{ width: '21mm' }} /></colgroup>
        <thead>
          <tr><th>Nº</th><th>Ficheiro</th><th>Material</th><th className="r">Qt.</th><th className="r">L × C (m)</th><th className="r">m²</th><th className="r">Preço m²</th><th className="r">Valor</th></tr>
        </thead>
        <tbody>
          {t.usadas.map((l, i) => (
            <tr key={i}>
              <td className="n">{String(i + 1).padStart(2, '0')}</td>
              <td className="f">{l.ficheiro.replace(/_/g, '_​')}</td>
              <td className="m">
                {nomeMaterial(l) === 'Bundle Wrap' ? <><b>Bundle Wrap</b><small>Vinil de wrap + laminação de wrap</small></> : <><b>{l.impressao || l.laminacao || '—'}</b>{l.impressao && l.laminacao && <small>+ {l.laminacao.toLowerCase()}</small>}</>}
              </td>
              <td className="r">{l.qt}</td>
              <td className="r nw">{num2(l.largura)} × {num2(l.comprimento)}</td>
              <td className="r">{num2(m2Linha(l))}</td>
              <td className="r nw">{mt(precoM2(l))}</td>
              <td className="r nw b">{mt(valorLinha(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rq-fim">
        <div>{notas && <div className="rq-notas">{notas}</div>}</div>
        <div className="rq-tot">
          <div><span>Sub-total</span><b>{mt(t.subtotal)}</b></div>
          <div><span>IVA {empresa.taxaIva}%</span><b>{mt(t.iva)}</b></div>
          <div className="g"><span>TOTAL</span><b>{mt(t.total)}</b></div>
        </div>
      </div>

      <div className="rq-pe">
        <span>Preços por m², sem IVA, do preçário 2026 da {fornecedor?.nome || 'fornecedora'}.</span>
        <span>{empresa.nome} · {empresa.telefones} · {empresa.email}</span>
      </div>
    </div>
  )
}

// Print styles of the document (A4, Gotham, the yellow of his brand).
export const CSS_REQUISICAO = `
.rq{width:210mm;min-height:297mm;box-sizing:border-box;padding:13mm 13mm 11mm;background:#fff;color:#141414;font-family:'Gotham PS',Arial,sans-serif;font-size:8.6pt;position:relative;display:flex;flex-direction:column;page-break-after:always}
.rq:last-child{page-break-after:auto}
.rq b{font-weight:700}
.rq .r{text-align:right}.rq .nw{white-space:nowrap}
.rq-top{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:6mm;border-bottom:1.2mm solid #ffc406}
.rq-logo{width:62mm;filter:none}
.rq-tit{text-align:right}
.rq-h{font-weight:700;font-size:16.5pt;letter-spacing:.1em;line-height:1}
.rq-num{display:inline-block;margin-top:2.5mm;padding:1.2mm 3.2mm;border-radius:2mm;background:#ffc406;font-weight:700;font-size:10.5pt;letter-spacing:.02em}
.rq-data{margin-top:2mm;font-weight:500;font-size:9pt;color:#444}
.rq-info{display:grid;grid-template-columns:1fr 1.4fr;gap:4mm;margin:6mm 0 5mm}
.rq-info>div{background:#f4f4f4;border-radius:2.5mm;padding:3.5mm 4mm;display:flex;flex-direction:column;gap:1mm}
.rq-info span{font-size:7pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8a8a8a}
.rq-info b{font-size:10.5pt}
.rq-para{justify-content:center;align-items:flex-start}
.rq-para img{height:12mm;width:auto;max-width:100%;object-fit:contain}
.rq-info .rq-nome{font-size:9.5pt;line-height:1.25}
.rq-info i{font-style:normal;color:#555;font-weight:300}
.rq-t{width:100%;border-collapse:collapse;table-layout:fixed}
.rq-t th{background:#141414;color:#fff;font-weight:500;font-size:6.8pt;letter-spacing:.05em;text-transform:uppercase;padding:2.4mm 1.6mm;text-align:left;white-space:nowrap;overflow:hidden}
.rq-t th:first-child{border-radius:2mm 0 0 2mm}.rq-t th:last-child{border-radius:0 2mm 2mm 0}
.rq-t td{padding:2.6mm 1.6mm;border-bottom:.25mm solid #e6e6e6;vertical-align:top;font-size:8pt}
.rq-t tbody tr:nth-child(even) td{background:#fafafa}
.rq-t .n{color:#8a8a8a;font-weight:500}
.rq-t .f{font-weight:700;font-size:10pt;color:#000;overflow-wrap:anywhere;line-height:1.25;border-left:1mm solid #ffc406;padding-left:2.4mm}
.rq-t .m b{display:block;font-weight:400;color:#333;font-size:7.8pt}
.rq-t .m small{display:block;font-size:6.6pt;color:#8a8a8a;font-weight:300;margin-top:.6mm}
.rq-fim{display:grid;grid-template-columns:1.5fr 1fr;gap:6mm;margin-top:6mm;align-items:start}
.rq-sub{font-size:7pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8a8a8a;margin-bottom:2mm}
.rq-res table{width:100%;border-collapse:collapse}
.rq-res td{padding:1.8mm 0;border-bottom:.25mm solid #eee}
.rq-res td+td{padding-left:3mm;white-space:nowrap}
.rq-notas{margin-top:4mm;font-weight:300;color:#444;white-space:pre-wrap}
.rq-tot>div{display:flex;justify-content:space-between;padding:2.2mm 3.5mm;border-bottom:.25mm solid #eee}
.rq-tot span{color:#555}
.rq-tot .g{margin-top:1.5mm;background:#ffc406;border:0;border-radius:2mm;font-size:11pt}
.rq-tot .g span{color:#141414;font-weight:700}
.rq-pe{margin-top:auto;padding-top:6mm;display:flex;justify-content:space-between;gap:6mm;font-size:6.8pt;color:#8a8a8a;font-weight:300}
`
