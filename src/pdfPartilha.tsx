import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { Requisicao } from './db'
import type { Dados } from './state'
import { CSS_REQUISICAO, linhasComMaterial, PaginaRequisicao } from './requisicaoPdf'
import { Icon, Modal } from './ui'

// Documents the app issues come out as real PDF files (Momad, 16 Oct: "sempre em PDF"),
// made on the device so it works offline too: the page is drawn off-screen and turned
// into an A4 PDF. Sending happens from a "PDF pronto" window, because phones only let a
// page open the share sheet straight from a tap.

export async function renderizarPdf(node: ReactNode, css: string): Promise<Blob> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')])
  const estilo = document.createElement('style')
  estilo.textContent = css
  document.head.appendChild(estilo)
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-12000px;top:0;width:210mm;background:#fff'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(<>{node}</>))
    await Promise.all([300, 400, 500, 700].map((w) => document.fonts.load(`${w} 10pt "Gotham PS"`).catch(() => [])))
    await document.fonts.ready
    // decode() waits for a painted frame, which never comes while the app is in the background.
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))
    await Promise.all(Array.from(host.querySelectorAll('img')).map((i) => Promise.race([i.decode().catch(() => {}), espera(2500)])))
    const el = host.firstElementChild as HTMLElement
    const canvas = await html2canvas(el, { scale: 2.5, backgroundColor: '#ffffff', logging: false })
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    const alturaPagina = Math.round(canvas.width * (297 / 210))
    for (let y = 0, n = 0; y < canvas.height - 4; y += alturaPagina, n++) {
      const c = document.createElement('canvas')
      c.width = canvas.width
      c.height = alturaPagina
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(canvas, 0, y, canvas.width, Math.min(alturaPagina, canvas.height - y), 0, 0, canvas.width, Math.min(alturaPagina, canvas.height - y))
      if (n) pdf.addPage()
      pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297)
    }
    return pdf.output('blob')
  } finally {
    root.unmount()
    host.remove()
    estilo.remove()
  }
}

export type PdfPronto = { blob: Blob; nome: string; texto: string; telefone?: string; destino?: string }

let mostrar: ((p: PdfPronto) => void) | null = null

// Mounted once in the app; any screen can hand it a finished PDF.
export function PdfHost() {
  const [p, setP] = useState<PdfPronto | null>(null)
  useEffect(() => {
    mostrar = setP
    return () => { mostrar = null }
  }, [])
  return p ? <PdfProntoModal p={p} onClose={() => setP(null)} /> : null
}

const soDigitos = (t?: string) => (t || '').replace(/\D/g, '')
const telemovel = () => /iPhone|iPad|Android/i.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

function PdfProntoModal({ p, onClose }: { p: PdfPronto; onClose: () => void }) {
  // One file and one link for the whole life of the window (a new link per render would die on the next one).
  const ficheiro = useMemo(() => new File([p.blob], p.nome, { type: 'application/pdf' }), [p])
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(p.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [p])
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  const podePartilhar = !!nav.canShare?.({ files: [ficheiro] })
  const tel = soDigitos(p.telefone)
  const descarregar = () => {
    const a = document.createElement('a')
    a.href = url
    a.download = p.nome
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  // The WhatsApp app (Mac/PC: the installed app; phone: the app via wa.me), straight into the supplier's chat.
  const abrirWhatsApp = () => {
    const texto = encodeURIComponent(p.texto)
    window.location.href = telemovel() ? `https://wa.me/${tel}?text=${texto}` : `whatsapp://send?phone=${tel}&text=${texto}`
  }
  return (
    <Modal title="PDF pronto" onClose={onClose} footer={<button className="btn" onClick={onClose}>Fechar</button>}>
      <div className="col" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="avatar" style={{ background: 'color-mix(in srgb, var(--y) 18%, transparent)', color: 'var(--y)' }}><Icon n="imprimir" /></div>
          <div className="main-t"><b style={{ wordBreak: 'break-all' }}>{p.nome}</b><span>{Math.max(1, Math.round(p.blob.size / 1024))} KB</span></div>
        </div>
        {podePartilhar && (
          <button className="btn pri block" onClick={() => nav.share({ files: [ficheiro], title: p.nome, text: p.texto }).catch(() => {})}>
            <Icon n="whatsapp" /> Partilhar (WhatsApp, email…)
          </button>
        )}
        {!podePartilhar && tel && (
          <button className="btn pri block" onClick={() => { descarregar(); abrirWhatsApp() }}>
            <Icon n="whatsapp" /> Descarregar e abrir o WhatsApp{p.destino ? ` da ${p.destino}` : ''}
          </button>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} onClick={descarregar}><Icon n="download" /> Descarregar</button>
          <a className="btn" style={{ flex: 1 }} href={url} target="_blank" rel="noreferrer"><Icon n="olho" /> Ver</a>
        </div>
        {!podePartilhar && tel && <div className="tiny muted">O WhatsApp abre na conversa com {p.destino || 'o fornecedor'}, com a mensagem escrita. Só tem de anexar o PDF que ficou nas Transferências.</div>}
      </div>
    </Modal>
  )
}

const nomePdf = (r: Pick<Requisicao, 'numero' | 'nomeTrabalho'>) => `${r.numero.replace(/\//g, '-')}_${(r.nomeTrabalho || 'Requisicao').replace(/[\s/\\:]+/g, '_')}.pdf`

// "Requisição de prints" as a PDF, ready to send to the supplier.
export async function emitirRequisicao(r: Requisicao, d: Dados) {
  const fornecedor = d.fornecedor(r.fornecedorId)
  const blob = await renderizarPdf(
    <PaginaRequisicao numero={r.numero} data={r.data} nomeTrabalho={r.nomeTrabalho} fornecedor={fornecedor} empresa={d.empresa} linhas={linhasComMaterial(r)} notas={r.notas} />,
    CSS_REQUISICAO
  )
  const prints = r.linhas.filter((l) => l.qt > 0).length
  mostrar?.({
    blob,
    nome: nomePdf(r),
    texto: `Bom dia! Segue a requisição de prints ${r.numero} — ${r.nomeTrabalho.replace(/_/g, ' ')} (${prints} print${prints === 1 ? '' : 's'}). Aguardo a pró-forma. Obrigado — Puzzle Stickers`,
    telefone: fornecedor?.telefone,
    destino: fornecedor?.nome?.split(' ')[0]
  })
}
