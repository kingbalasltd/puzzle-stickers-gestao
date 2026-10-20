import { useMemo, useState } from 'react'
import { Page } from '../App'
import { db, guardar, uid, type Requisicao } from '../db'
import { diasEntre, hojeISO, mapaCredito, pagoRequisicao, r2, saldoRequisicao, type FaseReq } from '../calc'
import { dataMedia, mt, num2, parseNum } from '../format'
import { ir, useDados } from '../state'
import { Empty, Field, Icon, Modal, Seg, useToast } from '../ui'
import { metodos } from './comum'

// Same wording as the company's Excel "Mapa de controlo de crédito".
const estadoTrabalho = (r: Requisicao, f: FaseReq) => (r.levantadaEm || r.estado === 'recebida' || f === 'levantada' ? 'Concluído' : f === 'rascunho' || f === 'enviada' ? 'Enviado' : 'Em produção')

export default function ContasPagar() {
  const d = useDados()
  const hoje = hojeISO()
  const taxa = d.empresa.taxaIva
  const [vista, setVista] = useState<'aberto' | 'todos'>('aberto')
  const [pagar, setPagar] = useState<Requisicao | null>(null)
  const comCredito = d.fornecedores.filter((f) => mapaCredito(d.requisicoes.filter((r) => r.fornecedorId === f.id), taxa).linhas.length)
  const [fid, setFid] = useState(() => comCredito[0]?.id || '')
  const forn = d.fornecedor(fid)
  const mapa = useMemo(() => mapaCredito(d.requisicoes.filter((r) => r.fornecedorId === fid), taxa), [d.requisicoes, fid, taxa])
  const linhas = mapa.linhas
    .filter((l) => vista === 'todos' || l.saldo > 0.005)
    .map((l) => {
      const job = d.trabalhos.find((t) => t.id === l.r.trabalhoId)
      const res = job && d.resumo(job)
      return { ...l, job, cliente: d.cliente(job?.clienteId), clientePagou: !!res && res.total > 0 && res.emDivida <= 0 }
    })
  const liquidaveis = linhas.filter((l) => l.saldo > 0 && l.clientePagou)

  return (
    <Page
      title="Mapa de crédito"
      sub="Trabalhos enviados à produção · faturas · valores pagos e crédito em aberto"
      actions={<>{forn && <button className="btn" onClick={() => exportarMapa(forn.nome, mapa, d)}><Icon n="excel" /> <span className="hide-m">Excel</span></button>}</>}
    >
      {comCredito.length === 0 ? (
        <div className="card"><Empty icon="check" title="Sem créditos nem pró-formas por pagar" /></div>
      ) : (
        <>
          {comCredito.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <Seg value={fid} onChange={setFid} options={comCredito.map((f) => ({ v: f.id, l: f.nome }))} />
            </div>
          )}
          <div className="grid g4" style={{ marginBottom: 14 }}>
            <div className="card kpi"><div className="lbl">Total dos trabalhos</div><div className="val">{mt(mapa.total).replace(',00', '')}</div><div className="foot">{mapa.linhas.length} trabalhos · {forn?.nome}</div></div>
            <div className="card kpi"><div className="lbl">Total pago</div><div className="val" style={{ color: 'var(--ok)' }}>{mt(mapa.pago).replace(',00', '')}</div></div>
            <div className="card kpi hl"><div className="lbl">Crédito em aberto</div><div className="val">{mt(mapa.aberto).replace(',00', '')}</div><div className="foot">{mapa.linhas.filter((l) => l.saldo > 0.005).length} por liquidar</div></div>
            <div className={`card kpi ${liquidaveis.length ? 'warn' : ''}`}><div className="lbl">Pode liquidar já</div><div className="val">{mt(liquidaveis.reduce((s, l) => s + l.saldo, 0)).replace(',00', '')}</div><div className="foot">{liquidaveis.length} com o cliente já pago</div></div>
          </div>

          <div className="row" style={{ marginBottom: 10 }}>
            <Seg value={vista} onChange={setVista} options={[{ v: 'aberto', l: 'Em aberto' }, { v: 'todos', l: 'Todos' }]} />
          </div>

          <div className="card">
            {linhas.length === 0 ? <Empty icon="check" title="Nada em aberto" /> : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Data</th><th>Trabalho</th><th>Fatura / pró-forma</th><th>Estado do trabalho</th><th className="r">Valor</th><th className="r">Pago</th><th className="r">Saldo</th><th>Pagamento</th><th>Material</th><th /></tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => (
                      <tr key={l.r.id} className="click" onClick={() => ir(`/requisicoes/${l.r.id}`)}>
                        <td className="nowrap small">{dataMedia(l.r.data)}<div className="tiny muted">{l.saldo > 0 ? `${diasEntre(l.r.creditoDesde || l.r.proforma?.data || l.r.data, hoje)} dias` : ''}</div></td>
                        <td>
                          <b>{l.job?.titulo || l.r.nomeTrabalho}</b>
                          <div className="tiny muted">{l.job ? `${l.job.codigo} · ${l.cliente?.nome}` : 'sem trabalho associado'}{l.clientePagou && l.saldo > 0 ? ' · ' : ''}{l.clientePagou && l.saldo > 0 && <span style={{ color: 'var(--warn)', fontWeight: 700 }}>cliente já pagou</span>}</div>
                        </td>
                        <td className="nowrap small">{l.r.faturaDocId ? `FT ${d.documentos.find((x) => x.id === l.r.faturaDocId)?.numero}` : l.r.proforma ? l.r.proforma.numero : '—'}</td>
                        <td><span className={`badge ${estadoTrabalho(l.r, l.fase) === 'Concluído' ? 'ok' : ''}`}>{estadoTrabalho(l.r, l.fase)}</span></td>
                        <td className="r num nowrap">{mt(l.valor)}</td>
                        <td className="r num nowrap" style={{ color: l.pago ? 'var(--ok)' : 'var(--tx3)' }}>{mt(l.pago)}</td>
                        <td className="r num nowrap b" style={{ color: l.saldo > 0 ? 'var(--warn)' : 'var(--tx3)' }}>{mt(l.saldo)}</td>
                        <td><span className={`badge ${l.estado === 'Pago' ? 'ok' : l.estado === 'Parcial' ? 'y' : 'warn'}`}>{l.estado}</span></td>
                        <td className="small nowrap">{l.r.levantadaEm ? <span className="badge ok"><Icon n="check" style={{ width: 12, height: 12 }} /> {dataMedia(l.r.levantadaEm)}</span> : <span className="muted">—</span>}</td>
                        <td className="r">{l.saldo > 0 && <button className={`btn sm ${l.clientePagou ? 'pri' : ''}`} onClick={(e) => { e.stopPropagation(); setPagar(l.r) }}>Pagar</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="b">TOTAL</td>
                      <td className="r num b nowrap">{mt(linhas.reduce((s, l) => s + l.valor, 0))}</td>
                      <td className="r num b nowrap">{mt(linhas.reduce((s, l) => s + l.pago, 0))}</td>
                      <td className="r num b nowrap" style={{ color: 'var(--warn)' }}>{mt(linhas.reduce((s, l) => s + l.saldo, 0))}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          {forn?.dadosBancarios && <details className="card pad" style={{ marginTop: 14 }}><summary className="small b" style={{ cursor: 'pointer' }}>Dados para pagamento — {forn.nome}</summary><div className="small tx2 pre num" style={{ marginTop: 10 }}>{forn.dadosBancarios}</div></details>}
        </>
      )}
      {pagar && <PagarModal r={pagar} onClose={() => setPagar(null)} />}
    </Page>
  )
}

function PagarModal({ r, onClose }: { r: Requisicao; onClose: () => void }) {
  const toast = useToast()
  const saldo = saldoRequisicao(r)
  const [f, setF] = useState({ data: hojeISO(), metodo: 'Transferência', ref: '', valor: num2(saldo) })
  async function confirmar() {
    const v = Math.min(parseNum(f.valor), saldo)
    if (!(v > 0)) return toast('Valor inválido')
    const base = r.pagamentos?.length ? r.pagamentos : r.pagamento === 'pago' ? [{ id: uid(), data: r.pagoEm || f.data, valor: pagoRequisicao(r), metodo: r.metodoPagamento || '—' }] : []
    await guardar(db.requisicoes, { ...r, pagamentos: [...base, { id: uid(), data: f.data, valor: r2(v), metodo: f.metodo, referencia: f.ref || undefined }], pagoEm: f.data })
    toast(v >= saldo - 0.005 ? `Liquidado · ${mt(v)}` : `Pagamento parcial · ${mt(v)}`)
    onClose()
  }
  return (
    <Modal title={`Pagar ${r.proforma ? `pró-forma ${r.proforma.numero}` : r.nomeTrabalho}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" onClick={confirmar}><Icon n="check" /> Registar pagamento</button></>}>
      <div className="small muted" style={{ marginBottom: 12 }}>Saldo em aberto: <b style={{ color: 'var(--tx)' }}>{mt(saldo)}</b></div>
      <div className="form-grid">
        <Field label="Valor (pode ser parcial)"><input inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Field>
        <Field label="Data"><input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Field>
        <Field label="Método"><select value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>{metodos.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Referência (opcional)"><input value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} placeholder="Ex.: Transferência BIM" /></Field>
      </div>
      <div className="tiny muted" style={{ marginTop: 12 }}>Quando receber a fatura e o recibo, carregue-os na requisição para entrarem no IVA dedutível.</div>
    </Modal>
  )
}

// Same layout as the company's Mapa_Credito_Academica.xlsx.
async function exportarMapa(nome: string, mapa: ReturnType<typeof mapaCredito>, d: ReturnType<typeof useDados>) {
  const XLSX = await import('xlsx')
  const aoa: (string | number | Date | null)[][] = [
    [`MAPA DE CONTROLO DE CRÉDITO — ${nome.toUpperCase()}`],
    [],
    ['Trabalhos enviados à produção • facturas recebidas • valores pagos e crédito em aberto'],
    [],
    ['TOTAL DOS TRABALHOS', null, 'TOTAL PAGO', null, 'CRÉDITO EM ABERTO'],
    [mapa.total, null, mapa.pago, null, mapa.aberto],
    [],
    ['DATA', 'TRABALHO', 'FACTURA ACADÉMICA', 'ESTADO DO TRABALHO', 'VALOR', 'PAGO', 'SALDO', 'ESTADO PAGAMENTO', 'MATERIAL RECEBIDO', 'OBSERVAÇÃO']
  ]
  for (const l of mapa.linhas) {
    const job = d.trabalhos.find((t) => t.id === l.r.trabalhoId)
    const fat = d.documentos.find((x) => x.id === l.r.faturaDocId)
    aoa.push([
      new Date(l.r.data + 'T12:00:00'),
      job?.titulo.replace(/ — Branding$/, '') || l.r.nomeTrabalho,
      fat?.numero || l.r.proforma?.numero || '',
      estadoTrabalho(l.r, l.fase),
      l.valor,
      l.pago,
      l.saldo,
      l.estado,
      l.r.levantadaEm ? 'Sim' : '',
      l.r.notas || ''
    ])
  }
  aoa.push(['', 'TOTAL', '', '', mapa.total, mapa.pago, mapa.aberto])
  aoa.push([])
  aoa.push(['Exportado do sistema Puzzle Stickers · Gestão em ' + new Date().toLocaleDateString('pt-PT')])
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })
  ws['!cols'] = [{ wch: 12 }, { wch: 42 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 40 }]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }]
  const money = '#,##0.00 "MT"'
  for (let r = 0; r < aoa.length; r++) for (const c of [4, 5, 6]) { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && typeof cell.v === 'number') cell.z = money }
  for (const c of [0, 2, 4]) { const cell = ws[XLSX.utils.encode_cell({ r: 5, c })]; if (cell) cell.z = money }
  for (let r = 8; r < 8 + mapa.linhas.length; r++) { const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })]; if (cell) cell.z = 'dd/mm/yyyy' }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `CRÉDITO ${nome.split(' ')[0].toUpperCase()}`.slice(0, 31))
  XLSX.writeFile(wb, `Mapa_Credito_${nome.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '')}.xlsx`)
}
