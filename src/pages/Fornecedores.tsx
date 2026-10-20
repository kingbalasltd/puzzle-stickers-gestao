import { Fragment, useState } from 'react'
import { Page } from '../App'
import { apagar, db, guardar, guardarFicheiro, novo, type Fornecedor, type MaterialFornecedor } from '../db'
import { contasAPagar, diasEntre, hojeISO, totaisRequisicao, valorRequisicao } from '../calc'
import { dataMedia, mt, num2, parseNum, waLink } from '../format'
import { ir, useDados, useSessao } from '../state'
import { DemoTag, Empty, Field, Icon, Modal, useFicheiro, useToast } from '../ui'
import { DocLinha } from './Documentos'
import { FaseBadge } from './RequisicaoForm'
import { imprimirLista } from '../print'

export const TIPOS_ITEM: { v: MaterialFornecedor['tipo']; l: string }[] = [
  { v: 'impressao', l: 'Impressão' },
  { v: 'laminacao', l: 'Laminação' },
  { v: 'material', l: 'Material' },
  { v: 'servico', l: 'Serviço' },
  { v: 'outro', l: 'Outro' }
]
const UNIDADES = ['m²', 'm', 'un', 'folha', 'rolo', 'kg', 'litro', 'hora', 'serviço']
const CONDICOES: Record<NonNullable<Fornecedor['condicao']>, string> = {
  proforma: 'Pró-forma paga antes de produzir',
  credito: 'A crédito',
  entrega: 'Paga na entrega',
  outra: 'Outra'
}

function LogoForn({ f, size = 44 }: { f: Fornecedor; size?: number }) {
  const { url } = useFicheiro(f.logoId)
  return url ? (
    <div style={{ width: size * 2.2, height: size, background: '#fff', borderRadius: 10, display: 'grid', placeItems: 'center', padding: 4, flex: 'none' }}>
      <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} />
    </div>
  ) : (
    <div className="avatar" style={{ width: size, height: size, background: 'var(--card2)', color: 'var(--y)' }}><Icon n="fornecedores" /></div>
  )
}

