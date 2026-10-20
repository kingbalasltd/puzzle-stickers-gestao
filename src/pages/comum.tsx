import type { Etapa, TipoTrabalho, Trabalho } from '../db'
import { confirmado, contaParaReceber, etapaInfo, hojeISO, diasEntre, prazoAtual, tipoInfo } from '../calc'
import { dataCurta, mt } from '../format'
import { ir, useDados, useSessao } from '../state'
import { Avatar, Icon } from '../ui'

export function EtapaBadge({ e, tipo }: { e: Etapa; tipo?: TipoTrabalho }) {
  const i = etapaInfo(e, tipo)
  return (
    <span className="badge">
      <i style={{ background: i.cor }} />
      {i.curto}
    </span>
  )
}

// The date the job has to meet now: this phase's deadline, else the delivery date.
export function PrazoBadge({ t }: { t: Trabalho }) {
  if (t.etapa === 'entregue') return <span className="badge ok"><Icon n="check" style={{ width: 13, height: 13 }} /> Entregue</span>
  const limite = prazoAtual(t) || t.prazo
  if (!limite) return null
  const d = diasEntre(hojeISO(), limite)
  if (d < 0) return <span className="badge bad"><Icon n="relogio" style={{ width: 13, height: 13 }} /> {-d}d atrasado</span>
  if (d === 0) return <span className="badge warn"><Icon n="relogio" style={{ width: 13, height: 13 }} /> Hoje</span>
  if (d <= 2) return <span className="badge warn"><Icon n="relogio" style={{ width: 13, height: 13 }} /> {d === 1 ? 'Amanhã' : `${d} dias`}</span>
  return <span className="badge"><Icon n="relogio" style={{ width: 13, height: 13 }} /> {dataCurta(limite)}</span>
}

export function JobCard({ t, draggable, onDragStart, onDragEnd }: { t: Trabalho; draggable?: boolean; onDragStart?: () => void; onDragEnd?: () => void }) {
  const d = useDados()
  const { pode } = useSessao()
  const r = d.resumo(t)
  const resp = d.user(t.responsavelId)
  const cli = d.cliente(t.clienteId)
  const fin = pode('financas')
  return (
    <div
      className={`jc ${r.atrasado ? 'late' : ''}`}
      onClick={() => ir(`/trabalhos/${t.id}`)}
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); (e.currentTarget as HTMLElement).classList.add('dragging'); onDragStart?.() }}
      onDragEnd={(e) => { (e.currentTarget as HTMLElement).classList.remove('dragging'); onDragEnd?.() }}
    >
      {t.urgente && <span className="urg badge warn" title="Urgente (+taxa)"><Icon n="raio" style={{ width: 12, height: 12 }} /></span>}
      <div className="code">{t.codigo} · {tipoInfo(t.tipo).curto}</div>
      <div className="t">{t.titulo}</div>
      <div className="c">{cli?.nome || '—'}</div>
      <div className="meta">
        <PrazoBadge t={t} />
        {fin && contaParaReceber(t, r) && <span className="badge" title="Em dívida">falta {mt(r.emDivida).replace(',00', '')}</span>}
        {fin && r.total > 0 && !r.sinalPago && !t.cancelado && t.etapa !== 'entregue' && confirmado(t, r.pago) && <span className="badge warn">Sem sinal</span>}
        {fin && !confirmado(t, r.pago) && r.total > 0 && <span className="badge" title="Ainda não conta no a receber">{mt(r.total).replace(',00', '')} em negociação</span>}
        {fin && t.etapa === 'entregue' && r.emDivida > 0 && t.pagamentoPrometido && <span className={`badge ${t.pagamentoPrometido < hojeISO() ? 'bad' : ''}`}>paga {t.pagamentoPrometido.slice(8, 10)}/{t.pagamentoPrometido.slice(5, 7)}</span>}
        {fin && r.total === 0 && <span className="badge">Valor por definir</span>}
        <span className="spacer" />
        {resp && <Avatar nome={resp.nome} cor={resp.cor} size="sm" />}
      </div>
    </div>
  )
}

export function ProgressoPago({ pago, total }: { pago: number; total: number }) {
  const p = total > 0 ? Math.min(1, pago / total) : 0
  return (
    <div className="progress" title={`${Math.round(p * 100)}% pago`}>
      <div style={{ width: `${p * 100}%`, background: p >= 1 ? 'var(--ok)' : p >= 0.5 ? 'var(--y)' : 'var(--warn)' }} />
    </div>
  )
}

export const metodos = ['M-Pesa', 'e-Mola', 'Transferência', 'Numerário', 'POS', 'Cheque'] as const
