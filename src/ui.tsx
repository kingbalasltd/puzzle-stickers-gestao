import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Ficheiro } from './db'
import { iniciais } from './format'

// ---------- Icons (24px stroke set) ----------
const P: Record<string, ReactNode> = {
  painel: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  quadro: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></>,
  lista: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  agenda: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2M11 17.5h2" /></>,
  clientes: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.7 2.8 2.4 3 5.2" /></>,
  fornecedores: <><path d="M3 7h11v10H3zM14 10h4l3 3.5V17h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></>,
  documentos: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  recibo: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  iva: <><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>,
  catalogo: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></>,
  equipa: <><circle cx="12" cy="7" r="3.5" /><path d="M5 21c.7-4 3.5-6.5 7-6.5s6.3 2.5 7 6.5" /><path d="M4.5 10.5a2.5 2.5 0 1 1 1.6-4.4M19.5 10.5a2.5 2.5 0 1 0-1.6-4.4" /></>,
  definicoes: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  cotacao: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M12 11v6M10 12.5c0-.8.9-1.5 2-1.5s2 .6 2 1.4c0 1.8-4 1-4 2.9 0 .9.9 1.5 2 1.5s2-.6 2-1.4" /></>,
  mais: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  down: <path d="m6 9 6 6 6-6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  alerta: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  dinheiro: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v.01M18 14.5v.01" /></>,
  carteira: <><path d="M20 7V5.5A1.5 1.5 0 0 0 18.5 4H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V6" /><path d="M16 14h.01" /></>,
  whatsapp: <><path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.6-2-1-1 .8c-.9-.4-1.7-1.2-2.1-2.1l.8-1-1-2z" /></>,
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  camera: <><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.4-2h6.6l1.4 2h1.8A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" /><circle cx="12" cy="13" r="3.6" /></>,
  imagem: <><rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
  pdf: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M8.5 16.5v-4h1.2a1.2 1.2 0 0 1 0 2.4H8.5M12.5 12.5v4h.8a1.6 1.6 0 0 0 1.6-1.6v-.8a1.6 1.6 0 0 0-1.6-1.6zM16.5 16.5v-4H18M16.5 14.5h1.2" /></>,
  imprimir: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></>,
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  lixo: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>,
  editar: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  seta: <path d="M5 12h14M13 6l6 6-6 6" />,
  sair: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  lua: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  nuvem: <path d="M17.5 19H8a5 5 0 1 1 .9-9.9A6 6 0 0 1 20 11a4 4 0 0 1-2.5 8z" />,
  raio: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  telefone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
  mail: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  local: <><path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  tendencia: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  caixa: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  bandeira: <><path d="M4 21V4M4 4h12l-2 4 2 4H4" /></>,
  cadeado: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  olho: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  copiar: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  nota: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  ficheiro: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  instalar: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M12 7v7M9 11l3 3 3-3M10 18.5h4" /></>,
  despesa: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /><path d="M12 12.5v4M10 14.5l2 2 2-2" /></>,
  excel: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 12l4 5M13 12l-4 5" /></>
}

export function Icon({ n, className = 'ico', style }: { n: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[n] || P.ficheiro}
    </svg>
  )
}

export function Logo({ className = 'logo' }: { className?: string }) {
  return <img src="/img/logo.svg" alt="Puzzle Stickers" className={className} style={{ filter: 'var(--logo-filter, invert(1))' }} />
}

// ---------- Viewer context (provider lives in Visualizador.tsx) ----------
export const VerCtx = createContext<(id: string) => void>(() => {})
export const useVer = () => useContext(VerCtx)

// ---------- Toast ----------
const ToastCtx = createContext<(m: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastHost({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const t = useRef<number>()
  const show = (m: string) => {
    setMsg(m)
    clearTimeout(t.current)
    t.current = window.setTimeout(() => setMsg(null), 2600)
  }
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status">
          <Icon n="check" /> {msg}
        </div>
      )}
    </ToastCtx.Provider>
  )
}

// ---------- Modal ----------
export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal>
        <div className="modal-h">
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="btn ghost sm icon" onClick={onClose} aria-label="Fechar">
            <Icon n="x" />
          </button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  )
}

export function Confirm({ text, ok = 'Apagar', onOk, onClose }: { text: string; ok?: string; onOk: () => void; onClose: () => void }) {
  return (
    <Modal
      title="Confirmar"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn pri" onClick={() => { onOk(); onClose() }}>{ok}</button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{text}</p>
    </Modal>
  )
}

