import { useMemo, useState } from 'react'
import { agora, db, guardar, novo, registar, type Cliente, type Etapa, type ItemTrabalho, type TipoTrabalho, type Trabalho } from '../db'
import { addDiasUteis, etapaInfo, etapasDoTipo, hojeISO, TIPOS, totaisTrabalho } from '../calc'
import { mt } from '../format'
import { ir, proximoCodigo, useDados, useSessao } from '../state'
import { Field, Icon, Modal, useToast } from '../ui'
import { EditorPartes, soCatalogo } from './Partes'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function TrabalhoForm({ t, onClose, preset }: { t?: Trabalho; onClose: () => void; preset?: Partial<Trabalho> }) {
  const d = useDados()
  const { user } = useSessao()
  const toast = useToast()
  const [f, setF] = useState<Partial<Trabalho>>(() =>
    t
      ? structuredClone({ ...t, tipo: t.tipo === 'producao' ? 'branding' : t.tipo })
      : {
          tipo: 'branding',
          titulo: '',
          descricao: '',
          clienteId: '',
          itens: [{ descricao: '', qt: 1, precoUnit: 0 }],
          comIva: true,
          urgente: false,
          dataEntrada: hojeISO(),
          prazo: addDiasUteis(hojeISO(), 7),
          responsavelId: '',
          ...preset
        }
  )
  // Client: type a name — an existing one is picked, a new one is created on save.
  const [cliNome, setCliNome] = useState(() => d.cliente(f.clienteId)?.nome || '')
  const [prazoManual, setPrazoManual] = useState(!!t)
  const set = (p: Partial<Trabalho>) => setF((x) => ({ ...x, ...p }))
  const tipo = (f.tipo || 'branding') as TipoTrabalho
  const [faseEscolhida, setFase] = useState<Etapa>('pedido')
  const fase = etapasDoTipo(tipo).includes(faseEscolhida) ? faseEscolhida : 'pedido'
  const tot = useMemo(() => totaisTrabalho(f as Trabalho, d.empresa.taxaIva, d.empresa.urgenciaPct), [f, d.empresa])
  const cliExistente = d.clientes.find((c) => norm(c.nome) === norm(cliNome))

  function mudarPartes(itens: ItemTrabalho[]) {
    const p: Partial<Trabalho> = { itens }
    // Criação de imagem: the deadline follows the longest catálogo service.
    if (!prazoManual) {
      const dias = Math.max(0, ...itens.map((i) => d.servicos.find((s) => s.id === i.servicoId)?.diasMax || 0))
      if (dias) p.prazo = addDiasUteis(f.dataEntrada || hojeISO(), dias)
    }
    set(p)
  }

  function mudarTipo(novoTipo: TipoTrabalho) {
    const p: Partial<Trabalho> = { tipo: novoTipo }
    if (t && !etapasDoTipo(novoTipo).includes(t.etapa)) p.etapa = 'pedido'
    // Moving into criação de imagem: free-text parts can't stay, they must come from the catálogo.
    if (soCatalogo(novoTipo) && (f.itens || []).some((i) => !i.servicoId)) p.itens = [...(f.itens || []).filter((i) => i.servicoId && i.servicoId !== '__escolher'), { descricao: '', qt: 1, precoUnit: 0 }].filter((x, i, a) => x.servicoId || i === a.length - 1)
    set(p)
  }

  async function salvar() {
    if (!cliNome.trim()) return toast('Escreva o nome do cliente')
    const itens = (f.itens || [])
      .filter((i) => i.descricao.trim())
      .map((i) => ({ ...i, servicoId: i.servicoId === '__escolher' ? undefined : i.servicoId, origem: i.origem || (i.precoUnit > 0 ? ('boca' as const) : undefined) }))
    if (soCatalogo(tipo) && !itens.length) return toast('Escolha pelo menos um serviço do catálogo')
    let clienteId = cliExistente?.id
    if (!clienteId) {
      const c = novo<Cliente>({ nome: cliNome.trim() })
      await db.clientes.put(c)
      clienteId = c.id
    }
    const titulo = f.titulo?.trim() || itens[0]?.descricao || TIPOS.find((x) => x.id === tipo)!.nome
    if (t) {
      await guardar(db.trabalhos, { ...(t as Trabalho), ...(f as Trabalho), titulo, clienteId, itens })
      await registar(user.id, `editou ${t.codigo}`, t.id)
      toast('Trabalho atualizado')
      onClose()
    } else {
      const job = novo<Trabalho>({
        codigo: proximoCodigo('T', d.trabalhos.map((x) => x.codigo)),
        titulo,
        clienteId,
        tipo,
        servicoId: itens.find((i) => i.servicoId)?.servicoId,
        descricao: f.descricao || '',
        itens,
        comIva: !!f.comIva,
        urgente: !!f.urgente,
        etapa: fase,
        etapas: [{ etapa: fase, em: agora(), por: user.id }],
        ...(etapasDoTipo(tipo).indexOf(fase) > etapasDoTipo(tipo).indexOf('negociacao') ? { confirmadoEm: hojeISO() } : {}),
        dataEntrada: f.dataEntrada || hojeISO(),
        prazo: f.prazo || '',
        responsavelId: f.responsavelId || undefined,
        ficheiros: [],
        notas: [],
        cotacaoId: f.cotacaoId
      })
      await db.trabalhos.put(job)
      await registar(user.id, `criou ${job.codigo}`, job.id)
      toast(`${job.codigo} criado${cliExistente ? '' : ` · cliente ${cliNome.trim()} registado`}`)
      onClose()
      ir(`/trabalhos/${job.id}`)
    }
  }

  return (
    <Modal
      wide
      title={t ? `Editar ${t.codigo}` : 'Novo trabalho'}
      onClose={onClose}
      footer={
        <>
          <div className="small muted hide-m" style={{ marginRight: 'auto' }}>
            Total <b className="num" style={{ color: 'var(--tx)' }}>{mt(tot.total)}</b> · sinal {d.empresa.sinalPct}% <b className="num">{mt(tot.total * d.empresa.sinalPct / 100)}</b>
          </div>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn pri" onClick={salvar}><Icon n="check" /> {t ? 'Guardar' : 'Criar trabalho'}</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field full">
          <span>1. Tipo de trabalho</span>
          <div className="tipos">
            {TIPOS.map((x) => (
              <button key={x.id} type="button" className={`tipo ${tipo === x.id ? 'on' : ''}`} onClick={() => mudarTipo(x.id)}>
                <Icon n={x.icone} />
                <b>{x.nome}</b>
                <span>{x.desc}</span>
              </button>
            ))}
          </div>
          <small>Fases: {etapasDoTipo(tipo).filter((e) => e !== 'entregue').map((e) => etapaInfo(e, tipo).curto).join(' → ')}</small>
        </div>

        {!t && (
          <Field label="Em que fase está?" full hint="Para registar um trabalho que já vai a meio. A partir de Layout conta como confirmado.">
            <select value={fase} onChange={(e) => setFase(e.target.value as Etapa)}>
              {etapasDoTipo(tipo).filter((e) => e !== 'entregue').map((e) => <option key={e} value={e}>{etapaInfo(e, tipo).nome}</option>)}
            </select>
          </Field>
        )}

        <Field label="2. Cliente" full hint={cliNome.trim() && !cliExistente ? `Cliente novo — fica registado ao criar o trabalho` : undefined}>
          <input list="clientes-lista" value={cliNome} onChange={(e) => setCliNome(e.target.value)} placeholder="Escreva o nome — se não existir, é criado" autoComplete="off" />
          <datalist id="clientes-lista">{d.clientes.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
        </Field>

        <div className="field full">
          <span>3. {soCatalogo(tipo) ? 'Serviços do catálogo' : 'Partes do trabalho'} <span className="muted">(sem IVA{soCatalogo(tipo) ? '' : ' · com preço = combinado de boca · vazio = por cotar'})</span></span>
          <EditorPartes tipo={tipo} itens={f.itens || []} onChange={mudarPartes} />
          <div className="row" style={{ marginTop: 8 }}>
            <label className="check"><input type="checkbox" checked={!!f.urgente} onChange={(e) => set({ urgente: e.target.checked })} /> Urgente (+{d.empresa.urgenciaPct}%)</label>
            <span className="spacer" />
            <label className="check"><input type="checkbox" checked={!!f.comIva} onChange={(e) => set({ comIva: e.target.checked })} /> IVA {d.empresa.taxaIva}%</label>
          </div>
          <div className="req-total small" style={{ marginTop: 8 }}>
            <div className="row"><span className="muted">Valor</span><span className="spacer" /><span className="num">{mt(tot.base)}</span></div>
            {tot.urgencia > 0 && <div className="row"><span className="muted">Taxa de urgência</span><span className="spacer" /><span className="num">{mt(tot.urgencia)}</span></div>}
            <div className="row"><span className="muted">IVA</span><span className="spacer" /><span className="num">{mt(tot.iva)}</span></div>
            <div className="row b"><span>Total</span><span className="spacer" /><span className="num">{mt(tot.total)}</span></div>
          </div>
        </div>

        <Field label="Título (opcional)" full hint="Se deixar vazio, usa a primeira parte">
          <input value={f.titulo} onChange={(e) => set({ titulo: e.target.value })} placeholder="Ex.: Branding camiões — Lote 1" />
        </Field>
        <Field label="Descrição / detalhes (opcional)" full>
          <textarea value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Medidas, materiais, referências, cores, o que o cliente pediu…" style={{ minHeight: 64 }} />
        </Field>
        <Field label="Data do pedido">
          <input type="date" value={f.dataEntrada} onChange={(e) => set({ dataEntrada: e.target.value })} />
        </Field>
        <Field label="Prazo de entrega" hint={soCatalogo(tipo) && !prazoManual ? 'Calculado pelo catálogo (dias úteis)' : undefined}>
          <input type="date" value={f.prazo} onChange={(e) => { setPrazoManual(true); set({ prazo: e.target.value }) }} />
        </Field>
        {d.utilizadores.filter((u) => u.ativo).length > 1 && (
          <Field label="Responsável" full>
            <select value={f.responsavelId || ''} onChange={(e) => set({ responsavelId: e.target.value })}>
              <option value="">— ninguém ainda —</option>
              {d.utilizadores.filter((u) => u.ativo).map((u) => <option key={u.id} value={u.id}>{u.nome} · {u.funcao}</option>)}
            </select>
          </Field>
        )}
      </div>
    </Modal>
  )
}
