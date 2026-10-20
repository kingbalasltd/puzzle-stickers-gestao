import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/styles.css'
import type { Cliente, Cotacao, Servico } from '../src/db'
import { CATALOGO, EMPRESA } from '../src/seed'
import { MATERIAIS_COTACAO as M, TEXTOS_FINAIS } from '../src/materiaisCotacao'
import { EditorCotacao, PreviewCotacao } from '../src/pages/cotacaoFormulario'

// Dev-only preview of the quote form, with sample quotes.
// ?v=fone|pc|a4 &ex=wrap|escola|mensal &aberto=N

const base = { id: 'x', updatedAt: '2026-10-17T00:00:00.000Z', validadeDias: 30, estado: 'rascunho' as const }
const texto = (nome: string) => TEXTOS_FINAIS.find((t) => t.nome === nome)!.texto
const wrap = 'Impresso em vynil  com aplicação do respectivo protector material 100% dedicado a wrap.'

const EXEMPLOS: Record<string, Cotacao> = {
  wrap: {
    ...base, numero: 'COT-001-JAN/26', data: '2026-01-15', clienteId: 'cliente-a', notas: texto('Pedir layouts'),
    itens: [
      { qt: 1, opcao: 1, titulo: 'Taksim®', subtitulo: 'Full Wrap Viatura Exemplo', precoUnit: 120000, descricao: `Full Wrap em Viatura Exemplo\nInclui Cobertura até 100% dos painéis e Stickers Complementares\n${wrap}`, materiais: [M[0], M[5]], nota: '** Layout já deﬁnido pelo cliente' },
      { qt: 1, opcao: 2, titulo: 'Mactac®', subtitulo: 'Full Wrap Viatura Exemplo', precoUnit: 150000, descricao: `Full Wrap em Viatura Exemplo\nInclui Cobertura até 100% dos painéis e Stickers Complementares\n${wrap}`, materiais: [M[1]], nota: '** Layout já deﬁnido pelo cliente' },
      { qt: 1, opcao: 3, titulo: 'Avery Dennison®', subtitulo: 'Full Wrap Viatura Exemplo', precoUnit: 190000, descricao: `Full Wrap em Viatura Exemplo\nInclui Cobertura até 100% dos painéis e Stickers Complementares\n${wrap}`, materiais: [M[2]], nota: '** Layout já deﬁnido pelo cliente' }
    ]
  },
  escola: {
    ...base, numero: 'COT-002-JAN/26', data: '2026-01-15', clienteId: 'cliente-b', notas: texto('Projecto'), desconto: 5,
    itens: [
      { qt: 1, titulo: 'Logotipo', subtitulo: 'Símbolo e assinatura', precoUnit: 12000, descricao: '• Proposta de logotipo com 2 revisões;\n• Versões a cores e a preto;\n• Ficheiros para digital e impressão.' },
      { qt: 1, titulo: 'Identidade Visual', subtitulo: 'Regras de uso da marca', precoUnit: 35000, descricao: '• Guia normativo da identidade visual;\n• Paleta de cores, tipograﬁa e elementos gráﬁcos;\n• Aplicações em papelaria, viaturas, sinalização e uniformes;\n• Entrega de ﬁcheiros técnicos para futuras produções.' },
      { qt: 1, titulo: 'Website', subtitulo: 'Site com área de gestão', precoUnit: 42000, descricao: '• Website com informação, notícias e contactos;\n• Área administrativa com perﬁs de acesso e formulários;\n• Funciona em computador, tablet e telemóvel.' },
      { qt: 1, titulo: 'Pacote de Divulgação', subtitulo: 'Lançamento da marca', precoUnit: 18000, descricao: '• 1 Spot (Vídeo) Publicitário\n• 5 Cartazes para divulgação' }
    ]
  },
  mensal: {
    ...base, numero: 'COT-003-JAN/26', data: '2026-01-15', clienteId: 'cliente-b', notas: texto('Padrão'),
    itens: [
      { qt: 1, secao: true, titulo: 'Serviços Mensais', precoUnit: 0 },
      { qt: 1, titulo: 'Manutenção do Website', subtitulo: 'Actualizações e suporte', precoUnit: 9000 },
      { qt: 1, titulo: 'Vídeo Publicitário', subtitulo: '1 vídeo por mês', precoUnit: 14000 },
      { qt: 1, titulo: 'Redes Sociais', subtitulo: 'Publicações e respostas', precoUnit: 6000 },
      { qt: 1, secao: true, titulo: 'Cartazes', precoUnit: 0 },
      { qt: 1, opcao: 1, titulo: 'Pacote 1', subtitulo: '4 cartazes por mês', precoUnit: 7000 },
      { qt: 1, opcao: 2, titulo: 'Pacote 2', subtitulo: '8 cartazes por mês', precoUnit: 11000 },
      { qt: 1, opcao: 3, titulo: 'Pacote 3', subtitulo: '15 cartazes por mês', precoUnit: 16000 }
    ]
  }
}

