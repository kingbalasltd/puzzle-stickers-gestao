import { useCallback, useEffect, useState } from 'react'
import { db, guardar, type Cliente, type Cotacao, type Empresa, type ItemCotacao, type MaterialCotacao, type Servico } from '../db'
import { r2, totaisCotacao } from '../calc'
import { juntarMorada, mt, num2, parseNum, separarMorada } from '../format'
import { carregarFontes, logoDoCliente, medirCanvas, PaginaCotacao, paginasCotacao } from '../cotacaoPdf'
import { DESLOCACAO, frasePartes, IMPRESSO, MATERIAIS_COTACAO, NOTAS_ITEM, TEXTOS_FINAIS } from '../materiaisCotacao'
import { Field, Icon } from '../ui'
import { ClienteForm, LogoCliente } from './Clientes'

// The quote form (17–18 Oct, Momad): one line per service or product, materials in red, options
// the client chooses from, headings, deslocação / urgency / discount, beside a live A4.

const itemNovo = (): ItemCotacao => ({ qt: 1, titulo: '', subtitulo: '', descricao: '', precoUnit: 0, materiais: [] })

const meta = (m: MaterialCotacao) => [m.certificado ? 'Certificado' : 'Não certificado', m.garantia ? `garantia ${m.garantia}` : m.certificado ? '' : 'sem garantias'].filter(Boolean).join(' · ')

function Materiais({ lista, valor, onChange }: { lista: MaterialCotacao[]; valor: MaterialCotacao[]; onChange: (m: MaterialCotacao[]) => void }) {
  const [outro, setOutro] = useState<MaterialCotacao | null>(null)
  return (
    <div className="col" style={{ gap: 6 }}>
      {valor.map((m, i) => (
        <div key={i} className="mat-li">
          <div className="main-t"><b>{m.nome}</b><span>{meta(m)}</span></div>
          <button className="btn sm icon ghost" aria-label="Tirar material" onClick={() => onChange(valor.filter((_, k) => k !== i))}><Icon n="x" /></button>
        </div>
      ))}
      {outro ? (
        <div className="mat-outro">
          <input className="inp" autoFocus placeholder="Nome do material, como sai na cotação" value={outro.nome} onChange={(e) => setOutro({ ...outro, nome: e.target.value })} />
          <div className="row" style={{ gap: 6 }}>
            <div className="seg"><button className={!outro.certificado ? 'on' : ''} onClick={() => setOutro({ ...outro, certificado: false })}>Não certificado</button><button className={outro.certificado ? 'on' : ''} onClick={() => setOutro({ ...outro, certificado: true })}>Certificado</button></div>
            <input className="inp" style={{ flex: 1, minWidth: 120 }} placeholder="Garantia: até 2 anos" value={outro.garantia || ''} onChange={(e) => setOutro({ ...outro, garantia: e.target.value })} />
          </div>
          <label className="check"><input type="checkbox" defaultChecked /> Guardar na lista de materiais</label>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={() => setOutro(null)}>Cancelar</button>
            <button className="btn sm pri" disabled={!outro.nome.trim()} onClick={() => { onChange([...valor, outro]); setOutro(null) }}><Icon n="check" /> Juntar</button>
          </div>
        </div>
      ) : (
        <select className="inp" value="" onChange={(e) => {
          if (e.target.value === 'outro') return setOutro({ nome: '', certificado: false, garantia: '' })
          const m = lista[Number(e.target.value)]
          if (m) onChange([...valor, m])
        }}>
          <option value="">+ Material…</option>
          {lista.map((m, i) => <option key={i} value={i}>{m.nome}</option>)}
          <option value="outro">Outro material (escrever)…</option>
        </select>
      )}
    </div>
  )
}

