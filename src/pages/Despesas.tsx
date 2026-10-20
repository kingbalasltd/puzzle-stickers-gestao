import { useMemo, useState } from 'react'
import { Page } from '../App'
import { apagar, db, guardar, guardarFicheiro, novo, registar, type Despesa, type DespesaFixa, type Documento } from '../db'
import { CATEGORIAS_DESPESA, baseDeTotal, despesaSemIva, fixasDoMes, hojeISO, r2, resultadoDoMes, type EstadoFixa } from '../calc'
import { dataCurta, dataMedia, mesNome, mt, num2, parseNum } from '../format'
import { useDados, useRota, useSessao } from '../state'
import { Confirm, Empty, Field, Icon, Modal, Seg, Thumb, UploadZone, useToast } from '../ui'
import { metodos } from './comum'

const COR_CAT: Record<string, string> = {
  'Salários': '#7c5cff',
  'Renda': '#ff8a00',
  'Energia (EDM)': '#ffc406',
  'Água': '#1e9bff',
  'Internet e telefone': '#00b3a4',
  'Subscrições e software': '#e84393',
  'Transporte e combustível': '#ff6b6b',
  'Material de escritório': '#8a8f98',
  'Manutenção e equipamento': '#2bb673',
  'Marketing e publicidade': '#f5a623',
  'Impostos e taxas': '#b4b4bb',
  'Outros': '#6b6b74'
}
export const corCategoria = (c: string) => COR_CAT[c] || '#6b6b74'

