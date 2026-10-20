import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Utilizador } from './db'
import { DadosProvider, SessaoProvider, ir, useDados, useOnline, useRota, useSessao, useTema, type Acao } from './state'
import { Avatar, Field, Icon, Logo, ToastHost } from './ui'
import { devLocal, entrar, sincronizar, terminarSessao, useNuvem } from './nuvem'
import { semear } from './seed'
import { VisualizadorHost } from './Visualizador'
import { PdfHost } from './pdfPartilha'
import Painel from './pages/Painel'
import Trabalhos from './pages/Trabalhos'
import TrabalhoDetalhe from './pages/Trabalho'
import Agenda from './pages/Agenda'
import { Clientes, ClienteDetalhe } from './pages/Clientes'
import { Fornecedores, FornecedorDetalhe } from './pages/Fornecedores'
import Requisicoes from './pages/Requisicoes'
import { Cotacoes, CotacaoEditor } from './pages/Cotacoes'
import Documentos from './pages/Documentos'
import Iva from './pages/Iva'
import Dividas from './pages/Dividas'
import Resumo from './pages/Resumo'
import Pessoal from './pages/Pessoal'
import Catalogos from './pages/Catalogos'
import Despesas from './pages/Despesas'
import ContasPagar from './pages/ContasPagar'
import Catalogo from './pages/Catalogo'
import Equipa from './pages/Equipa'
import Definicoes from './pages/Definicoes'
import Relatorios from './pages/Relatorios'
import { NovoPedido } from './pages/Rapido'
import { VERSAO, atualizarApp, versaoCurta, versaoNoServidor } from './versao'

const PAPEL_NOME = { dono: 'Dono', gerente: 'Gerente', trabalhador: 'Trabalhador' }
export { PAPEL_NOME }

export default function App() {
  useTema()
  const users = useLiveQuery(() => db.utilizadores.toArray())
  const nuvem = useLiveQuery(() => db.meta.get('nuvem').then((n) => n ?? null))
  const [uid, setUid] = useState<string | null>(() => {
    try { return localStorage.getItem('pg_sessao') } catch { return null }
  })
  const ativos = (users || []).filter((u) => !u.deleted && u.ativo)
  // Momad (18 Oct): one password only. With a single person, the company password is the
  // whole login — no PIN after it. The PIN screen only appears once there is a team.
  const unico = ativos.length === 1 ? ativos[0] : undefined
  const user = ativos.find((u) => u.id === uid) ?? unico
  const sair = useCallback(() => {
    try { localStorage.removeItem('pg_sessao') } catch { /* ignore */ }
    setUid(null)
    location.hash = ''
    // Alone in the app: leaving goes back to the password (the device keeps its data).
    if (unico) terminarSessao()
  }, [unico])

  if (!users || nuvem === undefined) return null
  if (!nuvem?.token && !devLocal())
    return (
      <ToastHost>
        <Ligar />
      </ToastHost>
    )
  if (!user)
    return (
      <ToastHost>
        <Login users={users.filter((u) => !u.deleted && u.ativo)} onEntrar={(u) => { try { localStorage.setItem('pg_sessao', u.id) } catch { /* ignore */ } setUid(u.id); location.hash = u.papel === 'trabalhador' ? '/agenda' : '/painel' }} />
      </ToastHost>
    )

  return (
    <ToastHost>
      <SessaoProvider user={user} sair={sair}>
        <DadosProvider>
          <VisualizadorHost>
            <Shell />
            <PdfHost />
          </VisualizadorHost>
        </DadosProvider>
      </SessaoProvider>
    </ToastHost>
  )
}