const CLIENTES = [
  { id: 'cliente-a', nome: 'Cliente Exemplo', cidade: 'Maputo, Moçambique' },
  { id: 'cliente-b', nome: 'Escola Exemplo', cidade: 'Maputo, Moçambique' }
] as Cliente[]
const SERVICOS = CATALOGO.map(([categoria, nome, preco, diasMin, diasMax, inclui], i): Servico => ({ id: `s${i}`, updatedAt: '', categoria, nome, preco, diasMin, diasMax, inclui, ativo: true, ordem: i }))

function Mock() {
  const q = new URLSearchParams(location.search)
  const v = q.get('v') || 'pc'
  const [c, setC] = useState<Cotacao>(EXEMPLOS[q.get('ex') || 'wrap'])
  const set = (p: Partial<Cotacao>) => setC((x) => ({ ...x, ...p }))
  const cliente = CLIENTES.find((x) => x.id === c.clienteId)
  const aberto = q.has('aberto') ? Number(q.get('aberto')) : 0
  const editor = <EditorCotacao c={c} set={set} clientes={CLIENTES} servicos={SERVICOS} empresa={EMPRESA} abertoInicial={aberto < 0 ? -1 : aberto} />
  const topo = (
    <div className="row" style={{ gap: 10, marginBottom: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: v === 'fone' ? 18 : 22, fontWeight: 800 }}>{c.numero} <span className="badge">Rascunho</span></div>
        <div className="small muted">{cliente?.nome}</div>
      </div>
      <button className="btn"><span>PDF</span></button>
      <button className="btn pri">Guardar</button>
    </div>
  )
  // ?v=a4: the pages alone; printed, each one is an A4 page of the PDF.
  if (v === 'a4') return (
    <div className="so-a4" style={{ width: 794, background: '#555' }}>
      <style>{'@page{size:A4;margin:0} @media print{html,body,.so-a4{background:#fff!important;width:auto!important} .so-a4 .col{gap:0!important} .a4-prev{width:210mm;height:297mm;border-radius:0;box-shadow:none;break-after:page}}'}</style>
      {(q.get('ex') || 'wrap').split(',').map((ex) => <PreviewCotacao key={ex} c={EXEMPLOS[ex]} cliente={CLIENTES.find((x) => x.id === EXEMPLOS[ex].clienteId)} empresa={EMPRESA} />)}
    </div>
  )
  if (v === 'fone') return <div style={{ width: 390, padding: 14 }}>{topo}{editor}</div>
  return (
    <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '520px 1fr', gap: 24, alignItems: 'start', maxWidth: 1400 }}>
      <div>{topo}{editor}</div>
      <div style={{ position: 'sticky', top: 24 }}>
        <div className="small muted" style={{ marginBottom: 8 }}>Como sai a cotação (actualiza enquanto escreve)</div>
        <PreviewCotacao c={c} cliente={cliente} empresa={EMPRESA} />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Mock />)
