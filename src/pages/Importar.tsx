import { useState } from 'react'
import { db, guardar, guardarFicheiro, novo, registar, uid, type Documento, type Requisicao } from '../db'
import { baseDeTotal, hojeISO, numeroDoMes, r2, saldoRequisicao, totaisRequisicao, valorRequisicao } from '../calc'
import { dataMedia, mt, num2 } from '../format'
import { chaveNome, lerFicheiro, type DocAcademica, type ListaLida } from '../leitura'
import { ir, useDados, useSessao } from '../state'
import { nomeOficial } from '../requisicaoPdf'
import { Field, Icon, Modal, UploadZone, useToast } from '../ui'

type Resultado = {
  id: string
  nome: string
  ficheiroId: string
  estado: 'lido' | 'feito' | 'erro'
  lista?: ListaLida
  doc?: DocAcademica
  motivo?: string
  reqId?: string // matched requisição (doc) or existing one with the same list
  trabalhoId?: string
  pago?: boolean
  msg?: string
}

const TIPO_DOC = { proforma: 'Pró-forma', fatura: 'Fatura', recibo: 'Recibo' }

// "Carregar ficheiros": the user drops the company's lists (Excel/PDF) and Académica's
// pró-formas/faturas/recibos; each one is read and linked to the right place.
export function ImportarModal({ trabalhoId, onClose }: { trabalhoId?: string; onClose: () => void }) {
  const d = useDados()
  const { user } = useSessao()
  const toast = useToast()
  const taxa = d.empresa.taxaIva
  const [res, setRes] = useState<Resultado[]>([])
  const [lendo, setLendo] = useState(false)
  const acad = d.fornecedores.find((f) => /acad[eé]mica/i.test(f.nome)) || d.fornecedores[0]
  const set = (id: string, p: Partial<Resultado>) => setRes((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))

  function procurar(doc: DocAcademica) {
    const reqs = d.requisicoes.filter((r) => !r.deleted)
    const k = doc.nomeBase ? chaveNome(doc.nomeBase) : ''
    return (
      (k && reqs.find((r) => chaveNome(r.nomeTrabalho) === k)) ||
      (k && reqs.find((r) => k.includes(chaveNome(r.nomeTrabalho)) || chaveNome(r.nomeTrabalho).includes(k))) ||
      (doc.tipo !== 'proforma' && reqs.find((r) => r.proforma?.numero === doc.numero)) ||
      (doc.total && reqs.find((r) => Math.abs(valorRequisicao(r, taxa) - doc.total!) < 0.01 && !(doc.tipo === 'proforma' && r.proforma))) ||
      undefined
    )?.id
  }

  async function ler(fs: File[]) {
    setLendo(true)
    for (const f of fs) {
      const id = uid()
      const ficheiroId = await guardarFicheiro(f)
      const l = await lerFicheiro(f)
      const r: Resultado = { id, nome: f.name, ficheiroId, estado: l.tipo === 'nada' ? 'erro' : 'lido' }
      if (l.tipo === 'nada') r.motivo = l.motivo
      if (l.tipo === 'lista') {
        r.lista = l.lista
        r.trabalhoId = trabalhoId || d.trabalhos.find((t) => d.requisicoes.some((q) => q.trabalhoId === t.id && chaveNome(q.nomeTrabalho) === chaveNome(l.lista.nomeTrabalho)))?.id || ''
        r.reqId = d.requisicoes.find((q) => chaveNome(q.nomeTrabalho) === chaveNome(l.lista.nomeTrabalho))?.id
      }
      if (l.tipo === 'academica') {
        r.doc = l.doc
        r.reqId = procurar(l.doc)
        r.pago = true
      }
      setRes((xs) => [...xs, r])
    }
    setLendo(false)
  }

  async function aplicarLista(x: Resultado) {
    const l = x.lista!
    const rec = novo<Requisicao>({
      numero: numeroDoMes('REQ', d.requisicoes.map((q) => q.numero), l.data || hojeISO()),
      trabalhoId: x.trabalhoId || '',
      fornecedorId: acad?.id || '',
      data: l.data || hojeISO(),
      tipo: 'lista',
      nomeTrabalho: l.nomeTrabalho,
      materialImpressao: nomeOficial(l.materialImpressao) || '',
      precoImpressaoM2: l.precoImpressaoM2 || 0,
      materialLaminacao: nomeOficial(l.materialLaminacao) || '',
      precoLaminacaoM2: l.precoLaminacaoM2 || 0,
      linhas: l.linhas,
      comIva: true,
      estado: 'rascunho',
      pagamento: 'pendente',
      anexoId: x.ficheiroId
    })
    await db.requisicoes.put(rec)
    await registar(user.id, `importou a lista ${rec.nomeTrabalho} (${rec.numero})`, rec.id)
    set(x.id, { estado: 'feito', reqId: rec.id, msg: `${rec.numero} criada` })
  }

  async function aplicarDoc(x: Resultado) {
    const doc = x.doc!
    const r = d.requisicoes.find((q) => q.id === x.reqId)
    if (!r) return toast('Escolha a requisição')
    const forn = d.fornecedor(r.fornecedorId)
    const total = doc.total || valorRequisicao(r, taxa)
    let patch: Partial<Requisicao> = {}
    let msg = ''
    if (doc.tipo === 'proforma') {
      patch = { proforma: { numero: doc.numero, data: doc.data || hojeISO(), valor: total, ficheiroId: x.ficheiroId }, enviadaEm: r.enviadaEm || r.data, estado: r.estado === 'rascunho' ? 'enviada' : r.estado }
      const lista = totaisRequisicao(r, taxa).total
      msg = Math.abs(lista - total) < 0.5 || r.tipo === 'encomenda' ? `Pró-forma ${doc.numero} ligada a ${r.numero} · igual à lista ✓` : `Pró-forma ${doc.numero} ligada a ${r.numero} · diferença de ${mt(total - lista)} face à lista`
    } else {
      const base = doc.base ?? baseDeTotal(total, taxa)
      const novoDoc = novo<Documento>({
        direcao: 'recebido', tipo: doc.tipo === 'fatura' ? 'fatura' : 'recibo', numero: doc.numero, data: doc.data || hojeISO(), entidade: forn?.nome || 'Fornecedor', nuit: forn?.nuit,
        fornecedorId: r.fornecedorId, trabalhoId: r.trabalhoId || undefined, requisicaoId: r.id,
        base: doc.tipo === 'fatura' ? base : 0, iva: doc.tipo === 'fatura' ? doc.iva ?? r2(total - base) : 0, total, ficheiroId: x.ficheiroId, notas: `${r.numero} · ${r.nomeTrabalho}`
      })
      await db.documentos.put(novoDoc)
      patch = doc.tipo === 'fatura' ? { faturaDocId: novoDoc.id } : { reciboDocId: novoDoc.id }
      msg = `${TIPO_DOC[doc.tipo]} ${doc.numero} guardada${doc.tipo === 'fatura' ? ' · conta no IVA dedutível' : ''}`
      // A receipt means it was paid: close the balance if the user confirms.
      const saldo = saldoRequisicao(r, taxa)
      if (doc.tipo === 'recibo' && x.pago && saldo > 0) {
        patch.pagamentos = [...(r.pagamentos || []), { id: uid(), data: doc.data || hojeISO(), valor: Math.min(saldo, total), metodo: 'Transferência', referencia: `Recibo ${doc.numero}` }]
        msg += ` · ${mt(Math.min(saldo, total))} registado como pago`
      }
    }
    await guardar(db.requisicoes, { ...r, ...patch })
    set(x.id, { estado: 'feito', msg })
  }

  const reqsOpcoes = d.requisicoes.filter((r) => !r.deleted)

  return (
    <Modal wide title="Carregar ficheiros" onClose={onClose} footer={<button className="btn pri" onClick={onClose}>Concluído</button>}>
      <UploadZone
        text={lendo ? 'A ler…' : 'Escolha listas de impressão (Excel ou PDF) e documentos da Académica (pró-formas, faturas, recibos)'}
        accept=".pdf,.xlsx,.xls,application/pdf,image/*"
        onFiles={ler}
      />
      <div className="tiny muted" style={{ margin: '8px 0 16px' }}>O sistema lê sozinho os PDF da Académica e as suas listas. Documentos digitalizados (scan) e fotos ficam guardados, mas os valores preenche à mão.</div>

      <div className="col" style={{ gap: 10 }}>
        {res.map((x) => {
          const r = d.requisicoes.find((q) => q.id === x.reqId)
          return (
            <div key={x.id} className="card pad" style={{ padding: 14 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <Icon n={x.estado === 'erro' ? 'alerta' : x.estado === 'feito' ? 'check' : x.lista ? 'imprimir' : 'recibo'} style={{ color: x.estado === 'erro' ? 'var(--warn)' : x.estado === 'feito' ? 'var(--ok)' : 'var(--y)', marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: 'block' }}>{x.nome}</b>
                  {x.estado === 'erro' && <div className="small muted">{x.motivo}</div>}

                  {x.lista && (
                    <div className="small tx2" style={{ marginTop: 4 }}>
                      Lista de impressão <b>{x.lista.nomeTrabalho}</b> · {x.lista.data ? dataMedia(x.lista.data) : 'sem data'} · {x.lista.linhas.length} prints · {num2(totaisRequisicao({ ...x.lista, comIva: true } as any, taxa).m2)} m² · {x.lista.materialImpressao}{x.lista.materialLaminacao ? ` + ${x.lista.materialLaminacao}` : ''} · <b>{mt(totaisRequisicao({ ...x.lista, precoImpressaoM2: x.lista.precoImpressaoM2 || 0, precoLaminacaoM2: x.lista.precoLaminacaoM2 || 0, comIva: true } as any, taxa).total)}</b>
                    </div>
                  )}
                  {x.doc && (
                    <div className="small tx2" style={{ marginTop: 4 }}>
                      {TIPO_DOC[x.doc.tipo]} <b>{x.doc.numero}</b> da Académica · {x.doc.data ? dataMedia(x.doc.data) : ''}{x.doc.total ? <> · <b>{mt(x.doc.total)}</b></> : ''}{x.doc.m2 ? ` · ${num2(x.doc.m2)} m²` : ''}{x.doc.nomeBase ? ` · ${x.doc.nomeBase}` : ''}
                    </div>
                  )}

                  {x.estado === 'lido' && x.lista && (
                    <div className="form-grid" style={{ marginTop: 10 }}>
                      {r && <div className="full alert warn" style={{ cursor: 'default' }}><Icon n="alerta" /><div><b>Já existe {r.numero} com esta lista</b><span>Se importar, fica duplicada.</span></div></div>}
                      <Field label="Trabalho" full>
                        <select value={x.trabalhoId} onChange={(e) => set(x.id, { trabalhoId: e.target.value })}>
                          <option value="">— sem trabalho —</option>
                          {d.trabalhos.filter((t) => !t.cancelado).map((t) => <option key={t.id} value={t.id}>{t.codigo} · {t.titulo} · {d.cliente(t.clienteId)?.nome}</option>)}
                        </select>
                      </Field>
                      <div className="full row"><span className="spacer" /><button className="btn sm pri" onClick={() => aplicarLista(x)}><Icon n="check" /> Criar requisição</button></div>
                    </div>
                  )}

                  {x.estado === 'lido' && x.doc && (
                    <div className="form-grid" style={{ marginTop: 10 }}>
                      <Field label={r ? 'Encontrei a requisição' : 'Não encontrei — escolha a requisição'} full>
                        <select value={x.reqId || ''} onChange={(e) => set(x.id, { reqId: e.target.value || undefined })}>
                          <option value="">— escolher —</option>
                          {reqsOpcoes.map((q) => <option key={q.id} value={q.id}>{q.numero} · {q.nomeTrabalho}{q.proforma ? ` · PF ${q.proforma.numero}` : ''} · {mt(valorRequisicao(q, taxa))}</option>)}
                        </select>
                      </Field>
                      {x.doc.tipo === 'recibo' && r && saldoRequisicao(r, taxa) > 0 && (
                        <label className="check full"><input type="checkbox" checked={!!x.pago} onChange={(e) => set(x.id, { pago: e.target.checked })} /> Registar como pago ({mt(Math.min(saldoRequisicao(r, taxa), x.doc.total || 0))})</label>
                      )}
                      {x.doc.tipo === 'proforma' && r?.proforma && <div className="full tiny" style={{ color: 'var(--warn)' }}>Esta requisição já tem a pró-forma {r.proforma.numero} — será substituída.</div>}
                      <div className="full row"><span className="spacer" /><button className="btn sm pri" disabled={!r} onClick={() => aplicarDoc(x)}><Icon n="check" /> Ligar à requisição</button></div>
                    </div>
                  )}

                  {x.estado === 'feito' && (
                    <div className="row small" style={{ marginTop: 6 }}>
                      <span style={{ color: 'var(--ok)', fontWeight: 700 }}>{x.msg}</span>
                      <span className="spacer" />
                      {x.reqId && <button className="btn sm ghost" onClick={() => { onClose(); ir(`/requisicoes/${x.reqId}`) }}>Abrir →</button>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

export function BotaoCarregar({ trabalhoId, texto = 'Carregar ficheiros', className = 'btn' }: { trabalhoId?: string; texto?: string; className?: string }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button className={className} onClick={() => setAberto(true)}><Icon n="upload" /> <span className="hide-m">{texto}</span></button>
      {aberto && <ImportarModal trabalhoId={trabalhoId} onClose={() => setAberto(false)} />}
    </>
  )
}
