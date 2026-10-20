import { useMemo, useState } from 'react'
import { Page } from '../App'
import { db, agora } from '../db'
import { addMeses, despesaSemIva, hojeISO, movimentosCaixa, resumoCaixaMes, saldoCaixa, type Movimento } from '../calc'
import { dataCurta, dataMedia, mesNome, mt, mtCurto, num2, parseNum } from '../format'
import { ir, useDados, useRota } from '../state'
import { Empty, Field, Icon, Modal, useToast } from '../ui'

// Money in and out, and the balance from the day he set it (16 Oct).
export function useCaixa() {
  const d = useDados()
  return useMemo(() => {
    const movs = movimentosCaixa(d.pagamentos, d.despesas, d.requisicoes, d.empresa.taxaIva)
    return { movs, saldo: saldoCaixa(movs, d.empresa.caixa), caixa: d.empresa.caixa }
  }, [d])
}

// He types what he really has today (bank + M-Pesa + cash); the app keeps it up to date.
export function CaixaModal({ onClose }: { onClose: () => void }) {
  const d = useDados()
  const toast = useToast()
  const { saldo } = useCaixa()
  const [valor, setValor] = useState(saldo !== undefined ? num2(saldo) : '')
  async function salvar() {
    const v = parseNum(valor)
    await db.empresa.put({ ...d.empresa, caixa: { valor: v, data: hojeISO(), em: agora() }, updatedAt: agora() })
    toast(`Caixa acertado: ${mt(v)}`)
    onClose()
  }
  return (
    <Modal title="Acertar caixa" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" onClick={salvar}><Icon n="check" /> Guardar</button></>}>
      <Field label="Quanto tem hoje? (banco + M-Pesa + numerário)" hint="Daqui para a frente a app soma o que os clientes pagam e tira as compras, as despesas e os pagamentos a fornecedores.">
        <input autoFocus inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
      </Field>
      {d.empresa.caixa && <div className="tiny muted" style={{ marginTop: 10 }}>Último acerto: {mt(d.empresa.caixa.valor)} a {dataMedia(d.empresa.caixa.data)}.</div>}
    </Modal>
  )
}

const ORIGEM: Record<Movimento['origem'], string> = { cliente: 'Cliente', compra: 'Compra', fixa: 'Despesa fixa', fornecedor: 'Fornecedor', pessoal: 'Pessoal', reposicao: 'Reposição pessoal' }