export function FornecedorForm({ f: f0, onClose }: { f?: Fornecedor; onClose: (id?: string) => void }) {
  const toast = useToast()
  const [f, setF] = useState<Partial<Fornecedor>>(() =>
    f0 ? structuredClone(f0) : { nome: '', categoria: '', condicao: 'proforma', temCredito: false, materiais: [{ nome: '', tipo: 'impressao', precoM2: 0, unidade: 'm²' }] }
  )
  const set = (p: Partial<Fornecedor>) => setF((x) => ({ ...x, ...p }))
  const setM = (i: number, p: Partial<MaterialFornecedor>) => set({ materiais: f.materiais!.map((m, k) => (k === i ? { ...m, ...p } : m)) })
  async function salvar() {
    if (!f.nome?.trim()) return toast('Escreva o nome')
    const materiais = (f.materiais || []).filter((m) => m.nome.trim())
    const rec = f0 ? await guardar(db.fornecedores, { ...f0, ...f, materiais } as Fornecedor) : novo<Fornecedor>({ ...(f as any), materiais })
    if (!f0) await db.fornecedores.put(rec)
    toast('Fornecedor guardado')
    onClose(rec.id)
  }
  return (
    <Modal wide title={f0 ? `Editar ${f0.nome}` : 'Novo fornecedor'} onClose={() => onClose()} footer={<><button className="btn" onClick={() => onClose()}>Cancelar</button><button className="btn pri" onClick={salvar}><Icon n="check" /> Guardar</button></>}>
      <div className="form-grid">
        <Field label="Nome"><input autoFocus={!f0} value={f.nome} onChange={(e) => set({ nome: e.target.value })} /></Field>
        <Field label="O que fornece"><input value={f.categoria} onChange={(e) => set({ categoria: e.target.value })} placeholder="Impressão digital, vinil, serralharia, transporte…" /></Field>
        <Field label="Pessoa de contacto"><input value={f.contacto || ''} onChange={(e) => set({ contacto: e.target.value })} /></Field>
        <Field label="WhatsApp / telefone"><input inputMode="tel" value={f.telefone || ''} onChange={(e) => set({ telefone: e.target.value })} placeholder="Para enviar as listas daqui" /></Field>
        <Field label="Email"><input value={f.email || ''} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="NUIT"><input value={f.nuit || ''} onChange={(e) => set({ nuit: e.target.value })} /></Field>
        <Field label="Morada" full><input value={f.morada || ''} onChange={(e) => set({ morada: e.target.value })} /></Field>
      </div>

      <div className="nav-sec" style={{ padding: '22px 0 8px' }}>Produtos e serviços (tabela de preços, sem IVA)</div>
      <table className="cat-tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr className="tiny muted" style={{ textAlign: 'left' }}><th style={{ padding: 4 }}>Nome</th><th style={{ padding: 4 }}>Descrição</th><th style={{ padding: 4, width: 120 }}>Tipo</th><th style={{ padding: 4, width: 90 }}>Unidade</th><th style={{ padding: 4, width: 120 }}>Preço</th><th style={{ width: 36 }} /></tr>
        </thead>
        <tbody>
          {f.materiais!.map((m, i) => (
            <tr key={i}>
              <td className="nm"><input placeholder="Ex.: Vinil de Wrap" value={m.nome} onChange={(e) => setM(i, { nome: e.target.value })} /></td>
              <td className="ds"><input placeholder="Opcional" value={m.descricao || ''} onChange={(e) => setM(i, { descricao: e.target.value })} /></td>
              <td><select value={m.tipo} onChange={(e) => setM(i, { tipo: e.target.value as any })}>{TIPOS_ITEM.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select></td>
              <td><input list="unidades" value={m.unidade || 'm²'} onChange={(e) => setM(i, { unidade: e.target.value })} /></td>
              <td><input className="num" style={{ textAlign: 'right' }} inputMode="decimal" defaultValue={m.precoM2 ? num2(m.precoM2) : ''} placeholder="MT" onBlur={(e) => setM(i, { precoM2: parseNum(e.target.value) })} /></td>
              <td><button className="btn sm icon ghost" onClick={() => set({ materiais: f.materiais!.filter((_, k) => k !== i) })} aria-label="Remover"><Icon n="x" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="unidades">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
      <button className="btn sm" style={{ marginTop: 8 }} onClick={() => set({ materiais: [...f.materiais!, { nome: '', tipo: 'material', precoM2: 0, unidade: 'un' }] })}><Icon n="plus" /> Produto / serviço</button>
      <div className="tiny muted" style={{ marginTop: 6 }}>Os de tipo <b>Impressão</b> e <b>Laminação</b> aparecem nas listas de impressão (por m²). Os outros nas encomendas.</div>

      <div className="nav-sec" style={{ padding: '22px 0 8px' }}>Condições</div>
      <div className="form-grid">
        <Field label="Como costuma pagar">
          <select value={f.condicao || 'proforma'} onChange={(e) => set({ condicao: e.target.value as any })}>
            {Object.entries(CONDICOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Prazo de entrega habitual"><input value={f.prazoEntrega || ''} onChange={(e) => set({ prazoEntrega: e.target.value })} placeholder="Ex.: 1–2 dias após pagamento" /></Field>
        <label className="check full"><input type="checkbox" checked={!!f.temCredito} onChange={(e) => set({ temCredito: e.target.checked })} /> Tenho crédito aberto com este fornecedor</label>
        <Field label="Dados para pagamento (contas, NIB…)" full><textarea value={f.dadosBancarios || ''} onChange={(e) => set({ dadosBancarios: e.target.value })} style={{ minHeight: 70 }} /></Field>
        <Field label="Logotipo (aparece na lista de impressão)" full>
          <input type="file" accept="image/*" onChange={async (e) => { const x = e.target.files?.[0]; if (x) set({ logoId: await guardarFicheiro(x) }) }} />
        </Field>
        <Field label="Notas" full><textarea value={f.notas || ''} onChange={(e) => set({ notas: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

export function Fornecedores() {
  const d = useDados()
  const [novoF, setNovoF] = useState(false)
  const contas = contasAPagar(d.requisicoes, d.empresa.taxaIva)
  return (
    <Page title="Fornecedores" sub={`${d.fornecedores.length} fornecedores`} actions={<button className="btn pri" onClick={() => setNovoF(true)}><Icon n="plus" /> <span className="hide-m">Novo fornecedor</span></button>}>
      <div className="grid g2">
        {d.fornecedores.map((f) => {
          const reqs = d.requisicoes.filter((r) => r.fornecedorId === f.id)
          const deve = contas.filter((c) => c.r.fornecedorId === f.id).reduce((s, c) => s + c.valor, 0)
          return (
            <div key={f.id} className="card pad" style={{ cursor: 'pointer' }} onClick={() => ir(`/fornecedores/${f.id}`)}>
              <div className="row">
                <LogoForn f={f} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 15 }}>{f.nome}</b> <DemoTag demo={f.demo} />
                  <div className="small muted">{f.categoria}{f.temCredito ? ' · crédito aberto' : ''}</div>
                </div>
              </div>
              <div className="small tx2" style={{ marginTop: 12 }}>{f.materiais.length} produtos/serviços na tabela</div>
              <div className="hr" />
              <div className="row small">
                <span className="muted">{reqs.length} requisições</span>
                <span className="spacer" />
                {deve > 0 ? <b className="num" style={{ color: 'var(--warn)' }}>Deve {mt(deve)}</b> : <span className="badge ok">Nada em dívida</span>}
              </div>
            </div>
          )
        })}
      </div>
      {d.fornecedores.length === 0 && <div className="card"><Empty icon="fornecedores" title="Sem fornecedores" /></div>}
      {novoF && <FornecedorForm onClose={(id) => { setNovoF(false); if (id) ir(`/fornecedores/${id}`) }} />}
    </Page>
  )
}

export function FornecedorDetalhe({ id }: { id: string }) {
  const d = useDados()
  const { pode } = useSessao()
  const f = d.fornecedor(id)
  const [edit, setEdit] = useState(false)
  if (!f) return <Page title="Fornecedor" back="/fornecedores"><Empty title="Não encontrado" /></Page>
  const taxa = d.empresa.taxaIva
  const reqs = d.requisicoes.filter((r) => r.fornecedorId === f.id)
  const docs = d.documentos.filter((x) => x.fornecedorId === f.id)
  const contas = contasAPagar(reqs, taxa)
  const deve = contas.reduce((s, c) => s + c.valor, 0)
  const tot = reqs.reduce((a, r) => { const t = totaisRequisicao(r, taxa); return { m2: a.m2 + t.m2, total: a.total + valorRequisicao(r, taxa) } }, { m2: 0, total: 0 })
  const grupos = TIPOS_ITEM.map((t) => ({ ...t, itens: f.materiais.filter((m) => m.tipo === t.v) })).filter((g) => g.itens.length)
  return (
    <Page back="/fornecedores" title={f.nome} sub={f.categoria} actions={<>
      {f.telefone && <a className="btn" href={waLink(f.telefone)} target="_blank" rel="noreferrer"><Icon n="whatsapp" /></a>}
      <button className="btn" onClick={() => setEdit(true)}><Icon n="editar" /> <span className="hide-m">Editar</span></button>
    </>}>
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className={`card kpi ${deve > 0 ? 'hl link' : ''}`} onClick={() => deve > 0 && ir('/contas-pagar')}><div className="lbl">Devo</div><div className="val">{mt(deve).replace(',00', '')}</div><div className="foot">{contas.filter((c) => c.credito).length} a crédito · {contas.filter((c) => !c.credito).length} pró-formas por pagar</div></div>
        <div className="card kpi"><div className="lbl">Requisições</div><div className="val">{reqs.length}</div></div>
        <div className="card kpi"><div className="lbl">m² impressos</div><div className="val">{num2(tot.m2)}</div></div>
        <div className="card kpi"><div className="lbl">Total (c/ IVA)</div><div className="val">{mt(tot.total).replace(',00', '')}</div></div>
      </div>
      <div className="grid g-main">
        <div className="col" style={{ gap: 14 }}>
          <div className="card pad">
            <h3><Icon n="catalogo" /> Tabela de preços <span className="right small tx2">sem IVA</span></h3>
            {grupos.length === 0 ? <Empty icon="catalogo" title="Sem produtos registados" text="Edite o fornecedor para adicionar a tabela." /> : (
              <table className="tbl">
                <tbody>
                  {grupos.map((g) => (
                    <Fragment key={g.v}>
                      <tr><td colSpan={2} className="tiny muted b" style={{ textTransform: 'uppercase', letterSpacing: '.08em', paddingTop: 16 }}>{g.l}</td></tr>
                      {g.itens.map((m) => (
                        <tr key={m.nome}>
                          <td><b>{m.nome}</b>{m.descricao && <div className="tiny muted">{m.descricao}</div>}</td>
                          <td className="r num nowrap b">{mt(m.precoM2)}<span className="muted small"> /{m.unidade || 'm²'}</span></td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card pad">
            <h3><Icon n="imprimir" /> Requisições</h3>
            {reqs.length === 0 ? <Empty icon="imprimir" title="Sem requisições" /> : (
              <div className="list">
                {reqs.map((r) => {
                  const job = d.trabalhos.find((x) => x.id === r.trabalhoId)
                  return (
                    <div key={r.id} className="li" onClick={() => ir(`/requisicoes/${r.id}`)}>
                      <div className="main-t"><b>{r.numero} · {r.nomeTrabalho}</b><span>{dataMedia(r.data)} · {job?.codigo} {d.cliente(job?.clienteId)?.nome}{r.proforma ? ` · PF ${r.proforma.numero}` : ''}</span></div>
                      <FaseBadge r={r} />
                      <b className="num nowrap hide-m">{mt(valorRequisicao(r, taxa))}</b>
                      {r.tipo !== 'encomenda' && <button className="btn sm icon" onClick={(e) => { e.stopPropagation(); imprimirLista(r, d) }} title="PDF"><Icon n="imprimir" /></button>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="card pad">
            <h3>Condições e contactos</h3>
            <dl className="kv">
              <dt>Pagamento</dt><dd>{CONDICOES[f.condicao || 'proforma']}</dd>
              <dt>Crédito</dt><dd>{f.temCredito ? 'Aberto' : 'Não'}</dd>
              {f.prazoEntrega && <><dt>Entrega</dt><dd>{f.prazoEntrega}</dd></>}
              <dt>Contacto</dt><dd>{f.contacto || '—'}</dd>
              <dt>Telefone</dt><dd>{f.telefone || '—'}</dd>
              <dt>Email</dt><dd className="ellipsis">{f.email || '—'}</dd>
              <dt>NUIT</dt><dd>{f.nuit || '—'}</dd>
            </dl>
            {f.morada && <div className="small tx2" style={{ marginTop: 10 }}>{f.morada}</div>}
            {f.dadosBancarios && <><div className="hr" /><div className="tiny muted b" style={{ marginBottom: 4 }}>DADOS PARA PAGAMENTO</div><div className="small tx2 pre num">{f.dadosBancarios}</div></>}
            {f.notas && <><div className="hr" /><div className="small tx2 pre">{f.notas}</div></>}
          </div>
          {contas.length > 0 && (
            <div className="card pad">
              <h3><Icon n="carteira" /> Por pagar</h3>
              <div className="list">
                {contas.map(({ r, valor, desde, credito }) => (
                  <div key={r.id} className="li" onClick={() => ir(`/requisicoes/${r.id}`)}>
                    <div className="main-t"><b>{r.proforma ? `PF ${r.proforma.numero}` : r.numero}</b><span>{credito ? 'A crédito' : 'Pró-forma'} há {diasEntre(desde, hojeISO())} dias</span></div>
                    <b className="num nowrap">{mt(valor)}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pode('iva') && docs.length > 0 && <div className="card pad"><h3>Faturas e recibos</h3><div className="list">{docs.map((x) => <DocLinha key={x.id} doc={x} />)}</div></div>}
          {pode('apagar') && reqs.length === 0 && <button className="btn danger" onClick={async () => { await apagar(db.fornecedores, f.id); ir('/fornecedores') }}><Icon n="lixo" /> Apagar fornecedor</button>}
        </div>
      </div>
      {edit && <FornecedorForm f={f} onClose={() => setEdit(false)} />}
    </Page>
  )
}