function ItemEditor({ it, n, opcoes, lista, onChange, onRemove, onFechar }: {
  it: ItemCotacao; n: number; opcoes: number; lista: MaterialCotacao[]; onChange: (p: Partial<ItemCotacao>) => void; onRemove: () => void; onFechar: () => void
}) {
  if (it.secao) {
    return (
      <div className="card pad it-secao">
        <div className="it-cab"><span className="badge">Secção</span><button className="btn sm icon ghost right" aria-label="Apagar" onClick={onRemove}><Icon n="lixo" /></button></div>
        <input className="inp" value={it.titulo} placeholder="PROJECTO GESTÃO MENSAL" onChange={(e) => onChange({ titulo: e.target.value })} />
      </div>
    )
  }
  return (
    <div className="card pad it-ed">
      <div className="it-cab">
        <b>Item {String(n).padStart(2, '0')}</b>
        <button className="btn sm ghost right" onClick={onFechar}>Fechar</button>
        <button className="btn sm icon ghost" aria-label="Apagar item" onClick={onRemove}><Icon n="lixo" /></button>
      </div>
      <div className="op-chips">
        <span className="tiny muted">Opção</span>
        <button className={`chip ${!it.opcao ? 'on' : ''}`} onClick={() => onChange({ opcao: undefined })}>Nenhuma</button>
        {Array.from({ length: Math.max(opcoes, it.opcao || 0) + 1 }, (_, k) => k + 1).map((o) => (
          <button key={o} className={`chip ${it.opcao === o ? 'on' : ''}`} onClick={() => onChange({ opcao: o })}>{o}</button>
        ))}
      </div>
      <div className="form-grid">
        <Field label="Linha 1" full><input value={it.titulo} placeholder="Full Wrap - Taksim®" onChange={(e) => onChange({ titulo: e.target.value })} /></Field>
        <Field label="Linha 2 (a negrito)" full><input value={it.subtitulo || ''} placeholder="BMW E92" onChange={(e) => onChange({ subtitulo: e.target.value })} /></Field>
        <Field label="Detalhes (em itálico, uma ideia por linha)" full><textarea value={it.descricao || ''} onChange={(e) => onChange({ descricao: e.target.value })} style={{ minHeight: 96 }} /></Field>
        <Field label="Materiais (saem a vermelho)" full><Materiais lista={lista} valor={it.materiais || []} onChange={(materiais) => onChange({ materiais })} /></Field>
        <Field label="Nota final" full>
          <input value={it.nota || ''} placeholder="** Layout já definido" onChange={(e) => onChange({ nota: e.target.value })} />
          <div className="chips">{NOTAS_ITEM.map((t) => <button key={t} className={`chip ${it.nota === t ? 'on' : ''}`} onClick={() => onChange({ nota: it.nota === t ? '' : t })}>{t.replace('** ', '').replace(' (Inclui melhoria, ou criação de novo Layout)', ' + melhoria')}</button>)}</div>
        </Field>
        <Field label="Qt."><input inputMode="numeric" value={it.qt} onChange={(e) => onChange({ qt: parseNum(e.target.value) })} /></Field>
        <Field label="Valor unitário (sem IVA)"><input inputMode="decimal" defaultValue={it.precoUnit ? num2(it.precoUnit) : ''} onBlur={(e) => onChange({ precoUnit: parseNum(e.target.value) })} /></Field>
      </div>
    </div>
  )
}

