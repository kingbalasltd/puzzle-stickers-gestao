import { useState } from 'react'
import { Page } from '../App'
import { agora, apagar, db, guardar, novo, registar, type Cotacao, type ItemCotacao, type Trabalho } from '../db'
import { addDiasUteis, addDias, comUrgencia, etapasDoTipo, hojeISO, numeroDoMes, r2, totaisCotacao } from '../calc'
import { dataMedia, mt } from '../format'
import { ir, proximoCodigo, useDados, useSessao, type Dados } from '../state'
import { DemoTag, Empty, Field, Icon, Modal, useToast } from '../ui'
import { imprimirCotacao } from '../print'
import { moverEtapa } from '../acoes'
import { EditorCotacao, PreviewCotacao } from './cotacaoFormulario'

// The value shown in lists: the whole quote, the option the client took, or "desde" the cheapest option.
const valorCot = (c: Cotacao, taxa: number, urgencia: number) => {
  const t = totaisCotacao(c, taxa, urgencia)
  if (t.opcoes.length < 2) return mt(t.total)
  const aceite = t.opcoes.find((o) => o.opcao === c.opcaoAceite)
  return aceite ? mt(aceite.total) : `desde ${mt(t.total)}`
}

const ESTADOS: Record<Cotacao['estado'], string> = { rascunho: 'Rascunho', enviada: 'Enviada', aceite: 'Aceite', recusada: 'Recusada' }
const corEstado = (e: Cotacao['estado']) => (e === 'aceite' ? 'ok' : e === 'enviada' ? 'y' : e === 'recusada' ? 'bad' : '')

// A quote on its own (no job needed): if the client accepts, it becomes a job.
export async function novaCotacao(d: Dados, userId: string) {
  const c = novo<Cotacao>({
    numero: numeroDoMes('COT', d.cotacoes.map((x) => x.numero), hojeISO()),
    data: hojeISO(),
    clienteId: '',
    itens: [{ qt: 1, titulo: '', subtitulo: '', descricao: '', precoUnit: 0 }],
    validadeDias: d.empresa.validadeCotacao,
    notas: d.empresa.notaCotacao,
    estado: 'rascunho'
  })
  await db.cotacoes.put(c)
  await registar(userId, `criou ${c.numero}`, c.id)
  ir(`/cotacoes/${c.id}`)
}

