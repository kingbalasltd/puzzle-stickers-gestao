import { useMemo, useState } from 'react'
import { Page } from '../App'
import { addDias, diaISO, etapaInfo, hojeISO, itensAgenda, secaoAgenda, type ItemAgenda, type SecaoAgenda } from '../calc'
import type { Trabalho } from '../db'
import { dataCurta, dataLonga, diaSemana3, mesNome } from '../format'
import { marcarTarefa, novaTarefa } from '../acoes'
import { ir, useDados, useSessao } from '../state'
import { Empty, Icon, Seg, useToast } from '../ui'
import { EtapaBadge } from './comum'

const SECOES: { id: SecaoAgenda; nome: string }[] = [
  { id: 'atrasado', nome: 'Atrasado' },
  { id: 'hoje', nome: 'Hoje' },
  { id: 'semana', nome: 'Próximos 7 dias' },
  { id: 'depois', nome: 'Mais tarde' },
  { id: 'semData', nome: 'Sem data' }
]

const ICONE: Record<ItemAgenda['tipo'], string> = { tarefa: 'check', fase: 'bandeira', montagem: 'raio', entrega: 'caixa', pedido: 'plus' }

// Tasks and job dates the person on this device should see.
export function useAgenda(resp = '') {
  const d = useDados()
  const { user, pode } = useSessao()
  return useMemo(() => {
    const todos = pode('todosTrabalhos')
    const meus = (t: Trabalho) => (todos || t.responsavelId === user.id) && (!resp || t.responsavelId === resp)
    const jobs = d.trabalhos.filter(meus)
    const ids = new Set(jobs.map((t) => t.id))
    const tarefas = d.tarefas.filter((k) => (k.trabalhoId ? ids.has(k.trabalhoId) : todos || k.por === user.id) && (!resp || k.por === resp || (k.trabalhoId && ids.has(k.trabalhoId))))
    return itensAgenda(jobs, tarefas).sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'))
  }, [d.trabalhos, d.tarefas, user, pode, resp])
}