// Printed work in one go: he picks the service, style and vehicle, ticks the materials he offers
// and gives each a price; the form writes one item per option with his usual text.
function NovoImpresso({ lista, onCriar, onCancelar, onRascunho }: { lista: MaterialCotacao[]; onCriar: (itens: ItemCotacao[]) => void; onCancelar: () => void; onRascunho?: (itens: ItemCotacao[] | null) => void }) {
  const [tipo, setTipo] = useState(0)
  const [estilos, setEstilos] = useState<string[]>(['Artístico', 'Desportivo'])
  const [objeto, setObjeto] = useState('')
  const [qt, setQt] = useState('1') // e.g. branding on 5 cars: 5 × the price per car
  const [viatura, setViatura] = useState(true)
  const [cobertura, setCobertura] = useState(IMPRESSO.tipos[0].cobertura)
  const [partes, setPartes] = useState<string[]>(IMPRESSO.tipos[0].partes)
  const [outra, setOutra] = useState('')
  const [nota, setNota] = useState(NOTAS_ITEM[0])
  const [linha, setLinha] = useState<string | null>(null) // first description line; null = written for him
  const marcas = lista.filter((m) => m.marca)
  const [ops, setOps] = useState(marcas.map((m, i) => ({ m, ok: i < 3, preco: '' })))
  const t = IMPRESSO.tipos[tipo]
  const escolher = (i: number) => { setTipo(i); setCobertura(IMPRESSO.tipos[i].cobertura); setPartes(IMPRESSO.tipos[i].partes); if (i === 2) setEstilos(['Corporativo']) }
  const marcadas = ops.filter((o) => o.ok)
  const n = Math.max(1, parseNum(qt) || 1)
  const todasPartes = [...IMPRESSO.partes, ...partes.filter((p) => !IMPRESSO.partes.includes(p))]
  const juntarOutra = () => { const x = outra.trim(); if (x) setPartes((ps) => (ps.includes(x) ? ps : [...ps, x])); setOutra('') }
  const nome = [t.nome, ...IMPRESSO.estilos.filter((e) => estilos.includes(e))].join(' ')
  const auto = `${nome} em ${viatura ? 'Viatura ' : ''}${objeto.trim()}`.trim()
  const itens = (): ItemCotacao[] => {
    const descricao = [(linha ?? auto).trim(), cobertura.trim() && `** ${cobertura.trim()}`, frasePartes(partes), IMPRESSO.impressao].filter(Boolean).join('\n')
    return marcadas.map((o, k) => ({
      qt: Math.max(1, parseNum(qt) || 1),
      opcao: marcadas.length > 1 ? k + 1 : undefined,
      titulo: o.m.marca!,
      subtitulo: `${t.nome} ${objeto.trim()}`,
      descricao,
      materiais: [{ nome: o.m.nome, certificado: o.m.certificado, garantia: o.m.garantia }],
      nota,
      precoUnit: parseNum(o.preco)
    }))
  }
  // The preview shows what is being filled in, before it goes into the quote.
  const rascunho = JSON.stringify(itens())
  useEffect(() => { onRascunho?.(JSON.parse(rascunho)) }, [rascunho, onRascunho])
  useEffect(() => () => onRascunho?.(null), [onRascunho])
  const criar = () => onCriar(itens())
  return (
    <div className="card pad it-ed">
      <div className="it-cab"><b>Serviço impresso</b><button className="btn sm ghost right" onClick={onCancelar}>Cancelar</button></div>
      <div className="form-grid">
        <Field label="Serviço" full><div className="chips">{IMPRESSO.tipos.map((x, i) => <button key={x.nome} className={`chip ${tipo === i ? 'on' : ''}`} onClick={() => escolher(i)}>{x.nome}</button>)}</div></Field>
        <Field label="Estilo" full><div className="chips">{IMPRESSO.estilos.map((e) => <button key={e} className={`chip ${estilos.includes(e) ? 'on' : ''}`} onClick={() => setEstilos((es) => (es.includes(e) ? es.filter((x) => x !== e) : [...es, e]))}>{e}</button>)}</div></Field>
        <Field label={viatura ? 'Viatura' : 'Onde (ex.: Congelador 0,80M x 3m)'} full>
          <div className="row" style={{ gap: 8 }}>
            <input className="inp" style={{ flex: 1 }} autoFocus value={objeto} placeholder={viatura ? 'Nissan Silvia S15' : 'Congelador (0,80M x 3m)'} onChange={(e) => setObjeto(e.target.value)} />
            <label className="qt-in"><span>Qt.</span><input className="inp" inputMode="numeric" value={qt} onChange={(e) => setQt(e.target.value.replace(/\D/g, ''))} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={viatura} onChange={(e) => setViatura(e.target.checked)} /> É uma viatura</label>
        </Field>
        <Field label="Primeira linha da descrição" full>
          <input value={linha ?? auto} placeholder="Branding Corporativo na traseira dos Atrelados" onChange={(e) => setLinha(e.target.value)} />
          {linha !== null && linha !== auto && <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setLinha(null)}>Voltar ao texto automático</button>}
        </Field>
        <Field label="Cobertura" full>
          <div className="chips">{IMPRESSO.coberturas.map((c) => <button key={c} className={`chip ${cobertura === c ? 'on' : ''}`} onClick={() => setCobertura(c)}>{c.replace(/^Cobertura (de (?=toda))?/, '').replace(' dos painéis', '')}</button>)}</div>
          <input value={cobertura} onChange={(e) => setCobertura(e.target.value)} />
        </Field>
        <Field label="Inclui" full>
          <div className="chips">{todasPartes.map((p) => <button key={p} className={`chip ${partes.includes(p) ? 'on' : ''}`} onClick={() => setPartes((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]))}>{p}</button>)}</div>
          <div className="row" style={{ gap: 6 }}>
            <input className="inp" style={{ flex: 1 }} placeholder="Outra parte…" value={outra} onChange={(e) => setOutra(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') juntarOutra() }} />
            <button className="btn" disabled={!outra.trim()} onClick={juntarOutra}><Icon n="plus" /></button>
          </div>
          <small className="muted" style={{ fontStyle: 'italic' }}>{frasePartes(partes) || 'Nenhuma parte escolhida'}</small>
        </Field>
        <Field label={`Opções (uma por material, preço sem IVA${n > 1 ? ` por ${viatura ? 'viatura' : 'unidade'}` : ''})`} full>
          <div className="col" style={{ gap: 6 }}>
            {ops.map((o, i) => (
              <div key={o.m.nome} className={`op-li ${o.ok ? 'on' : ''}`}>
                <label className="check"><input type="checkbox" checked={o.ok} onChange={(e) => setOps(ops.map((x, k) => (k === i ? { ...x, ok: e.target.checked } : x)))} /> <span><b>{o.m.marca}</b><small>{o.m.nome}</small></span></label>
                <span className="op-preco">
                  <input className="inp" inputMode="decimal" placeholder="Preço" disabled={!o.ok} value={o.preco} onChange={(e) => setOps(ops.map((x, k) => (k === i ? { ...x, preco: e.target.value } : x)))} />
                  {o.ok && n > 1 && parseNum(o.preco) > 0 && <small>{n} × = {mt(n * parseNum(o.preco))}</small>}
                </span>
              </div>
            ))}
          </div>
        </Field>
        <Field label="Layout" full><div className="chips">{NOTAS_ITEM.map((x) => <button key={x} className={`chip ${nota === x ? 'on' : ''}`} onClick={() => setNota(x)}>{x.replace('** ', '').replace(' (Inclui melhoria, ou criação de novo Layout)', ' + melhoria')}</button>)}</div></Field>
      </div>
      <button className="btn pri block" style={{ marginTop: 14 }} disabled={!objeto.trim() || !marcadas.length} onClick={criar}>
        <Icon n="plus" /> Juntar à cotação{marcadas.length > 1 ? ` (${marcadas.length} opções)` : ''}
      </button>
    </div>
  )
}