export function Cotacoes() {
  const d = useDados()
  const { user } = useSessao()
  const nova = () => novaCotacao(d, user.id)
  return (
    <Page title="Cotações" sub="No formato da Puzzle Stickers · não servem de comprovativo fiscal" actions={<button className="btn pri" onClick={nova}><Icon n="plus" /> <span className="hide-m">Nova cotação</span></button>}>
      <div className="card">
        {d.cotacoes.length === 0 ? <Empty icon="cotacao" title="Sem cotações" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Cotação</th><th>Cliente</th><th>Data</th><th>Validade</th><th>Estado</th><th className="r">Total</th></tr></thead>
              <tbody>
                {d.cotacoes.map((c) => {
                  const fim = addDias(c.data, c.validadeDias)
                  const expirada = c.estado === 'enviada' && fim < hojeISO()
                  return (
                    <tr key={c.id} className="click" onClick={() => ir(`/cotacoes/${c.id}`)}>
                      <td><b>{c.numero}</b> <DemoTag demo={c.demo} /><div className="tiny muted">{[...new Set(c.itens.filter((i) => !i.secao).map((i) => i.subtitulo || i.titulo))].join(' · ')}</div></td>
                      <td>{d.cliente(c.clienteId)?.nome || <span className="muted">—</span>}</td>
                      <td className="nowrap">{dataMedia(c.data)}</td>
                      <td className="nowrap">{expirada ? <span className="badge bad">expirou</span> : dataMedia(fim)}</td>
                      <td><span className={`badge ${corEstado(c.estado)}`}>{ESTADOS[c.estado]}</span></td>
                      <td className="r num b nowrap">{valorCot(c, d.empresa.taxaIva, d.empresa.urgenciaPct)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  )
}

// Which kind of job a quoted item becomes.
const tipoDe = (it: ItemCotacao): Trabalho['tipo'] => {
  const s = `${it.titulo} ${it.subtitulo} ${it.descricao}`
  return /montagem|ppf/i.test(s) ? 'montagem' : /camisete|t-?shirt|estampad|bon[ée]|caneca|fornec/i.test(s) ? 'fornecimento' : /wrap|branding|impress|vinil|viatura|cami[ãa]o|aplica/i.test(s) ? 'branding' : 'criacao'
}

export function CotacaoEditor({ id }: { id: string }) {
  const d = useDados()
  const { user, pode } = useSessao()
  const toast = useToast()
  const orig = d.cotacoes.find((c) => c.id === id)
  const [c, setC] = useState<Cotacao | undefined>(orig && structuredClone(orig))
  const [escolha, setEscolha] = useState<number | undefined>(orig?.opcaoAceite)
  const [ver, setVer] = useState(false) // Preview: the quote as it will come out, before saving or the PDF
  const [rascunho, setRascunho] = useState<ItemCotacao[] | null>(null) // being filled in, not yet added
  if (!orig || !c) return <Page title="Cotação" back="/cotacoes"><Empty title="Cotação não encontrada" /></Page>
  const set = (p: Partial<Cotacao>) => setC({ ...c, ...p })
  const t = totaisCotacao(c, d.empresa.taxaIva, d.empresa.urgenciaPct)
  const mudou = JSON.stringify(c) !== JSON.stringify(orig)
  const jobs = d.trabalhos.filter((x) => x.cotacaoId === c.id && x.id !== c.origemTrabalhoId)
  const origem = d.trabalhos.find((x) => x.id === c.origemTrabalhoId)
  // The old Taksim note at the foot of the page, for wrap quotes whose items have no materials of their own.
  const comMateriais = c.itens.some((it) => it.materiais?.length)
  const deWrap = c.itens.some((it) => /taksim|wrap/i.test(`${it.titulo} ${it.descricao}`))
  const notaMaterial = !comMateriais && (c.notaMaterial ?? deWrap)
  // With options the client takes one: the job gets the common items plus that option.
  const temOpcoes = t.opcoes.length > 1
  const escolhida = temOpcoes ? t.opcoes.find((o) => o.opcao === escolha) : undefined
  const totalAceite = temOpcoes ? escolhida?.total ?? 0 : t.total
  // Urgency lines included: they go into the job of their item.
  const aceites = (rec: Cotacao) => comUrgencia(rec.itens, d.empresa.urgenciaPct).filter((it) => !it.secao && (!temOpcoes || !it.opcao || it.opcao === escolhida?.opcao))
  // A job has no discount of its own: it goes into the unit prices, so the job adds up like the quote.
  const precoNoTrabalho = (rec: Cotacao, it: ItemCotacao) => r2(it.precoUnit * (1 - (rec.desconto || 0) / 100))
  // What the preview shows: the quote plus whatever is being filled in right now.
  const vista: Cotacao = { ...c, notaMaterial, itens: rascunho ? [...c.itens.filter((x) => x.titulo || x.precoUnit || x.secao), ...rascunho] : c.itens }
  const falta = () => {
    if (temOpcoes && !escolhida) {
      toast('Escolha a opção que o cliente aceitou')
      return true
    }
    return false
  }

  // Quote made from a job: when the client accepts, the job takes the quoted parts.
  async function aceitarNoTrabalho() {
    if (!origem || falta()) return
    const rec = await salvar({ estado: 'aceite', opcaoAceite: escolhida?.opcao })
    const itens = aceites(rec).map((it) => ({ descricao: [it.titulo, it.subtitulo].filter(Boolean).join(' · '), detalhe: it.descricao, qt: it.qt, precoUnit: precoNoTrabalho(rec, it), origem: 'cotacao' as const }))
    // Accepted = confirmed: the job leaves negotiation and starts counting in "a receber".
    const seq = etapasDoTipo(origem.tipo)
    const depois = seq[seq.indexOf('negociacao') + 1]
    const vai = seq.indexOf(origem.etapa) <= seq.indexOf('negociacao')
    await moverEtapa({ ...origem, itens, cotacaoId: rec.id }, vai ? depois : origem.etapa, user.id, { confirmadoEm: origem.confirmadoEm || hojeISO() })
    await registar(user.id, `${rec.numero} aceite${escolhida ? ` (opção ${escolhida.opcao})` : ''} — ${origem.codigo} atualizado`, origem.id)
    toast(`${origem.codigo} atualizado com a cotação · sinal ${d.empresa.sinalPct}% = ${mt(totalAceite * d.empresa.sinalPct / 100)}`)
    ir(`/trabalhos/${origem.id}?tab=pagamentos`)
  }

  async function salvar(extra?: Partial<Cotacao>) {
    const rec = { ...c!, ...extra }
    await guardar(db.cotacoes, rec)
    setC(rec)
    toast('Cotação guardada')
    return rec
  }

  async function converter() {
    if (!c!.clienteId) return toast('Escolha o cliente primeiro')
    if (falta()) return
    const rec = await salvar({ estado: 'aceite', opcaoAceite: escolhida?.opcao })
    // One job per quoted item: each car/service has its own agenda and stages.
    let codigos = d.trabalhos.map((x) => x.codigo)
    let primeiro: string | undefined
    const itens = aceites(rec)
    // One job per service line; its urgency line goes with it, the Deslocação with the first job.
    const grupos: ItemCotacao[][] = []
    const deslocacoes: ItemCotacao[] = []
    for (const it of itens) {
      if (it.gerada && grupos.length) grupos[grupos.length - 1].push(it)
      else if (it.extra) deslocacoes.push(it)
      else grupos.push([it])
    }
    if (!grupos.length) grupos.push([])
    grupos[0].push(...deslocacoes)
    const parte = (it: ItemCotacao) => ({ descricao: [it.titulo, it.subtitulo].filter(Boolean).join(' · '), detalhe: it.descricao, qt: it.qt, precoUnit: precoNoTrabalho(rec, it), origem: 'cotacao' as const })
    for (const grupo of grupos) {
      const it = grupo[0]
      if (!it) continue
      const codigo = proximoCodigo('T', codigos)
      codigos = [...codigos, codigo]
      const j = novo<Trabalho>({
        codigo,
        titulo: [it.subtitulo, it.titulo].filter(Boolean).join(' — ') || it.titulo || 'Trabalho',
        clienteId: rec.clienteId,
        tipo: tipoDe(it),
        descricao: it.descricao || '',
        itens: grupo.map(parte),
        comIva: true,
        urgente: false,
        // Made from an accepted quote: confirmed, so it starts right after negotiation.
        ...(() => {
          const seq = etapasDoTipo(tipoDe(it))
          return { etapa: seq[seq.indexOf('negociacao') + 1], etapas: [{ etapa: 'negociacao' as const, em: agora(), por: user.id }, { etapa: seq[seq.indexOf('negociacao') + 1], em: agora(), por: user.id }] }
        })(),
        confirmadoEm: hojeISO(),
        dataEntrada: hojeISO(),
        prazo: addDiasUteis(hojeISO(), 10),
        ficheiros: [],
        notas: [],
        cotacaoId: rec.id
      })
      await db.trabalhos.put(j)
      primeiro = primeiro || j.id
    }
    await guardar(db.cotacoes, { ...rec, estado: 'aceite', trabalhoId: primeiro })
    await registar(user.id, `converteu ${rec.numero} em ${grupos.length} trabalho(s)`, rec.id)
    toast(`${grupos.length} trabalho${grupos.length > 1 ? 's' : ''} criado${grupos.length > 1 ? 's' : ''} na agenda`)
    if (primeiro) ir(`/trabalhos/${primeiro}`)
  }

  return (
    <Page
      back="/cotacoes"
      title={<span className="row" style={{ gap: 8 }}>{c.numero} <span className={`badge ${corEstado(c.estado)}`}>{ESTADOS[c.estado]}</span></span>}
      sub={d.cliente(c.clienteId)?.nome || 'Sem cliente'}
      actions={
        <>
          <button className="btn" onClick={() => setVer(true)}><Icon n="olho" /> <span className="hide-m">Preview</span></button>
          <button className="btn" onClick={async () => { const r = await salvar({ notaMaterial }); imprimirCotacao(r, d) }}><Icon n="imprimir" /> <span className="hide-m">PDF</span></button>
          <button className="btn pri" disabled={!mudou} onClick={() => salvar()}><Icon n="check" /> Guardar</button>
        </>
      }
    >
      <div className="grid g-main">
        <div className="col" style={{ gap: 14 }}>
          <EditorCotacao c={c} set={set} clientes={d.clientes} servicos={d.servicos} empresa={d.empresa} abertoInicial={-1} onRascunho={setRascunho} />
          {!comMateriais && deWrap && (
            <label className="check"><input type="checkbox" checked={notaMaterial} onChange={(e) => set({ notaMaterial: e.target.checked })} /> Nota do material no rodapé (TAKSIM® STX570 + STX571, garantia até 2 anos)</label>
          )}
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div className="card pad">
            <Field label="Estado">
              <select value={c.estado} onChange={(e) => set({ estado: e.target.value as Cotacao['estado'] })}>
                {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          <div className="card pad">
            <h3>Cliente aceitou?</h3>
            {temOpcoes && !(c.estado === 'aceite' && (origem || jobs.length)) && (
              <div style={{ marginBottom: 12 }}>
                <div className="small muted" style={{ marginBottom: 8 }}>Qual opção o cliente escolheu?</div>
                <div className="chips">{t.opcoes.map((o) => <button key={o.opcao} className={`chip ${escolha === o.opcao ? 'on' : ''}`} onClick={() => setEscolha(o.opcao)}>Opção {o.opcao} · {mt(o.total)}</button>)}</div>
              </div>
            )}
            {origem ? (
              <>
                <div className="small muted" style={{ marginBottom: 12 }}>Esta cotação é do trabalho <a href={`#/trabalhos/${origem.id}`}><b>{origem.codigo} · {origem.titulo}</b></a>. Quando o cliente aceitar, o trabalho fica com estas partes e valores.</div>
                {c.estado === 'aceite' ? <span className="badge ok"><Icon n="check" style={{ width: 13, height: 13 }} /> Aceite{c.opcaoAceite ? ` · opção ${c.opcaoAceite}` : ''} · trabalho atualizado</span> : <button className="btn pri block" onClick={aceitarNoTrabalho}><Icon n="check" /> Cliente aceitou</button>}
              </>
            ) : jobs.length > 0 ? (
              <div className="list">{jobs.map((j) => <a key={j.id} className="li" href={`#/trabalhos/${j.id}`}><div className="main-t"><b>{j.titulo}</b><span>{j.codigo}</span></div><Icon n="right" /></a>)}</div>
            ) : (
              <>
                <div className="small muted" style={{ marginBottom: 12 }}>Converta em trabalhos: cada item vira um trabalho na agenda, com o valor, o cliente e a descrição já preenchidos.</div>
                <button className="btn pri block" onClick={converter}><Icon n="seta" /> Converter em trabalho{aceites(c).filter((it) => !it.extra).length > 1 ? 's' : ''}</button>
              </>
            )}
            <div className="hr" />
            <div className="small muted">Sinal de {d.empresa.sinalPct}%{temOpcoes ? ' da opção escolhida' : ''}: <b style={{ color: 'var(--tx)' }}>{temOpcoes && !escolhida ? '—' : mt(totalAceite * d.empresa.sinalPct / 100)}</b></div>
          </div>
          <div className="hide-m">
            <div className="small muted" style={{ marginBottom: 8 }}>Como sai a cotação</div>
            <PreviewCotacao c={vista} cliente={d.cliente(c.clienteId)} empresa={d.empresa} />
          </div>
          {pode('apagar') && <button className="btn danger" onClick={async () => { await apagar(db.cotacoes, c.id); ir('/cotacoes') }}><Icon n="lixo" /> Apagar cotação</button>}
        </div>
      </div>
      {ver && (
        <Modal
          wide
          title={`Preview · ${c.numero}`}
          onClose={() => setVer(false)}
          footer={
            <>
              <button className="btn" onClick={() => setVer(false)}>Fechar</button>
              <button className="btn pri" onClick={async () => { const r = await salvar({ notaMaterial }); imprimirCotacao(r, d) }}><Icon n="imprimir" /> PDF</button>
            </>
          }
        >
          <PreviewCotacao c={vista} cliente={d.cliente(c.clienteId)} empresa={d.empresa} />
        </Modal>
      )}
    </Page>
  )
}
