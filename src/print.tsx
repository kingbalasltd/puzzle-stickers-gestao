import { createRoot } from 'react-dom/client'
import { emitirRequisicao } from './pdfPartilha'
import { flushSync } from 'react-dom'
import type { Cotacao, Documento, Requisicao } from './db'
import { type ivaDoMes } from './calc'
import { dataLonga, dataMedia, mesNome, mt, num2 } from './format'
import type { Dados } from './state'
import { carregarFontes, logoDoCliente, medirCanvas, PaginaCotacao, paginasCotacao } from './cotacaoPdf'

// Renders a document into #print-root and opens the system print sheet
// (on iPhone/Mac: "Guardar em PDF" / Partilhar).
async function imprimir(node: React.ReactNode, titulo: string) {
  const host = document.getElementById('print-root')!
  host.innerHTML = ''
  const div = document.createElement('div')
  host.appendChild(div)
  const root = createRoot(div)
  flushSync(() => root.render(<>{node}</>))
  await Promise.all(
    Array.from(host.querySelectorAll('img')).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r })))
  )
  const old = document.title
  document.title = titulo
  const fim = () => {
    document.title = old
    root.unmount()
    host.innerHTML = ''
    window.removeEventListener('afterprint', fim)
  }
  window.addEventListener('afterprint', fim)
  setTimeout(() => window.print(), 250)
}


