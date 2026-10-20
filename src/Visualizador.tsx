import { useEffect, useRef, useState, type ReactNode } from 'react'
import { db, type Ficheiro } from './db'
import { carregarPdfjs } from './leitura'
import { tamanho } from './format'
import { Icon, useVer, VerCtx } from './ui'

// In-app viewer: iPhone Safari blocks window.open after an await and shows
// blob PDFs badly, so PDFs are drawn page by page with pdf.js.
export { useVer }

export function VisualizadorHost({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null)
  return (
    <VerCtx.Provider value={setId}>
      {children}
      {id && <Visualizador id={id} onClose={() => setId(null)} />}
    </VerCtx.Provider>
  )
}

function Visualizador({ id, onClose }: { id: string; onClose: () => void }) {
  const [f, setF] = useState<Ficheiro | null | undefined>()
  const [url, setUrl] = useState<string>()
  const [erro, setErro] = useState('')
  const [paginas, setPaginas] = useState(0)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    db.ficheiros.get(id).then((x) => setF(x || null))
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [id, onClose])

  useEffect(() => {
    if (!f) return
    const u = URL.createObjectURL(f.blob)
    setUrl(u)
    let cancel = false
    if (f.mime === 'application/pdf') {
      ;(async () => {
        try {
          const lib = await carregarPdfjs()
          const doc = await lib.getDocument({ data: new Uint8Array(await f.blob.arrayBuffer()) }).promise
          if (cancel) return
          setPaginas(doc.numPages)
          const host = caixa.current!
          host.innerHTML = ''
          const largura = Math.min(host.clientWidth || 800, 900)
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i)
            const base = page.getViewport({ scale: 1 })
            const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
            const vp = page.getViewport({ scale: (largura / base.width) * dpr })
            const c = document.createElement('canvas')
            c.width = vp.width
            c.height = vp.height
            c.style.width = `${largura}px`
            c.className = 'ver-pagina'
            host.appendChild(c)
            await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise
            if (cancel) return
          }
        } catch {
          setErro('Não foi possível mostrar este PDF aqui. Use "Descarregar".')
        }
      })()
    }
    return () => { cancel = true; URL.revokeObjectURL(u) }
  }, [f])

  const partilhar = async () => {
    if (!f) return
    const file = new File([f.blob], f.nome, { type: f.mime })
    const nav = navigator as any
    if (nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title: f.nome }) } catch { /* cancelled */ }
    } else descarregar()
  }
  const descarregar = () => {
    if (!url || !f) return
    const a = document.createElement('a')
    a.href = url
    a.download = f.nome
    a.click()
  }

  return (
    <div className="ver" role="dialog" aria-modal>
      <div className="ver-h">
        <button className="btn ghost icon" onClick={onClose} aria-label="Fechar"><Icon n="x" /></button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <b className="ellipsis" style={{ display: 'block' }}>{f?.nome || '…'}</b>
          <span className="tiny muted">{f ? `${tamanho(f.tamanho)}${paginas ? ` · ${paginas} página${paginas > 1 ? 's' : ''}` : ''}` : ''}</span>
        </div>
        <button className="btn sm" onClick={partilhar}><Icon n="upload" /> <span className="hide-m">Partilhar</span></button>
        <button className="btn sm" onClick={descarregar}><Icon n="download" /> <span className="hide-m">Descarregar</span></button>
      </div>
      <div className="ver-b">
        {f === null && <div className="empty"><b>Ficheiro não encontrado</b></div>}
        {erro && <div className="empty"><b>{erro}</b></div>}
        {f && f.mime.startsWith('image/') && url && <img src={url} alt={f.nome} className="ver-pagina" />}
        {f && f.mime !== 'application/pdf' && !f.mime.startsWith('image/') && <div className="empty"><b>Pré-visualização não disponível</b><div className="small">Use “Descarregar”.</div></div>}
        <div ref={caixa} className="ver-pdf" />
      </div>
    </div>
  )
}

// First page of a PDF (or the image) as a small preview card.
export function Miniatura({ id, alto = 150 }: { id: string; alto?: number }) {
  const ver = useVer()
  const ref = useRef<HTMLCanvasElement>(null)
  const [f, setF] = useState<Ficheiro>()
  const [img, setImg] = useState<string>()
  useEffect(() => {
    let cancel = false
    db.ficheiros.get(id).then(async (x) => {
      if (!x || cancel) return
      setF(x)
      if (x.mime.startsWith('image/')) return setImg(URL.createObjectURL(x.blob))
      if (x.mime !== 'application/pdf') return
      try {
        const lib = await carregarPdfjs()
        const doc = await lib.getDocument({ data: new Uint8Array(await x.blob.arrayBuffer()) }).promise
        const page = await doc.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const vp = page.getViewport({ scale: (alto * 2) / base.height })
        const c = ref.current
        if (!c || cancel) return
        c.width = vp.width
        c.height = vp.height
        await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise
      } catch { /* leave blank */ }
    })
    return () => { cancel = true }
  }, [id, alto])
  return (
    <button type="button" className="mini" style={{ height: alto }} onClick={() => ver(id)} title={f?.nome}>
      {img ? <img src={img} alt="" /> : <canvas ref={ref} />}
      <span className="mini-n"><Icon n="olho" /> Ver</span>
    </button>
  )
}
