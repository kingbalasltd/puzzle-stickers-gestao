import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Page, textoNuvem } from '../App'
import { db, type Empresa } from '../db'
import { parseNum } from '../format'
import { useDados } from '../state'
import { apagarExemplos, repor } from '../seed'
import { Confirm, Field, Icon, useToast } from '../ui'
import { atualizarApp, versaoCurta } from '../versao'
import { desligar, mudarSenha, sincronizar, useNuvem } from '../nuvem'

// Cloud link of this device: status, sync now, company password, unlink.
function CartaoNuvem() {
  const toast = useToast()
  const { fase, ultimo, erro } = useNuvem()
  const n = useLiveQuery(() => db.meta.get('nuvem'))
  const [senha, setSenha] = useState<{ atual: string; nova: string } | null>(null)
  const [sair, setSair] = useState(false)
  async function trocar() {
    try {
      await mudarSenha(senha!.atual, senha!.nova)
      setSenha(null)
      toast('Palavra-passe mudada. Os outros aparelhos vão pedir a nova.')
    } catch (e: any) {
      toast(e.message)
    }
  }
  return (
    <div className="card pad" style={{ marginTop: 14 }}>
      <h3>Nuvem</h3>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <span>{n ? <>Ligado a <b>{n.nome}</b> · {textoNuvem(fase, ultimo)}</> : 'Este aparelho não está ligado.'}</span>
        <button className="btn sm right" onClick={() => sincronizar().then(() => toast('Sincronizado'))}><Icon n="instalar" /> Sincronizar agora</button>
      </div>
      {fase === 'erro' && erro && <div className="small" style={{ color: 'var(--bad)', marginTop: 8 }}>{erro}</div>}
      <div className="small muted" style={{ marginTop: 8 }}>Tudo o que muda neste aparelho vai para a nuvem e aparece nos outros. Sem internet, fica guardado aqui e sobe quando voltar a ligação. Os ficheiros (PDF e fotos) ainda ficam só no aparelho onde foram carregados.</div>
      <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {!senha && <button className="btn sm" onClick={() => setSenha({ atual: '', nova: '' })}>Mudar palavra-passe da empresa</button>}
        <button className="btn sm ghost" onClick={() => setSair(true)}>Desligar este aparelho</button>
      </div>
      {senha && (
        <div className="form-grid" style={{ marginTop: 12 }}>
          <Field label="Palavra-passe atual"><input type="password" value={senha.atual} onChange={(e) => setSenha({ ...senha, atual: e.target.value })} autoComplete="current-password" /></Field>
          <Field label="Nova (mínimo 8 caracteres)"><input type="password" value={senha.nova} onChange={(e) => setSenha({ ...senha, nova: e.target.value })} autoComplete="new-password" /></Field>
          <div className="row full" style={{ gap: 8 }}>
            <button className="btn sm" onClick={() => setSenha(null)}>Cancelar</button>
            <button className="btn sm pri" disabled={senha.nova.length < 8 || !senha.atual} onClick={trocar}>Guardar</button>
          </div>
        </div>
      )}
      <div className="hr" />
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <span>Versão da app <b>{versaoCurta()}</b></span>
        <button className="btn sm right" onClick={atualizarApp}><Icon n="instalar" /> Atualizar app</button>
      </div>
      {sair && <Confirm text="Este aparelho deixa de sincronizar e volta a pedir a palavra-passe da empresa. Os dados ficam guardados aqui e na nuvem." ok="Desligar" onOk={() => desligar()} onClose={() => setSair(false)} />}
    </div>
  )
}