const CSS = `
.pr{width:210mm;min-height:297mm;padding:14mm 14mm 12mm;font-family:Montserrat,Arial,sans-serif;color:#111;background:#fff;position:relative;overflow:hidden;font-size:9.5pt;line-height:1.35;page-break-after:always}
.pr:last-child{page-break-after:auto}
.pr .logo{display:block;filter:none}
.pr table{border-collapse:collapse;width:100%}
.pr .num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.pr .b{font-weight:700}
.pr .muted{color:#555}
/* lista */
.li-h{display:flex;justify-content:space-between;align-items:flex-start}
.li-co{width:92mm;text-align:center}
.li-co .bar{height:1.2mm;background:linear-gradient(90deg,#c9c9c9,#e6e6e6);margin-bottom:5mm}
.li-co .logo{width:66mm;margin:0 auto 3mm}
.li-co .bar2{height:.9mm;background:linear-gradient(90deg,#f6a21a,#ffe600);margin-bottom:2mm}
.li-co .nm{font-weight:800;font-size:8.5pt}
.li-co .ln{font-size:7.6pt;color:#222}
.li-r{width:72mm;text-align:right}
.li-r h1{font-size:13pt;margin:0 0 3mm;font-weight:800;letter-spacing:.02em}
.li-r .sup{max-width:52mm;max-height:16mm;object-fit:contain;margin-left:auto;display:block}
.li-r .dt{margin-top:4mm;font-size:8pt}
.li-r .dt b{display:block;font-size:10pt}
.li-mid{display:flex;justify-content:space-between;align-items:flex-start;margin-top:6mm}
.li-job{font-size:8.5pt;margin-top:2mm}
.li-job b{display:block;margin-top:1mm}
.li-boxes{width:72mm}
.li-box{border:1px solid #333;text-align:center;padding:1.6mm 2mm;margin-bottom:3.5mm;font-size:8.2pt}
.li-box b{font-size:10pt;display:block}
.li-box.t{border-width:2px}
.li-tbl{margin-top:5mm}
.li-tbl th{background:#f8cbad;border:1px solid #888;font-size:8.3pt;text-align:left;padding:1.2mm 1.6mm}
.li-tbl td{border:1px solid #888;padding:.9mm 1.6mm;font-size:8.3pt;height:5.2mm}
.li-sum td{border:0;padding:1mm 1.6mm}
.li-y{background:#ffd966!important;border:1px solid #888!important;font-weight:800}
.li-g{background:#a9d08e!important}
/* cotação */
.ct{padding:0}
.ct .bgtop{position:absolute;left:0;right:0;top:0;height:70mm;background:linear-gradient(180deg,#ffd400 0%,#ffe766 35%,rgba(255,255,255,0) 100%)}
.ct .bgbot{position:absolute;left:0;right:0;bottom:0;height:80mm;background:linear-gradient(0deg,#fff6b3 0%,rgba(255,255,255,0) 100%)}
.ct .pat{position:absolute;inset:0;background-size:100% auto;background-repeat:no-repeat;mix-blend-mode:multiply;opacity:.55}
.ct .pat.t{top:0;bottom:auto;height:70mm;-webkit-mask-image:linear-gradient(180deg,#000,transparent);mask-image:linear-gradient(180deg,#000,transparent)}
.ct .pat.b{top:auto;bottom:0;height:80mm;background-position:bottom;-webkit-mask-image:linear-gradient(0deg,#000 10%,transparent);mask-image:linear-gradient(0deg,#000 10%,transparent)}
.ct .in{position:relative;padding:12mm 12mm 10mm;min-height:297mm;display:flex;flex-direction:column}
.ct-h{display:flex;justify-content:space-between}
.ct-h h1{margin:0;font-size:14pt;font-weight:600}
.ct-h .it{font-style:italic;font-size:7.6pt;color:#333}
.ct-h .dt{font-size:11pt;font-weight:700;margin:4mm 0 2mm}
.ct-h .to{font-size:9.5pt}
.ct-h .to b{display:block;font-size:10.5pt}
.ct-h .rt{text-align:right}
.ct-h .rt .logo{width:70mm;margin-left:auto;margin-bottom:3mm}
.ct-h .rt div{font-size:8.6pt;margin-top:.6mm}
.ct-line{height:.5mm;background:linear-gradient(90deg,#ffd400,#ffe766,#ffd400);margin:5mm 0 3mm}
.ct-th{display:grid;grid-template-columns:14mm 1fr 34mm 34mm;gap:1.5mm}
.ct-th div{background:#e8e8e8;padding:2mm 2.5mm;font-weight:700;font-size:9pt}
.ct-th div.c{text-align:center}
.ct-it{margin-top:3mm}
.ct-it .r{display:grid;grid-template-columns:14mm 1fr 34mm 34mm;gap:1.5mm}
.ct-it .r div{background:#f1f1f1;border:1px solid #ddd;padding:2mm 2.5mm;font-size:9.2pt}
.ct-it .r .c{text-align:center;font-weight:700}
.ct-it .r .num{font-weight:700}
.ct-it .d{font-size:7.6pt;font-style:italic;color:#333;margin:1.5mm 0 4mm;white-space:pre-line}
.ct-it .d b{font-size:8.2pt}
.ct-ft{margin-top:auto}
.ct-ft .g{font-size:7.6pt;font-style:italic;border-top:.4mm solid #ffd400;padding-top:2mm;margin-bottom:3mm}
.ct-ft .row{display:flex;gap:6mm;align-items:flex-start}
.ct-ft .nt{flex:1;font-size:7.6pt;font-style:italic;color:#444;white-space:pre-line}
.ct-ft .tt{width:82mm}
.ct-ft .tt .l{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm;margin-bottom:1.5mm}
.ct-ft .tt .l div{background:#ececec;padding:2mm 2.5mm;font-weight:700;text-align:center;font-size:9.3pt}
.ct-ft .tt .l div.num{text-align:right}
.ct-ft .tot{display:flex;justify-content:flex-end;gap:8mm;padding:2.5mm 3mm;margin-top:2mm;background:linear-gradient(90deg,rgba(255,212,0,0),#ffd400 45%);font-weight:800;font-size:11pt}
/* iva */
.iv-h{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:.6mm solid #ffc406;padding-bottom:4mm}
.iv-h .logo{width:58mm}
.iv-h h1{margin:0;font-size:14pt}
.iv-k{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:6mm 0}
.iv-k div{border:1px solid #ccc;border-radius:2mm;padding:3mm}
.iv-k div.h{background:#ffc406;border-color:#ffc406}
.iv-k small{display:block;font-size:7.5pt;text-transform:uppercase;letter-spacing:.06em;color:#444;font-weight:700}
.iv-k b{font-size:13pt}
.iv-t{margin-top:4mm}
.iv-t h2{font-size:10pt;margin:5mm 0 2mm}
.iv-t th{text-align:left;font-size:7.6pt;text-transform:uppercase;border-bottom:1px solid #999;padding:1.4mm}
.iv-t td{border-bottom:1px solid #e3e3e3;padding:1.4mm;font-size:8.3pt}
.iv-t tfoot td{font-weight:800;border-top:1px solid #999;border-bottom:0}
.iv-f{margin-top:8mm;font-size:7.5pt;color:#555}
`


// The supplier order: the new "Requisição de prints" PDF, ready to share (16 Oct).
export const imprimirLista = (r: Requisicao, d: Dados) => emitirRequisicao(r, d)

export async function imprimirCotacao(c: Cotacao, d: Dados) {
  const cli = d.cliente(c.clienteId)
  await carregarFontes()
  const logo = await logoDoCliente(cli)
  // SVG <image> loads on its own; decode everything first so the print never comes out without the artwork.
  await Promise.all(['/img/cotacao-fundo.jpg', '/img/cotacao-fundo-livre.jpg', '/img/cotacao-barra-total.jpg', '/img/logo.svg', logo].filter(Boolean).map((src) => {
    const im = new Image()
    im.src = src!
    return im.decode().catch(() => {})
  }))
  const paginas = paginasCotacao(c, medirCanvas, d.empresa.urgenciaPct)
  await imprimir(
    <>
      {paginas.map((p, i) => (
        <div key={i} className="pr-svg">
          <PaginaCotacao c={p.c} cliente={cli} empresa={d.empresa} itens={p.itens} ultima={p.ultima} pagina={i + 1} total={paginas.length} logoCliente={logo} medir={medirCanvas} />
        </div>
      ))}
    </>,
    // Named like his own files (Puzzle_Stickers_Cotação_<Cliente>_<Assunto>): client + subject, never the app's code.
    ['Puzzle_Stickers_Cotação', cli?.nome, c.itens[0]?.subtitulo || c.itens[0]?.titulo].filter(Boolean).join('_').replace(/[\s/\:]+/g, '_')
  )
}

