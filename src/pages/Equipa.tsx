import { useState } from 'react'
import { Page, PAPEL_NOME } from '../App'
import { db, guardar, novo, type Papel, type Utilizador } from '../db'
import { useDados, useSessao } from '../state'
import { Avatar, DemoTag, Field, Icon, Modal, useToast } from '../ui'

const CORES = ['#ffc406', '#1e9bff', '#7c5cff', '#00b3a4', '#ff6b6b', '#2bb673', '#ff8a00', '#e84393']

const PODE: Record<Papel, string[]> = {
  dono: ['Tudo: trabalhos, finanças, IVA, documentos, equipa e definições'],
  gerente: ['Todos os trabalhos, agenda, clientes, fornecedores e requisições', 'Pagamentos e dívidas, cotações', 'Não vê o IVA, faturas, equipa nem definições'],
  trabalhador: ['Só os trabalhos atribuídos a si (a sua agenda)', 'Avança as etapas, junta fotos e notas', 'Não vê valores, clientes nem finanças']
}

export default function Equipa() {
  const d = useDados()
  const { user } = useSessao()
  const [edit, setEdit] = useState<Utilizador | 'novo' | null>(null)
  return (
    <Page title="Equipa e acessos" sub="Cada pessoa entra com o seu PIN e vê só o que o perfil permite" actions={<button className="btn pri" onClick={() => setEdit('novo')}><Icon n="plus" /> <span className="hide-m">Adicionar</span></button>}>
      <div className="grid g3" style={{ marginBottom: 18 }}>
        {(['dono', 'gerente', 'trabalhador'] as Papel[]).map((p) => (
          <div key={p} className="card pad">
            <h3>{PAPEL_NOME[p]}</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }} className="small tx2">{PODE[p].map((x) => <li key={x} style={{ marginBottom: 4 }}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Pessoa</th><th>Perfil</th><th>Função</th><th className="r">Trabalhos em curso</th><th /></tr></thead>
            <tbody>
              {d.utilizadores.map((u) => (
                <tr key={u.id} className="click" onClick={() => setEdit(u)} style={{ opacity: u.ativo ? 1 : 0.5 }}>
                  <td><div className="row"><Avatar nome={u.nome} cor={u.cor} /><div><b>{u.nome}</b> <DemoTag demo={u.demo} />{u.id === user.id && <span className="badge y" style={{ marginLeft: 6 }}>você</span>}<div className="tiny muted">{u.telefone}</div></div></div></td>
                  <td><span className="badge">{PAPEL_NOME[u.papel]}</span></td>
                  <td className="tx2">{u.funcao}</td>
                  <td className="r num">{d.trabalhos.filter((t) => t.responsavelId === u.id && t.etapa !== 'entregue' && !t.cancelado).length}</td>
                  <td className="r">{!u.ativo && <span className="badge">inativo</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {edit && <UserForm u={edit === 'novo' ? undefined : edit} onClose={() => setEdit(null)} />}
    </Page>
  )
}

function UserForm({ u, onClose }: { u?: Utilizador; onClose: () => void }) {
  const d = useDados()
  const { user } = useSessao()
  const toast = useToast()
  const [f, setF] = useState<Partial<Utilizador>>(u ? { ...u } : { nome: '', papel: 'trabalhador', funcao: '', telefone: '', pin: '', cor: CORES[d.utilizadores.length % CORES.length], ativo: true })
  const set = (p: Partial<Utilizador>) => setF((x) => ({ ...x, ...p }))
  const eu = u?.id === user.id
  async function salvar() {
    if (!f.nome?.trim()) return toast('Escreva o nome')
    if (!/^\d{4}$/.test(f.pin || '')) return toast('O PIN tem 4 números')
    if (d.utilizadores.some((x) => x.pin === f.pin && x.id !== u?.id)) return toast('Esse PIN já é usado por outra pessoa')
    await guardar(db.utilizadores, u ? ({ ...u, ...f } as Utilizador) : novo<Utilizador>(f as any))
    toast('Guardado')
    onClose()
  }
  return (
    <Modal title={u ? u.nome : 'Adicionar pessoa'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn pri" onClick={salvar}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Nome" full><input autoFocus value={f.nome} onChange={(e) => set({ nome: e.target.value })} /></Field>
        <Field label="Perfil">
          <select value={f.papel} disabled={eu} onChange={(e) => set({ papel: e.target.value as Papel })}>
            <option value="trabalhador">Trabalhador</option>
            <option value="gerente">Gerente</option>
            <option value="dono">Dono</option>
          </select>
        </Field>
        <Field label="Função"><input value={f.funcao} onChange={(e) => set({ funcao: e.target.value })} placeholder="Designer, aplicador…" /></Field>
        <Field label="Telefone"><input inputMode="tel" value={f.telefone} onChange={(e) => set({ telefone: e.target.value })} /></Field>
        <Field label="PIN (4 números)"><input inputMode="numeric" maxLength={4} value={f.pin} onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></Field>
        <div className="field full">
          <span>Cor</span>
          <div className="row">{CORES.map((c) => <button key={c} type="button" onClick={() => set({ cor: c })} style={{ width: 30, height: 30, borderRadius: 9, background: c, border: f.cor === c ? '3px solid var(--tx)' : '1px solid var(--line)', cursor: 'pointer' }} aria-label={c} />)}</div>
        </div>
        {!eu && <label className="check full"><input type="checkbox" checked={!!f.ativo} onChange={(e) => set({ ativo: e.target.checked })} /> Pode entrar no sistema</label>}
      </div>
    </Modal>
  )
}
