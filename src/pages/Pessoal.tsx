import { useState } from 'react'
import { Page } from '../App'
import { apagar, db, guardar, novo, type Despesa } from '../db'
import { addMeses, hojeISO, r2 } from '../calc'
import { dataMedia, mesNome, mt, num2, parseNum } from '../format'
import { useDados } from '../state'
import { Empty, Field, Icon, Modal, useToast } from '../ui'

// Momad (18 Oct): his personal spending paid with the company's money. It leaves the caixa,
// but it is not a cost of the business, so it stays out of the expenses and the month result.
// Each one is then settled: paid back (the money returns to the caixa) or authorised as his use.

const METODOS = ['M-Pesa', 'e-Mola', 'Transferência', 'Numerário', 'POS', 'Cheque']
const ESTADO = { reposto: 'Reposto', autorizado: 'Autorizado como meu uso' }

const soma = (xs: Despesa[]) => r2(xs.reduce((s, x) => s + x.valor, 0))

export default function Pessoal() {
  const d = useDados()
  const toast = useToast()
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [edit, setEdit] = useState<Despesa | 'novo' | null>(null)
  const meus = d.despesas.filter((x) => x.pessoal && !x.deleted)
  const porResolver = meus.filter((x) => !x.pessoalEstado).sort((a, b) => a.data.localeCompare(b.data))
  const doMes = meus.filter((x) => x.data.startsWith(mes) && x.pessoalEstado).sort((a, b) => b.data.localeCompare(a.data))
  const resolver = async (xs: Despesa[], estado: 'reposto' | 'autorizado') => {
    for (const x of xs) await guardar(db.despesas, { ...x, pessoalEstado: estado, pessoalEm: hojeISO() })
    toast(estado === 'reposto' ? `Reposto ${mt(soma(xs))} · voltou à caixa` : `Autorizado ${mt(soma(xs))} como seu uso`)
  }
  return (
    <Page title="Pessoal" sub="Os meus gastos pessoais pagos com dinheiro da empresa" actions={<button className="btn pri" onClick={() => setEdit('novo')}><Icon n="plus" /> <span className="hide-m">Gasto pessoal</span></button>}>
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <div className="card kpi hl"><div className="lbl"><Icon n="alerta" /> Por resolver</div><div className="val">{mt(soma(porResolver))}</div><div className="foot">repor à empresa ou autorizar como meu uso</div></div>
        <div className="card kpi"><div className="lbl"><Icon n="dinheiro" /> Reposto este ano</div><div className="val">{mt(soma(meus.filter((x) => x.pessoalEstado === 'reposto' && (x.pessoalEm || x.data).startsWith(mes.slice(0, 4)))))}</div><div className="foot">voltou à caixa</div></div>
        <div className="card kpi"><div className="lbl"><Icon n="check" /> Autorizado este ano</div><div className="val">{mt(soma(meus.filter((x) => x.pessoalEstado === 'autorizado' && (x.pessoalEm || x.data).startsWith(mes.slice(0, 4)))))}</div><div className="foot">assumido como meu uso</div></div>
      </div>

      <div className="card pad" style={{ marginBottom: 14 }}>
        <h3>Por resolver {porResolver.length > 1 && (
          <span className="right row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={() => resolver(porResolver, 'reposto')}>Repor tudo</button>
            <button className="btn sm" onClick={() => resolver(porResolver, 'autorizado')}>Autorizar tudo</button>
          </span>
        )}</h3>
        {porResolver.length === 0 ? <div className="small muted">Nada por resolver.</div> : (
          <div className="list">
            {porResolver.map((x) => (
              <div key={x.id} className="li pessoal-li">
                <button className="main-t" onClick={() => setEdit(x)}><b>{x.descricao}</b><span>{dataMedia(x.data)}{x.metodo ? ` · ${x.metodo}` : ''}{x.notas ? ` · ${x.notas}` : ''}</span></button>
                <b className="num nowrap">{mt(x.valor)}</b>
                <span className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => resolver([x], 'reposto')}>Repor</button>
                  <button className="btn sm" onClick={() => resolver([x], 'autorizado')}>Autorizar</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <button className="btn icon" onClick={() => setMes(addMeses(mes, -1))} aria-label="Mês anterior"><Icon n="left" /></button>
        <b style={{ minWidth: 150, textAlign: 'center' }}>{mesNome(mes)}</b>
        <button className="btn icon" onClick={() => setMes(addMeses(mes, 1))} aria-label="Mês seguinte"><Icon n="right" /></button>
      </div>
      <div className="card">
        {doMes.length === 0 ? <Empty icon="carteira" title="Nada resolvido neste mês" /> : (
          <div className="list">
            {doMes.map((x) => (
              <button key={x.id} className="li" onClick={() => setEdit(x)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}>
                <div className="main-t"><b>{x.descricao}</b><span>{dataMedia(x.data)} · {ESTADO[x.pessoalEstado!]}{x.pessoalEm ? ` a ${dataMedia(x.pessoalEm)}` : ''}</span></div>
                <span className={`badge ${x.pessoalEstado === 'reposto' ? 'ok' : 'y'}`}>{x.pessoalEstado === 'reposto' ? 'Reposto' : 'Autorizado'}</span>
                <b className="num nowrap">{mt(x.valor)}</b>
              </button>
            ))}
          </div>
        )}
      </div>
      {edit && <GastoForm g={edit === 'novo' ? undefined : edit} onClose={() => setEdit(null)} />}
    </Page>
  )
}

function GastoForm({ g, onClose }: { g?: Despesa; onClose: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ data: g?.data || hojeISO(), descricao: g?.descricao || '', valor: g ? num2(g.valor) : '', metodo: g?.metodo || 'M-Pesa', notas: g?.notas || '' })
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p })
  async function salvar() {
    if (!f.descricao.trim()) return toast('Escreva o que foi')
    const valor = parseNum(f.valor)
    if (!valor) return toast('Escreva o valor')
    const base = { data: f.data, descricao: f.descricao.trim(), valor, metodo: f.metodo, notas: f.notas.trim() || undefined, categoria: 'Pessoal', iva: 0, pessoal: true }
    if (g) await guardar(db.despesas, { ...g, ...base })
    else await db.despesas.put(novo<Despesa>(base))
    toast('Guardado')
    onClose()
  }
  return (
    <Modal
      title={g ? 'Gasto pessoal' : 'Novo gasto pessoal'}
      onClose={onClose}
      footer={
        <>
          {g && <button className="btn danger" onClick={async () => { await apagar(db.despesas, g.id); onClose() }}><Icon n="lixo" /></button>}
          {g?.pessoalEstado && <button className="btn" onClick={async () => { await guardar(db.despesas, { ...g, pessoalEstado: undefined, pessoalEm: undefined }); onClose() }}>Voltar a por resolver</button>}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn pri" onClick={salvar}><Icon n="check" /> Guardar</button>
        </>
      }
    >
      {g?.pessoalEstado && <div className="small muted" style={{ marginBottom: 12 }}>{ESTADO[g.pessoalEstado]}{g.pessoalEm ? ` a ${dataMedia(g.pessoalEm)}` : ''}.</div>}
      <div className="form-grid">
        <Field label="O que foi" full><input autoFocus value={f.descricao} placeholder="Ex.: Supermercado, propinas, combustível do carro pessoal" onChange={(e) => set({ descricao: e.target.value })} /></Field>
        <Field label="Valor"><input inputMode="decimal" value={f.valor} placeholder="0,00" onChange={(e) => set({ valor: e.target.value })} /></Field>
        <Field label="Data"><input type="date" value={f.data} onChange={(e) => set({ data: e.target.value })} /></Field>
        <Field label="Como pagou" full>
          <div className="chips">{METODOS.map((m) => <button key={m} className={`chip ${f.metodo === m ? 'on' : ''}`} onClick={() => set({ metodo: m })}>{m}</button>)}</div>
        </Field>
        <Field label="Notas" full><input value={f.notas} onChange={(e) => set({ notas: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