type Iva = ReturnType<typeof ivaDoMes>

export async function imprimirIva(mes: string, r: Iva, d: Dados) {
  const tab = (xs: Documento[]) => (
    <table>
      <thead><tr><th>Data</th><th>Tipo</th><th>Número</th><th>Entidade</th><th>NUIT</th><th className="num">Base</th><th className="num">IVA</th><th className="num">Total</th></tr></thead>
      <tbody>
        {xs.map((x) => (
          <tr key={x.id}><td>{dataMedia(x.data)}</td><td>{x.tipo}</td><td>{x.numero}</td><td>{x.entidade}</td><td>{x.nuit || ''}</td><td className="num">{mt(x.base)}</td><td className="num">{mt(x.tipo === 'nota-credito' ? -x.iva : x.iva)}</td><td className="num">{mt(x.total)}</td></tr>
        ))}
      </tbody>
      <tfoot><tr><td colSpan={5}>Total</td><td className="num">{mt(xs.reduce((s, x) => s + (x.tipo === 'nota-credito' ? -1 : 1) * x.base, 0))}</td><td className="num">{mt(xs.reduce((s, x) => s + (x.tipo === 'nota-credito' ? -1 : 1) * x.iva, 0))}</td><td /></tr></tfoot>
    </table>
  )
  await imprimir(
    <div className="pr">
      <style>{CSS}</style>
      <div className="iv-h">
        <div>
          <img className="logo" src="/img/logo.svg" alt="" />
          <div style={{ fontSize: '8pt', marginTop: '2mm' }}>{d.empresa.razaoSocial} · NUIT {d.empresa.nuit}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h1>Relação do IVA</h1>
          <div className="b">{mesNome(mes)}</div>
          <div className="muted" style={{ fontSize: '8pt' }}>Regime normal · taxa {d.empresa.taxaIva}%</div>
        </div>
      </div>
      <div className="iv-k">
        <div><small>IVA liquidado</small><b>{mt(r.liquidado)}</b></div>
        <div><small>IVA dedutível</small><b>{mt(r.dedutivel)}</b></div>
        <div className="h"><small>{r.credito > 0 ? 'Crédito a reportar' : 'IVA a pagar'}</small><b>{mt(r.credito || r.apagar)}</b></div>
      </div>
      <div className="iv-t">
        <h2>Faturas emitidas (vendas) — {r.emitidos.length}</h2>
        {tab(r.emitidos)}
        <h2>Faturas recebidas (compras) — {r.recebidos.length}</h2>
        {tab(r.recebidos)}
      </div>
      <div className="iv-f">Resumo de apoio preparado no sistema de gestão da Puzzle Stickers a partir dos documentos carregados. Não substitui a declaração oficial nem o programa de faturação certificado. Gerado a {dataLonga(new Date().toISOString())}.</div>
    </div>,
    `Relacao IVA ${mes} Puzzle Stickers`
  )
}

export function exportarIvaExcel(mes: string, r: Iva, d: Dados) {
  const esc = (s: string | number) => {
    const v = typeof s === 'number' ? num2(s) : s
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }
  const linhas: (string | number)[][] = [
    [`Relação do IVA — ${mesNome(mes)}`],
    [d.empresa.razaoSocial, `NUIT ${d.empresa.nuit}`],
    [],
    ['IVA liquidado', r.liquidado],
    ['IVA dedutível', r.dedutivel],
    [r.credito > 0 ? 'Crédito a reportar' : 'IVA a pagar', r.credito || r.apagar],
    [],
    ['Direção', 'Data', 'Tipo', 'Número', 'Entidade', 'NUIT', 'Base', 'IVA', 'Total']
  ]
  for (const x of [...r.emitidos, ...r.recebidos]) {
    const s = x.tipo === 'nota-credito' ? -1 : 1
    linhas.push([x.direcao === 'emitido' ? 'Emitido' : 'Recebido', x.data, x.tipo, x.numero, x.entidade, x.nuit || '', s * x.base, s * x.iva, x.total])
  }
  const csv = '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `Relacao_IVA_${mes}_Puzzle_Stickers.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