// Criação de imagem: his catálogo, one tap adds the service as a line (logotipo, identidade…).
function CatalogoCriacao({ servicos, onEscolher, onCancelar }: { servicos: Servico[]; onEscolher: (s: Servico) => void; onCancelar: () => void }) {
  const ativos = servicos.filter((s) => s.ativo)
  return (
    <div className="card pad it-ed">
      <div className="it-cab"><b>Criação de imagem</b><button className="btn sm ghost right" onClick={onCancelar}>Voltar</button></div>
      {[...new Set(ativos.map((s) => s.categoria))].map((cat) => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div className="sec-t">{cat}</div>
          <div className="col" style={{ gap: 6 }}>
            {ativos.filter((s) => s.categoria === cat).map((s) => (
              <button key={s.id} className="desl" onClick={() => onEscolher(s)}>
                <span className="main-t"><b>{s.nome}</b>{s.inclui.length > 0 && <span>{s.inclui.join(' · ')}</span>}</span>
                <b className="num">{s.preco ? mt(s.preco) : 'a definir'}</b>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Resumo({ it, n, onAbrir }: { it: ItemCotacao; n: number; onAbrir: () => void }) {
  return (
    <button className="it-resumo" onClick={onAbrir}>
      {it.secao ? <b className="sec">{it.titulo || 'Secção'}</b> : (
        <>
          <span className="n">{String(n).padStart(2, '0')}</span>
          <span className="main-t">
            <b>{it.opcao ? <span className="badge y">Opção {it.opcao}</span> : null}{it.urgente ? <span className="badge urg-b">Urgente</span> : null} {it.titulo || 'Linha sem nome'}</b>
            <span>{[it.qt > 1 ? `${it.qt} × ${mt(it.precoUnit)}` : '', it.subtitulo, ...(it.materiais || []).map((m) => m.nome.split(' (')[0])].filter(Boolean).join(' · ')}</span>
          </span>
          <b className="num">{mt(it.qt * it.precoUnit)}</b>
        </>
      )}
      <Icon n="editar" />
    </button>
  )
}

// Cidade, País under the client's name, editable right in the quote (saved on the client).
function MoradaCliente({ cliente }: { cliente: Cliente }) {
  const m = separarMorada(cliente.cidade)
  const [cidade, setCidade] = useState(m.cidade)
  const [pais, setPais] = useState(m.pais || 'Moçambique')
  const gravar = () => {
    const nova = cidade.trim() ? juntarMorada(cidade, pais) : ''
    if (nova !== (cliente.cidade || '')) guardar(db.clientes, { ...cliente, cidade: nova })
  }
  return (
    <>
      <Field label="Cidade" hint={cidade.trim() ? undefined : 'Falta a cidade: sai na cotação por baixo do nome'}><input value={cidade} placeholder="Maputo" onChange={(e) => setCidade(e.target.value)} onBlur={gravar} /></Field>
      <Field label="País"><input value={pais} placeholder="Moçambique" onChange={(e) => setPais(e.target.value)} onBlur={gravar} /></Field>
    </>
  )
}

const DESL = 'Deslocação'
// Deslocação and other charges always sit at the end of the quote.
const ordenar = (xs: ItemCotacao[]) => [...xs.filter((x) => !x.extra), ...xs.filter((x) => x.extra)]

// Momad (18 Oct): every line is a service or product; he adds lines as he needs them. Deslocação,
// urgency and discount sit at the bottom, by the totals, which follow everything he types.
export function EditorCotacao({ c, set, clientes, servicos, empresa, materiais = MATERIAIS_COTACAO, abertoInicial = 0, onRascunho }: {
  c: Cotacao; set: (p: Partial<Cotacao>) => void; clientes: Cliente[]; servicos: Servico[]; empresa: Empresa; materiais?: MaterialCotacao[]; abertoInicial?: number
  onRascunho?: (itens: ItemCotacao[] | null) => void // what is being filled in, not yet in the quote
}) {
  const [aberto, setAberto] = useState<number | null>(abertoInicial)
  // A new quote starts with one blank item; it goes away as soon as a real one is added.
  const reais = c.itens.filter((x) => x.titulo || x.precoUnit || x.secao)
  const [painel, setPainel] = useState<'escolher' | 'impresso' | 'criacao' | null>(reais.some((x) => !x.extra) ? null : 'escolher')
  const [novoCliente, setNovoCliente] = useState(false)
  const [outraDesl, setOutraDesl] = useState(false)
  const [km, setKm] = useState('')
  const [valorDesl, setValorDesl] = useState('')
  const [rasc, setRasc] = useState<ItemCotacao[] | null>(null)
  const rascunho = useCallback((xs: ItemCotacao[] | null) => { setRasc(xs); onRascunho?.(xs) }, [onRascunho])
  // Totals follow what is being filled in too, before it goes into the quote.
  const vista = { ...c, itens: rasc ? ordenar([...reais, ...rasc]) : c.itens }
  const t = totaisCotacao(vista, empresa.taxaIva, empresa.urgenciaPct)
  const opcoes = Math.max(0, ...c.itens.map((i) => i.opcao || 0))
  const setI = (i: number, p: Partial<ItemCotacao>) => set({ itens: c.itens.map((x, k) => (k === i ? { ...x, ...p } : x)) })
  const juntarLinha = (it: ItemCotacao) => {
    const xs = ordenar([...reais, it])
    set({ itens: xs })
    setAberto(xs.indexOf(it))
    setPainel(null)
  }
  const cliente = clientes.find((x) => x.id === c.clienteId)
  const deslocacao = c.itens.find((x) => x.extra && x.titulo === DESL)
  const porDesl = (it?: ItemCotacao) => set({ itens: ordenar([...reais.filter((x) => !(x.extra && x.titulo === DESL)), ...(it ? [it] : [])]) })
  const linhas = c.itens.map((it, i) => ({ it, i })).filter(({ it, i }) => !it.extra && (it.titulo || it.precoUnit || it.secao || aberto === i))
  const servicosLinhas = linhas.filter(({ it }) => !it.secao)
  let numero = 0
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="card pad">
        <div className="form-grid">
          <Field label="Cliente (Exmo(s) Sr(s))" full>
            <div className="row" style={{ gap: 8 }}>
              <select className="inp" style={{ flex: 1 }} value={c.clienteId} onChange={(e) => (e.target.value === 'novo' ? setNovoCliente(true) : set({ clienteId: e.target.value }))}>
                <option value="">— escolher —</option>
                {clientes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                <option value="novo">+ Novo cliente…</option>
              </select>
              <button className="btn" onClick={() => setNovoCliente(true)}><Icon n="plus" /> <span className="hide-m">Novo</span></button>
            </div>
          </Field>
          {cliente && <MoradaCliente key={cliente.id} cliente={cliente} />}
          {cliente && (
            <div className="field full">
              <span>Logotipo do cliente (sai junto ao nome)</span>
              <LogoCliente id={cliente.logoId} onChange={(logoId) => guardar(db.clientes, { ...cliente, logoId })} />
            </div>
          )}
          {novoCliente && <ClienteForm onClose={(id) => { setNovoCliente(false); if (id) set({ clienteId: id }) }} />}
          <Field label="Data"><input type="date" value={c.data} onChange={(e) => set({ data: e.target.value })} /></Field>
          <Field label="Válida por (dias)"><input inputMode="numeric" value={c.validadeDias} onChange={(e) => set({ validadeDias: parseNum(e.target.value) })} /></Field>
        </div>
      </div>

      {linhas.map(({ it, i }) => {
        if (!it.secao) numero++
        return aberto === i
          ? <ItemEditor key={i} it={it} n={numero} opcoes={opcoes} lista={materiais} onChange={(p) => setI(i, p)} onRemove={() => { set({ itens: c.itens.filter((_, k) => k !== i) }); setAberto(null) }} onFechar={() => setAberto(null)} />
          : <Resumo key={i} it={it} n={numero} onAbrir={() => { setAberto(i); setPainel(null) }} />
      })}

      {painel === null && <button className="add-linha" onClick={() => { setPainel('escolher'); setAberto(null) }}><Icon n="plus" /> Adicionar linha</button>}
      {painel === 'escolher' && (
        <div className="card pad">
          <div className="it-cab"><b>{linhas.length ? 'Nova linha' : 'Primeira linha'}: que serviço ou produto?</b>{linhas.length > 0 && <button className="btn sm ghost right" onClick={() => setPainel(null)}>Cancelar</button>}</div>
          <div className="tipos-linha">
            <button onClick={() => setPainel('impresso')}><Icon n="imprimir" /><b>Wrap / Branding</b><span>Full Wrap, Half Wrap ou Branding impresso</span></button>
            <button onClick={() => setPainel('criacao')}><Icon n="catalogo" /><b>Criação de imagem</b><span>Logotipo, identidade visual, editorial…</span></button>
            <button onClick={() => juntarLinha(itemNovo())}><Icon n="editar" /><b>Outro serviço ou produto</b><span>Escreves o texto e o preço</span></button>
            <button onClick={() => juntarLinha({ ...itemNovo(), secao: true })}><Icon n="lista" /><b>Título de secção</b><span>Ex.: PROJECTO GESTÃO MENSAL</span></button>
          </div>
        </div>
      )}
      {painel === 'impresso' && <NovoImpresso lista={materiais} onRascunho={rascunho} onCancelar={() => setPainel('escolher')} onCriar={(xs) => { set({ itens: ordenar([...reais, ...xs]) }); setPainel(null); setAberto(null) }} />}
      {painel === 'criacao' && <CatalogoCriacao servicos={servicos} onCancelar={() => setPainel('escolher')} onEscolher={(s) => juntarLinha({ ...itemNovo(), titulo: s.nome, subtitulo: '', descricao: s.inclui.map((x) => `• ${x}`).join('\n'), precoUnit: s.preco })} />}

      <div className="card pad">
        <h3>Deslocação, urgência e desconto</h3>
        <div className="form-grid">
          <Field label="Deslocação" full>
            <div className="chips">
              <button className={`chip ${!deslocacao ? 'on' : ''}`} onClick={() => { porDesl(); setOutraDesl(false) }}>Sem deslocação</button>
              {DESLOCACAO.map((x) => (
                <button key={x.ida} className={`chip ${deslocacao?.subtitulo === x.ida ? 'on' : ''}`} onClick={() => { porDesl({ qt: 1, titulo: DESL, subtitulo: x.ida, precoUnit: x.preco, extra: true }); setOutraDesl(false) }}>{x.ida} · {mt(x.preco)}</button>
              ))}
              <button className={`chip ${outraDesl || (deslocacao && !DESLOCACAO.some((x) => x.ida === deslocacao.subtitulo)) ? 'on' : ''}`} onClick={() => setOutraDesl(true)}>Outro valor</button>
            </div>
            {outraDesl && (
              <div className="row" style={{ gap: 6 }}>
                <input className="inp" style={{ flex: 1 }} placeholder="Ex.: 80 km" value={km} onChange={(e) => setKm(e.target.value)} />
                <input className="inp" style={{ width: 120 }} inputMode="decimal" placeholder="Valor" value={valorDesl} onChange={(e) => setValorDesl(e.target.value)} />
                <button className="btn pri" disabled={!km.trim() || !parseNum(valorDesl)} onClick={() => { porDesl({ qt: 1, titulo: DESL, subtitulo: km.trim(), precoUnit: parseNum(valorDesl), extra: true }); setOutraDesl(false) }}><Icon n="check" /></button>
              </div>
            )}
          </Field>
          <Field label={`Urgência (+${empresa.urgenciaPct}% do preço unitário da linha, uma vez)`} full>
            {servicosLinhas.length ? (
              <div className="chips">
                {servicosLinhas.map(({ it, i }, k) => (
                  <button key={i} className={`chip ${it.urgente ? 'on urg-on' : ''}`} onClick={() => setI(i, { urgente: !it.urgente || undefined })}>
                    <Icon n="raio" /> {String(k + 1).padStart(2, '0')} · {[it.opcao ? `Opção ${it.opcao}` : '', it.titulo].filter(Boolean).join(' ')}{it.urgente ? ` · +${mt(r2(it.precoUnit * empresa.urgenciaPct / 100))}` : ''}
                  </button>
                ))}
              </div>
            ) : <small className="muted">Junte primeiro uma linha.</small>}
          </Field>
          <Field label="Desconto (%)"><input inputMode="decimal" value={c.desconto || ''} placeholder="0" onChange={(e) => set({ desconto: parseNum(e.target.value) || undefined })} /></Field>
          <Field label="IVA"><div className="inp fixo">{empresa.taxaIva}% · sempre incluído</div></Field>
        </div>
      </div>

      <div className="card pad">
        <Field label="Texto final" full>
          <div className="chips">{TEXTOS_FINAIS.map((x) => <button key={x.nome} className={`chip ${c.notas === x.texto ? 'on' : ''}`} onClick={() => set({ notas: x.texto })}>{x.nome}</button>)}</div>
          <textarea value={c.notas} onChange={(e) => set({ notas: e.target.value })} style={{ minHeight: 90 }} />
        </Field>
      </div>

      <div className="card pad">
        <h3>Totais</h3>
        {t.opcoes.length > 1 ? (
          <div className="list">
            {t.opcoes.map((o) => (
              <div key={o.opcao} className="li tot-op">
                <span className="badge y">Opção {o.opcao}</span>
                <span className="small muted">{mt(o.sub)} + IVA {mt(o.iva)}</span>
                <b className="num right">{mt(o.total)}</b>
              </div>
            ))}
          </div>
        ) : (
          <dl className="kv">
            <dt>Sub-total</dt><dd className="num">{mt(t.bruto)}</dd>
            {!!c.desconto && <><dt>Desconto {c.desconto}%</dt><dd className="num" style={{ color: 'var(--bad)' }}>-{mt(t.desconto)}</dd></>}
            <dt>IVA {empresa.taxaIva}%</dt><dd className="num">{mt(t.iva)}</dd>
            <dt className="b" style={{ color: 'var(--tx)' }}>TOTAL</dt><dd className="num b" style={{ fontSize: 18, color: 'var(--y)' }}>{mt(t.total)}</dd>
          </dl>
        )}
      </div>
    </div>
  )
}

// The quote as it will come out, page by page, updating while he types.
export function PreviewCotacao({ c, cliente, empresa }: { c: Cotacao; cliente?: Cliente; empresa: Empresa }) {
  const [pronto, setPronto] = useState(false)
  const [logo, setLogo] = useState<string>()
  useEffect(() => { carregarFontes().then(() => setPronto(true)) }, [])
  // The client's logo under "Exmo (s)Sr(s)", as in the PDF.
  useEffect(() => {
    let url: string | undefined
    let vivo = true
    logoDoCliente(cliente).then((u) => { url = u; if (vivo) setLogo(u); else if (u) URL.revokeObjectURL(u) })
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); setLogo(undefined) }
  }, [cliente?.logoId])
  if (!pronto) return null
  const paginas = paginasCotacao(c, medirCanvas, empresa.urgenciaPct)
  return (
    <div className="col" style={{ gap: 12 }}>
      {paginas.map((p, i) => (
        <div key={i} className="a4-prev">
          <PaginaCotacao c={p.c} cliente={cliente} empresa={empresa} itens={p.itens} ultima={p.ultima} pagina={i + 1} total={paginas.length} logoCliente={logo} medir={medirCanvas} />
        </div>
      ))}
    </div>
  )
}
