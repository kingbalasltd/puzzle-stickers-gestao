import { useEffect, useMemo, useState } from 'react'
import { Page } from '../App'
import { ETAPAS, addDias, etapaInfo, etapasDoTipo, hojeISO, TIPOS } from '../calc'
import type { Etapa, TipoTrabalho } from '../db'
import { dataCurta, mt } from '../format'
import { moverEtapa } from '../acoes'
import { ir, useDados, useRota, useSessao } from '../state'
import { Avatar, Empty, Icon, Seg, useToast } from '../ui'
import { EtapaBadge, JobCard, PrazoBadge, ProgressoPago } from './comum'
import { TrabalhoForm } from './TrabalhoForm'

export default function Trabalhos() {
  const d = useDados()
  const { user, pode } = useSessao()
  const { query } = useRota()
  const toast = useToast()
  const [vista, setVista] = useState<'quadro' | 'lista'>(() => (localStorage.getItem('pg_vista') as any) || 'quadro')
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState<'todos' | TipoTrabalho>(() => (query.get('tipo') as TipoTrabalho) || 'todos')
  const [resp, setResp] = useState(user.papel === 'trabalhador' ? user.id : '')
  const [novo, setNovo] = useState(query.get('novo') === '1')
  const [over, setOver] = useState<Etapa | null>(null)
  const filtro = query.get('f')
  const etapaQ = query.get('etapa') as Etapa | null
  const fin = pode('financas')

  useEffect(() => { try { localStorage.setItem('pg_vista', vista) } catch { /* ignore */ } }, [vista])

  const lista = useMemo(() => {
    const hoje = hojeISO()
    const limiteEntregues = addDias(hoje, -30)
    return d.trabalhos.filter((t) => {
      if (t.cancelado) return false
      if (!pode('todosTrabalhos') && t.responsavelId !== user.id) return false
      if (resp && t.responsavelId !== resp) return false
      if (tipo !== 'todos' && (t.tipo === 'producao' ? 'branding' : t.tipo) !== tipo) return false
      if (filtro === 'atrasados' && !d.resumo(t).atrasado) return false
      if (filtro === 'semvalor' && d.resumo(t).total !== 0) return false
      if (etapaQ && t.etapa !== etapaQ) return false
      if (vista === 'quadro' && t.etapa === 'entregue') {
        const quando = t.etapas.find((e) => e.etapa === 'entregue')?.em.slice(0, 10) || t.prazo
        if (quando < limiteEntregues) return false
      }
      if (q) {
        const s = `${t.codigo} ${t.titulo} ${d.cliente(t.clienteId)?.nome} ${t.descricao}`.toLowerCase()
        if (!s.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [d, q, tipo, resp, filtro, etapaQ, vista, user, pode])

  async function soltar(e: React.DragEvent, etapa: Etapa) {
    e.preventDefault()
    setOver(null)
    const id = e.dataTransfer.getData('text/plain')
    const t = d.trabalhos.find((x) => x.id === id)
    if (!t || t.etapa === etapa) return
    if (!etapasDoTipo(t.tipo).includes(etapa)) return toast(`${TIPOS.find((x) => x.id === t.tipo)?.nome || 'Este tipo'} não tem a etapa ${etapaInfo(etapa).curto}`)
    if (etapa === 'entregue' && fin && d.resumo(t).emDivida > 0) return ir(`/trabalhos/${t.id}?entregar=1`)
    await moverEtapa(t, etapa, user.id)
    toast(`${t.codigo} → ${etapaInfo(etapa, t.tipo).curto}`)
  }

  // One type: its own path. All types: only the stages that have jobs (+ Pedido and Entregue).
  const lanes = tipo !== 'todos'
    ? etapasDoTipo(tipo).map((e) => etapaInfo(e, tipo))
    : ETAPAS.filter((e) => e.id === 'pedido' || e.id === 'entregue' || lista.some((t) => t.etapa === e.id))

  return (
    <Page
      title={user.papel === 'trabalhador' ? 'Os meus trabalhos' : 'Trabalhos'}
      sub={`${lista.length} ${vista === 'quadro' ? 'no quadro' : 'trabalhos'}${filtro === 'atrasados' ? ' · atrasados' : filtro === 'semvalor' ? ' · sem valor de venda' : ''}${etapaQ ? ` · ${ETAPAS.find((e) => e.id === etapaQ)?.curto}` : ''}`}
      actions={pode('editarTrabalho') && <button className="btn pri" onClick={() => setNovo(true)}><Icon n="plus" /> <span className="hide-m">Novo trabalho</span></button>}
    >
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <Seg value={vista} onChange={setVista} options={[{ v: 'quadro', l: 'Quadro', i: 'quadro' }, { v: 'lista', l: 'Lista', i: 'lista' }]} />
        <div className="search">
          <Icon n="search" />
          <input className="inp" placeholder="Procurar código, cliente, título…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="inp" style={{ width: 'auto' }} value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
          <option value="todos">Todos os tipos</option>
          {TIPOS.map((x) => <option key={x.id} value={x.id}>{x.nome} · {d.trabalhos.filter((t) => !t.cancelado && (t.tipo === 'producao' ? 'branding' : t.tipo) === x.id).length}</option>)}
        </select>
        {pode('todosTrabalhos') && (
          <select className="inp" style={{ width: 'auto' }} value={resp} onChange={(e) => setResp(e.target.value)}>
            <option value="">Toda a equipa</option>
            {d.utilizadores.filter((u) => u.ativo).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}
        {(filtro || etapaQ) && <a className="btn sm" href="#/trabalhos"><Icon n="x" /> Limpar filtro</a>}
      </div>

      {vista === 'quadro' ? (
        <div className="board">
          {lanes.map((e) => {
            const xs = lista.filter((t) => t.etapa === e.id).sort((a, b) => a.prazo.localeCompare(b.prazo))
            return (
              <div
                key={e.id}
                className={`lane ${over === e.id ? 'drop' : ''}`}
                onDragOver={(ev) => { ev.preventDefault(); setOver(e.id) }}
                onDragLeave={() => setOver((o) => (o === e.id ? null : o))}
                onDrop={(ev) => soltar(ev, e.id)}
              >
                <div className="lane-h">
                  <i style={{ background: e.cor }} />
                  {e.nome}
                  <span className="n">{xs.length}</span>
                </div>
                <div className="lane-b">
                  {xs.map((t) => <JobCard key={t.id} t={t} draggable />)}
                  {xs.length === 0 && <div className="tiny muted" style={{ textAlign: 'center', padding: '18px 0' }}>Arraste um trabalho para aqui</div>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card">
          {lista.length === 0 ? (
            <Empty icon="quadro" title="Nenhum trabalho encontrado" />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Trabalho</th>
                    <th>Cliente</th>
                    <th>Etapa</th>
                    <th>Prazo</th>
                    <th>Responsável</th>
                    {fin && <th className="r">Total</th>}
                    {fin && <th style={{ width: 120 }}>Pago</th>}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((t) => {
                    const r = d.resumo(t)
                    const u = d.user(t.responsavelId)
                    return (
                      <tr key={t.id} className="click" onClick={() => ir(`/trabalhos/${t.id}`)}>
                        <td>
                          <div className="tiny muted b">{t.codigo}{t.urgente ? ' · URGENTE' : ''}</div>
                          <div className="b">{t.titulo}</div>
                        </td>
                        <td className="tx2">{d.cliente(t.clienteId)?.nome}</td>
                        <td><EtapaBadge e={t.etapa} tipo={t.tipo} /></td>
                        <td><PrazoBadge t={t} /><div className="tiny muted" style={{ marginTop: 3 }}>entrou {dataCurta(t.dataEntrada)}</div></td>
                        <td>{u ? <div className="row" style={{ gap: 8 }}><Avatar nome={u.nome} cor={u.cor} size="sm" /><span className="small">{u.nome.split(' ')[0]}</span></div> : <span className="muted">—</span>}</td>
                        {fin && <td className="r num b nowrap">{mt(r.total)}</td>}
                        {fin && <td><ProgressoPago pago={r.pago} total={r.total} /><div className="tiny muted" style={{ marginTop: 4 }}>{r.emDivida > 0 ? `falta ${mt(r.emDivida)}` : 'pago'}</div></td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {novo && <TrabalhoForm onClose={() => { setNovo(false); if (query.get('novo')) ir('/trabalhos') }} />}
    </Page>
  )
}
