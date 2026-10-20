import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/styles.css'
import type { Cliente, Cotacao, Servico } from '../src/db'
import { CATALOGO, EMPRESA } from '../src/seed'
import { MATERIAIS_COTACAO as M, TEXTOS_FINAIS } from '../src/materiaisCotacao'
import { EditorCotacao, PreviewCotacao } from '../src/pages/cotacaoFormulario'

// Dev-only page to show Momad the proposed quote form with examples taken from his own quotes.
// ?v=fone|pc|a4 &ex=wrap|escola|mensal &aberto=N

const base = { id: 'x', updatedAt: '2026-10-17T00:00:00.000Z', validadeDias: 30, estado: 'rascunho' as const }
const texto = (nome: string) => TEXTOS_FINAIS.find((t) => t.nome === nome)!.texto
const wrap = 'Impresso em vynil  com aplicação do respectivo protector material 100% dedicado a wrap.'

const EXEMPLOS: Record<string, Cotacao> = {
  wrap: {
    ...base, numero: 'COT-004-OUT/26', data: '2026-10-17', clienteId: 'cliente-a', notas: texto('Pedir layouts'),
    itens: [
      { qt: 1, opcao: 1, titulo: 'Taksim®', subtitulo: 'Full Wrap BMW E92', precoUnit: 145000, descricao: `Full Wrap em Viatura Bmw E92\nInclui Cobertura até 100% dos painéis e Stickers Complementares\n${wrap}`, materiais: [M[0], M[5]], nota: '** Layout já deﬁnido pelo cliente' },
      { qt: 1, opcao: 2, titulo: 'Mactac®', subtitulo: 'Full Wrap BMW E92', precoUnit: 175000, descricao: `Full Wrap em Viatura Bmw E92\nInclui Cobertura até 100% dos painéis e Stickers Complementares\n${wrap}`, materiais: [M[1]], nota: '** Layout já deﬁnido pelo cliente' },
      { qt: 1, opcao: 3, titulo: 'Avery Dennison®', subtitulo: 'Full Wrap BMW E92', precoUnit: 220000, descricao: `Full Wrap em Viatura Bmw E92\nInclui Cobertura até 100% dos painéis e Stickers Complementares\n${wrap}`, materiais: [M[2]], nota: '** Layout já deﬁnido pelo cliente' }
    ]
  },
  escola: {
    ...base, numero: 'COT-005-OUT/26', data: '2026-10-17', clienteId: 'cliente-b', notas: texto('Projecto'), desconto: 10,
    itens: [
      { qt: 1, titulo: 'Criação de Logotipo Institucional', subtitulo: 'Criação do símbolo e assinatura visual', precoUnit: 10000, descricao: '• Criação do Logotipo;\n• Desenvolvimento e normalização das versões oﬁciais do Logotipo;\n• Criação das versões policromática, monocromática e em escala de cinzentos;\n• Entrega dos ﬁcheiros ﬁnais para utilização digital e impressão.' },
      { qt: 1, titulo: 'Manual de Identidade Visual Institucional', subtitulo: 'Criação e estruturação do sistema de identidade', precoUnit: 50000, descricao: '• Desenvolvimento do Guia Normativo de Identidade Visual Institucional;\n• Estruturação gráﬁca, normativa e operacional da identidade institucional;\n• Criação e normalização da paleta cromática, tipograﬁa e elementos gráﬁcos institucionais;\n• Desenvolvimento de backgrounds, ícones, padrões visuais e aplicações institucionais complementares;\n• Estruturação visual para materiais administrativos, comunicação institucional, viaturas, sinalização, uniformes, autocolantes, dísticos, selos e todos outros elementos necessários (a serem deﬁnidos);\n• Deﬁnição das normas de utilização, coerência visual e aplicações permitidas da identidade institucional;\n• Entrega de ﬁcheiros técnicos, elementos gráﬁcos e materiais institucionais para facilitar futuras produções e aplicações.' },
      { qt: 1, titulo: 'Website e Sistema de Gestão Institucional', subtitulo: 'Presença digital e plataforma integrada', precoUnit: 50000, descricao: '• Website institucional com áreas de informação, notícias, contactos e matrículas;\n• Estrutura preparada para direcção, colaboradores, professores, alunos, encarregados e todos os departamentos integrantes no funcionamento da instituição;\n• Área administrativa, perﬁs de acesso, comunicação escolar e formulários;\n• Desenvolvimento responsivo para computador, tablet e telemóvel.' },
      { qt: 1, titulo: 'Pacote Marketing Inicial', subtitulo: 'Pacote base para divulgação da instituição', precoUnit: 25000, descricao: '• 1 Spot (Vídeo) Publicitário\n• 5 Cartazes grátis para divulgação "urgente"' }
    ]
  },
  mensal: {
    ...base, numero: 'COT-006-OUT/26', data: '2026-10-17', clienteId: 'cliente-b', notas: texto('Padrão'),
    itens: [
      { qt: 1, secao: true, titulo: 'Projecto Gestão Mensal', precoUnit: 0 },
      { qt: 1, titulo: 'Gestão Mensal Website e Sistema', subtitulo: 'Assistência completa', precoUnit: 15000 },
      { qt: 1, titulo: 'Spot Publicitário', subtitulo: '1 Spot por mês', precoUnit: 18000 },
      { qt: 1, titulo: 'Gestão de Redes Sociais', subtitulo: 'Criação e gestão', precoUnit: 4000 },
      { qt: 1, secao: true, titulo: 'Gestão de Marketing', precoUnit: 0 },
      { qt: 1, opcao: 1, titulo: 'Pacote Básico', subtitulo: '5 Cartazes Mensais', precoUnit: 10000, descricao: 'Inclui datas comemorativas do calendário' },
      { qt: 1, opcao: 2, titulo: 'Pacote Essencial', subtitulo: '10 Cartazes Mensais', precoUnit: 15000, descricao: 'Inclui datas comemorativas do calendário' },
      { qt: 1, opcao: 3, titulo: 'Pacote Avançado', subtitulo: '20 Cartazes Mensais', precoUnit: 20000, descricao: 'Inclui datas comemorativas do calendário' }
    ]
  }
}

const CLIENTES = [
  { id: 'cliente-a', nome: 'Cliente Exemplo', cidade: 'Maputo, Moçambique' },
  { id: 'cliente-b', nome: 'Escola Exemplo', cidade: 'Matola, Moçambique' }
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