export default function Definicoes() {
  const d = useDados()
  const toast = useToast()
  const [f, setF] = useState<Empresa>({ ...d.empresa })
  const [conf, setConf] = useState<'exemplos' | 'repor' | null>(null)
  const set = (p: Partial<Empresa>) => setF((x) => ({ ...x, ...p }))
  const demos = [...d.trabalhos, ...d.clientes, ...d.documentos, ...d.utilizadores].filter((x) => x.demo).length

  async function salvar() {
    await db.empresa.put({ ...f, updatedAt: new Date().toISOString() })
    toast('Definições guardadas')
  }

  async function exportar() {
    const tabelas = ['utilizadores', 'clientes', 'fornecedores', 'servicos', 'trabalhos', 'pagamentos', 'requisicoes', 'custos', 'documentos', 'cotacoes', 'empresa'] as const
    const out: Record<string, unknown> = { exportado: new Date().toISOString() }
    for (const t of tabelas) out[t] = await (db as any)[t].toArray()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }))
    a.download = `puzzle-gestao-copia-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  return (
    <Page title="Definições" actions={<button className="btn pri" onClick={salvar}><Icon n="check" /> Guardar</button>}>
      <div className="grid g2">
        <div className="card pad">
          <h3>Empresa (aparece nos documentos)</h3>
          <div className="form-grid">
            <Field label="Nome comercial"><input value={f.nome} onChange={(e) => set({ nome: e.target.value })} /></Field>
            <Field label="NUIT"><input value={f.nuit} onChange={(e) => set({ nuit: e.target.value })} /></Field>
            <Field label="Razão social" full><input value={f.razaoSocial} onChange={(e) => set({ razaoSocial: e.target.value })} /></Field>
            <Field label="Morada" full><input value={f.morada} onChange={(e) => set({ morada: e.target.value })} /></Field>
            <Field label="Cidade"><input value={f.cidade} onChange={(e) => set({ cidade: e.target.value })} /></Field>
            <Field label="Telefones"><input value={f.telefones} onChange={(e) => set({ telefones: e.target.value })} /></Field>
            <Field label="Email"><input value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
            <Field label="Instagram"><input value={f.instagram} onChange={(e) => set({ instagram: e.target.value })} /></Field>
          </div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="card pad">
            <h3>Regras do negócio</h3>
            <div className="form-grid">
              <Field label="Taxa de IVA (%)"><input inputMode="decimal" value={f.taxaIva} onChange={(e) => set({ taxaIva: parseNum(e.target.value) })} /></Field>
              <Field label="Sinal para começar (%)"><input inputMode="decimal" value={f.sinalPct} onChange={(e) => set({ sinalPct: parseNum(e.target.value) })} /></Field>
              <Field label="Taxa de urgência (%)"><input inputMode="decimal" value={f.urgenciaPct} onChange={(e) => set({ urgenciaPct: parseNum(e.target.value) })} /></Field>
              <Field label="Validade das cotações (dias)"><input inputMode="numeric" value={f.validadeCotacao} onChange={(e) => set({ validadeCotacao: parseNum(e.target.value) })} /></Field>
              <Field label="Nota padrão das cotações" full><textarea value={f.notaCotacao} onChange={(e) => set({ notaCotacao: e.target.value })} /></Field>
            </div>
          </div>
          <div className="card pad">
            <h3>Dados</h3>
            <div className="small tx2" style={{ marginBottom: 12 }}>
              Protótipo: os dados ficam guardados neste aparelho e funcionam sem internet. Na versão 1 passam a sincronizar automaticamente entre iPhone, iPad, Mac e a equipa.
            </div>
            <div className="col" style={{ gap: 8 }}>
              <button className="btn" onClick={exportar}><Icon n="download" /> Descarregar cópia de segurança</button>
              {demos > 0 && <button className="btn" onClick={() => setConf('exemplos')}><Icon n="lixo" /> Apagar os dados de exemplo ({demos})</button>}
              <button className="btn danger" onClick={() => setConf('repor')}><Icon n="alerta" /> Recomeçar este aparelho</button>
            </div>
          </div>
        </div>
      </div>
      <CartaoNuvem />
      {conf === 'exemplos' && <Confirm text="Apaga os trabalhos, pagamentos, documentos e pessoas marcados como exemplo. Ficam a empresa, o catálogo, o dono, os clientes reais e os fornecedores." ok="Apagar exemplos" onOk={async () => { await apagarExemplos(); toast('Exemplos apagados') }} onClose={() => setConf(null)} />}
      {conf === 'repor' && <Confirm text="Apaga os dados DESTE aparelho. O que já está na nuvem fica guardado e volta a descer quando entrar outra vez; alterações que ainda não subiram perdem-se." ok="Recomeçar" onOk={async () => { await desligar(); await repor() }} onClose={() => setConf(null)} />}
    </Page>
  )
}
