import { useState } from 'react'
import { agora, db, guardar, registar, type Etapa, type Trabalho } from '../db'
import { addDias, confirmado, etapaInfo, etapasDoTipo, hojeISO } from '../calc'
import { dataCurta, dataMedia, mt } from '../format'
import { moverEtapa } from '../acoes'
import { useDados, useSessao } from '../state'
import { Field, Icon, Modal, useToast } from '../ui'
import { FaseBadge } from './RequisicaoForm'

// Momad's phases (16 Oct): one clear step at a time, each with its own button and
// an optional deadline. Pedido → Em negociação → Layout → Produção → Montagem → Entrega.
export function FasesTrabalho({ t, onCotacao, onRequisicao, onPago, abrirEntrega }: { t: Trabalho; onCotacao: () => void; onRequisicao: () => void; onPago?: () => void; abrirEntrega?: boolean }) {
  const d = useDados()
  const { user, pode } = useSessao()
  const toast = useToast()
  const [entregar, setEntregar] = useState(!!abrirEntrega && t.etapa !== 'entregue')
  const todas = etapasDoTipo(t.tipo)
  const seq = todas.filter((e) => e !== 'entregue')
  const idx = t.etapa === 'entregue' ? seq.length : seq.indexOf(t.etapa)
  const podeMover = pode('editarTrabalho') || t.responsavelId === user.id
  const fin = pode('financas')
  const r = d.resumo(t)
  const reqs = d.requisicoes.filter((x) => x.trabalhoId === t.id)
  const cot = d.cotacoes.find((c) => c.id === t.cotacaoId)
  const nome = (e: Etapa) => etapaInfo(e, t.tipo).nome
  const depois = (e: Etapa) => todas[todas.indexOf(e) + 1]

  const salvar = (p: Partial<Trabalho>) => guardar(db.trabalhos, { ...t, ...p })
  const prazoDe = (e: Etapa, v: string) => salvar({ prazos: { ...t.prazos, [e]: v || undefined } })
  const avancar = async (extra: Partial<Trabalho> = {}, msg?: string) => {
    const p = depois(t.etapa)
    if (!p) return
    if (p === 'entregue') return setEntregar(true)
    await moverEtapa(t, p, user.id, extra)
    toast(msg || `Passou para ${nome(p)}`)
  }

  // When a phase was finished: the day the job entered the next one.
  const feitaEm = (e: Etapa) => {
    const i = todas.indexOf(e)
    const seguinte = t.etapas.filter((x) => todas.indexOf(x.etapa) > i).map((x) => x.em).sort()[0]
    return seguinte?.slice(0, 10)
  }
  const limiteDe = (e: Etapa) => (e === 'montagem' ? t.montagemAte || t.montagemDe : e === 'entrega' ? t.prazo : t.prazos?.[e]) || undefined

  return (
    <div className="card pad" style={{ marginBottom: 14 }}>
      <div className="stepper">
        {seq.map((e, i) => {
          const st = i < idx ? 'done' : i === idx ? 'cur' : ''
          const quando = st === 'done' ? feitaEm(e) : limiteDe(e)
          return (
            <div
              key={e}
              className={`step ${st}`}
              style={{ cursor: podeMover && i !== idx ? 'pointer' : 'default' }}
              title={podeMover && i !== idx ? `Mover para ${nome(e)}` : ''}
              onClick={() => podeMover && i !== idx && (i > idx || confirm(`Voltar o trabalho para ${nome(e)}?`)) && moverEtapa(t, e, user.id)}
            >
              <span className="dot">{st === 'done' && <Icon n="check" />}</span>
              {etapaInfo(e, t.tipo).curto}
              <span className="when" style={{ color: st !== 'done' && quando && quando < hojeISO() ? 'var(--bad)' : undefined }}>{quando ? `${st === 'done' ? '' : 'até '}${dataCurta(quando)}` : ' '}</span>
            </div>
          )
        })}
      </div>

      <div className="fase-agora">
        {t.etapa === 'pedido' && (
          <>
            <div className="fase-t"><b>Pedido</b> — o cliente pediu e ainda não há cotação.</div>
            {t.descricao && <div className="small tx2 pre" style={{ marginBottom: 10 }}>{t.descricao}</div>}
            <div className="row wrap" style={{ gap: 8 }}>
              {fin && <button className="btn pri" onClick={onCotacao}><Icon n="cotacao" /> Fazer cotação</button>}
              {podeMover && <button className="btn" onClick={() => avancar({}, 'Em negociação')}>Já está em negociação</button>}
              <DataFase label="Responder até" v={t.prazos?.pedido} onChange={(v) => prazoDe('pedido', v)} />
            </div>
          </>
        )}

        {t.etapa === 'negociacao' && (
          <>
            <div className="fase-t"><b>Em negociação</b> — {fin && r.total > 0 ? <>{mt(r.total)} ainda <u>não conta</u> no "a receber".</> : 'à espera da resposta do cliente.'}</div>
            <div className="row wrap" style={{ gap: 8 }}>
              {podeMover && <button className="btn pri" onClick={() => avancar({ confirmadoEm: hojeISO() }, 'Confirmado — já conta no "a receber"')}><Icon n="check" /> Cliente confirmou</button>}
              {fin && (cot ? <a className="btn" href={`#/cotacoes/${cot.id}`}><Icon n="cotacao" /> {cot.numero}</a> : <button className="btn" onClick={onCotacao}><Icon n="cotacao" /> Fazer cotação</button>)}
              <DataFase label="Resposta até" v={t.prazos?.negociacao} onChange={(v) => prazoDe('negociacao', v)} />
            </div>
          </>
        )}

        {t.etapa === 'layout' && (
          <>
            <div className="fase-t"><b>{nome('layout')}</b>{confirmado(t, r.pago) && t.confirmadoEm ? ` — confirmado a ${dataCurta(t.confirmadoEm)}` : ''}</div>
            <div className="row wrap" style={{ gap: 8 }}>
              {podeMover && <button className="btn pri" onClick={() => avancar({ layoutAprovadoEm: hojeISO() }, `${nome('layout')} aprovado`)}><Icon n="check" /> Aprovado</button>}
              <DataFase label={`${nome('layout')} até`} v={t.prazos?.layout} onChange={(v) => prazoDe('layout', v)} />
            </div>
          </>
        )}

        {t.etapa === 'producao' && (
          <>
            <div className="fase-t"><b>{nome('producao')}</b>{t.layoutAprovadoEm ? ` — layout aprovado a ${dataCurta(t.layoutAprovadoEm)}` : ''}</div>
            <div className="list" style={{ marginBottom: 10 }}>
              {reqs.map((x) => (
                <a key={x.id} className="li" href={`#/requisicoes/${x.id}`}>
                  <div className="main-t">
                    <b>{d.fornecedor(x.fornecedorId)?.nome || 'Fornecedor'} · {x.numero}</b>
                    <span>{x.enviadaEm ? `Pedido enviado a ${dataMedia(x.enviadaEm)}` : x.proforma ? `Pró-forma ${x.proforma.numero} de ${dataMedia(x.proforma.data)}` : x.estado === 'rascunho' ? 'Preparado — ainda não foi enviado' : dataMedia(x.data)}</span>
                  </div>
                  <FaseBadge r={x} />
                </a>
              ))}
              {reqs.length === 0 && <div className="small muted">Ainda sem pedido ao fornecedor nesta app.</div>}
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {podeMover && <button className="btn pri" onClick={() => avancar({}, 'Produção pronta')}><Icon n="check" /> Produção pronta</button>}
              {fin && <button className="btn" onClick={onRequisicao}><Icon n="imprimir" /> Pedido à Académica</button>}
              <DataFase label="Pedido feito a (fora da app)" v={t.pedidoFornecedorEm} onChange={(v) => salvar({ pedidoFornecedorEm: v || undefined })} hoje />
              <DataFase label="Produção até" v={t.prazos?.producao} onChange={(v) => prazoDe('producao', v)} />
            </div>
          </>
        )}

        {t.etapa === 'montagem' && (
          <>
            <div className="fase-t"><b>Montagem</b>{t.montagemDe ? ` — de ${dataCurta(t.montagemDe)}${t.montagemAte ? ` a ${dataCurta(t.montagemAte)}` : ''}` : ' — marque os dias'}</div>
            <div className="row wrap" style={{ gap: 8 }}>
              {podeMover && <button className="btn pri" onClick={() => avancar({}, 'Montagem feita')}><Icon n="check" /> Montagem feita</button>}
              <DataFase label="De" v={t.montagemDe} onChange={(v) => salvar({ montagemDe: v || undefined, ...(v && t.montagemAte && t.montagemAte < v ? { montagemAte: v } : {}) })} />
              <DataFase label="Até" v={t.montagemAte} onChange={(v) => salvar({ montagemAte: v || undefined })} />
            </div>
          </>
        )}

        {t.etapa === 'entrega' && (
          <>
            <div className="fase-t"><b>Entrega</b> — {t.prazo ? `prevista para ${dataMedia(t.prazo)}` : 'sem data prevista'}{fin && r.emDivida > 0 ? ` · o cliente ainda deve ${mt(r.emDivida)}` : ''}</div>
            <div className="row wrap" style={{ gap: 8 }}>
              {podeMover && <button className="btn pri" onClick={() => setEntregar(true)}><Icon n="check" /> Entregue</button>}
              {onPago && <button className="btn" onClick={onPago}><Icon n="dinheiro" /> Pago</button>}
              <DataFase label="Entrega prevista" v={t.prazo} onChange={(v) => salvar({ prazo: v || '' })} />
            </div>
          </>
        )}

        {t.etapa === 'entregue' && (
          <div className="fase-t">
            <b>Entregue</b> a {dataMedia(feitaEm(seq[seq.length - 1]) || t.etapas.find((x) => x.etapa === 'entregue')?.em.slice(0, 10) || hojeISO())}
            {fin && r.emDivida > 0 ? <> · falta receber <b style={{ color: 'var(--warn)' }}>{mt(r.emDivida)}</b>{t.pagamentoPrometido ? ` (prometido para ${dataCurta(t.pagamentoPrometido)})` : ''}</> : fin && r.total > 0 ? ' · pago' : ''}
            {onPago && <div style={{ marginTop: 10 }}><button className="btn pri" onClick={onPago}><Icon n="check" /> Pago</button></div>}
          </div>
        )}

        {podeMover && t.etapa !== 'entregue' && depois(t.etapa) && depois(t.etapa) !== 'entregue' && t.etapa !== 'pedido' && (
          <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => avancar()}>Saltar {nome(t.etapa).toLowerCase()} →</button>
        )}
      </div>

      {t.etapa !== 'entregue' && (
        <details className="fase-datas">
          <summary>Datas de todas as fases</summary>
          <div className="form-grid" style={{ marginTop: 10 }}>
            {seq.slice(Math.max(0, idx)).map((e) =>
              e === 'montagem' ? (
                <div key={e} className="field">
                  <span>Montagem</span>
                  <div className="row" style={{ gap: 6 }}>
                    <input type="date" value={t.montagemDe || ''} onChange={(ev) => salvar({ montagemDe: ev.target.value || undefined })} />
                    <input type="date" value={t.montagemAte || ''} onChange={(ev) => salvar({ montagemAte: ev.target.value || undefined })} />
                  </div>
                </div>
              ) : e === 'entrega' ? (
                <Field key={e} label="Entrega prevista"><input type="date" value={t.prazo || ''} onChange={(ev) => salvar({ prazo: ev.target.value })} /></Field>
              ) : (
                <Field key={e} label={`${nome(e)} até`}><input type="date" value={t.prazos?.[e] || ''} onChange={(ev) => prazoDe(e, ev.target.value)} /></Field>
              )
            )}
          </div>
        </details>
      )}

      {entregar && <EntregaModal t={t} emDivida={fin ? r.emDivida : 0} onClose={() => setEntregar(false)} />}
    </div>
  )
}

