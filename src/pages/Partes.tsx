import type { ItemTrabalho, Servico, TipoTrabalho } from '../db'
import { mt, num2, parseNum } from '../format'
import { useDados } from '../state'
import { Icon } from '../ui'

// How parts are added depends on the job type (Momad, 14 Oct):
// criação de imagem = always picked from the catálogo (everything is priced
// there); the other types = free parts (price agreed by voice, or "por cotar"),
// with the option to add a catálogo service too (e.g. vectorização in a branding).
export const soCatalogo = (tipo?: TipoTrabalho) => tipo === 'criacao'

const EXEMPLO: Partial<Record<TipoTrabalho, string>> = {
  branding: 'Ex.: Branding em Camião — Freightliner Argosy',
  producao: 'Ex.: Branding em Camião — Freightliner Argosy',
  fornecimento: 'Ex.: Camisetes estampadas (frente e costas)',
  montagem: 'Ex.: Montagem de PPF — Toyota Hilux'
}

export const parteDoServico = (s: Servico, qt = 1): ItemTrabalho => ({
  descricao: s.nome,
  detalhe: s.inclui.join(' · ') + (s.diasMax ? ` · ${s.diasMin}–${s.diasMax} dias` : ''),
  qt,
  precoUnit: s.preco,
  origem: 'catalogo',
  servicoId: s.id
})

export function SelectCatalogo({ value, onChange, placeholder = '— escolher do catálogo —' }: { value?: string; onChange: (s: Servico | undefined) => void; placeholder?: string }) {
  const d = useDados()
  const ativos = d.servicos.filter((s) => s.ativo)
  const cats = [...new Set(ativos.map((s) => s.categoria))]
  return (
    <select className="inp" value={value || ''} onChange={(e) => onChange(ativos.find((s) => s.id === e.target.value))}>
      <option value="">{placeholder}</option>
      {cats.map((c) => (
        <optgroup key={c} label={c}>
          {ativos.filter((s) => s.categoria === c).map((s) => (
            <option key={s.id} value={s.id}>{s.nome} — {s.preco ? mt(s.preco) : 'sob proposta'}{s.diasMax ? ` · ${s.diasMin}–${s.diasMax} dias` : ''}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

export function LinhaParte({ tipo, it, onChange, onRemove }: { tipo?: TipoTrabalho; it: ItemTrabalho; onChange: (p: Partial<ItemTrabalho>) => void; onRemove?: () => void }) {
  const d = useDados()
  const serv = d.servicos.find((s) => s.id === it.servicoId)
  const doCatalogo = soCatalogo(tipo) || !!it.servicoId
  return (
    <div className="parte">
      <div className="row item-row" style={{ alignItems: 'stretch' }}>
        {doCatalogo ? (
          <div className="desc" style={{ flex: 3, minWidth: 0 }}>
            <SelectCatalogo value={it.servicoId} onChange={(s) => onChange(s ? parteDoServico(s, it.qt || 1) : { servicoId: undefined, descricao: '', precoUnit: 0, detalhe: undefined, origem: undefined })} />
          </div>
        ) : (
          <input className="inp desc" style={{ flex: 3 }} placeholder={EXEMPLO[tipo || 'branding'] || 'Descrição'} value={it.descricao} onChange={(e) => onChange({ descricao: e.target.value })} />
        )}
        <input className="inp num" style={{ width: 64, textAlign: 'right' }} inputMode="decimal" value={it.qt} onChange={(e) => onChange({ qt: parseNum(e.target.value) })} aria-label="Quantidade" />
        <input
          className="inp num"
          style={{ width: 130, textAlign: 'right' }}
          inputMode="decimal"
          placeholder={doCatalogo ? 'Preço' : 'Vazio = por cotar'}
          defaultValue={it.precoUnit ? num2(it.precoUnit) : ''}
          key={`p-${it.servicoId}-${it.precoUnit}`}
          readOnly={!!serv && serv.preco > 0}
          title={serv && serv.preco > 0 ? 'Preço do catálogo' : undefined}
          onBlur={(e) => onChange({ precoUnit: parseNum(e.target.value) })}
          aria-label="Preço unitário"
        />
        {onRemove && <button className="btn icon" type="button" onClick={onRemove} aria-label="Remover parte"><Icon n="x" /></button>}
      </div>
      {serv && <div className="tiny muted" style={{ margin: '4px 2px 0' }}>{serv.inclui.join(' · ')}{serv.diasMax ? ` · ${serv.diasMin}–${serv.diasMax} dias` : ''}{!serv.preco ? ' · preço sob proposta: escreva o valor' : ''}</div>}
    </div>
  )
}

export function EditorPartes({ tipo, itens, onChange }: { tipo?: TipoTrabalho; itens: ItemTrabalho[]; onChange: (xs: ItemTrabalho[]) => void }) {
  const set = (i: number, p: Partial<ItemTrabalho>) => onChange(itens.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const vazio: ItemTrabalho = { descricao: '', qt: 1, precoUnit: 0 }
  return (
    <div className="col" style={{ gap: 8 }}>
      {itens.map((it, i) => <LinhaParte key={i} tipo={tipo} it={it} onChange={(p) => set(i, p)} onRemove={itens.length > 1 ? () => onChange(itens.filter((_, k) => k !== i)) : undefined} />)}
      <div className="row wrap" style={{ gap: 6 }}>
        {soCatalogo(tipo) ? (
          <button className="btn sm" type="button" onClick={() => onChange([...itens, { ...vazio }])}><Icon n="plus" /> Do catálogo</button>
        ) : (
          <>
            <button className="btn sm" type="button" onClick={() => onChange([...itens, { ...vazio }])}><Icon n="plus" /> Parte</button>
            <button className="btn sm ghost" type="button" onClick={() => onChange([...itens, { ...vazio, servicoId: '__escolher' }])}><Icon n="catalogo" /> Do catálogo (ex.: vectorização)</button>
          </>
        )}
      </div>
    </div>
  )
}
