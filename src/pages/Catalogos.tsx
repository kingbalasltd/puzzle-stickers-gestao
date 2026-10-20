import { Page } from '../App'
import { Icon, useToast } from '../ui'

// The company's catalogues, ready to send in a couple of taps. The PDFs ship with the app
// (public/catalogos), so the link works for any client and the file is the same on every device.
const CATALOGOS = [
  { id: 'criacao-de-imagem-2026', nome: 'Criação de Imagem', ano: 2026, paginas: 21, mb: 4.7, deitado: true },
  { id: 'sticker-kits-2025', nome: 'Sticker Kits', ano: 2025, paginas: 10, mb: 5.7 },
  { id: 'producao-2020', nome: 'Produção', ano: 2020, paginas: 10, mb: 3.1, antigo: true }
]

const telemovel = () => /iPhone|iPad|Android/i.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

export default function Catalogos() {
  const toast = useToast()
  const link = (id: string) => `${location.origin}/catalogos/${id}.pdf`
  const nomeFicheiro = (c: (typeof CATALOGOS)[number]) => `Catálogo ${c.nome} · Puzzle Stickers ${c.ano}.pdf`

  // The PDF itself through the share sheet (WhatsApp, email…); where that is not possible, it downloads.
  async function partilhar(c: (typeof CATALOGOS)[number]) {
    toast('A preparar o PDF…')
    const blob = await (await fetch(`/catalogos/${c.id}.pdf`)).blob()
    const ficheiro = new File([blob], nomeFicheiro(c), { type: 'application/pdf' })
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
    if (nav.canShare?.({ files: [ficheiro] })) {
      await nav.share({ files: [ficheiro], title: `Catálogo ${c.nome}`, text: `Catálogo ${c.nome} · Puzzle Stickers` }).catch(() => {})
      return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = nomeFicheiro(c)
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
    toast('PDF descarregado')
  }
  // Or just the link: WhatsApp opens and the user picks the contact.
  const whatsapp = (c: (typeof CATALOGOS)[number]) => {
    const texto = encodeURIComponent(`Olá! Segue o nosso catálogo de ${c.nome}: ${link(c.id)}`)
    window.location.href = telemovel() ? `https://wa.me/?text=${texto}` : `whatsapp://send?text=${texto}`
  }
  const copiar = async (c: (typeof CATALOGOS)[number]) => {
    try { await navigator.clipboard.writeText(link(c.id)); toast('Link copiado') } catch { toast(link(c.id)) }
  }

  return (
    <Page title="Catálogos" sub="Os catálogos da Puzzle Stickers, prontos a enviar">
      <div className="catalogos">
        {CATALOGOS.map((c) => (
          <div key={c.id} className={`card catalogo ${c.antigo ? 'antigo' : ''}`}>
            <a className={`capa ${c.deitado ? 'deitado' : ''}`} href={`/catalogos/${c.id}.pdf`} target="_blank" rel="noreferrer"><img src={`/catalogos/${c.id}.jpg`} alt={`Capa do catálogo ${c.nome}`} loading="lazy" /></a>
            <div className="info">
              <b>{c.nome} {c.antigo && <span className="badge">antigo</span>}</b>
              <span>{c.ano} · {c.paginas} páginas · {c.mb.toLocaleString('pt-PT')} MB</span>
            </div>
            <div className="acoes">
              <button className="btn pri" onClick={() => partilhar(c)}><Icon n="whatsapp" /> Partilhar PDF</button>
              <button className="btn" onClick={() => whatsapp(c)}><Icon n="whatsapp" /> Enviar link</button>
              <a className="btn" href={`/catalogos/${c.id}.pdf`} target="_blank" rel="noreferrer"><Icon n="olho" /> Ver</a>
              <button className="btn icon" onClick={() => copiar(c)} aria-label="Copiar link"><Icon n="copiar" /></button>
            </div>
          </div>
        ))}
      </div>
    </Page>
  )
}
