import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  vivos,
  type Cliente,
  type Cotacao,
  type Custo,
  type Despesa,
  type DespesaFixa,
  type Relatorio,
  type Documento,
  type Empresa,
  type Fornecedor,
  type Pagamento,
  type Papel,
  type Requisicao,
  type Servico,
  type Tarefa,
  type Trabalho,
  type Utilizador
} from './db'
import { normalizarEtapa, resumoTrabalho, type ResumoTrabalho } from './calc'
import { EMPRESA } from './seed'

// ---------- Router (hash based: works offline and from the home-screen icon) ----------
export function useRota() {
  const [h, setH] = useState(() => location.hash.slice(1) || '/painel')
  useEffect(() => {
    const f = () => {
      setH(location.hash.slice(1) || '/painel')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const [path, qs] = h.split('?')
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs || '') }
}
export const ir = (p: string) => {
  location.hash = p
}

// ---------- Session ----------
export interface Sessao {
  user: Utilizador
  sair: () => void
  pode: (acao: Acao) => boolean
}
export type Acao = 'financas' | 'iva' | 'despesas' | 'equipa' | 'definicoes' | 'apagar' | 'todosTrabalhos' | 'editarTrabalho'

const PERM: Record<Papel, Acao[]> = {
  dono: ['financas', 'iva', 'despesas', 'equipa', 'definicoes', 'apagar', 'todosTrabalhos', 'editarTrabalho'],
  gerente: ['financas', 'todosTrabalhos', 'editarTrabalho'],
  trabalhador: []
}

const SessaoCtx = createContext<Sessao>(null as any)
export const useSessao = () => useContext(SessaoCtx)
export function SessaoProvider({ user, sair, children }: { user: Utilizador; sair: () => void; children: ReactNode }) {
  const v = useMemo(() => ({ user, sair, pode: (a: Acao) => PERM[user.papel].includes(a) }), [user, sair])
  return <SessaoCtx.Provider value={v}>{children}</SessaoCtx.Provider>
}

// ---------- All data in memory (a print shop has hundreds of rows, not millions) ----------
export interface Dados {
  pronto: boolean
  empresa: Empresa
  utilizadores: Utilizador[]
  clientes: Cliente[]
  fornecedores: Fornecedor[]
  servicos: Servico[]
  trabalhos: Trabalho[]
  pagamentos: Pagamento[]
  requisicoes: Requisicao[]
  custos: Custo[]
  documentos: Documento[]
  cotacoes: Cotacao[]
  despesasFixas: DespesaFixa[]
  despesas: Despesa[]
  relatorios: Relatorio[]
  tarefas: Tarefa[]
  resumo: (t: Trabalho) => ResumoTrabalho
  cliente: (id?: string) => Cliente | undefined
  user: (id?: string) => Utilizador | undefined
  fornecedor: (id?: string) => Fornecedor | undefined
}

const DadosCtx = createContext<Dados>(null as any)
export const useDados = () => useContext(DadosCtx)

export function DadosProvider({ children }: { children: ReactNode }) {
  const raw = useLiveQuery(async () => {
    const [empresa, utilizadores, clientes, fornecedores, servicos, trabalhos, pagamentos, requisicoes, custos, documentos, cotacoes, despesasFixas, despesas, relatorios, tarefas] = await Promise.all([
      db.empresa.get('empresa'),
      db.utilizadores.toArray(),
      db.clientes.toArray(),
      db.fornecedores.toArray(),
      db.servicos.toArray(),
      db.trabalhos.toArray(),
      db.pagamentos.toArray(),
      db.requisicoes.toArray(),
      db.custos.toArray(),
      db.documentos.toArray(),
      db.cotacoes.toArray(),
      db.despesasFixas.toArray(),
      db.despesas.toArray(),
      db.relatorios.toArray(),
      db.tarefas.toArray()
    ])
    return { empresa, utilizadores, clientes, fornecedores, servicos, trabalhos, pagamentos, requisicoes, custos, documentos, cotacoes, despesasFixas, despesas, relatorios, tarefas }
  })

  const v = useMemo<Dados>(() => {
    const empresa = raw?.empresa || EMPRESA
    const d = {
      utilizadores: vivos(raw?.utilizadores || []),
      clientes: vivos(raw?.clientes || []).sort((a, b) => a.nome.localeCompare(b.nome)),
      fornecedores: vivos(raw?.fornecedores || []).sort((a, b) => a.nome.localeCompare(b.nome)),
      servicos: vivos(raw?.servicos || []).sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || a.nome.localeCompare(b.nome)),
      // Old stage names (before 16 Oct) are read as the new phases; nothing is rewritten.
      trabalhos: vivos(raw?.trabalhos || [])
        .map((t) => ({ ...t, etapa: normalizarEtapa(t.etapa), etapas: t.etapas.map((e) => ({ ...e, etapa: normalizarEtapa(e.etapa) })) }))
        .sort((a, b) => b.codigo.localeCompare(a.codigo)),
      pagamentos: vivos(raw?.pagamentos || []),
      requisicoes: vivos(raw?.requisicoes || []).sort((a, b) => b.data.localeCompare(a.data)),
      custos: vivos(raw?.custos || []),
      documentos: vivos(raw?.documentos || []).sort((a, b) => b.data.localeCompare(a.data)),
      cotacoes: vivos(raw?.cotacoes || []).sort((a, b) => b.numero.localeCompare(a.numero)),
      despesasFixas: vivos(raw?.despesasFixas || []).sort((a, b) => a.dia - b.dia),
      despesas: vivos(raw?.despesas || []).sort((a, b) => b.data.localeCompare(a.data)),
      relatorios: vivos(raw?.relatorios || []).sort((a, b) => b.data.localeCompare(a.data) || b.updatedAt.localeCompare(a.updatedAt)),
      tarefas: vivos(raw?.tarefas || []).sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999') || a.createdAt.localeCompare(b.createdAt))
    }
    const cache = new Map<string, ResumoTrabalho>()
    const cfg = { taxaIva: empresa.taxaIva, urgenciaPct: empresa.urgenciaPct, sinalPct: empresa.sinalPct }
    const byId = <T extends { id: string }>(xs: T[]) => {
      const m = new Map(xs.map((x) => [x.id, x]))
      return (id?: string) => (id ? m.get(id) : undefined)
    }
    return {
      pronto: !!raw,
      empresa,
      ...d,
      resumo: (t: Trabalho) => {
        const k = t.id + t.updatedAt
        let r = cache.get(k)
        if (!r) {
          r = resumoTrabalho(t, d.pagamentos, d.requisicoes, d.custos, cfg)
          cache.set(k, r)
        }
        return r
      },
      cliente: byId(d.clientes),
      user: byId(raw?.utilizadores || []),
      fornecedor: byId(d.fornecedores)
    }
  }, [raw])

  return <DadosCtx.Provider value={v}>{children}</DadosCtx.Provider>
}

// Next sequential code, e.g. T-2026-010.
export function proximoCodigo(prefixo: string, existentes: string[], ano = new Date().getFullYear()) {
  const re = new RegExp(`^${prefixo}-${ano}-(\\d+)$`)
  const max = existentes.reduce((m, c) => {
    const x = re.exec(c)
    return x ? Math.max(m, Number(x[1])) : m
  }, 0)
  return `${prefixo}-${ano}-${String(max + 1).padStart(3, '0')}`
}

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine)
  useEffect(() => {
    const a = () => setOn(true)
    const b = () => setOn(false)
    window.addEventListener('online', a)
    window.addEventListener('offline', b)
    return () => {
      window.removeEventListener('online', a)
      window.removeEventListener('offline', b)
    }
  }, [])
  return on
}

export function useTema() {
  const [t, setT] = useState<'dark' | 'light'>(() => (localStorage.getItem('pg_tema') as any) || 'dark')
  useEffect(() => {
    document.documentElement.dataset.theme = t
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#0b0b0c' : '#f4f3ef')
    try { localStorage.setItem('pg_tema', t) } catch { /* private mode */ }
  }, [t])
  return [t, setT] as const
}