export default function Agenda() {
  const d = useDados()
  const { user, pode } = useSessao()
  const trab = user.papel === 'trabalhador'
  const [vista, setVista] = useState<'lista' | 'mes'>('lista')
  const [resp, setResp] = useState(trab ? user.id : '')
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const hoje = hojeISO()
  const itens = useAgenda(resp)

  const porSecao = useMemo(() => {
    const m = new Map<SecaoAgenda, ItemAgenda[]>()
    for (const i of itens) {
      const s = secaoAgenda(i, hoje)
      m.set(s, [...(m.get(s) || []), i])
    }
    return m
  }, [itens, hoje])

  const celulas = useMemo(() => {
    const first = new Date(mes + '-01T12:00:00')
    const start = new Date(first)
    start.setDate(1 - ((first.getDay() + 6) % 7)) // Monday-first
    return Array.from({ length: 42 }, (_, i) => {
      const x = new Date(start)
      x.setDate(start.getDate() + i)
      return diaISO(x)
    })
  }, [mes])

  const mover = (n: number) => {
    const x = new Date(mes + '-15T12:00:00')
    x.setMonth(x.getMonth() + n)
    setMes(x.toISOString().slice(0, 7))
  }

  const contagem = (s: SecaoAgenda) => porSecao.get(s)?.length || 0

  return (
    <Page title={trab ? 'A minha agenda' : 'Agenda'} sub={`${contagem('hoje')} hoje · ${contagem('semana')} nos próximos 7 dias${contagem('atrasado') ? ` · ${contagem('atrasado')} atrasados` : ''}`}>
      <NovaTarefa />

      <div className="row wrap" style={{ margin: '14px 0' }}>
        <Seg value={vista} onChange={setVista} options={[{ v: 'lista', l: 'Lista', i: 'lista' }, { v: 'mes', l: 'Mês', i: 'agenda' }]} />
        {pode('todosTrabalhos') && (
          <select className="inp" style={{ width: 'auto' }} value={resp} onChange={(e) => setResp(e.target.value)}>
            <option value="">Toda a equipa</option>
            {d.utilizadores.filter((u) => u.ativo).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}
        {vista === 'mes' && (
          <div className="row" style={{ marginLeft: 'auto' }}>
            <button className="btn icon" onClick={() => mover(-1)} aria-label="Mês anterior"><Icon n="left" /></button>
            <b style={{ minWidth: 140, textAlign: 'center' }}>{mesNome(mes)}</b>
            <button className="btn icon" onClick={() => mover(1)} aria-label="Mês seguinte"><Icon n="right" /></button>
            <button className="btn sm" onClick={() => setMes(hoje.slice(0, 7))}>Hoje</button>
          </div>
        )}
      </div>

      {vista === 'lista' ? (
        <>
          {SECOES.filter((s) => contagem(s.id)).map((s) => (
            <div key={s.id} className="day-group">
              <div className={`dh ${s.id === 'atrasado' ? 'late' : s.id === 'hoje' ? 'today' : ''}`}>
                {s.id === 'atrasado' && <Icon n="alerta" />} {s.nome} <span>{contagem(s.id)}</span>
              </div>
              <div className="card" style={{ padding: '0 12px' }}>
                <div className="list">{porSecao.get(s.id)!.map((i) => <LinhaAgenda key={i.id} i={i} mostrarData={s.id !== 'hoje' && s.id !== 'semData'} />)}</div>
              </div>
            </div>
          ))}
          {itens.length === 0 && <div className="card"><Empty icon="agenda" title="Nada na agenda" text="Tarefas, pedidos e datas das fases dos trabalhos aparecem aqui." /></div>}
        </>
      ) : (
        <div className="cal">
          {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((x) => <div key={x} className="dh">{x}</div>)}
          {celulas.map((dia) => {
            const xs = itens.filter((i) => i.data && (i.data === dia || (i.ate && i.data <= dia && dia <= i.ate)))
            return (
              <div key={dia} className={`dc ${dia.slice(0, 7) !== mes ? 'out' : ''} ${dia === hoje ? 'today' : ''}`}>
                <div className="dn" title={`${diaSemana3(dia)} ${dia}`}>{Number(dia.slice(8))}</div>
                {xs.slice(0, 3).map((i) => {
                  const t = d.trabalhos.find((x) => x.id === i.trabalhoId)
                  const cor = i.tipo === 'tarefa' ? 'var(--info)' : (i.ate || i.data)! < hoje ? 'var(--bad)' : etapaInfo(i.etapa || 'pedido').cor
                  return (
                    <div key={i.id} className="ev" style={{ borderLeftColor: cor }} onClick={() => t && ir(`/trabalhos/${t.id}`)} title={`${i.texto}${t ? ` · ${t.codigo} ${t.titulo}` : ''}`}>
                      {i.tipo === 'tarefa' ? i.texto : `${t?.titulo || ''} · ${i.texto}`}
                    </div>
                  )
                })}
                {xs.length > 3 && <div className="more">+{xs.length - 3}</div>}
              </div>
            )
          })}
        </div>
      )}
    </Page>
  )
}

export function LinhaAgenda({ i, mostrarData }: { i: ItemAgenda; mostrarData?: boolean }) {
  const d = useDados()
  const toast = useToast()
  const t = i.trabalhoId ? d.trabalhos.find((x) => x.id === i.trabalhoId) : undefined
  const cli = t && d.cliente(t.clienteId)?.nome
  const tarefa = i.tarefa
  return (
    <div className="li" onClick={() => t && ir(`/trabalhos/${t.id}`)} style={{ cursor: t ? 'pointer' : 'default' }}>
      {tarefa ? (
        <button className="tick" aria-label="Marcar como feita" onClick={async (e) => { e.stopPropagation(); await marcarTarefa(tarefa, true); toast('Tarefa feita') }}><Icon n="check" /></button>
      ) : (
        <div className="avatar" style={{ background: 'var(--card2)', color: etapaInfo(i.etapa || 'pedido').cor }}><Icon n={ICONE[i.tipo]} /></div>
      )}
      <div className="main-t">
        <b>{tarefa ? tarefa.texto : t?.titulo}</b>
        <span>
          {tarefa ? (t ? `${t.codigo} · ${t.titulo}` : 'Tarefa') : `${i.texto}${i.ate && i.ate !== i.data ? ` · ${dataCurta(i.data!)} a ${dataCurta(i.ate)}` : ''} · ${t?.codigo}${cli ? ` · ${cli}` : ''}`}
        </span>
      </div>
      {mostrarData && i.data && <span className="badge">{dataCurta(i.data)}</span>}
      {t && !tarefa && <span className="hide-m"><EtapaBadge e={t.etapa} tipo={t.tipo} /></span>}
    </div>
  )
}

// Quick add: write it, optionally give it a day and a job.
export function NovaTarefa({ trabalhoId, compacto }: { trabalhoId?: string; compacto?: boolean }) {
  const d = useDados()
  const { user } = useSessao()
  const toast = useToast()
  const [texto, setTexto] = useState('')
  const [data, setData] = useState('')
  const [job, setJob] = useState(trabalhoId || '')
  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    await novaTarefa(texto, user.id, data, job)
    setTexto('')
    setData('')
    toast('Tarefa adicionada')
  }
  const atalhos = [['Hoje', hojeISO()], ['Amanhã', addDias(hojeISO(), 1)]] as const
  return (
    <form className={compacto ? 'nova-tarefa compacta' : 'card pad nova-tarefa'} onSubmit={add}>
      <input className="inp" placeholder={compacto ? 'Nova tarefa deste trabalho…' : 'Nova tarefa… (ex.: ligar ao cliente, preparar apresentação)'} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="row wrap" style={{ gap: 6 }}>
        {atalhos.map(([l, v]) => <button key={l} type="button" className={`btn sm ${data === v ? 'pri' : ''}`} onClick={() => setData(data === v ? '' : v)}>{l}</button>)}
        <input type="date" className="inp" style={{ width: 'auto' }} value={data} onChange={(e) => setData(e.target.value)} aria-label="Data" />
        {!trabalhoId && (
          <select className="inp" style={{ width: 'auto', maxWidth: 220 }} value={job} onChange={(e) => setJob(e.target.value)} aria-label="Trabalho">
            <option value="">Sem trabalho</option>
            {d.trabalhos.filter((t) => !t.cancelado && t.etapa !== 'entregue').map((t) => <option key={t.id} value={t.id}>{t.codigo} · {t.titulo}</option>)}
          </select>
        )}
        <button className="btn pri sm" disabled={!texto.trim()}><Icon n="plus" /> Adicionar</button>
      </div>
    </form>
  )
}

// The job page's own task list: open ones first, the last done ones below.
export function TarefasDoTrabalho({ t }: { t: Trabalho }) {
  const d = useDados()
  const toast = useToast()
  const minhas = d.tarefas.filter((k) => k.trabalhoId === t.id)
  const abertas = minhas.filter((k) => !k.feitaEm)
  const feitas = minhas.filter((k) => k.feitaEm).sort((a, b) => b.feitaEm!.localeCompare(a.feitaEm!)).slice(0, 5)
  return (
    <div className="card pad">
      <h3>Tarefas <span className="right badge">{abertas.length}</span></h3>
      <div className="list">
        {abertas.map((k) => (
          <div key={k.id} className="li">
            <button className="tick" aria-label="Marcar como feita" onClick={async () => { await marcarTarefa(k, true); toast('Tarefa feita') }}><Icon n="check" /></button>
            <div className="main-t"><b>{k.texto}</b><span>{k.data ? dataLonga(k.data) : 'Sem data'}</span></div>
            {k.data && <span className={`badge ${k.data < hojeISO() ? 'bad' : ''}`}>{dataCurta(k.data)}</span>}
          </div>
        ))}
        {feitas.map((k) => (
          <div key={k.id} className="li" style={{ opacity: 0.55 }}>
            <button className="tick on" aria-label="Voltar a abrir" onClick={() => marcarTarefa(k, false)}><Icon n="check" /></button>
            <div className="main-t"><b style={{ textDecoration: 'line-through' }}>{k.texto}</b><span>feita {dataCurta(k.feitaEm!.slice(0, 10))}</span></div>
          </div>
        ))}
      </div>
      <NovaTarefa trabalhoId={t.id} compacto />
    </div>
  )
}