export default function Despesas() {
  const d = useDados()
  const { query } = useRota()
  const hoje = hojeISO()
  const [mes, setMes] = useState(query.get('mes') || hoje.slice(0, 7))
  const [form, setForm] = useState<{ despesa?: Despesa; preset?: Partial<Despesa> } | null>(null)
  const [fixas, setFixas] = useState(false)
  const [cat, setCat] = useState('')

  const estado = useMemo(() => fixasDoMes(d.despesasFixas, d.despesas, mes, hoje), [d.despesasFixas, d.despesas, mes, hoje])
  const doMes = d.despesas.filter((x) => x.data.startsWith(mes) && !x.pessoal)
  const res = useMemo(() => resultadoDoMes(mes, d.documentos, d.requisicoes, d.custos, d.despesas, d.empresa.taxaIva), [mes, d])
  const porPagar = estado.filter((e) => e.estado !== 'paga')
  const totalPago = r2(doMes.reduce((s, x) => s + x.valor, 0))
  const ivaDesp = r2(doMes.reduce((s, x) => s + (x.iva || 0), 0))
  const cats = [...res.porCategoria.entries()].sort((a, b) => b[1] - a[1])
  const maxCat = Math.max(1, ...cats.map((c) => c[1]))
  const lista = doMes.filter((x) => !cat || x.categoria === cat)

  const mover = (n: number) => {
    const x = new Date(mes + '-15T12:00:00')
    x.setMonth(x.getMonth() + n)
    setMes(x.toISOString().slice(0, 7))
  }

  const pagar = ({ fixa: f, vencimento }: EstadoFixa) =>
    setForm({ preset: { descricao: f.nome, categoria: f.categoria, valor: f.valor, entidade: f.entidade, fixaId: f.id, mes, data: hoje >= `${mes}-01` ? hoje : vencimento, iva: f.categoria === 'Internet e telefone' ? r2(f.valor - baseDeTotal(f.valor, d.empresa.taxaIva)) : 0 } })

  return (
    <Page
      title="Despesas"
      sub="Salários, contas, subscrições e todos os gastos da empresa"
      actions={
        <>
          <button className="btn" onClick={() => setFixas(true)}><Icon n="agenda" /> <span className="hide-m">Despesas fixas</span></button>
          <button className="btn pri" onClick={() => setForm({ preset: { data: hoje.slice(0, 7) === mes ? hoje : `${mes}-01` } })}><Icon n="plus" /> <span className="hide-m">Despesa</span></button>
        </>
      }
    >
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn icon" onClick={() => mover(-1)} aria-label="Mês anterior"><Icon n="left" /></button>
        <div className="b" style={{ fontSize: 18, minWidth: 170, textAlign: 'center' }}>{mesNome(mes)}</div>
        <button className="btn icon" onClick={() => mover(1)} aria-label="Mês seguinte"><Icon n="right" /></button>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi">
          <div className="lbl"><Icon n="despesa" /> Gasto no mês</div>
          <div className="val">{mt(totalPago).replace(',00', '')}</div>
          <div className="foot">{doMes.length} despesas · {mt(res.despesas).replace(',00', '')} sem IVA</div>
        </div>
        <div className={`card kpi ${porPagar.some((e) => e.estado === 'atrasada') ? 'warn' : ''}`}>
          <div className="lbl"><Icon n="relogio" /> Despesas fixas do mês</div>
          <div className="val">{mt(estado.reduce((s, e) => s + e.fixa.valor, 0)).replace(',00', '')}</div>
          <div className="foot">{resumoFixas(estado)}</div>
        </div>
        <div className="card kpi">
          <div className="lbl"><Icon n="iva" /> IVA dedutível</div>
          <div className="val">{mt(ivaDesp).replace(',00', '')}</div>
          <div className="foot">das despesas com fatura</div>
        </div>
        <div className={`card kpi ${res.resultado >= 0 ? 'hl' : 'bad'}`}>
          <div className="lbl"><Icon n="tendencia" /> Resultado do mês</div>
          <div className="val">{mt(res.resultado).replace(',00', '')}</div>
          <div className="foot">faturado − trabalhos − despesas</div>
        </div>
      </div>

      <div className="grid g-main">
        <div className="col" style={{ gap: 14 }}>
          <div className="card pad">
            <h3><Icon n="agenda" /> Despesas fixas de {mesNome(mes).split(' ')[0].toLowerCase()} <button className="right btn sm ghost" onClick={() => setFixas(true)}>Gerir</button></h3>
            {estado.length === 0 ? (
              <Empty icon="agenda" title="Sem despesas fixas" text="Registe salários, renda, luz, internet e subscrições uma vez e elas aparecem todos os meses.">
                <button className="btn pri" onClick={() => setFixas(true)}><Icon n="plus" /> Adicionar</button>
              </Empty>
            ) : (
              <div className="list">
                {estado.map((e) => (
                  <div key={e.fixa.id} className="li" onClick={() => (e.paga ? setForm({ despesa: e.paga }) : pagar(e))}>
                    <div className="avatar" style={{ background: `color-mix(in srgb, ${corCategoria(e.fixa.categoria)} 20%, transparent)`, color: corCategoria(e.fixa.categoria) }}><Icon n="despesa" /></div>
                    <div className="main-t">
                      <b>{e.fixa.nome}</b>
                      <span>{e.fixa.categoria} · {e.abre ? `pagar de ${dataCurta(e.abre)} a ${dataCurta(e.vencimento)}` : `vence ${dataCurta(e.vencimento)}`}{e.paga ? ` · paga ${dataCurta(e.paga.data)}` : ''}</span>
                    </div>
                    <b className="num nowrap">{mt(e.paga?.valor ?? e.fixa.valor)}</b>
                    {e.estado === 'paga' ? (
                      <span className="badge ok"><Icon n="check" style={{ width: 13, height: 13 }} /> <span className="hide-m">Paga</span></span>
                    ) : e.estado === 'pendente' ? (
                      <span className="badge" title="Ainda não está na altura de pagar">a partir de {dataCurta(e.abre || e.vencimento)}</span>
                    ) : (
                      <button className={`btn sm ${e.estado === 'atrasada' || e.estado === 'a-pagar' ? 'pri' : ''}`} onClick={(ev) => { ev.stopPropagation(); pagar(e) }}>
                        {e.estado === 'atrasada' ? 'Em atraso · pagar' : `Pagar até ${dataCurta(e.vencimento)}`}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card pad">
            <h3>
              <Icon n="lista" /> Todas as despesas
              <select className="inp right" style={{ width: 'auto', height: 32, fontSize: 12.5 }} value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Todas as categorias</option>
                {[...new Set(doMes.map((x) => x.categoria))].map((c) => <option key={c}>{c}</option>)}
              </select>
            </h3>
            {lista.length === 0 ? (
              <Empty icon="despesa" title="Nenhuma despesa neste mês" />
            ) : (
              <div className="list">
                {lista.map((x) => (
                  <div key={x.id} className="li" onClick={() => setForm({ despesa: x })}>
                    <div style={{ width: 42, textAlign: 'center' }}>
                      <div className="b" style={{ fontSize: 16, lineHeight: 1 }}>{x.data.slice(8, 10)}</div>
                      <div className="tiny muted" style={{ textTransform: 'uppercase' }}>{dataCurta(x.data).split(' ')[1]}</div>
                    </div>
                    <div className="main-t">
                      <b>{x.descricao}{x.demo && <span className="badge demo">exemplo</span>}</b>
                      <span>
                        <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 3, background: corCategoria(x.categoria), marginRight: 6 }} />
                        {x.categoria}{x.entidade ? ` · ${x.entidade}` : ''}{x.metodo ? ` · ${x.metodo}` : ''}{x.ficheiroId ? ' · 📎' : ''}
                      </span>
                    </div>
                    <div className="right">
                      <b className="num nowrap">{mt(x.valor)}</b>
                      {x.iva > 0 && <div className="tiny muted num">IVA {mt(x.iva)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div className="card pad">
            <h3><Icon n="tendencia" /> Resultado de {mesNome(mes).split(' ')[0].toLowerCase()}</h3>
            <dl className="kv">
              <dt>Faturado (sem IVA)</dt><dd className="num">{mt(res.vendas)}</dd>
              <dt>− Material dos trabalhos (fornecedores)</dt><dd className="num">{mt(res.custosTrabalhos)}</dd>
              <dt>− Compras e despesas da empresa</dt><dd className="num">{mt(res.despesas)}</dd>
            </dl>
            <div className="hr" />
            <div className="row">
              <b>= Resultado</b>
              <span className="spacer" />
              <b className="num" style={{ fontSize: 20, color: res.resultado >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{mt(res.resultado)}</b>
            </div>
            <div className="tiny muted" style={{ marginTop: 8 }}>Valores sem IVA. Tudo é despesa, mas cada coisa conta uma só vez: o material da Académica conta quando faz o pedido; pagar depois a Académica não volta a contar. As compras (refeições, limpeza…) são as despesas da empresa.</div>
          </div>

          <div className="card pad">
            <h3><Icon n="painel" /> Por categoria</h3>
            {cats.length === 0 ? <div className="small muted">Sem despesas neste mês.</div> : (
              <div className="bars">
                {cats.map(([c, v]) => (
                  <div key={c} className="bar-row" style={{ gridTemplateColumns: '1fr 90px', cursor: 'pointer' }} onClick={() => setCat(cat === c ? '' : c)}>
                    <div>
                      <div className="row small" style={{ marginBottom: 4 }}><span className="tx2 ellipsis" style={{ fontWeight: cat === c ? 800 : 500 }}>{c}</span></div>
                      <div className="track"><div className="fill" style={{ width: `${(v / maxCat) * 100}%`, background: corCategoria(c) }} /></div>
                    </div>
                    <b className="num right small">{mt(v).replace(',00', '')}</b>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card pad">
            <h3><Icon n="agenda" /> Custo fixo mensal</h3>
            <div className="sum-big num">{mt(d.despesasFixas.filter((f) => f.ativo).reduce((s, f) => s + f.valor, 0))}</div>
            <div className="small muted">{d.despesasFixas.filter((f) => f.ativo).length} despesas fixas ativas — é o mínimo que a empresa precisa de faturar por mês (mais os materiais).</div>
          </div>
        </div>
      </div>

      {form && <DespesaForm despesa={form.despesa} preset={form.preset} onClose={() => setForm(null)} />}
      {fixas && <FixasModal onClose={() => setFixas(false)} />}
    </Page>
  )
}

export function DespesaForm({ despesa, preset, titulo, onClose }: { despesa?: Despesa; preset?: Partial<Despesa>; titulo?: string; onClose: () => void }) {
  const d = useDados()
  const { user, pode } = useSessao()
  const toast = useToast()
  const taxa = d.empresa.taxaIva
  const docLigado = despesa ? d.documentos.find((x) => x.despesaId === despesa.id) : undefined
  const [f, setF] = useState<Partial<Despesa>>(() => despesa ? { ...despesa } : { descricao: '', categoria: 'Outros', valor: 0, iva: 0, data: hojeISO(), metodo: 'M-Pesa', ...preset })
  // A new purchase with a fatura / venda a dinheiro usually carries IVA.
  const [comIva, setComIva] = useState(() => (despesa ? despesa.iva > 0 : (preset?.iva || 0) > 0 || preset?.documento === 'fatura' || preset?.documento === 'venda-dinheiro'))
  const [numeroFatura, setNumeroFatura] = useState(despesa?.numeroDoc || docLigado?.numero || '')
  const [docTipo, setDocTipo] = useState<NonNullable<Despesa['documento']>>(() => despesa?.documento || (docLigado ? (docLigado.tipo === 'venda-dinheiro' ? 'venda-dinheiro' : 'fatura') : despesa?.ficheiroId ? 'recibo' : preset?.documento || 'nenhum'))
  const fiscal = docTipo === 'fatura' || docTipo === 'venda-dinheiro'
  const [conf, setConf] = useState(false)
  const set = (p: Partial<Despesa>) => setF((x) => ({ ...x, ...p }))
  const fixa = d.despesasFixas.find((x) => x.id === f.fixaId)
  const cats = [...new Set([...CATEGORIAS_DESPESA, ...d.despesas.map((x) => x.categoria), ...d.despesasFixas.map((x) => x.categoria)])]

  const ivaAuto = (valor: number) => r2(valor - baseDeTotal(valor, taxa))

  async function salvar() {
    const valor = f.valor || 0
    if (!f.descricao?.trim()) return toast('Escreva a descrição')
    if (valor <= 0) return toast('Indique o valor')
    const iva = fiscal && comIva ? f.iva || 0 : 0
    const rec: Despesa = { ...(despesa || novo<Despesa>({ ...(f as any) })), ...(f as Despesa), iva, documento: docTipo, numeroDoc: docTipo === 'nenhum' ? undefined : numeroFatura || undefined }
    await guardar(db.despesas, rec)
    // Fatura / venda a dinheiro also go to the archive of received documents (IVA dedutível when they carry IVA).
    if (fiscal) {
      const tipo = docTipo === 'venda-dinheiro' ? 'venda-dinheiro' : 'fatura'
      const doc: Documento = docLigado
        ? { ...docLigado, tipo, numero: numeroFatura || docLigado.numero, data: rec.data, entidade: rec.entidade || rec.descricao, base: r2(valor - iva), iva, total: valor, ficheiroId: rec.ficheiroId }
        : novo<Documento>({ direcao: 'recebido', tipo, numero: numeroFatura || 's/n', data: rec.data, entidade: rec.entidade || rec.descricao, base: r2(valor - iva), iva, total: valor, ficheiroId: rec.ficheiroId, despesaId: rec.id, notas: `Despesa: ${rec.descricao}` })
      await guardar(db.documentos, doc)
    } else if (docLigado) {
      await apagar(db.documentos, docLigado.id)
    }
    if (!despesa) await registar(user.id, `registou despesa ${rec.descricao} (${mt(valor)})`, rec.id)
    toast(fixa && !despesa ? `${fixa.nome} marcada como paga` : 'Despesa guardada')
    onClose()
  }

  async function remover() {
    if (!despesa) return
    await apagar(db.despesas, despesa.id)
    if (docLigado) await apagar(db.documentos, docLigado.id)
    toast('Despesa apagada')
    onClose()
  }

  return (
    <Modal
      wide
      title={despesa ? 'Despesa' : fixa ? `Pagar ${fixa.nome}` : titulo || 'Nova despesa'}
      onClose={onClose}
      footer={
        <>
          {despesa && pode('apagar') && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => setConf(true)}><Icon n="lixo" /> {fixa ? 'Desmarcar' : 'Apagar'}</button>}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn pri" onClick={salvar}><Icon n="check" /> {fixa && !despesa ? 'Marcar como paga' : 'Guardar'}</button>
        </>
      }
    >
      {fixa && <div className="banner"><Icon n="agenda" /> Despesa fixa · referente a {mesNome(f.mes || hojeISO().slice(0, 7))}</div>}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="form-grid">
          <Field label="Descrição" full><input autoFocus={!despesa && !fixa} value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Ex.: refeição da equipa, material de limpeza, recarga Credelec…" /></Field>
          <Field label="Categoria">
            <select value={f.categoria} onChange={(e) => set({ categoria: e.target.value })}>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Valor pago (MT)">
            <input inputMode="decimal" defaultValue={f.valor ? num2(f.valor) : ''} onBlur={(e) => { const v = parseNum(e.target.value); set({ valor: v, iva: comIva ? ivaAuto(v) : 0 }) }} />
          </Field>
          <Field label="Data"><input type="date" value={f.data} onChange={(e) => set({ data: e.target.value })} /></Field>
          <Field label="Método">
            <select value={f.metodo} onChange={(e) => set({ metodo: e.target.value })}>
              {metodos.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Pago a (opcional)" full><input value={f.entidade || ''} onChange={(e) => set({ entidade: e.target.value })} placeholder="EDM, senhorio, operadora, nome do trabalhador…" /></Field>
          <Field label="Notas" full><input value={f.notas || ''} onChange={(e) => set({ notas: e.target.value })} /></Field>
        </div>
        <div className="col">
          <div className="req-total small">
            <div className="row"><span className="muted">Sem IVA</span><span className="spacer" /><span className="num">{mt(despesaSemIva({ valor: f.valor || 0, iva: comIva ? f.iva || 0 : 0 }))}</span></div>
            <div className="row"><span className="muted">IVA dedutível</span><span className="spacer" /><span className="num">{mt(comIva ? f.iva || 0 : 0)}</span></div>
            <div className="row b"><span>Total pago</span><span className="spacer" /><span className="num">{mt(f.valor || 0)}</span></div>
          </div>
          <div className="tiny muted">{fiscal && comIva ? `Fica também em Faturas e recibos e entra no IVA de ${mesNome((f.data || '').slice(0, 7) || hojeISO().slice(0, 7))}.` : 'Sem IVA dedutível. Conta como despesa da empresa.'}</div>
        </div>
      </div>
      <div className="card pad" style={{ marginTop: 14, background: 'var(--card2)' }}>
        <div className="small b tx2" style={{ marginBottom: 8 }}>Documento da compra</div>
        <div className="seg-wrap"><Seg value={docTipo} onChange={(v) => { setDocTipo(v); if (v === 'fatura' || v === 'venda-dinheiro') { setComIva(true); set({ iva: ivaAuto(f.valor || 0) }) } else { setComIva(false); set({ iva: 0 }) } }} options={[{ v: 'fatura', l: 'Fatura' }, { v: 'venda-dinheiro', l: 'Venda a dinheiro' }, { v: 'recibo', l: 'Recibo' }, { v: 'nenhum', l: 'Sem documento' }]} /></div>
        {docTipo !== 'nenhum' && (
          <div className="grid g2" style={{ marginTop: 10, alignItems: 'start' }}>
            <div className="form-grid">
              <Field label={docTipo === 'venda-dinheiro' ? 'Nº da venda a dinheiro' : docTipo === 'recibo' ? 'Nº do recibo (opcional)' : 'Nº da fatura'} full><input value={numeroFatura} onChange={(e) => setNumeroFatura(e.target.value)} /></Field>
              {fiscal && (
                <div className="field full">
                  <label className="check"><input type="checkbox" checked={comIva} onChange={(e) => { setComIva(e.target.checked); set({ iva: e.target.checked ? ivaAuto(f.valor || 0) : 0 }) }} /> Tem IVA (conta como IVA dedutível)</label>
                  {comIva && <label className="field" style={{ marginTop: 8 }}><span>IVA incluído</span><input inputMode="decimal" value={num2(f.iva || 0)} onChange={(e) => set({ iva: parseNum(e.target.value) })} /></label>}
                </div>
              )}
            </div>
            <div className="col">
              {f.ficheiroId ? (
                <div className="thumbs" style={{ gridTemplateColumns: '1fr' }}><Thumb id={f.ficheiroId} onRemove={() => set({ ficheiroId: undefined })} /></div>
              ) : (
                <UploadZone multiple={false} text={docTipo === 'venda-dinheiro' ? 'Foto ou PDF da venda a dinheiro' : docTipo === 'recibo' ? 'Foto ou PDF do recibo' : 'Foto ou PDF da fatura'} onFiles={async (fs) => fs[0] && set({ ficheiroId: await guardarFicheiro(fs[0]) })} />
              )}
            </div>
          </div>
        )}
      </div>
      {conf && <Confirm text={fixa ? 'Desmarcar este pagamento? A despesa fixa volta a aparecer como por pagar neste mês.' : 'Apagar esta despesa?'} ok={fixa ? 'Desmarcar' : 'Apagar'} onOk={remover} onClose={() => setConf(false)} />}
    </Modal>
  )
}

function FixasModal({ onClose }: { onClose: () => void }) {
  const d = useDados()
  const [edit, setEdit] = useState<DespesaFixa | 'nova' | null>(null)
  const ativas = d.despesasFixas.filter((f) => f.ativo)
  if (edit) return <FixaForm fixa={edit === 'nova' ? undefined : edit} onClose={() => setEdit(null)} />
  return (
    <Modal
      wide
      title="Despesas fixas mensais"
      onClose={onClose}
      footer={<><span className="small muted" style={{ marginRight: 'auto' }}>Total mensal: <b style={{ color: 'var(--tx)' }}>{mt(ativas.reduce((s, f) => s + f.valor, 0))}</b></span><button className="btn pri" onClick={() => setEdit('nova')}><Icon n="plus" /> Nova despesa fixa</button></>}
    >
      <div className="small muted" style={{ marginBottom: 12 }}>Registe uma vez. Todos os meses aparecem em Despesas para marcar como pagas, com aviso quando passam do dia.</div>
      {d.despesasFixas.length === 0 ? <Empty icon="agenda" title="Ainda sem despesas fixas" /> : (
        <div className="list">
          {d.despesasFixas.map((f) => (
            <div key={f.id} className="li" onClick={() => setEdit(f)} style={{ opacity: f.ativo ? 1 : 0.5 }}>
              <div className="avatar" style={{ background: `color-mix(in srgb, ${corCategoria(f.categoria)} 20%, transparent)`, color: corCategoria(f.categoria) }}><Icon n="despesa" /></div>
              <div className="main-t">
                <b>{f.nome}{f.demo && <span className="badge demo">exemplo</span>}</b>
                <span>{f.categoria} · {f.abre ? `de dia ${f.abre} a dia ${f.dia}${f.abre > f.dia ? ' do mês seguinte' : ''}` : `todo dia ${f.dia}`}{f.entidade ? ` · ${f.entidade}` : ''}{!f.ativo ? ' · parada' : ''}</span>
              </div>
              <b className="num nowrap">{mt(f.valor)}</b>
              <Icon n="right" />
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// One line for the month: when they are paid, how many are paid, any late.
function resumoFixas(estado: EstadoFixa[]) {
  if (!estado.length) return 'Sem despesas fixas'
  const pagas = estado.filter((e) => e.estado === 'paga').length
  const atraso = estado.filter((e) => e.estado === 'atrasada').length
  const abertas = estado.filter((e) => e.estado === 'a-pagar')
  if (pagas === estado.length) return `Todas pagas (${pagas})`
  if (atraso) return `${atraso} em atraso · ${pagas} de ${estado.length} pagas`
  if (abertas.length) return `${abertas.length} por pagar até ${dataCurta(abertas[0].vencimento)} · ${pagas} de ${estado.length} pagas`
  const e = estado.find((x) => x.estado === 'pendente')!
  return e.abre ? `Pagam-se de ${dataCurta(e.abre)} a ${dataCurta(e.vencimento)}` : `Vencem a ${dataCurta(e.vencimento)}`
}

function FixaForm({ fixa, onClose }: { fixa?: DespesaFixa; onClose: () => void }) {
  const d = useDados()
  const toast = useToast()
  const [f, setF] = useState<Partial<DespesaFixa>>(() => fixa ? { ...fixa } : { nome: '', categoria: 'Renda', valor: 0, abre: 25, dia: 5, inicio: hojeISO().slice(0, 7), ativo: true })
  const set = (p: Partial<DespesaFixa>) => setF((x) => ({ ...x, ...p }))
  const cats = [...new Set([...CATEGORIAS_DESPESA, ...d.despesasFixas.map((x) => x.categoria)])]
  async function salvar() {
    if (!f.nome?.trim()) return toast('Escreva o nome')
    if (!f.valor) return toast('Indique o valor mensal')
    if (!f.dia || f.dia < 1 || f.dia > 31 || (f.abre && (f.abre < 1 || f.abre > 31))) return toast('Dias do mês entre 1 e 31')
    await guardar(db.despesasFixas, fixa ? ({ ...fixa, ...f } as DespesaFixa) : novo<DespesaFixa>(f as any))
    toast('Despesa fixa guardada')
    onClose()
  }
  return (
    <Modal
      title={fixa ? fixa.nome : 'Nova despesa fixa'}
      onClose={onClose}
      footer={
        <>
          {fixa && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={async () => { await apagar(db.despesasFixas, fixa.id); onClose() }}><Icon n="lixo" /></button>}
          <button className="btn" onClick={onClose}>Voltar</button>
          <button className="btn pri" onClick={salvar}><Icon n="check" /> Guardar</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nome" full><input autoFocus value={f.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Renda do escritório, Salário — Ana, Internet" /></Field>
        <Field label="Categoria">
          <select value={f.categoria} onChange={(e) => set({ categoria: e.target.value })}>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Valor mensal (MT)"><input inputMode="decimal" defaultValue={f.valor ? num2(f.valor) : ''} onBlur={(e) => set({ valor: parseNum(e.target.value) })} /></Field>
        <Field label="Paga-se a partir do dia" hint="Vazio = só há um dia de pagamento"><input inputMode="numeric" value={f.abre || ''} onChange={(e) => set({ abre: parseNum(e.target.value) || undefined })} /></Field>
        <Field label="Até ao dia" hint={f.abre && f.dia && f.abre > f.dia ? `As de outubro pagam-se de ${f.abre} out a ${f.dia} nov` : 'Se o mês for mais curto, conta o último dia'}><input inputMode="numeric" value={f.dia} onChange={(e) => set({ dia: parseNum(e.target.value) })} /></Field>
        <Field label="A partir de"><input type="month" value={f.inicio} onChange={(e) => set({ inicio: e.target.value })} /></Field>
        <Field label="Pago a (opcional)"><input value={f.entidade || ''} onChange={(e) => set({ entidade: e.target.value })} /></Field>
        {f.categoria === 'Salários' && (
          <Field label="Trabalhador (opcional)">
            <select value={f.utilizadorId || ''} onChange={(e) => set({ utilizadorId: e.target.value || undefined })}>
              <option value="">—</option>
              {d.utilizadores.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notas" full><input value={f.notas || ''} onChange={(e) => set({ notas: e.target.value })} /></Field>
        <label className="check full"><input type="checkbox" checked={!!f.ativo} onChange={(e) => set({ ativo: e.target.checked })} /> Ativa (aparece todos os meses)</label>
      </div>
      {fixa && <div className="tiny muted" style={{ marginTop: 12 }}>Pagamentos registados: {d.despesas.filter((x) => x.fixaId === fixa.id).map((x) => dataMedia(x.data)).join(' · ') || 'nenhum'}</div>}
    </Modal>
  )
}
