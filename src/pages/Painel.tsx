import { useMemo, useState } from 'react'
import { Page } from '../App'
import { addMeses, confirmado, contaParaReceber, contasAPagar, diasEntre, faseRequisicao, fixasDoMes, hojeISO, ivaDoMes, r2, resultadoDoMes, secaoAgenda, semDocumento } from '../calc'
import type { Etapa } from '../db'
import { dataCurta, mesNome, mt, mtCurto } from '../format'
import { ir, useDados, useSessao } from '../state'
import { Avatar, Icon } from '../ui'
import { LinhaAgenda, useAgenda } from './Agenda'
import { EmitirFatura, EmitirRecibo, NovoPedido } from './Rapido'
import { novaCotacao } from './Cotacoes'
import { DespesaForm } from './Despesas'
import { CaixaModal, useCaixa } from './Resumo'

type Acao = 'pedido' | 'fatura' | 'recibo' | 'compra'

// Home (16 Oct): today and this week first, how many jobs in each phase, the quick
// buttons, then the money — "a receber" only counts confirmed or delivered work.
export default function Painel() {
  const d = useDados()
  const { user, pode } = useSessao()
  const hoje = hojeISO()
  const mes = hoje.slice(0, 7)
  const fin = pode('financas')
  const [acao, setAcao] = useState<Acao | null>(null)
  const [acertar, setAcertar] = useState(false)
  const agenda = useAgenda()
  const caixa = useCaixa()

  const s = useMemo(() => {
    const vivos = d.trabalhos.filter((t) => !t.cancelado && (pode('todosTrabalhos') || t.responsavelId === user.id))
    const naFase = (...es: Etapa[]) => vivos.filter((t) => es.includes(t.etapa))
    const pedidos = naFase('pedido')
    const negociacao = naFase('negociacao')
    const emCurso = naFase('layout', 'producao', 'montagem')
    const paraEntregar = naFase('entrega')
    const valorNegociacao = negociacao.reduce((a, t) => a + d.resumo(t).total, 0)

    const devedores = new Map<string, { divida: number; jobs: number }>()
    let aReceber = 0
    let valorAberto = 0
    let recebidoAberto = 0
    for (const t of d.trabalhos) {
      const r = d.resumo(t)
      if (!contaParaReceber(t, r)) continue
      aReceber += r.emDivida
      valorAberto += r.total
      recebidoAberto += r.pago
      const x = devedores.get(t.clienteId) || { divida: 0, jobs: 0 }
      x.divida += r.emDivida
      x.jobs++
      devedores.set(t.clienteId, x)
    }

    // What needs attention, following his terms.
    const alertas: { tipo: 'bad' | 'warn' | 'info'; t: string; s: string; to: string }[] = []
    if (fin) {
      for (const t of d.trabalhos.filter((x) => !x.cancelado && x.etapa === 'entregue')) {
        const r = d.resumo(t)
        if (r.emDivida <= 0 || r.total === 0) continue
        const cli = d.cliente(t.clienteId)?.nome || ''
        const to = `/trabalhos/${t.id}?tab=pagamentos`
        if (!t.pagamentoPrometido) alertas.push({ tipo: 'warn', t: `${t.codigo} · entregue sem o pagamento final`, s: `${cli} — falta ${mt(r.emDivida)}.`, to })
        else if (t.pagamentoPrometido < hoje) alertas.push({ tipo: 'bad', t: `${cli} prometeu pagar até ${dataCurta(t.pagamentoPrometido)} — ${diasEntre(t.pagamentoPrometido, hoje)} dias de atraso`, s: `${t.codigo} · falta ${mt(r.emDivida)}.`, to })
        else if (diasEntre(hoje, t.pagamentoPrometido) <= 2) alertas.push({ tipo: 'info', t: `${cli} paga ${diasEntre(hoje, t.pagamentoPrometido) === 0 ? 'hoje' : `a ${dataCurta(t.pagamentoPrometido)}`}`, s: `${t.codigo} · ${mt(r.emDivida)}.`, to })
      }
      for (const t of vivos.filter((x) => x.etapa !== 'entregue')) {
        const r = d.resumo(t)
        const cli = d.cliente(t.clienteId)?.nome || ''
        if (t.etapa === 'negociacao') {
          const desde = [...t.etapas].reverse().find((e) => e.etapa === 'negociacao')?.em.slice(0, 10) || t.dataEntrada
          const dias = diasEntre(desde, hoje)
          if (dias >= 7 && !t.prazos?.negociacao) alertas.push({ tipo: 'info', t: `${t.codigo} · em negociação há ${dias} dias`, s: `${cli} — dar seguimento${r.total ? ` (${mt(r.total)})` : ''}.`, to: `/trabalhos/${t.id}` })
        }
        if (r.total > 0 && !r.sinalPago && confirmado(t, r.pago) && ['layout', 'producao', 'montagem'].includes(t.etapa))
          alertas.push({ tipo: 'warn', t: `${t.codigo} · a trabalhar sem sinal`, s: `${cli} — pedir o sinal de ${d.empresa.sinalPct}%: ${mt(r.sinalEsperado - r.pago)}.`, to: `/trabalhos/${t.id}?tab=pagamentos` })
        if (t.etapa === 'entrega' && r.emDivida > 0)
          alertas.push({ tipo: 'warn', t: `${t.codigo} · pronto para entregar`, s: `${cli} — ${mt(r.emDivida)} a cobrar na entrega.`, to: `/trabalhos/${t.id}` })
        if (r.total === 0 && confirmado(t, r.pago))
          alertas.push({ tipo: 'info', t: `${t.codigo} · valor de venda por definir`, s: `${cli} — preencha o valor para contar no "a receber".`, to: `/trabalhos/${t.id}` })
      }
      // Paid with "Pago" but the fatura-recibo / recibo is not in yet.
      const porDoc = new Map<string, number>()
      for (const p of semDocumento(d.pagamentos)) porDoc.set(p.trabalhoId, r2((porDoc.get(p.trabalhoId) || 0) + p.valor))
      for (const [id, v] of porDoc) {
        const t = d.trabalhos.find((x) => x.id === id)
        if (t) alertas.push({ tipo: 'warn', t: `${t.codigo} · recebido sem fatura/recibo`, s: `${d.cliente(t.clienteId)?.nome || ''} — passar o documento de ${mt(v)}.`, to: `/trabalhos/${t.id}` })
      }
      for (const r of d.requisicoes) {
        const fase = faseRequisicao(r)
        const forn = d.fornecedor(r.fornecedorId)?.nome || ''
        const to = `/requisicoes/${r.id}`
        if (fase === 'enviada') {
          const dias = diasEntre(r.enviadaEm || r.data, hoje)
          if (dias >= 1) alertas.push({ tipo: 'info', t: `${r.numero} · à espera da pró-forma há ${dias} dia${dias > 1 ? 's' : ''}`, s: `${forn} — lista ${r.nomeTrabalho}.`, to })
        }
        if (fase === 'proforma') alertas.push({ tipo: 'warn', t: `Pró-forma ${r.proforma?.numero} por pagar`, s: `${forn} só avança depois do pagamento — ${mt(r.proforma?.valor || 0)}.`, to })
      }
      for (const c of contasAPagar(d.requisicoes, d.empresa.taxaIva).filter((x) => x.credito)) {
        const job = d.trabalhos.find((t) => t.id === c.r.trabalhoId)
        const res = job && d.resumo(job)
        if (job && res && res.total > 0 && res.emDivida <= 0)
          alertas.push({ tipo: 'warn', t: `${d.cliente(job.clienteId)?.nome} já pagou ${job.codigo} — liquidar o crédito`, s: `Pró-forma ${c.r.proforma?.numero || c.r.numero} na ${d.fornecedor(c.r.fornecedorId)?.nome} — ${mt(c.valor)}.`, to: '/contas-pagar' })
      }
    }
    if (pode('despesas')) {
      // Last month too: its window (25 → 5) is still open in the first days of this one.
      for (const m of [addMeses(mes, -1), mes]) {
        const fixas = fixasDoMes(d.despesasFixas, d.despesas, m, hoje)
        const soma = (xs: typeof fixas) => mt(xs.reduce((a, e) => a + e.fixa.valor, 0))
        const atrasadas = fixas.filter((e) => e.estado === 'atrasada')
        const abertas = fixas.filter((e) => e.estado === 'a-pagar')
        const nomeMes = mesNome(m).split(' ')[0].toLowerCase()
        if (atrasadas.length) alertas.push({ tipo: 'bad', t: atrasadas.length === 1 ? `${atrasadas[0].fixa.nome} · por pagar desde ${dataCurta(atrasadas[0].vencimento)}` : `${atrasadas.length} despesas fixas de ${nomeMes} em atraso`, s: `${atrasadas.map((e) => e.fixa.nome).join(', ')} — ${soma(atrasadas)}`, to: `/despesas?mes=${m}` })
        if (abertas.length) alertas.push({ tipo: 'info', t: `${abertas.length === 1 ? abertas[0].fixa.nome : `${abertas.length} despesas fixas de ${nomeMes}`} · pagar até ${dataCurta(abertas[0].vencimento)}`, s: `${abertas.map((e) => e.fixa.nome).join(', ')} — ${soma(abertas)}`, to: `/despesas?mes=${m}` })
      }
    }
    const peso = { bad: 0, warn: 1, info: 2 }
    alertas.sort((a, b) => peso[a.tipo] - peso[b.tipo])
    const resultado = resultadoDoMes(mes, d.documentos, d.requisicoes, d.custos, d.despesas, d.empresa.taxaIva)
    const contas = contasAPagar(d.requisicoes, d.empresa.taxaIva)
    const iva = ivaDoMes(d.documentos, mes)
    return { pedidos, negociacao, emCurso, paraEntregar, valorNegociacao, devedores, aReceber, valorAberto, recebidoAberto, alertas, resultado, contas, iva }
  }, [d, hoje, mes, fin, pode, user])

  const agoraItens = agenda.filter((i) => ['atrasado', 'hoje'].includes(secaoAgenda(i, hoje)))
  const semana = agenda.filter((i) => secaoAgenda(i, hoje) === 'semana')
  const semData = agenda.filter((i) => secaoAgenda(i, hoje) === 'semData')
  const hora = new Date().getHours()
  const ola = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const devs = [...s.devedores.entries()].sort((a, b) => b[1].divida - a[1].divida)
  const devo = s.contas.reduce((a, c) => a + c.valor, 0)

  const botoes: { a: Acao | 'cotacao'; l: string; i: string; ok: boolean }[] = [
    { a: 'pedido', l: 'Novo pedido', i: 'plus', ok: pode('editarTrabalho') },
    { a: 'cotacao', l: 'Cotação', i: 'cotacao', ok: fin },
    { a: 'fatura', l: 'Fatura', i: 'upload', ok: fin },
    { a: 'recibo', l: 'Recibo', i: 'dinheiro', ok: fin },
    { a: 'compra', l: 'Compra', i: 'despesa', ok: pode('despesas') }
  ]
  const fases: { l: string; n: number; e: Etapa; extra?: string }[] = [
    { l: 'Pedidos', n: s.pedidos.length, e: 'pedido' },
    { l: 'Em negociação', n: s.negociacao.length, e: 'negociacao', extra: fin && s.valorNegociacao ? mtCurto(s.valorNegociacao) : undefined },
    { l: 'Em curso', n: s.emCurso.length, e: 'layout' },
    { l: 'Para entregar', n: s.paraEntregar.length, e: 'entrega' }
  ]

  return (
    <Page title="Início" sub={mesNome(mes)}>
      <div className="hello">
        <div>
          <h2>{ola}, {user.nome.split(' ')[0]}.</h2>
          <p>{agoraItens.length ? `${agoraItens.length} coisa${agoraItens.length > 1 ? 's' : ''} para hoje` : 'Nada marcado para hoje'}{semana.length ? ` · ${semana.length} nos próximos 7 dias` : ''}</p>
        </div>
      </div>

      <div className="rapido">
        {botoes.filter((b) => b.ok).map((b) => (
          <button key={b.a} className="btn" onClick={() => (b.a === 'cotacao' ? novaCotacao(d, user.id) : setAcao(b.a))}>
            <Icon n={b.i} /> {b.l}
          </button>
        ))}
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        {fases.map((f) => (
          <div key={f.e} className={`card kpi link ${f.e === 'negociacao' ? '' : f.n && f.e === 'entrega' ? 'hl' : ''}`} onClick={() => ir(f.e === 'layout' ? '/trabalhos' : `/trabalhos?etapa=${f.e}`)}>
            <div className="lbl">{f.l}</div>
            <div className="val">{f.n}</div>
            <div className="foot">{f.extra ? `${f.extra} · não conta no a receber` : f.e === 'layout' ? 'layout, produção, montagem' : ' '}</div>
          </div>
        ))}
      </div>

      <div className="grid g-main">
        <div className="col" style={{ gap: 14 }}>
          <div className="card pad">
            <h3><Icon n="agenda" /> Hoje <a className="right small tx2" href="#/agenda">Agenda →</a></h3>
            {agoraItens.length === 0 ? <div className="small muted">Nada para hoje. Escreva tarefas na Agenda para não se esquecer de nada.</div> : <div className="list">{agoraItens.slice(0, 10).map((i) => <LinhaAgenda key={i.id} i={i} mostrarData={!!i.data && i.data < hoje} />)}</div>}
          </div>

          {semana.length > 0 && (
            <div className="card pad">
              <h3><Icon n="relogio" /> Próximos 7 dias</h3>
              <div className="list">{semana.slice(0, 8).map((i) => <LinhaAgenda key={i.id} i={i} mostrarData />)}</div>
            </div>
          )}

          {semData.length > 0 && (
            <div className="card pad">
              <h3><Icon n="bandeira" /> Sem data <span className="right badge">{semData.length}</span></h3>
              <div className="list">{semData.slice(0, 6).map((i) => <LinhaAgenda key={i.id} i={i} />)}</div>
            </div>
          )}

          {s.alertas.length > 0 && (
            <div className="card pad">
              <h3><Icon n="alerta" /> O que precisa de atenção <span className="right badge">{s.alertas.length}</span></h3>
              <div className="col" style={{ gap: 8 }}>
                {s.alertas.slice(0, 8).map((a, i) => (
                  <div key={i} className={`alert ${a.tipo}`} onClick={() => ir(a.to)}>
                    <Icon n={a.tipo === 'info' ? 'bandeira' : 'alerta'} />
                    <div style={{ minWidth: 0 }}>
                      <b>{a.t}</b>
                      <span>{a.s}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col" style={{ gap: 14 }}>
          {fin && (
            <div className="card pad">
              <h3><Icon n="carteira" /> Quem me deve <a className="right small tx2" href="#/dividas">Tudo →</a></h3>
              {devs.length === 0 ? <div className="small muted">Ninguém deve nada.</div> : (
                <div className="list">
                  {devs.slice(0, 6).map(([cid, x]) => {
                    const c = d.cliente(cid)
                    return (
                      <div key={cid} className="li" onClick={() => ir(`/clientes/${cid}`)}>
                        <Avatar nome={c?.nome || '?'} cor="neutro" />
                        <div className="main-t"><b>{c?.nome}</b><span>{x.jobs} trabalho{x.jobs > 1 ? 's' : ''}</span></div>
                        <b className="num nowrap">{mt(x.divida)}</b>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {pode('iva') && (
            <div className="card pad" style={{ cursor: 'pointer' }} onClick={() => ir('/iva')}>
              <h3><Icon n="iva" /> IVA de {mesNome(mes).split(' ')[0].toLowerCase()} <span className="right small tx2">Ver →</span></h3>
              <dl className="kv">
                <dt>Liquidado (vendas)</dt><dd>{mt(s.iva.liquidado)}</dd>
                <dt>Dedutível (compras)</dt><dd>{mt(s.iva.dedutivel)}</dd>
                <dt className="b" style={{ color: 'var(--tx)' }}>{s.iva.credito > 0 ? 'Crédito' : 'A pagar'}</dt><dd className="b">{mt(s.iva.credito || s.iva.apagar)}</dd>
              </dl>
            </div>
          )}
        </div>
      </div>

      {fin && (
        <div style={{ marginTop: 18 }}>
          <h3 className="sec-t"><Icon n="carteira" /> Caixa</h3>
          <div className="grid g4">
            <div className="card kpi hl link" onClick={() => (pode('despesas') ? setAcertar(true) : undefined)}>
              <div className="lbl">Em caixa</div>
              <div className="val">{caixa.saldo !== undefined ? mtCurto(caixa.saldo) : '—'}</div>
              <div className="foot">{caixa.caixa ? `acertado a ${dataCurta(caixa.caixa.data)}` : 'tocar para dizer quanto tem'}</div>
            </div>
            <div className="card kpi link" onClick={() => ir('/dividas')}>
              <div className="lbl">Valor dos trabalhos</div>
              <div className="val">{mtCurto(s.valorAberto)}</div>
              <div className="foot">confirmados por receber · já recebido {mtCurto(s.recebidoAberto)}</div>
            </div>
            <div className="card kpi link" onClick={() => ir('/dividas')}>
              <div className="lbl">Falta receber</div>
              <div className="val" style={{ color: s.aReceber ? 'var(--warn)' : undefined }}>{mtCurto(s.aReceber)}</div>
              <div className="foot">{devs.length} cliente{devs.length === 1 ? '' : 's'}</div>
            </div>
            <div className="card kpi link" onClick={() => ir('/contas-pagar')}>
              <div className="lbl">Eu devo</div>
              <div className="val" style={{ color: devo ? 'var(--bad)' : undefined }}>{mtCurto(devo)}</div>
              <div className="foot">fornecedores (crédito)</div>
            </div>
          </div>
        </div>
      )}

      {acertar && <CaixaModal onClose={() => setAcertar(false)} />}
      {acao === 'pedido' && <NovoPedido onClose={() => setAcao(null)} />}
      {acao === 'fatura' && <EmitirFatura onClose={() => setAcao(null)} />}
      {acao === 'recibo' && <EmitirRecibo onClose={() => setAcao(null)} />}
      {acao === 'compra' && <DespesaForm titulo="Nova compra" preset={{ categoria: 'Outros', data: hoje, documento: 'fatura' }} onClose={() => setAcao(null)} />}
    </Page>
  )
}
