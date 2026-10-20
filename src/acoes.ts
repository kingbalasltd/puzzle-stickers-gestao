import { agora, db, guardar, novo as novoReg, registar, uid, type Etapa, type Tarefa, type Trabalho } from './db'
import { ETAPAS, etapaInfo, hojeISO } from './calc'

const pos = (e: Etapa) => ETAPAS.findIndex((x) => x.id === e)

// Moving a job past "Em negociação" means the client confirmed: from then on it counts in "a receber".
export async function moverEtapa(t: Trabalho, nova: Etapa, por: string, extra: Partial<Trabalho> = {}) {
  if (t.etapa === nova && !Object.keys(extra).length) return
  const confirma = pos(nova) > pos('negociacao') && !t.confirmadoEm && !extra.confirmadoEm ? { confirmadoEm: hojeISO() } : {}
  const novo: Trabalho = { ...t, ...confirma, ...extra, etapa: nova, etapas: t.etapa === nova ? t.etapas : [...t.etapas, { etapa: nova, em: agora(), por }] }
  await guardar(db.trabalhos, novo)
  if (t.etapa !== nova) await registar(por, `moveu ${t.codigo} para ${etapaInfo(nova, t.tipo).nome}`, t.id)
}

export async function novaTarefa(texto: string, por: string, data?: string, trabalhoId?: string) {
  const k = novoReg<Tarefa>({ texto: texto.trim(), data: data || undefined, trabalhoId: trabalhoId || undefined, por })
  await db.tarefas.put(k)
  return k
}

export async function marcarTarefa(k: Tarefa, feita: boolean) {
  await guardar(db.tarefas, { ...k, feitaEm: feita ? agora() : undefined })
}

export async function adicionarNota(t: Trabalho, texto: string, por: string, ficheiroId?: string) {
  const novo: Trabalho = { ...t, notas: [...t.notas, { id: uid(), em: agora(), por, texto, ficheiroId }] }
  await guardar(db.trabalhos, novo)
}
