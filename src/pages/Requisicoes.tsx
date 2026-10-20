import { useState } from 'react'
import { RequisicaoForm } from './RequisicaoForm'
import { Page } from '../App'
import { faseRequisicao, FASES_REQ, totaisRequisicao, valorRequisicao, type FaseReq } from '../calc'
import { dataMedia, mesNome, mt, num2 } from '../format'
import { ir, useDados } from '../state'
import { Empty, Icon } from '../ui'
import { imprimirLista } from '../print'
import { FaseBadge } from './RequisicaoForm'

export default function Requisicoes({ abrir }: { abrir?: string }) {
  const d = useDados()
  const aberta = abrir ? d.requisicoes.find((r) => r.id === abrir) : undefined
  const taxa = d.empresa.taxaIva
  const [fase, setFase] = useState<FaseReq | ''>('')
  const [nova, setNova] = useState(false)
  const contagem = (Object.keys(FASES_REQ) as FaseReq[]).map((f) => ({ f, n: d.requisicoes.filter((r) => faseRequisicao(r) === f).length })).filter((x) => x.n)
  const lista = d.requisicoes.filter((r) => !fase || faseRequisicao(r) === fase)
  const meses = [...new Set(lista.map((r) => r.data.slice(0, 7)))]
  return (
    <Page title="Requisições" sub="Listas de impressão e encomendas a fornecedores" actions={<button className="btn pri" onClick={() => setNova(true)}><Icon n="plus" /> <span className="hide-m">Nova requisição</span></button>}>
      <div className="row wrap" style={{ marginBottom: 14, gap: 6 }}>
        <button className={`btn sm ${!fase ? 'pri' : ''}`} onClick={() => setFase('')}>Todas · {d.requisicoes.length}</button>
        {contagem.map(({ f, n }) => (
          <button key={f} className={`btn sm ${fase === f ? 'pri' : ''}`} onClick={() => setFase(f)}>
            <i style={{ width: 8, height: 8, borderRadius: 3, background: FASES_REQ[f].cor, display: 'inline-block' }} /> {FASES_REQ[f].nome} · {n}
          </button>
        ))}
      </div>
      {lista.length === 0 && <div className="card"><Empty icon="imprimir" title="Sem requisições" /></div>}
      {meses.map((m) => {
        const xs = lista.filter((r) => r.data.startsWith(m))
        const tot = xs.reduce((a, r) => ({ m2: a.m2 + totaisRequisicao(r, taxa).m2, total: a.total + valorRequisicao(r, taxa) }), { m2: 0, total: 0 })
        return (
          <div key={m} className="card pad" style={{ marginBottom: 14 }}>
            <h3>{mesNome(m)} <span className="right small tx2">{num2(tot.m2)} m² · {mt(tot.total)}</span></h3>
            <div className="list">
              {xs.map((r) => {
                const t = totaisRequisicao(r, taxa)
                const job = d.trabalhos.find((x) => x.id === r.trabalhoId)
                return (
                  <div key={r.id} className="li" onClick={() => ir(`/requisicoes/${r.id}`)}>
                    <div className="avatar" style={{ background: 'var(--card2)', color: 'var(--y)' }}><Icon n={r.tipo === 'encomenda' ? 'caixa' : 'imprimir'} /></div>
                    <div className="main-t">
                      <b>{r.numero} · {d.fornecedor(r.fornecedorId)?.nome}{r.proforma ? ` · PF ${r.proforma.numero}` : ''}</b>
                      <span>{dataMedia(r.data)} · {job ? `${job.codigo} ${job.titulo}` : 'sem trabalho'}{r.tipo !== 'encomenda' ? ` · ${num2(t.m2)} m²` : ''}</span>
                    </div>
                    <FaseBadge r={r} />
                    <b className="num nowrap hide-m">{mt(valorRequisicao(r, taxa))}</b>
                    {r.tipo !== 'encomenda' && <button className="btn sm icon" onClick={(e) => { e.stopPropagation(); imprimirLista(r, d) }} title="PDF"><Icon n="imprimir" /></button>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {nova && <RequisicaoForm onClose={() => setNova(false)} />}
      {aberta && <RequisicaoForm r={aberta} trabalho={d.trabalhos.find((t) => t.id === aberta.trabalhoId)} onClose={() => ir('/requisicoes')} />}
    </Page>
  )
}
