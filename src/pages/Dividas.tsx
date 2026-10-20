import { useMemo, useState } from 'react'
import { Page } from '../App'
import { confirmado, contaParaReceber, diasEntre, hojeISO } from '../calc'
import { dataMedia, mesNome, mt, waLink } from '../format'
import { ir, useDados } from '../state'
import { Avatar, Empty, Icon, Seg } from '../ui'
import { EtapaBadge, ProgressoPago } from './comum'
import { PagamentoForm } from './Trabalho'
import type { Trabalho } from '../db'

export default function Dividas() {
  const d = useDados()
  const [vista, setVista] = useState<'dividas' | 'recebidos'>('dividas')
  const [pago, setPago] = useState<Trabalho | null>(null)
  const hoje = hojeISO()

  const linhas = useMemo(
    () =>
      d.trabalhos
        .filter((t) => !t.cancelado)
        .map((t) => ({ t, r: d.resumo(t) }))
        .filter(({ t, r }) => contaParaReceber(t, r))
        .sort((a, b) => b.r.emDivida - a.r.emDivida),
    [d]
  )
  const total = linhas.reduce((s, x) => s + x.r.emDivida, 0)
  const prontos = linhas.filter((x) => x.t.etapa === 'entrega' || x.t.etapa === 'entregue')
  const aguardaSinal = d.trabalhos.filter((t) => { const r = d.resumo(t); return !t.cancelado && t.etapa !== 'entregue' && r.total > 0 && confirmado(t, r.pago) && !r.sinalPago })
  // Quoted or being negotiated: shown apart, never in the total to receive.
  const negociacao = d.trabalhos.filter((t) => { const r = d.resumo(t); return !t.cancelado && r.total > 0 && !confirmado(t, r.pago) })

  const pags = [...d.pagamentos].sort((a, b) => b.data.localeCompare(a.data))
  const meses = [...new Set(pags.map((p) => p.data.slice(0, 7)))]

  return (
    <Page title="Pagamentos e dívidas" sub="Visão geral do que entra e do que falta receber">
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi hl"><div className="lbl">Total a receber</div><div className="val">{mt(total).replace(',00', '')}</div><div className="foot">{linhas.length} trabalhos</div></div>
        <div className="card kpi warn"><div className="lbl">Prontos por cobrar</div><div className="val">{mt(prontos.reduce((s, x) => s + x.r.emDivida, 0)).replace(',00', '')}</div><div className="foot">{prontos.length} trabalhos prontos/entregues</div></div>
        <div className="card kpi"><div className="lbl">Em negociação</div><div className="val">{mt(negociacao.reduce((s, t) => s + d.resumo(t).total, 0)).replace(',00', '')}</div><div className="foot">{negociacao.length} trabalho{negociacao.length === 1 ? '' : 's'} · não conta no total</div></div>
        <div className="card kpi"><div className="lbl">Aguardam sinal</div><div className="val">{aguardaSinal.length}</div><div className="foot">{mt(aguardaSinal.reduce((s, t) => s + d.resumo(t).sinalEsperado, 0)).replace(',00', '')} em sinais</div></div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Seg value={vista} onChange={setVista} options={[{ v: 'dividas', l: 'Quem deve', i: 'carteira' }, { v: 'recebidos', l: 'Pagamentos recebidos', i: 'dinheiro' }]} />
      </div>

      {vista === 'dividas' ? (
        <div className="card">
          {linhas.length === 0 ? <Empty icon="check" title="Nada em dívida" /> : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Trabalho</th><th>Cliente</th><th>Etapa</th><th className="r">Total</th><th style={{ width: 140 }}>Pago</th><th className="r">Falta</th><th /></tr></thead>
                <tbody>
                  {linhas.map(({ t, r }) => {
                    const c = d.cliente(t.clienteId)
                    const ult = d.pagamentos.filter((p) => p.trabalhoId === t.id).sort((a, b) => b.data.localeCompare(a.data))[0]
                    const msg = `Olá ${c?.nome.split(' ')[0] || ''}! O trabalho "${t.titulo}" (${t.codigo}) ${t.etapa === 'entrega' ? 'já está pronto' : t.etapa === 'entregue' ? 'foi entregue' : 'está em andamento'}. Valor em falta: ${mt(r.emDivida)}. Obrigado — Puzzle Stickers`
                    return (
                      <tr key={t.id} className="click" onClick={() => ir(`/trabalhos/${t.id}?tab=pagamentos`)}>
                        <td><div className="tiny muted b">{t.codigo}</div><b>{t.titulo}</b></td>
                        <td><div className="row" style={{ gap: 8 }}><Avatar nome={c?.nome || '?'} cor="neutro" size="sm" /><span className="small">{c?.nome}</span></div></td>
                        <td><EtapaBadge e={t.etapa} tipo={t.tipo} />{t.etapa === 'entregue' && t.pagamentoPrometido && <div className="tiny" style={{ marginTop: 4, color: t.pagamentoPrometido < hoje ? 'var(--bad)' : 'var(--tx3)' }}>prometeu {dataMedia(t.pagamentoPrometido)}</div>}</td>
                        <td className="r num nowrap">{mt(r.total)}</td>
                        <td><ProgressoPago pago={r.pago} total={r.total} /><div className="tiny muted" style={{ marginTop: 4 }}>{ult ? `último ${dataMedia(ult.data)} (${diasEntre(ult.data, hoje)}d)` : 'nada pago'}</div></td>
                        <td className="r num nowrap b" style={{ color: 'var(--warn)' }}>{mt(r.emDivida)}</td>
                        <td className="nowrap">
                          <button className="btn sm pri" onClick={(e) => { e.stopPropagation(); setPago(t) }}><Icon n="check" /> Pago</button>{' '}
                          {c?.telefone ? <a className="btn sm icon" href={waLink(c.telefone, msg)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Lembrar por WhatsApp"><Icon n="whatsapp" /></a> : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        meses.map((m) => {
          const xs = pags.filter((p) => p.data.startsWith(m))
          return (
            <div key={m} className="card pad" style={{ marginBottom: 14 }}>
              <h3>{mesNome(m)} <span className="right small tx2 num">{mt(xs.reduce((s, p) => s + p.valor, 0))}</span></h3>
              <div className="list">
                {xs.map((p) => {
                  const t = d.trabalhos.find((x) => x.id === p.trabalhoId)
                  return (
                    <div key={p.id} className="li" onClick={() => t && ir(`/trabalhos/${t.id}?tab=pagamentos`)}>
                      <div className="avatar" style={{ background: 'color-mix(in srgb, var(--ok) 18%, transparent)', color: 'var(--ok)' }}><Icon n="dinheiro" /></div>
                      <div className="main-t"><b>{d.cliente(t?.clienteId)?.nome} · {p.tipo}</b><span>{dataMedia(p.data)} · {p.metodo} · {t?.codigo} {t?.titulo}</span></div>
                      <b className="num nowrap" style={{ color: 'var(--ok)' }}>{mt(p.valor)}</b>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
      {pago && <PagamentoForm t={pago} tudo onClose={() => setPago(null)} />}
    </Page>
  )
}