export default function Resumo() {
  const d = useDados()
  const { query } = useRota()
  const hoje = hojeISO()
  const [mes, setMes] = useState(query.get('mes') || hoje.slice(0, 7))
  const [acertar, setAcertar] = useState(false)
  const { movs, saldo } = useCaixa()
  const r = useMemo(() => resumoCaixaMes(movs, mes), [movs, mes])
  const meses = useMemo(() => [5, 4, 3, 2, 1, 0].map((n) => ({ m: addMeses(mes, -n), ...resumoCaixaMes(movs, addMeses(mes, -n)) })), [movs, mes])
  const maxMes = Math.max(1, ...meses.map((x) => Math.max(x.entrou, x.saiu)))

  // Spending by category: purchases and fixed expenses by their category, supplier payments as one line.
  const cats = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of d.despesas) if (x.data.slice(0, 7) === mes) m.set(x.pessoal ? 'Pessoal (dono)' : x.categoria, (m.get(x.pessoal ? 'Pessoal (dono)' : x.categoria) || 0) + x.valor)
    if (r.fornecedores) m.set('Fornecedores (material)', r.fornecedores)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [d.despesas, mes, r.fornecedores])
  const maxCat = Math.max(1, ...cats.map((c) => c[1]))
  const semIva = d.despesas.filter((x) => x.data.slice(0, 7) === mes).reduce((s, x) => s + despesaSemIva(x), 0)
  // His personal spending not yet paid back or authorised, whatever the month.
  const porResolver = d.despesas.filter((x) => x.pessoal && !x.deleted && !x.pessoalEstado)

  return (
    <Page title="Resumo" sub="O que entrou e o que saiu, mês a mês">
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn icon" onClick={() => setMes(addMeses(mes, -1))} aria-label="Mês anterior"><Icon n="left" /></button>
        <div className="b" style={{ fontSize: 18, minWidth: 170, textAlign: 'center' }}>{mesNome(mes)}</div>
        <button className="btn icon" onClick={() => setMes(addMeses(mes, 1))} aria-label="Mês seguinte"><Icon n="right" /></button>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi"><div className="lbl"><Icon n="dinheiro" /> Entrou</div><div className="val" style={{ color: 'var(--ok)' }}>{mtCurto(r.entrou)}</div><div className="foot">{r.reposicoes ? `clientes + ${mtCurto(r.reposicoes)} repostos por si` : 'pagamentos dos clientes'}</div></div>
        <div className="card kpi"><div className="lbl"><Icon n="despesa" /> Saiu</div><div className="val" style={{ color: 'var(--warn)' }}>{mtCurto(r.saiu)}</div><div className="foot">compras, despesas e fornecedores</div></div>
        <div className="card kpi"><div className="lbl"><Icon n="tendencia" /> Saldo do mês</div><div className="val" style={{ color: r.saldo < 0 ? 'var(--bad)' : undefined }}>{mtCurto(r.saldo)}</div><div className="foot">entrou − saiu</div></div>
        <div className="card kpi hl link" onClick={() => setAcertar(true)}>
          <div className="lbl"><Icon n="carteira" /> Em caixa</div>
          <div className="val">{saldo !== undefined ? mtCurto(saldo) : '—'}</div>
          <div className="foot">{d.empresa.caixa ? `acertado a ${dataCurta(d.empresa.caixa.data)} · tocar para acertar` : 'tocar para dizer quanto tem'}</div>
        </div>
      </div>
      {porResolver.length > 0 && (
        <a className="card pad alerta-pessoal" href="#/pessoal">
          <Icon n="carteira" />
          <div className="main-t"><b>Gastos pessoais por resolver: {mt(porResolver.reduce((s, x) => s + x.valor, 0))}</b><span>{porResolver.length} gasto{porResolver.length === 1 ? '' : 's'} pago{porResolver.length === 1 ? '' : 's'} com dinheiro da empresa · repor ou autorizar</span></div>
          <Icon n="right" />
        </a>
      )}

      <div className="grid g-main">
        <div className="col" style={{ gap: 14 }}>
          <div className="card pad">
            <h3><Icon n="despesa" /> O que saiu</h3>
            <dl className="kv">
              <dt><a href={`#/despesas?mes=${mes}`}>Compras</a></dt><dd className="num">{mt(r.compras)}</dd>
              <dt><a href={`#/despesas?mes=${mes}`}>Despesas fixas</a></dt><dd className="num">{mt(r.fixas)}</dd>
              <dt><a href="#/contas-pagar">Pagamentos a fornecedores</a></dt><dd className="num">{mt(r.fornecedores)}</dd>
              {r.pessoal > 0 && <><dt><a href="#/pessoal">Gastos pessoais</a></dt><dd className="num">{mt(r.pessoal)}</dd></>}
              <dt className="b" style={{ color: 'var(--tx)' }}>Total</dt><dd className="num b">{mt(r.saiu)}</dd>
            </dl>
            <div className="tiny muted" style={{ marginTop: 8 }}>Dinheiro que saiu neste mês, com IVA. Compras e despesas sem IVA: {mt(semIva)}.</div>
          </div>

          <div className="card pad">
            <h3><Icon n="lista" /> Movimentos de {mesNome(mes).split(' ')[0].toLowerCase()}</h3>
            {r.movimentos.length === 0 ? <Empty icon="dinheiro" title="Sem movimentos neste mês" /> : (
              <div className="list">
                {[...r.movimentos].reverse().map((m, i) => (
                  <div key={i} className="li" onClick={() => m.origem === 'cliente' && m.ref ? ir(`/trabalhos/${m.ref}?tab=pagamentos`) : m.origem === 'fornecedor' && m.ref ? ir(`/requisicoes/${m.ref}`) : ir(`/despesas?mes=${mes}`)}>
                    <div style={{ width: 42, textAlign: 'center' }}>
                      <div className="b" style={{ fontSize: 16, lineHeight: 1 }}>{m.data.slice(8, 10)}</div>
                      <div className="tiny muted" style={{ textTransform: 'uppercase' }}>{dataCurta(m.data).split(' ')[1]}</div>
                    </div>
                    <div className="main-t">
                      <b>{m.origem === 'cliente' ? clienteDe(d, m.ref) || m.texto : m.texto}</b>
                      <span>{ORIGEM[m.origem]}{m.origem === 'cliente' && m.texto !== 'Pagamento de cliente' ? ` · ${m.texto}` : ''}</span>
                    </div>
                    <b className="num nowrap" style={{ color: m.tipo === 'entrada' ? 'var(--ok)' : 'var(--tx)' }}>{m.tipo === 'entrada' ? '+' : '−'}{mt(m.valor)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div className="card pad">
            <h3><Icon n="painel" /> Gastos por categoria</h3>
            {cats.length === 0 ? <div className="small muted">Sem gastos neste mês.</div> : (
              <div className="bars">
                {cats.map(([c, v]) => (
                  <div key={c} className="bar-row" style={{ gridTemplateColumns: '1fr 90px' }}>
                    <div>
                      <div className="row small" style={{ marginBottom: 4 }}><span className="tx2 ellipsis">{c}</span></div>
                      <div className="track"><div className="fill" style={{ width: `${(v / maxCat) * 100}%`, background: c.startsWith('Fornecedores') ? 'var(--info)' : 'var(--y)' }} /></div>
                    </div>
                    <b className="num right small">{mt(v).replace(',00', '')}</b>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card pad">
            <h3><Icon n="tendencia" /> Últimos 6 meses</h3>
            <div className="col" style={{ gap: 10 }}>
              {meses.map((x) => (
                <div key={x.m} onClick={() => setMes(x.m)} style={{ cursor: 'pointer', opacity: x.m === mes ? 1 : 0.8 }}>
                  <div className="row small" style={{ marginBottom: 4 }}>
                    <b style={{ textTransform: 'capitalize' }}>{mesNome(x.m).split(' ')[0]}</b>
                    <span className="spacer" />
                    <span className="num" style={{ color: x.saldo < 0 ? 'var(--bad)' : 'var(--ok)' }}>{x.saldo >= 0 ? '+' : ''}{mt(x.saldo).replace(',00', '')}</span>
                  </div>
                  <div className="track-b" title={`Entrou ${mt(x.entrou)}`}><div className="fill" style={{ width: `${(x.entrou / maxMes) * 100}%`, background: 'var(--ok)' }} /></div>
                  <div className="track-b" style={{ marginTop: 3 }} title={`Saiu ${mt(x.saiu)}`}><div className="fill" style={{ width: `${(x.saiu / maxMes) * 100}%`, background: 'var(--warn)' }} /></div>
                </div>
              ))}
              <div className="tiny muted"><span style={{ color: 'var(--ok)' }}>■</span> entrou · <span style={{ color: 'var(--warn)' }}>■</span> saiu</div>
            </div>
          </div>
        </div>
      </div>
      {acertar && <CaixaModal onClose={() => setAcertar(false)} />}
    </Page>
  )
}

function clienteDe(d: ReturnType<typeof useDados>, trabalhoId?: string) {
  const t = d.trabalhos.find((x) => x.id === trabalhoId)
  return t ? `${d.cliente(t.clienteId)?.nome || ''} · ${t.codigo}` : undefined
}
