import { useState } from 'react'
import { Page } from '../App'
import { hojeISO, ivaDoMes } from '../calc'
import { dataMedia, mesNome, mt } from '../format'
import { useDados, useRota } from '../state'
import { Empty, Icon } from '../ui'
import { DocLinha } from './Documentos'
import { exportarIvaExcel, imprimirIva } from '../print'

export default function Iva() {
  const d = useDados()
  const { query } = useRota()
  const [mes, setMes] = useState(query.get('mes') || hojeISO().slice(0, 7))
  const r = ivaDoMes(d.documentos, mes)
  const mover = (n: number) => {
    const x = new Date(mes + '-15T12:00:00')
    x.setMonth(x.getMonth() + n)
    setMes(x.toISOString().slice(0, 7))
  }
  // Delivered/charged jobs this month with no invoice registered yet: easy to forget.
  const semFatura = d.trabalhos.filter((t) => {
    const pagosMes = d.pagamentos.some((p) => p.trabalhoId === t.id && p.data.startsWith(mes))
    const temDoc = d.documentos.some((x) => x.trabalhoId === t.id && x.direcao === 'emitido' && x.data.startsWith(mes))
    return pagosMes && !temDoc
  })
  const venc = (() => {
    const x = new Date(mes + '-15T12:00:00')
    x.setMonth(x.getMonth() + 2, 0)
    return x.toISOString().slice(0, 10)
  })()

  return (
    <Page
      title="Relação do IVA"
      sub="Regime normal · declaração mensal"
      actions={
        <>
          <button className="btn" onClick={() => exportarIvaExcel(mes, r, d)}><Icon n="excel" /> <span className="hide-m">Excel</span></button>
          <button className="btn pri" onClick={() => imprimirIva(mes, r, d)}><Icon n="imprimir" /> <span className="hide-m">PDF</span></button>
        </>
      }
    >
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn icon" onClick={() => mover(-1)} aria-label="Mês anterior"><Icon n="left" /></button>
        <div className="b" style={{ fontSize: 18, minWidth: 170, textAlign: 'center' }}>{mesNome(mes)}</div>
        <button className="btn icon" onClick={() => mover(1)} aria-label="Mês seguinte"><Icon n="right" /></button>
        <input type="month" className="inp" style={{ width: 'auto', marginLeft: 'auto' }} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div className="card kpi">
          <div className="lbl"><Icon n="upload" /> IVA liquidado</div>
          <div className="val">{mt(r.liquidado)}</div>
          <div className="foot">{r.emitidos.length} faturas emitidas · base {mt(r.baseVendas)}</div>
        </div>
        <div className="card kpi">
          <div className="lbl"><Icon n="download" /> IVA dedutível</div>
          <div className="val">{mt(r.dedutivel)}</div>
          <div className="foot">{r.recebidos.length} faturas de fornecedores · base {mt(r.baseCompras)}</div>
        </div>
        <div className="card kpi hl">
          <div className="lbl"><Icon n="iva" /> {r.credito > 0 ? 'Crédito a reportar' : 'IVA a pagar'}</div>
          <div className="val">{mt(r.credito > 0 ? r.credito : r.apagar)}</div>
          <div className="foot">liquidado − dedutível</div>
        </div>
      </div>

      <div className="banner">
        <Icon n="relogio" />
        <span>Resumo para entregar ao contabilista e preparar a declaração periódica de {mesNome(mes)}. Confirme o prazo de entrega com o contabilista (normalmente até {dataMedia(venc)}).</span>
      </div>

      {semFatura.length > 0 && (
        <div className="alert warn" style={{ marginBottom: 14, cursor: 'default' }}>
          <Icon n="alerta" />
          <div>
            <b>{semFatura.length} trabalho{semFatura.length > 1 ? 's' : ''} com pagamento este mês sem fatura emitida registada</b>
            <span>{semFatura.map((t) => `${t.codigo} (${d.cliente(t.clienteId)?.nome})`).join(' · ')}</span>
          </div>
        </div>
      )}

      <div className="grid g2">
        <div className="card pad">
          <h3>Emitidos (vendas) <span className="right badge">{r.emitidos.length}</span></h3>
          {r.emitidos.length ? <div className="list">{r.emitidos.map((x) => <DocLinha key={x.id} doc={x} />)}</div> : <Empty icon="upload" title="Nenhuma fatura emitida neste mês" />}
        </div>
        <div className="card pad">
          <h3>Recebidos (compras) <span className="right badge">{r.recebidos.length}</span></h3>
          {r.recebidos.length ? <div className="list">{r.recebidos.map((x) => <DocLinha key={x.id} doc={x} />)}</div> : <Empty icon="download" title="Nenhuma fatura de fornecedor neste mês" />}
        </div>
      </div>
      {r.ignorados.length > 0 && <div className="small muted" style={{ marginTop: 12 }}>{r.ignorados.length} recibo(s)/outros deste mês não entram na conta (o IVA está nas faturas).</div>}
    </Page>
  )
}
