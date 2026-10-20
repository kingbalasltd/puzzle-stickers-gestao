import { useMemo, useState } from 'react'
import { Page } from '../App'
import { db, guardar, guardarFicheiro, novo, type Relatorio } from '../db'
import { addDias, hojeISO } from '../calc'
import { dataLonga, horaCurta } from '../format'
import { ir, useDados, useSessao } from '../state'
import { Avatar, Empty, Field, Icon, Thumb, UploadZone, useToast } from '../ui'

// Daily report: each worker writes what they did, what's next and any problem,
// linked to jobs and with photos. Momad sees everyone and who hasn't sent.
export default function Relatorios() {
  const d = useDados()
  const { user, pode } = useSessao()
  const hoje = hojeISO()
  const chefe = pode('todosTrabalhos')
  const [quem, setQuem] = useState(chefe ? '' : user.id)
  const meuHoje = d.relatorios.find((r) => r.utilizadorId === user.id && r.data === hoje)
  const [editar, setEditar] = useState(false)
  const trabalhadores = d.utilizadores.filter((u) => u.ativo && u.papel === 'trabalhador')

  const feed = useMemo(
    () => d.relatorios.filter((r) => (chefe ? !quem || r.utilizadorId === quem : r.utilizadorId === user.id) && r.data >= addDias(hoje, -45)),
    [d.relatorios, chefe, quem, user.id, hoje]
  )
  const dias = [...new Set(feed.map((r) => r.data))]

  return (
    <Page title="Relatórios diários" sub={chefe ? 'O que a equipa fez em cada dia' : 'Escreva no fim do dia o que fez'}>
      {chefe && (
        <div className="card pad" style={{ marginBottom: 14 }}>
          <h3><Icon n="equipa" /> Hoje · {dataLonga(hoje).split(',')[0]}</h3>
          {trabalhadores.length === 0 ? (
            <div className="small tx2">Ainda não tem trabalhadores com acesso. Quando os adicionar em <a href="#/equipa">Definições → Equipa</a>, cada um entra com o seu PIN e escreve aqui o relatório do dia. O senhor vê tudo e o sistema avisa quem não enviou.</div>
          ) : (
            <div className="row wrap" style={{ gap: 8 }}>
              {trabalhadores.map((u) => {
                const ok = d.relatorios.some((r) => r.utilizadorId === u.id && r.data === hoje)
                return (
                  <button key={u.id} className={`badge ${ok ? 'ok' : 'warn'}`} style={{ height: 30, cursor: 'pointer' }} onClick={() => setQuem(quem === u.id ? '' : u.id)}>
                    {ok ? <Icon n="check" style={{ width: 13, height: 13 }} /> : <Icon n="relogio" style={{ width: 13, height: 13 }} />} {u.nome.split(' ')[0]} · {ok ? 'enviou' : 'ainda não enviou'}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="card pad" style={{ marginBottom: 14 }}>
        <h3><Icon n="nota" /> O meu relatório de hoje {meuHoje && !editar && <button className="right btn sm" onClick={() => setEditar(true)}><Icon n="editar" /> Editar</button>}</h3>
        {meuHoje && !editar ? <Cartao r={meuHoje} /> : <RelatorioForm r={meuHoje} onDone={() => setEditar(false)} />}
      </div>

      <div className="row wrap" style={{ margin: '18px 0 10px' }}>
        <b>Anteriores</b>
        <span className="spacer" />
        {chefe && d.utilizadores.length > 1 && (
          <select className="inp" style={{ width: 'auto' }} value={quem} onChange={(e) => setQuem(e.target.value)}>
            <option value="">Todos</option>
            {d.utilizadores.filter((u) => u.ativo).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}
      </div>
      {!feed.some((r) => !(r.data === hoje && r.utilizadorId === user.id)) && <div className="card"><Empty icon="nota" title="Ainda sem relatórios anteriores" /></div>}
      {dias.map((dia) => {
        const xs = feed.filter((r) => r.data === dia && !(dia === hoje && r.utilizadorId === user.id))
        if (!xs.length) return null
        return (
          <div key={dia} className="day-group">
            <div className="dh">{dataLonga(dia).split(',')[0].replace(/^./, (c) => c.toUpperCase())} <span>{dataLonga(dia).split(', ')[1]}</span></div>
            <div className="col" style={{ gap: 10 }}>{xs.map((r) => <div key={r.id} className="card pad"><Cartao r={r} autor /></div>)}</div>
          </div>
        )
      })}
    </Page>
  )
}

function Cartao({ r, autor }: { r: Relatorio; autor?: boolean }) {
  const d = useDados()
  const u = d.user(r.utilizadorId)
  return (
    <div className="col" style={{ gap: 10 }}>
      {autor && u && (
        <div className="row">
          <Avatar nome={u.nome} cor={u.cor} size="sm" />
          <b className="small">{u.nome}</b>
          <span className="tiny muted">{horaCurta(r.updatedAt)}</span>
        </div>
      )}
      <div><div className="tiny muted b">FEITO</div><div className="pre small">{r.feito}</div></div>
      {r.aFazer && <div><div className="tiny muted b">FALTA / AMANHÃ</div><div className="pre small">{r.aFazer}</div></div>}
      {r.problemas && <div className="alert warn" style={{ cursor: 'default' }}><Icon n="alerta" /><div><b>Problemas / o que precisa</b><span className="pre">{r.problemas}</span></div></div>}
      {r.trabalhosIds.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {r.trabalhosIds.map((id) => { const t = d.trabalhos.find((x) => x.id === id); return t ? <button key={id} className="badge" style={{ cursor: 'pointer' }} onClick={() => ir(`/trabalhos/${id}`)}>{t.codigo} · {t.titulo}</button> : null })}
        </div>
      )}
      {r.fotos.length > 0 && <div className="thumbs">{r.fotos.map((f) => <Thumb key={f} id={f} />)}</div>}
    </div>
  )
}

function RelatorioForm({ r, onDone }: { r?: Relatorio; onDone: () => void }) {
  const d = useDados()
  const { user, pode } = useSessao()
  const toast = useToast()
  const [f, setF] = useState({ feito: r?.feito || '', aFazer: r?.aFazer || '', problemas: r?.problemas || '', trabalhosIds: r?.trabalhosIds || [], fotos: r?.fotos || [] })
  const meus = d.trabalhos.filter((t) => !t.cancelado && t.etapa !== 'entregue' && (pode('todosTrabalhos') || t.responsavelId === user.id))
  const alterna = (id: string) => setF((x) => ({ ...x, trabalhosIds: x.trabalhosIds.includes(id) ? x.trabalhosIds.filter((y) => y !== id) : [...x.trabalhosIds, id] }))
  async function enviar() {
    if (!f.feito.trim()) return toast('Escreva o que fez hoje')
    await guardar(db.relatorios, r ? { ...r, ...f } : novo<Relatorio>({ data: hojeISO(), utilizadorId: user.id, ...f }))
    toast('Relatório enviado')
    onDone()
  }
  return (
    <div className="col" style={{ gap: 12 }}>
      <Field label="O que fiz hoje"><textarea value={f.feito} onChange={(e) => setF({ ...f, feito: e.target.value })} placeholder="Ex.: Apliquei as laterais do Volvo FH, cortei os autocolantes de um cliente…" /></Field>
      {meus.length > 0 && (
        <div className="field">
          <span>Em que trabalhos</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {meus.map((t) => (
              <button key={t.id} type="button" className={`badge ${f.trabalhosIds.includes(t.id) ? 'y' : ''}`} style={{ height: 30, cursor: 'pointer' }} onClick={() => alterna(t.id)}>
                {f.trabalhosIds.includes(t.id) && <Icon n="check" style={{ width: 13, height: 13 }} />} {t.codigo} · {t.titulo}
              </button>
            ))}
          </div>
        </div>
      )}
      <Field label="O que falta / amanhã (opcional)"><textarea style={{ minHeight: 60 }} value={f.aFazer} onChange={(e) => setF({ ...f, aFazer: e.target.value })} /></Field>
      <Field label="Problemas ou o que preciso (opcional)"><textarea style={{ minHeight: 60 }} value={f.problemas} onChange={(e) => setF({ ...f, problemas: e.target.value })} placeholder="Ex.: falta vinil branco, cliente não estava…" /></Field>
      <div className="field">
        <span>Fotos (opcional)</span>
        {f.fotos.length > 0 && <div className="thumbs" style={{ marginBottom: 8 }}>{f.fotos.map((id) => <Thumb key={id} id={id} onRemove={() => setF((x) => ({ ...x, fotos: x.fotos.filter((y) => y !== id) }))} />)}</div>}
        <UploadZone text="Tirar foto do trabalho" accept="image/*" onFiles={async (fs) => { const ids: string[] = []; for (const x of fs) ids.push(await guardarFicheiro(x)); setF((y) => ({ ...y, fotos: [...y.fotos, ...ids] })) }} />
      </div>
      <div className="row"><span className="spacer" />{r && <button className="btn" onClick={onDone}>Cancelar</button>}<button className="btn pri" onClick={enviar}><Icon n="check" /> Enviar relatório</button></div>
    </div>
  )
}
