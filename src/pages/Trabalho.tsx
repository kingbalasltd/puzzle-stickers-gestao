import { useState } from 'react'
import { Page } from '../App'
import { apagar, db, guardar, guardarFicheiro, novo, registar, type Cotacao, type Custo, type ItemTrabalho, type Pagamento, type Requisicao, type Trabalho } from '../db'
import { etapaAnterior, etapaInfo, etapasDoTipo, hojeISO, numeroDoMes, r2, semDocumento, tipoInfo, totaisRequisicao, totaisTrabalho, valorRequisicao } from '../calc'
import { dataMedia, mt, num2, parseNum, pct, quando, waLink } from '../format'
import { adicionarNota, moverEtapa } from '../acoes'
import { ir, useDados, useRota, useSessao } from '../state'
import { Avatar, Confirm, DemoTag, Empty, Field, Icon, Modal, Thumb, UploadZone, useMenu, useToast } from '../ui'
import { EtapaBadge, PrazoBadge, ProgressoPago, metodos } from './comum'
import { TrabalhoForm } from './TrabalhoForm'
import { FaseBadge, RequisicaoForm } from './RequisicaoForm'
import { DocumentoForm, DocLinha } from './Documentos'
import { imprimirLista } from '../print'
import { LinhaParte, soCatalogo } from './Partes'
import { FasesTrabalho } from './Fases'
import { EmitirFatura, EmitirRecibo } from './Rapido'
import { TarefasDoTrabalho } from './Agenda'

type Tab = 'resumo' | 'requisicoes' | 'pagamentos' | 'documentos' | 'notas'