function DataFase({ label, v, onChange, hoje }: { label: string; v?: string; onChange: (v: string) => void; hoje?: boolean }) {
  return (
    <label className="data-fase">
      <span>{label}</span>
      <input type="date" value={v || ''} onChange={(e) => onChange(e.target.value)} />
      {hoje && !v && <button type="button" className="btn sm ghost" onClick={(e) => { e.preventDefault(); onChange(hojeISO()) }}>Hoje</button>}
    </label>
  )
}

// The Entrega button: confirm the day; with money still owed, the day the client promised to pay.
function EntregaModal({ t, emDivida, onClose }: { t: Trabalho; emDivida: number; onClose: () => void }) {
  const { user } = useSessao()
  const toast = useToast()
  const [data, setData] = useState(hojeISO())
  const [promessa, setPromessa] = useState(emDivida > 0 ? addDias(hojeISO(), 7) : '')
  async function ok() {
    const novo: Trabalho = {
      ...t,
      etapa: 'entregue',
      etapas: [...t.etapas, { etapa: 'entregue', em: data === hojeISO() ? agora() : `${data}T12:00:00.000Z`, por: user.id }],
      ...(t.confirmadoEm ? {} : { confirmadoEm: data }),
      ...(emDivida > 0 && promessa ? { pagamentoPrometido: promessa } : {})
    }
    await guardar(db.trabalhos, novo)
    await registar(user.id, `entregou ${t.codigo}`, t.id)
    toast(emDivida > 0 ? `Entregue · falta receber ${mt(emDivida)}` : 'Entregue')
    onClose()
  }
  return (
    <Modal title={`Entregar ${t.codigo}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" onClick={ok}><Icon n="check" /> Confirmar entrega</button></>}>
      <div className="form-grid">
        <Field label="Data da entrega"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
        {emDivida > 0 && <Field label="O cliente prometeu pagar até" hint={`Ainda deve ${mt(emDivida)}. Fica nos avisos do Início.`}><input type="date" value={promessa} onChange={(e) => setPromessa(e.target.value)} /></Field>}
      </div>
    </Modal>
  )
}