// ---------- Small pieces ----------
export function Field({ label, hint, children, full }: { label: string; hint?: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function Avatar({ nome, cor, size = '' }: { nome: string; cor?: string; size?: '' | 'sm' | 'lg' }) {
  return (
    <div className={`avatar ${size}`} style={cor === 'neutro' ? { background: 'var(--card2)', color: 'var(--tx2)', boxShadow: 'inset 0 0 0 1px var(--line2)' } : { background: cor || 'var(--y)' }}>
      {iniciais(nome)}
    </div>
  )
}

export function Empty({ icon = 'caixa', title, text, children }: { icon?: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon n={icon} />
      <b>{title}</b>
      {text && <div className="small">{text}</div>}
      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  )
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: ReactNode; i?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)} type="button">
          {o.i && <Icon n={o.i} />}
          {o.l}
        </button>
      ))}
    </div>
  )
}

export function DemoTag({ demo }: { demo?: boolean }) {
  return demo ? <span className="badge demo">exemplo</span> : null
}

// ---------- Files ----------
export function useFicheiro(id?: string) {
  const f = useLiveQuery(() => (id ? db.ficheiros.get(id) : undefined), [id])
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!f) return setUrl(undefined)
    const u = URL.createObjectURL(f.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [f])
  return { f, url }
}

export function abrirFicheiro(f: Ficheiro) {
  const u = URL.createObjectURL(f.blob)
  const w = window.open(u, '_blank')
  if (!w) {
    const a = document.createElement('a')
    a.href = u
    a.download = f.nome
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(u), 60_000)
}

export function Thumb({ id, onRemove }: { id: string; onRemove?: () => void }) {
  const { f, url } = useFicheiro(id)
  const ver = useVer()
  if (!f) return null
  const img = f.mime.startsWith('image/')
  return (
    <div className="thumb" onClick={() => ver(f.id)} title={f.nome}>
      <div className="img">{img && url ? <img src={url} alt={f.nome} /> : <Icon n={f.mime === 'application/pdf' ? 'pdf' : 'ficheiro'} />}</div>
      <div className="row" style={{ gap: 4, paddingRight: 4 }}>
        <div className="nm" style={{ flex: 1 }}>{f.nome}</div>
        {onRemove && (
          <button className="btn ghost sm icon" style={{ width: 24, height: 24 }} onClick={(e) => { e.stopPropagation(); onRemove() }} aria-label="Remover">
            <Icon n="x" />
          </button>
        )}
      </div>
    </div>
  )
}

export function UploadZone({ onFiles, text = 'Carregar foto, scan ou PDF', accept = 'image/*,application/pdf', multiple = true }: { onFiles: (f: File[]) => void; text?: string; accept?: string; multiple?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      className="drop-zone"
      onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onFiles(Array.from(e.dataTransfer.files)) }}
    >
      <Icon n="upload" />
      <b>{text}</b>
      <span className="tiny">No iPhone pode tirar a foto na hora</span>
      <input ref={ref} type="file" accept={accept} multiple={multiple} hidden onChange={(e) => { onFiles(Array.from(e.target.files || [])); e.target.value = '' }} />
    </div>
  )
}

// ---------- Context menu ----------
export function useMenu() {
  const [m, setM] = useState<{ x: number; y: number; items: { l: string; i?: string; f: () => void }[] } | null>(null)
  useEffect(() => {
    if (!m) return
    const c = () => setM(null)
    window.addEventListener('click', c)
    window.addEventListener('scroll', c, true)
    return () => { window.removeEventListener('click', c); window.removeEventListener('scroll', c, true) }
  }, [m])
  const open = (e: React.MouseEvent, items: { l: string; i?: string; f: () => void }[]) => {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setM({ x: Math.min(r.left, window.innerWidth - 220), y: Math.min(r.bottom + 6, window.innerHeight - items.length * 40 - 20), items })
  }
  const node = m && (
    <div className="menu" style={{ left: m.x, top: m.y }}>
      {m.items.map((it) => (
        <button key={it.l} onClick={() => { it.f(); setM(null) }}>
          {it.i && <Icon n={it.i} />} {it.l}
        </button>
      ))}
    </div>
  )
  return { open, node }
}