export default function TrabalhoDetalhe({ id }: { id: string }) {
  const d = useDados()
  const { user, pode } = useSessao()
  const { query } = useRota()
  const toast = useToast()
  const menu = useMenu()
  const t = d.trabalhos.find((x) => x.id === id)
  const [tab, setTab] = useState<Tab>((query.get('tab') as Tab) || 'resumo')
  const [editar, setEditar] = useState(false)
  const [pag, setPag] = useState<Pagamento | 'novo' | null>(null)
  const [req, setReq] = useState<Requisicao | 'novo' | null>(null)
  const [custo, setCusto] = useState<Custo | 'novo' | null>(null)
  const [doc, setDoc] = useState<'novo' | null>(null)
  const [conf, setConf] = useState<{ text: string; ok: string; f: () => void } | null>(null)
  const [nota, setNota] = useState('')
  const [parte, setParte] = useState<ItemTrabalho | null>(null)
  const [pago, setPago] = useState(false)
  const [passar, setPassar] = useState<{ recibo?: string } | null>(null)

  if (!t) return <Page title="Trabalho" back="/trabalhos"><Empty title="Trabalho não encontrado" /></Page>

  const fin = pode('financas')
  const meu = t.responsavelId === user.id
  const podeMover = pode('editarTrabalho') || meu
  if (!pode('todosTrabalhos') && !meu) return <Page title="Trabalho" back="/trabalhos"><Empty icon="cadeado" title="Este trabalho não está atribuído a si" /></Page>

  const r = d.resumo(t)
  const tot = totaisTrabalho(t, d.empresa.taxaIva, d.empresa.urgenciaPct)
  const cli = d.cliente(t.clienteId)
  const resp = d.user(t.responsavelId)
  const ant = etapaAnterior(t)
  const pags = d.pagamentos.filter((p) => p.trabalhoId === t.id).sort((a, b) => a.data.localeCompare(b.data))
  const reqs = d.requisicoes.filter((x) => x.trabalhoId === t.id)
  const custos = d.custos.filter((x) => x.trabalhoId === t.id)
  const docs = d.documentos.filter((x) => x.trabalhoId === t.id || x.trabalhoIds?.includes(t.id))
  // Paid but no fatura-recibo / recibo yet: a reminder until he passes the document.
  const porDocumentar = r2(semDocumento(d.pagamentos, t.id).reduce((s, p) => s + p.valor, 0))
  const faturaAberta = docs.find((x) => x.direcao === 'emitido' && x.tipo === 'fatura')
  const passarDocumento = () => setPassar(faturaAberta ? { recibo: faturaAberta.id } : {})
  const serv = d.servicos.find((s) => s.id === t.servicoId)
  const cot = d.cotacoes.find((c) => c.id === t.cotacaoId)

  async function addFicheiros(fs: File[]) {
    const ids = []
    for (const f of fs) ids.push(await guardarFicheiro(f))
    await guardar(db.trabalhos, { ...t!, ficheiros: [...t!.ficheiros, ...ids] })
    toast(`${fs.length} ficheiro${fs.length > 1 ? 's' : ''} adicionado${fs.length > 1 ? 's' : ''}`)
  }

  async function guardarParte() {
    if (!parte?.descricao.trim()) return toast(soCatalogo(t!.tipo) ? 'Escolha o serviço do catálogo' : 'Escreva a descrição da parte')
    const nova: ItemTrabalho = { ...parte, servicoId: parte.servicoId === '__escolher' ? undefined : parte.servicoId, origem: parte.origem || (parte.precoUnit > 0 ? 'boca' : undefined) }
    await guardar(db.trabalhos, { ...t!, itens: [...t!.itens, nova] })
    setParte(null)
    toast(nova.origem === 'catalogo' ? 'Serviço do catálogo adicionado' : nova.precoUnit > 0 ? 'Parte guardada · combinado de boca' : 'Parte guardada · por cotar')
  }

  // One single quote with every part (verbal ones included), like his reference quote.
  async function fazerCotacao() {
    const c = novo<Cotacao>({
      numero: numeroDoMes('COT', d.cotacoes.map((x) => x.numero), hojeISO()),
      data: hojeISO(),
      clienteId: t!.clienteId,
      itens: (t!.itens.length ? t!.itens : [{ descricao: t!.titulo, qt: 1, precoUnit: 0 }]).map((it) => ({ qt: it.qt, titulo: it.descricao, subtitulo: '', descricao: it.detalhe || '', precoUnit: it.precoUnit })),
      validadeDias: d.empresa.validadeCotacao,
      notas: d.empresa.notaCotacao,
      estado: 'rascunho',
      origemTrabalhoId: t!.id
    })
    await db.cotacoes.put(c)
    // A quote puts a Pedido into negotiation.
    const seq = etapasDoTipo(t!.tipo)
    await moverEtapa(t!, seq.indexOf(t!.etapa) < seq.indexOf('negociacao') ? 'negociacao' : t!.etapa, user.id, { cotacaoId: c.id })
    await registar(user.id, `criou a cotação ${c.numero} para ${t!.codigo}`, t!.id)
    ir(`/cotacoes/${c.id}`)
  }

  const msgWa = `Olá ${cli?.nome?.split(' ')[0] || ''}! Sobre o trabalho "${t.titulo}" (${t.codigo}) da Puzzle Stickers: `

  const tabs: { v: Tab; l: string; n?: number; fin?: boolean }[] = [
    { v: 'resumo', l: 'Detalhes' },
    { v: 'requisicoes', l: 'Requisições', n: reqs.length + custos.length, fin: true },
    { v: 'pagamentos', l: 'Pagamentos', n: pags.length, fin: true },
    { v: 'documentos', l: 'Faturas e recibos', n: docs.length, fin: true },
    { v: 'notas', l: 'Notas e histórico', n: t.notas.length }
  ]

  return (
    <Page
      back="/trabalhos"
      title={<span className="row" style={{ gap: 8 }}>{t.titulo} <DemoTag demo={t.demo} /></span>}
      sub={<>{t.codigo} · {cli?.nome} · {tipoInfo(t.tipo).nome}</>}
      actions={
        <>
          <button
            className="btn icon"
            aria-label="Mais ações"
            onClick={(e) =>
              menu.open(e, [
                ...(podeMover && ant ? [{ l: `Voltar para ${etapaInfo(ant, t.tipo).curto}`, i: 'left', f: () => moverEtapa(t, ant, user.id) }] : []),
                ...(pode('editarTrabalho') ? [{ l: 'Editar trabalho', i: 'editar', f: () => setEditar(true) }] : []),
                ...(cli?.telefone ? [{ l: 'WhatsApp do cliente', i: 'whatsapp', f: () => window.open(waLink(cli.telefone, msgWa)) }] : []),
                ...(pode('editarTrabalho') && !t.cancelado
                  ? [{ l: 'Cancelar trabalho', i: 'x', f: () => setConf({ text: `Cancelar ${t.codigo}? Deixa de contar nas dívidas e na agenda.`, ok: 'Cancelar trabalho', f: async () => { await guardar(db.trabalhos, { ...t, cancelado: true }); await registar(user.id, `cancelou ${t.codigo}`, t.id) } }) }]
                  : []),
                ...(pode('apagar') ? [{ l: 'Apagar trabalho', i: 'lixo', f: () => setConf({ text: `Apagar ${t.codigo} definitivamente?`, ok: 'Apagar', f: async () => { await apagar(db.trabalhos, t.id); ir('/trabalhos') } }) }] : [])
              ])
            }
          >
            <Icon n="mais" />
          </button>
        </>
      }
    >
      {t.cancelado && <div className="banner"><Icon n="alerta" /> Trabalho cancelado. <button className="btn sm" onClick={() => guardar(db.trabalhos, { ...t, cancelado: false })}>Reativar</button></div>}

      {fin && porDocumentar > 0 && (
        <div className="banner warn" style={{ marginBottom: 14 }}>
          <Icon n="alerta" />
          <span style={{ flex: 1 }}>Recebido <b>{mt(porDocumentar)}</b> sem fatura/recibo — falta passar o documento.</span>
          <button className="btn sm pri" onClick={passarDocumento}>Passar fatura/recibo</button>
        </div>
      )}
      {!t.cancelado && <FasesTrabalho t={t} onPago={fin && r.emDivida > 0 ? () => setPago(true) : undefined} onCotacao={fazerCotacao} onRequisicao={() => { setTab('requisicoes'); setReq('novo') }} abrirEntrega={query.get('entregar') === '1'} />}

      <div className="grid g-main">
        <div style={{ minWidth: 0 }}>
          <div className="tabs">
            {tabs.filter((x) => !x.fin || fin).map((x) => (
              <button key={x.v} className={tab === x.v ? 'on' : ''} onClick={() => setTab(x.v)}>
                {x.l} {x.n ? <span className="n">{x.n}</span> : null}
              </button>
            ))}
          </div>

          {tab === 'resumo' && (
            <div className="col" style={{ gap: 14 }}>
              <div className="card pad">
                <h3>Trabalho</h3>
                <dl className="kv">
                  <dt>Cliente</dt><dd>{fin || pode('todosTrabalhos') ? <a href={`#/clientes/${cli?.id}`}>{cli?.nome}</a> : cli?.nome}</dd>
                  <dt>Tipo</dt><dd>{tipoInfo(t.tipo).nome}</dd>
                  <dt>Fase</dt><dd><EtapaBadge e={t.etapa} tipo={t.tipo} /></dd>
                  {t.etapa === 'entregue' && t.pagamentoPrometido && r.emDivida > 0 && <><dt>Prometeu pagar</dt><dd><span className={`badge ${t.pagamentoPrometido < hojeISO() ? 'bad' : 'warn'}`}>{dataMedia(t.pagamentoPrometido)}</span></dd></>}
                  <dt>Entrada</dt><dd>{dataMedia(t.dataEntrada)}</dd>
                  <dt>Entrega prevista</dt><dd><span className="row" style={{ justifyContent: 'flex-end' }}>{t.prazo ? dataMedia(t.prazo) : '—'} <PrazoBadge t={t} /></span></dd>
                  <dt>Responsável</dt><dd>{resp ? <span className="row" style={{ justifyContent: 'flex-end', gap: 8 }}><Avatar nome={resp.nome} cor={resp.cor} size="sm" /> {resp.nome}</span> : '—'}</dd>
                  {serv && <><dt>Serviço do catálogo</dt><dd>{serv.nome}{serv.diasMax ? ` · ${serv.diasMin}–${serv.diasMax} dias` : ''}</dd></>}
                  {cot && fin && <><dt>Cotação</dt><dd><a href={`#/cotacoes/${cot.id}`}>{cot.numero}</a></dd></>}
                  {t.urgente && <><dt>Urgência</dt><dd><span className="badge warn"><Icon n="raio" style={{ width: 12, height: 12 }} /> Urgente +{d.empresa.urgenciaPct}%</span></dd></>}
                </dl>
                {t.descricao && <><div className="hr" /><div className="pre tx2">{t.descricao}</div></>}
              </div>

              {fin && (
                <div className="card pad">
                  <h3>
                    Partes do trabalho
                    <span className="right row" style={{ gap: 6 }}>
                      <button className="btn sm" onClick={() => setParte({ descricao: '', qt: 1, precoUnit: 0 })}><Icon n="plus" /> {soCatalogo(t.tipo) ? 'Do catálogo' : 'Parte'}</button>
                      {cot ? (
                        <a className="btn sm pri" href={`#/cotacoes/${cot.id}`}><Icon n="cotacao" /> Cotação {cot.numero}</a>
                      ) : (
                        <button className="btn sm pri" onClick={fazerCotacao}><Icon n="cotacao" /> Fazer cotação</button>
                      )}
                    </span>
                  </h3>
                  {parte && (
                    <div className="req-total" style={{ marginBottom: 12 }}>
                      <LinhaParte tipo={t.tipo} it={parte} onChange={(p) => setParte({ ...parte, ...p })} />
                      <div className="row" style={{ marginTop: 8 }}>
                        <span className="tiny muted" style={{ flex: 1 }}>{soCatalogo(t.tipo) ? 'Criação de imagem: escolha do catálogo — o preço já vem.' : 'Com preço = combinado de boca. Sem preço = fica por cotar.'}</span>
                        {!soCatalogo(t.tipo) && !parte.servicoId && <button className="btn sm ghost" onClick={() => setParte({ ...parte, servicoId: '__escolher' })}><Icon n="catalogo" /> Do catálogo</button>}
                        <button className="btn sm" onClick={() => setParte(null)}>Cancelar</button>
                        <button className="btn sm pri" onClick={guardarParte}><Icon n="check" /> Guardar</button>
                      </div>
                    </div>
                  )}
                  <table className="tbl">
                    <thead><tr><th>Parte</th><th className="r">Qt.</th><th className="r">Valor unit.</th><th className="r">Total</th><th /></tr></thead>
                    <tbody>
                      {t.itens.map((it, i) => (
                        <tr key={i}>
                          <td>
                            <b>{it.descricao}</b>{' '}
                            {it.precoUnit === 0 ? <span className="badge warn">por cotar</span> : it.origem === 'boca' ? <span className="badge">combinado de boca</span> : it.origem === 'cotacao' ? <span className="badge ok">da cotação</span> : it.origem === 'catalogo' ? <span className="badge y">catálogo</span> : null}
                            {it.detalhe && <div className="tiny muted pre" style={{ marginTop: 4 }}>{it.detalhe}</div>}
                          </td>
                          <td className="r num">{it.qt}</td>
                          <td className="r num nowrap">{it.precoUnit ? mt(it.precoUnit) : '—'}</td>
                          <td className="r num nowrap b">{it.precoUnit ? mt(it.qt * it.precoUnit) : '—'}</td>
                          <td className="r">{pode('editarTrabalho') && <button className="btn sm ghost icon" onClick={() => guardar(db.trabalhos, { ...t, itens: t.itens.filter((_, k) => k !== i) })} aria-label="Remover parte"><Icon n="x" /></button>}</td>
                        </tr>
                      ))}
                      {t.itens.length === 0 && <tr><td colSpan={5} className="muted small">Ainda sem partes. Adicione o que já combinou com o cliente.</td></tr>}
                      {tot.urgencia > 0 && <tr><td colSpan={3} className="r muted">Taxa de urgência ({d.empresa.urgenciaPct}%)</td><td className="r num">{mt(tot.urgencia)}</td><td /></tr>}
                      <tr><td colSpan={3} className="r muted">Sub-total</td><td className="r num">{mt(tot.subtotal)}</td><td /></tr>
                      <tr><td colSpan={3} className="r muted">IVA {t.comIva ? `${d.empresa.taxaIva}%` : '(isento)'}</td><td className="r num">{mt(tot.iva)}</td><td /></tr>
                      <tr><td colSpan={3} className="r b">TOTAL</td><td className="r num b" style={{ color: 'var(--y)' }}>{mt(tot.total)}</td><td /></tr>
                    </tbody>
                  </table>
                  {r.custoRequisicoes > 0 && <div className="tiny muted" style={{ marginTop: 8 }}>Material já pedido: {mt(r.custoRequisicoes)} sem IVA ({num2(r.m2)} m²) — use como base para dar o preço.</div>}
                </div>
              )}

              <TarefasDoTrabalho t={t} />

              <div className="card pad">
                <h3>Ficheiros e fotos da arte <span className="right badge">{t.ficheiros.length}</span></h3>
                {t.ficheiros.length > 0 && (
                  <div className="thumbs" style={{ marginBottom: 12 }}>
                    {t.ficheiros.map((fid) => <Thumb key={fid} id={fid} onRemove={podeMover ? () => guardar(db.trabalhos, { ...t, ficheiros: t.ficheiros.filter((x) => x !== fid) }) : undefined} />)}
                  </div>
                )}
                <UploadZone onFiles={addFicheiros} text="Adicionar arte, layouts, fotos da aplicação…" accept="image/*,application/pdf" />
              </div>
            </div>
          )}

          {tab === 'requisicoes' && fin && (
            <div className="col" style={{ gap: 14 }}>
              <div className="card pad">
                <h3>Requisições a fornecedores <span className="right row" style={{ gap: 6 }}><button className="btn sm pri" onClick={() => setReq('novo')}><Icon n="plus" /> Nova</button></span></h3>
                {reqs.length === 0 ? (
                  <Empty icon="imprimir" title="Ainda sem requisições" text="Registe aqui o que mandou produzir: ficheiros, medidas, material e preço por m²." />
                ) : (
                  <div className="list">
                    {reqs.map((x) => {
                      const tr = totaisRequisicao(x, d.empresa.taxaIva)
                      return (
                        <div key={x.id} className="li" onClick={() => setReq(x)}>
                          <div className="avatar" style={{ background: 'var(--card2)', color: 'var(--y)' }}><Icon n="imprimir" /></div>
                          <div className="main-t">
                            <b>{x.numero} · {d.fornecedor(x.fornecedorId)?.nome}</b>
                            <span>{dataMedia(x.data)} · {x.tipo === 'encomenda' ? `${(x.itens || []).length} itens` : `${x.linhas.filter((l) => l.qt).length} prints · ${num2(tr.m2)} m² · ${x.materialImpressao}${x.materialLaminacao ? ` + ${x.materialLaminacao}` : ''}`}{x.proforma ? ` · PF ${x.proforma.numero}` : ''}</span>
                          </div>
                          <FaseBadge r={x} />
                          <b className="num nowrap hide-m">{mt(valorRequisicao(x, d.empresa.taxaIva))}</b>
                          {x.tipo !== 'encomenda' && <button className="btn sm icon" title="Imprimir / PDF" onClick={(e) => { e.stopPropagation(); imprimirLista(x, d) }}><Icon n="imprimir" /></button>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="card pad">
                <h3>Outros custos <button className="right btn sm" onClick={() => setCusto('novo')}><Icon n="plus" /> Custo</button></h3>
                {custos.length === 0 ? (
                  <div className="small muted">Transporte, consumíveis, aplicação externa… tudo o que gastou neste trabalho fora das listas de impressão.</div>
                ) : (
                  <div className="list">
                    {custos.map((c) => (
                      <div key={c.id} className="li" onClick={() => setCusto(c)}>
                        <div className="main-t"><b>{c.descricao}</b><span>{dataMedia(c.data)}</span></div>
                        <b className="num">{mt(c.valor)}</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'pagamentos' && fin && (
            <div className="card pad">
              <h3>Pagamentos do cliente <button className="right btn sm pri" onClick={() => setPag('novo')}><Icon n="plus" /> Registar pagamento</button></h3>
              {pags.length === 0 ? (
                <Empty icon="dinheiro" title="Nenhum pagamento ainda" text={`Pelos termos, o trabalho começa com o sinal de ${d.empresa.sinalPct}% (${mt(r.sinalEsperado)}).`} />
              ) : (
                <div className="list">
                  {pags.map((p) => (
                    <div key={p.id} className="li" onClick={() => setPag(p)}>
                      <div className="avatar" style={{ background: 'color-mix(in srgb, var(--ok) 18%, transparent)', color: 'var(--ok)' }}><Icon n="dinheiro" /></div>
                      <div className="main-t">
                        <b>{p.tipo === 'sinal' ? `Sinal (${d.empresa.sinalPct}%)` : p.tipo === 'final' ? 'Pagamento final' : 'Pagamento parcial'}</b>
                        <span>{dataMedia(p.data)} · {p.metodo}{p.referencia ? ` · ${p.referencia}` : ''}</span>
                      </div>
                      <b className="num" style={{ color: 'var(--ok)' }}>{mt(p.valor)}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'documentos' && fin && (
            <div className="card pad">
              <h3>Faturas e recibos deste trabalho <button className="right btn sm pri" onClick={() => setDoc('novo')}><Icon n="upload" /> Carregar</button></h3>
              {docs.length === 0 ? (
                <Empty icon="recibo" title="Sem documentos" text="Carregue a foto ou PDF das faturas e recibos que emitiu ou recebeu para este trabalho." />
              ) : (
                <div className="list">{docs.map((x) => <DocLinha key={x.id} doc={x} />)}</div>
              )}
            </div>
          )}

          {tab === 'notas' && (
            <div className="card pad">
              <h3>Notas</h3>
              <div className="row" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
                <textarea className="inp" style={{ height: 70, padding: 10 }} placeholder="Escrever uma nota (ex.: cliente pediu para mudar a cor do capô)" value={nota} onChange={(e) => setNota(e.target.value)} />
                <button className="btn pri" disabled={!nota.trim()} onClick={async () => { await adicionarNota(t, nota.trim(), user.id); setNota('') }}>Guardar</button>
              </div>
              <div className="timeline">
                {[
                  ...t.notas.map((n) => ({ em: n.em, por: n.por, txt: n.texto, nota: true })),
                  ...t.etapas.map((e) => ({ em: e.em, por: e.por, txt: e.etapa === 'pedido' ? 'Pedido registado' : `Passou para ${etapaInfo(e.etapa, t.tipo).nome}`, nota: false })),
                  ...(fin ? pags.map((p) => ({ em: p.data + 'T12:00:00', por: '', txt: `Pagamento ${p.tipo} de ${mt(p.valor)} (${p.metodo})`, nota: false })) : [])
                ]
                  .sort((a, b) => b.em.localeCompare(a.em))
                  .map((x, i) => {
                    const u = d.user(x.por)
                    return (
                      <div key={i} className="tl">
                        {u ? <Avatar nome={u.nome} cor={u.cor} size="sm" /> : <div className="avatar sm" style={{ background: 'var(--card2)' }} />}
                        <div style={{ flex: 1 }}>
                          <div className="when">{u?.nome || 'Sistema'} · {quando(x.em)}</div>
                          {x.nota ? <div className="bubble" style={{ marginTop: 4 }}>{x.txt}</div> : <div className="small tx2" style={{ marginTop: 2 }}>{x.txt}</div>}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        <div className="col" style={{ gap: 14 }}>
          {fin && (
            <div className="card pad">
              <h3>Resumo financeiro</h3>
              <div className="row" style={{ alignItems: 'baseline' }}>
                <span className="sum-big num">{mt(r.total)}</span>
              </div>
              <div className="small muted" style={{ margin: '2px 0 12px' }}>{mt(r.subtotal)} + IVA {mt(r.iva)}</div>
              <ProgressoPago pago={r.pago} total={r.total} />
              <div className="row small" style={{ marginTop: 8 }}>
                <span>Pago <b className="num" style={{ color: 'var(--ok)' }}>{mt(r.pago)}</b></span>
                <span className="spacer" />
                <span>Falta <b className="num" style={{ color: r.emDivida > 0 ? 'var(--warn)' : 'var(--ok)' }}>{mt(r.emDivida)}</b></span>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                {r.sinalPago ? <span className="badge ok"><Icon n="check" style={{ width: 13, height: 13 }} /> Sinal pago</span> : <span className="badge warn">Sinal em falta: {mt(r.sinalEsperado - r.pago)}</span>}
                <span className="spacer" />
                {r.emDivida > 0 && <button className="btn sm pri" onClick={() => setPago(true)}><Icon n="check" /> Pago</button>}
                <button className="btn sm" onClick={() => { setTab('pagamentos'); setPag('novo') }}><Icon n="plus" /> Parcial</button>
              </div>
              <div className="hr" />
              <dl className="kv">
                <dt>Requisições ({num2(r.m2)} m²)</dt><dd className="num">{mt(r.custoRequisicoes)}</dd>
                <dt>Outros custos</dt><dd className="num">{mt(r.custoOutros)}</dd>
                <dt>Custo total</dt><dd className="num">{mt(r.custoTotal)}</dd>
                <dt className="b" style={{ color: 'var(--tx)' }}>Lucro</dt>
                {r.total > 0 ? <dd className="num b" style={{ color: r.lucro >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{mt(r.lucro)} <span className="muted small">({pct(r.margem)})</span></dd> : <dd className="muted">valor de venda por definir</dd>}
              </dl>
              <div className="tiny muted" style={{ marginTop: 8 }}>Custos e lucro sem IVA — o IVA das compras é recuperado na declaração mensal.</div>
            </div>
          )}

          <div className="card pad">
            <h3>Tempo</h3>
            <dl className="kv">
              <dt>{t.etapa === 'entregue' ? 'Levou' : 'Em curso há'}</dt><dd>{r.dias} dia{r.dias === 1 ? '' : 's'}</dd>
              <dt>Entrega prevista</dt><dd>{t.prazo ? dataMedia(t.prazo) : '—'}</dd>
              {serv?.diasMax ? <><dt>Prazo do catálogo</dt><dd>{serv.diasMin}–{serv.diasMax} dias úteis</dd></> : null}
            </dl>
          </div>

          {cli && (
            <div className="card pad">
              <h3>Cliente</h3>
              <div className="row">
                <Avatar nome={cli.nome} cor="neutro" size="lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: 'block' }}>{cli.nome}</b>
                  <div className="small muted">{cli.cidade || cli.telefone || '—'}</div>
                </div>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                {cli.telefone ? (
                  <a className="btn sm" href={waLink(cli.telefone, msgWa)} target="_blank" rel="noreferrer"><Icon n="whatsapp" /> WhatsApp</a>
                ) : (
                  <span className="small muted">Sem telefone registado</span>
                )}
                {pode('todosTrabalhos') && <a className="btn sm ghost" href={`#/clientes/${cli.id}`}>Ficha →</a>}
              </div>
            </div>
          )}
        </div>
      </div>

      {menu.node}
      {editar && <TrabalhoForm t={t} onClose={() => setEditar(false)} />}
      {pag && <PagamentoForm t={t} p={pag === 'novo' ? undefined : pag} onClose={() => setPag(null)} />}
      {pago && <PagamentoForm t={t} tudo onClose={() => setPago(false)} />}
      {passar && (passar.recibo ? <EmitirRecibo faturaId={passar.recibo} onClose={() => setPassar(null)} /> : <EmitirFatura trabalhoId={t.id} tipoInicial="fatura-recibo" onClose={() => setPassar(null)} />)}
      {req && <RequisicaoForm trabalho={t} r={req === 'novo' ? undefined : req} onClose={() => setReq(null)} />}
      {custo && <CustoForm t={t} c={custo === 'novo' ? undefined : custo} onClose={() => setCusto(null)} />}
      {doc && <DocumentoForm preset={{ trabalhoId: t.id, clienteId: t.clienteId, entidade: cli?.nome || '', direcao: 'emitido' }} onClose={() => setDoc(null)} />}
      {conf && <Confirm text={conf.text} ok={conf.ok} onOk={conf.f} onClose={() => setConf(null)} />}
    </Page>
  )
}

// "Pago": by default everything still owed; change the value for a partial payment.
export function PagamentoForm({ t, p, tudo, onClose }: { t: Trabalho; p?: Pagamento; tudo?: boolean; onClose: () => void }) {
  const d = useDados()
  const { user, pode } = useSessao()
  const toast = useToast()
  const r = d.resumo(t)
  const sugestao = p ? p.valor : tudo ? r.emDivida : r.pago < r.sinalEsperado ? r.sinalEsperado - r.pago : r.emDivida
  const [f, setF] = useState({
    data: p?.data || hojeISO(),
    valor: String(p?.valor ?? sugestao).replace('.', ','),
    metodo: p?.metodo || 'M-Pesa',
    tipo: p?.tipo || (r.pago === 0 ? 'sinal' : sugestao >= r.emDivida ? 'final' : 'parcial'),
    referencia: p?.referencia || ''
  })
  async function salvar() {
    const valor = parseNum(f.valor)
    if (valor <= 0) return toast('Valor inválido')
    const rec = p ? { ...p, ...f, valor } : novo<Pagamento>({ trabalhoId: t.id, ...f, valor } as any)
    await guardar(db.pagamentos, rec as Pagamento)
    await registar(user.id, `registou pagamento de ${mt(valor)} em ${t.codigo}`, t.id)
    toast('Pagamento registado')
    onClose()
  }
  return (
    <Modal
      title={p ? 'Editar pagamento' : tudo ? 'Pago' : 'Registar pagamento'}
      onClose={onClose}
      footer={
        <>
          {p && pode('apagar') && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={async () => { await apagar(db.pagamentos, p.id); onClose() }}><Icon n="lixo" /> Apagar</button>}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn pri" onClick={salvar}><Icon n="check" /> Guardar</button>
        </>
      }
    >
      <div className="small muted" style={{ marginBottom: 14 }}>
        {t.codigo} · total {mt(r.total)} · pago {mt(r.pago)} · falta <b style={{ color: 'var(--tx)' }}>{mt(r.emDivida)}</b>
      </div>
      <div className="form-grid">
        <Field label="Valor (MT)">
          <input inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
        </Field>
        <Field label="Data">
          <input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        </Field>
        <Field label="Tipo">
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as any })}>
            <option value="sinal">Sinal ({d.empresa.sinalPct}%)</option>
            <option value="parcial">Parcial</option>
            <option value="final">Final (na entrega)</option>
          </select>
        </Field>
        <Field label="Método">
          <select value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value as any })}>
            {metodos.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Referência (opcional)" full hint="ID da transação M-Pesa/e-Mola, nº do talão…">
          <input value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} />
        </Field>
      </div>
      {!p && (
        <div className="row wrap" style={{ marginTop: 12, gap: 6 }}>
          <span className="tiny muted">Rápido:</span>
          <button className="btn sm" onClick={() => setF({ ...f, valor: String(r.sinalEsperado).replace('.', ','), tipo: 'sinal' })}>Sinal {d.empresa.sinalPct}%</button>
          <button className="btn sm" onClick={() => setF({ ...f, valor: String(r.emDivida).replace('.', ','), tipo: 'final' })}>Tudo o que falta</button>
        </div>
      )}
    </Modal>
  )
}

function CustoForm({ t, c, onClose }: { t: Trabalho; c?: Custo; onClose: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ descricao: c?.descricao || '', valor: c ? String(c.valor).replace('.', ',') : '', data: c?.data || hojeISO() })
  async function salvar() {
    const valor = parseNum(f.valor)
    if (!f.descricao.trim() || valor <= 0) return toast('Preencha descrição e valor')
    await guardar(db.custos, c ? { ...c, ...f, valor } : novo<Custo>({ trabalhoId: t.id, ...f, valor }))
    onClose()
  }
  return (
    <Modal
      title={c ? 'Editar custo' : 'Novo custo'}
      onClose={onClose}
      footer={
        <>
          {c && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={async () => { await apagar(db.custos, c.id); onClose() }}><Icon n="lixo" /> Apagar</button>}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn pri" onClick={salvar}>Guardar</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Descrição" full><input autoFocus value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: transporte, consumíveis, aplicação" /></Field>
        <Field label="Valor sem IVA (MT)"><input inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Field>
        <Field label="Data"><input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
