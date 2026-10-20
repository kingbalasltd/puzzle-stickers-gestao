import { useState } from 'react'
import { Page } from '../App'
import { db, guardar, novo, type Servico } from '../db'
import { mt, num2, parseNum } from '../format'
import { useDados, useSessao } from '../state'
import { Field, Icon, Modal, useToast } from '../ui'
import { TrabalhoForm } from './TrabalhoForm'
import { parteDoServico } from './Partes'

export default function Catalogo() {
  const d = useDados()
  const { pode } = useSessao()
  const [edit, setEdit] = useState<Servico | 'novo' | null>(null)
  const [usar, setUsar] = useState<Servico | null>(null)
  const cats = [...new Set(d.servicos.map((s) => s.categoria))]
  return (
    <Page title="Catálogo" sub="Criação de Imagem 2026 · preços sem IVA" actions={pode('definicoes') && <button className="btn" onClick={() => setEdit('novo')}><Icon n="plus" /> <span className="hide-m">Serviço</span></button>}>
      <div className="banner"><Icon n="raio" /> Taxa de urgência: +{d.empresa.urgenciaPct}% sobre o valor · Início com {d.empresa.sinalPct}% de sinal, restante na entrega.</div>
      {cats.map((cat) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div className="nav-sec" style={{ paddingLeft: 2 }}>{cat}</div>
          <div className="grid g3">
            {d.servicos.filter((s) => s.categoria === cat).map((s) => (
              <div key={s.id} className="card pad" style={{ opacity: s.ativo ? 1 : 0.5, display: 'flex', flexDirection: 'column' }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <b style={{ fontSize: 15, flex: 1 }}>{s.nome}</b>
                  {pode('definicoes') && <button className="btn sm icon ghost" onClick={() => setEdit(s)} aria-label="Editar"><Icon n="editar" /></button>}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 2px', color: 'var(--y)' }}>{s.preco ? mt(s.preco) : 'Sob proposta'}</div>
                <div className="small muted">{s.diasMax ? `${s.diasMin}–${s.diasMax} dias` : cat === 'Extras' ? 'Extra' : 'Prazo por definir'}</div>
                <div className="row wrap" style={{ gap: 6, margin: '12px 0' }}>
                  {s.inclui.map((x) => <span key={x} className="badge">{x}</span>)}
                </div>
                <div style={{ marginTop: 'auto' }}>
                  {cat !== 'Extras' && s.ativo && <button className="btn sm block" onClick={() => setUsar(s)}><Icon n="plus" /> Criar trabalho</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {edit && <ServicoForm s={edit === 'novo' ? undefined : edit} onClose={() => setEdit(null)} />}
      {usar && <TrabalhoForm preset={{ servicoId: usar.id, tipo: 'criacao', itens: [parteDoServico(usar)] }} onClose={() => setUsar(null)} />}
    </Page>
  )
}

function ServicoForm({ s, onClose }: { s?: Servico; onClose: () => void }) {
  const toast = useToast()
  const [f, setF] = useState<Partial<Servico>>(s ? { ...s } : { categoria: '', nome: '', preco: 0, diasMin: 0, diasMax: 0, inclui: [], ativo: true })
  const set = (p: Partial<Servico>) => setF((x) => ({ ...x, ...p }))
  async function salvar() {
    if (!f.nome?.trim() || !f.categoria?.trim()) return toast('Nome e categoria')
    await guardar(db.servicos, s ? ({ ...s, ...f } as Servico) : novo<Servico>(f as any))
    onClose()
  }
  return (
    <Modal title={s ? 'Editar serviço' : 'Novo serviço'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" onClick={salvar}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Categoria"><input value={f.categoria} onChange={(e) => set({ categoria: e.target.value })} /></Field>
        <Field label="Nome"><input value={f.nome} onChange={(e) => set({ nome: e.target.value })} /></Field>
        <Field label="Preço (sem IVA)"><input inputMode="decimal" defaultValue={f.preco ? num2(f.preco) : ''} onBlur={(e) => set({ preco: parseNum(e.target.value) })} /></Field>
        <div className="row">
          <Field label="Dias mín."><input inputMode="numeric" value={f.diasMin} onChange={(e) => set({ diasMin: parseNum(e.target.value) })} /></Field>
          <Field label="Dias máx."><input inputMode="numeric" value={f.diasMax} onChange={(e) => set({ diasMax: parseNum(e.target.value) })} /></Field>
        </div>
        <Field label="Inclui (um por linha)" full><textarea value={(f.inclui || []).join('\n')} onChange={(e) => set({ inclui: e.target.value.split('\n').filter(Boolean) })} /></Field>
        <label className="check full"><input type="checkbox" checked={!!f.ativo} onChange={(e) => set({ ativo: e.target.checked })} /> Ativo</label>
      </div>
    </Modal>
  )
}