// ---------- Login with PIN ----------
// First screen on every device: link it to the company's cloud copy.
function Ligar() {
  const { erro: erroSessao } = useNuvem()
  const voltar = useLiveQuery(() => db.meta.get('nuvem').then((n) => !!n))
  const [empresa, setEmpresa] = useState('puzzle')
  const [outraEmpresa, setOutraEmpresa] = useState(false)
  const [senha, setSenha] = useState('')
  const [aLigar, setALigar] = useState(false)
  const [erro, setErro] = useState('')
  async function ok(e: React.FormEvent) {
    e.preventDefault()
    setALigar(true)
    setErro('')
    try {
      await entrar(empresa, senha)
      await semear()
      await sincronizar()
    } catch (x: any) {
      setErro(x?.message || 'Sem ligação. Tente outra vez.')
    } finally {
      setALigar(false)
    }
  }
  return (
    <div className="login">
      <div className="login-box">
        <Logo />
        <div className="tag">Gestão</div>
        <form className="col" style={{ gap: 12, alignItems: 'stretch', textAlign: 'left' }} onSubmit={ok}>
          {outraEmpresa && <Field label="Código da empresa"><input value={empresa} onChange={(e) => setEmpresa(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></Field>}
          <Field label="Palavra-passe"><input type="password" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" /></Field>
          {(erro || erroSessao) && <div className="small" style={{ color: 'var(--bad)' }}>{erro || erroSessao}</div>}
          <button className="btn pri block" disabled={aLigar || !senha || !empresa}>{aLigar ? 'A ligar…' : 'Entrar'}</button>
          <div className="proto-note" style={{ marginTop: 4 }}>
            {voltar ? 'O que mudou neste aparelho sobe para a nuvem quando entrar.' : 'Este aparelho fica com os dados da empresa que estão na nuvem.'}
          </div>
          {!outraEmpresa && <button type="button" className="btn sm ghost" style={{ alignSelf: 'center' }} onClick={() => setOutraEmpresa(true)}>Outra empresa</button>}
        </form>
      </div>
    </div>
  )
}

function Login({ users, onEntrar }: { users: Utilizador[]; onEntrar: (u: Utilizador) => void }) {
  const ordem = { dono: 0, gerente: 1, trabalhador: 2 }
  const lista = [...users].sort((a, b) => ordem[a.papel] - ordem[b.papel])
  const [sel, setSel] = useState<Utilizador | null>(lista.length === 1 ? lista[0] : null)
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState(false)
  useEffect(() => {
    if (sel && pin.length === 4) {
      if (pin === sel.pin) onEntrar(sel)
      else {
        setErro(true)
        setTimeout(() => { setErro(false); setPin('') }, 400)
      }
    }
  }, [pin, sel, onEntrar])
  useEffect(() => {
    if (!sel) return
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 4 ? p + e.key : p))
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [sel])

  return (
    <div className="login">
      <div className="login-box">
        <Logo />
        <div className="tag">Gestão</div>
        {!sel ? (
          <>
            <div className="small muted b" style={{ marginBottom: 10 }}>Quem está a entrar?</div>
            <div className="who-list">
              {lista.map((u) => (
                <button key={u.id} className="who" onClick={() => setSel(u)}>
                  <Avatar nome={u.nome} cor={u.cor} size="lg" />
                  <div style={{ flex: 1 }}>
                    <b>{u.nome}</b>
                    <span>{PAPEL_NOME[u.papel]} · {u.funcao}</span>
                  </div>
                  <Icon n="right" />
                </button>
              ))}
            </div>

          </>
        ) : (
          <div className="col" style={{ alignItems: 'stretch' }}>
            <button className="who on" onClick={() => { setSel(null); setPin('') }}>
              <Avatar nome={sel.nome} cor={sel.cor} size="lg" />
              <div style={{ flex: 1 }}>
                <b>{sel.nome}</b>
                <span>Introduza o seu PIN</span>
              </div>
              {lista.length > 1 && <span className="small muted">Trocar</span>}
            </button>
            <div className={`pin ${erro ? 'shake' : ''}`}>
              {[0, 1, 2, 3].map((i) => <i key={i} className={pin.length > i ? 'f' : ''} />)}
            </div>
            {sel.pin === '1234' && <div className="proto-note" style={{ marginTop: 0 }}>PIN inicial: <b>1234</b> — pode mudar em Definições → Equipa.</div>}
            <div className="keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
                k ? (
                  <button key={i} onClick={() => setPin((p) => (k === '⌫' ? p.slice(0, -1) : p.length < 4 ? p + k : p))} aria-label={k === '⌫' ? 'Apagar' : k}>
                    {k}
                  </button>
                ) : <span key={i} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Navigation: 5 areas + Definições, each with its own tabs ----------
interface Aba { to: string; l: string; acao?: Acao; naoTrab?: boolean }
interface Area { id: string; l: string; i: string; abas: Aba[] }
const AREAS: Area[] = [
  { id: 'inicio', l: 'Início', i: 'painel', abas: [{ to: 'painel', l: 'Início', naoTrab: true }] },
  { id: 'trabalhos', l: 'Trabalhos', i: 'quadro', abas: [{ to: 'trabalhos', l: 'Trabalhos' }, { to: 'agenda', l: 'Agenda' }, { to: 'relatorios', l: 'Relatórios' }] },
  // Momad (18 Oct): the quotes get their own place in the menu.
  { id: 'cotacoes', l: 'Cotações', i: 'cotacao', abas: [{ to: 'cotacoes', l: 'Cotações', acao: 'financas' }, { to: 'catalogos', l: 'Catálogos', naoTrab: true }] },
  { id: 'clientes', l: 'Clientes', i: 'clientes', abas: [{ to: 'clientes', l: 'Clientes', naoTrab: true }] },
  {
    id: 'fornecedores', l: 'Fornecedores', i: 'fornecedores',
    abas: [{ to: 'fornecedores', l: 'Fornecedores', naoTrab: true }, { to: 'requisicoes', l: 'Requisições', naoTrab: true }, { to: 'contas-pagar', l: 'Mapa de crédito', acao: 'financas' }]
  },
  {
    id: 'financas', l: 'Finanças', i: 'carteira',
    abas: [{ to: 'resumo', l: 'Resumo', acao: 'despesas' }, { to: 'dividas', l: 'Recebimentos', acao: 'financas' }, { to: 'despesas', l: 'Despesas', acao: 'despesas' }, { to: 'documentos', l: 'Faturas e recibos', acao: 'iva' }, { to: 'iva', l: 'IVA', acao: 'iva' }, { to: 'pessoal', l: 'Pessoal', acao: 'despesas' }]
  },
  {
    id: 'definicoes', l: 'Definições', i: 'definicoes',
    abas: [{ to: 'definicoes', l: 'Empresa', acao: 'definicoes' }, { to: 'catalogo', l: 'Catálogo', naoTrab: true }, { to: 'equipa', l: 'Equipa', acao: 'equipa' }]
  }
]

function useAreas() {
  const { user, pode } = useSessao()
  const trab = user.papel === 'trabalhador'
  return AREAS.map((a) => ({ ...a, abas: a.abas.filter((x) => (!x.acao || pode(x.acao)) && !(trab && x.naoTrab)) })).filter((a) => a.abas.length)
}

const AbasCtx = createContext<{ abas: Aba[]; sec: string }>({ abas: [], sec: '' })

export function Page({ title, sub, actions, back, children }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: string; children: ReactNode }) {
  const online = useOnline()
  const { abas, sec } = useContext(AbasCtx)
  return (
    <>
      <header className="topbar">
        <div className="topbar-row">
          {back && (
            <button className="btn ghost icon back" onClick={() => ir(back)} aria-label="Voltar">
              <Icon n="left" />
            </button>
          )}
          {back && (
            <button className="btn ghost sm hide-m" onClick={() => ir(back)}>
              <Icon n="left" /> Voltar
            </button>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1>{title}</h1>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <div className="actions">
            <span className={`sync-pill hide-m ${online ? '' : 'off'}`} title="Neste protótipo os dados ficam guardados neste aparelho.">
              <i /> {online ? 'Online' : 'Offline'} · guardado no aparelho
            </span>
            {actions}
          </div>
        </div>
        {!back && abas.length > 1 && (
          <nav className="subnav">
            {abas.map((a) => (
              <a key={a.to} href={`#/${a.to}`} className={sec === a.to ? 'on' : ''}>{a.l}</a>
            ))}
          </nav>
        )}
      </header>
      <div className="content">{children}</div>
    </>
  )
}

function Shell() {
  const { parts, query } = useRota()
  const { user, sair } = useSessao()
  const dados = useDados()
  const areas = useAreas()
  const [tema, setTema] = useTema()
  const [novo, setNovo] = useState(false)
  const trab = user.papel === 'trabalhador'
  const sec = parts[0] || (trab ? 'agenda' : 'painel')
  const area = areas.find((a) => a.abas.some((x) => x.to === sec))

  const atrasados = dados.trabalhos.filter((t) => (trab ? t.responsavelId === user.id : true) && dados.resumo(t).atrasado).length

  if (!dados.pronto) return null

  let view: ReactNode
  const id = parts[1]
  if (!area) view = <Bloqueado />
  else
    switch (sec) {
      case 'painel': view = <Painel />; break
      case 'trabalhos': view = id ? <TrabalhoDetalhe id={id} /> : <Trabalhos />; break
      case 'agenda': view = <Agenda />; break
      case 'relatorios': view = <Relatorios />; break
      case 'clientes': view = id ? <ClienteDetalhe id={id} /> : <Clientes />; break
      case 'fornecedores': view = id ? <FornecedorDetalhe id={id} /> : <Fornecedores />; break
      case 'requisicoes': view = <Requisicoes abrir={id} />; break
      case 'cotacoes': view = id ? <CotacaoEditor id={id} /> : <Cotacoes />; break
      case 'documentos': view = <Documentos />; break
      case 'iva': view = <Iva />; break
      case 'dividas': view = <Dividas />; break
      case 'resumo': view = <Resumo />; break
      case 'despesas': view = <Despesas />; break
      case 'pessoal': view = <Pessoal />; break
      case 'catalogos': view = <Catalogos />; break
      case 'contas-pagar': view = <ContasPagar />; break
      case 'catalogo': view = <Catalogo />; break
      case 'equipa': view = <Equipa />; break
      case 'definicoes': view = <Definicoes />; break
      default: view = <Painel />
    }

  const tabs = areas.filter((a) => a.id !== 'definicoes').slice(0, 6)

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div>
            <Logo />
            <small>Gestão</small>
          </div>
        </div>
        <nav className="nav">
          {areas.map((a) => (
            <a key={a.id} href={`#/${a.abas[0].to}`} className={area?.id === a.id ? 'on' : ''}>
              <Icon n={a.i} />
              {a.l}
              {a.id === 'trabalhos' && atrasados > 0 && <span className="count" title="Atrasados">{atrasados}</span>}
            </a>
          ))}
        </nav>
        <div style={{ height: 16 }} />
        <div className="row" style={{ padding: '0 4px 10px', gap: 6 }}>
          <button className="btn sm ghost" onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}>
            <Icon n={tema === 'dark' ? 'sol' : 'lua'} /> {tema === 'dark' ? 'Claro' : 'Escuro'}
          </button>
        </div>
        <div className="me" onClick={sair} title="Terminar sessão">
          <Avatar nome={user.nome} cor={user.cor} />
          <div className="me-t">
            <b>{user.nome}</b>
            <span>{PAPEL_NOME[user.papel]}</span>
          </div>
          <Icon n="sair" />
        </div>
        <EstadoNuvem />
        <div className="small muted" style={{ padding: '2px 8px 0', fontSize: 11 }}>Versão {versaoCurta()}</div>
      </aside>

      <AbasCtx.Provider value={{ abas: area?.abas || [], sec }}>
        <main className="main" key={parts.join('/') + '?' + query.toString()}>
          <VersaoNova />
          <DicaInstalar />
          {view}
          {sec === 'painel' && (
            <div className="so-m-block" style={{ padding: '0 16px 110px' }}>
              <div className="row">
                <a className="btn" href="#/definicoes"><Icon n="definicoes" /> Definições</a>
                <button className="btn" onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}><Icon n={tema === 'dark' ? 'sol' : 'lua'} /></button>
                <span className="spacer" />
                <button className="btn danger" onClick={sair}><Icon n="sair" /> Sair</button>
              </div>
            </div>
          )}
        </main>
      </AbasCtx.Provider>

      <nav className="tabbar" style={{ gridTemplateColumns: `repeat(${tabs.length + (trab ? 1 : 0)}, 1fr)` }}>
        {tabs.map((a) => (
          <a key={a.id} href={`#/${a.abas[0].to}`} className={area?.id === a.id ? 'on' : ''}>
            <Icon n={a.i} />
            {a.l}
            {a.id === 'trabalhos' && atrasados > 0 && <span className="dot">{atrasados}</span>}
          </a>
        ))}
        {trab && (
          <button onClick={sair}>
            <Icon n="sair" />
            Sair
          </button>
        )}
      </nav>
      {!trab && ['painel', 'agenda', 'clientes'].includes(sec) && !id && (
        <button className="fab" onClick={() => setNovo(true)} aria-label="Novo pedido">
          <Icon n="plus" />
        </button>
      )}
      {novo && <NovoPedido onClose={() => setNovo(false)} />}
    </div>
  )
}

function Bloqueado() {
  return (
    <Page title="Sem acesso">
      <div className="card pad">
        <div className="empty">
          <Icon n="cadeado" />
          <b>Esta área não está disponível para o seu perfil.</b>
          <div className="small">Peça acesso ao dono da conta.</div>
        </div>
      </div>
    </Page>
  )
}

// iPhone/iPad/Mac Safari have no install prompt, so explain the two taps once.
export function textoNuvem(fase: string, ultimo?: string) {
  if (fase === 'a-sincronizar') return 'A sincronizar…'
  if (fase === 'offline') return 'Sem internet · guardado no aparelho'
  if (fase === 'erro') return 'Erro ao sincronizar · toque para tentar'
  if (fase === 'desligado') return 'Não ligado à nuvem'
  return ultimo ? `Na nuvem · ${new Date(ultimo).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}` : 'Na nuvem'
}

function EstadoNuvem() {
  const { fase, ultimo } = useNuvem()
  const cor = fase === 'erro' ? 'var(--bad)' : fase === 'offline' ? 'var(--warn)' : 'var(--ok)'
  return (
    <button className="small muted" style={{ padding: '6px 8px 0', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit' }} onClick={() => sincronizar()} title="Sincronizar agora">
      <i style={{ width: 7, height: 7, borderRadius: 9, background: cor, flex: 'none' }} />
      {textoNuvem(fase, ultimo)}
    </button>
  )
}

// If the phone is still on an older build, say so and offer a one-tap refresh.
function VersaoNova() {
  const [nova, setNova] = useState<string>()
  useEffect(() => {
    if (VERSAO === 'dev') return
    const ver = () => versaoNoServidor().then((v) => setNova(v && v > VERSAO ? v : undefined))
    ver()
    const vis = () => document.visibilityState === 'visible' && ver()
    document.addEventListener('visibilitychange', vis)
    const t = setInterval(ver, 120_000)
    return () => { document.removeEventListener('visibilitychange', vis); clearInterval(t) }
  }, [])
  if (!nova) return null
  return (
    <div className="banner" style={{ margin: '12px 16px 0' }}>
      <Icon n="instalar" />
      <span style={{ flex: 1 }}>Há uma versão nova ({versaoCurta(nova)}). Os seus dados ficam guardados.</span>
      <button className="btn sm pri" onClick={atualizarApp}>Atualizar</button>
    </div>
  )
}

function DicaInstalar() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
  const [fechado, setFechado] = useState(() => {
    try { return localStorage.getItem('pg_dica') === '1' } catch { return true }
  })
  if (standalone || fechado) return null
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  const mac = !ios && ua.includes('Macintosh')
  const texto = ios
    ? <>Instale como app: toque em <b>Partilhar</b> e depois <b>Adicionar ao ecrã principal</b>.</>
    : mac
      ? <>Instale como app no Mac: no Safari, menu <b>Ficheiro → Adicionar à Dock</b>.</>
      : <>Instale como app: no menu do navegador escolha <b>Instalar app</b> / <b>Adicionar ao ecrã principal</b>.</>
  return (
    <div className="banner" style={{ margin: '12px 16px 0' }}>
      <Icon n="instalar" />
      <span style={{ flex: 1 }}>{texto}</span>
      <button className="btn sm ghost icon" aria-label="Fechar" onClick={() => { try { localStorage.setItem('pg_dica', '1') } catch { /* ignore */ } setFechado(true) }}><Icon n="x" /></button>
    </div>
  )
}
