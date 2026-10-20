import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { PaginaCotacao, paginar, type Medir } from './cotacaoPdf'
import { EMPRESA } from './seed'
import type { Cliente, Cotacao } from './db'

// Renders a sample quote to test/out/cotacao.html so it can be printed with Chrome
// and compared with the company's quote template.
const adv = JSON.parse(fs.readFileSync('test/fixtures/gotham-advances.json', 'utf8')) as Record<string, Record<string, number>>
const medir: Medir = (t, e) => {
  const tab = adv[`${e.peso}${e.italico ? 'i' : ''}`]
  return [...t].reduce((s, ch) => s + (tab[ch] ?? 600), 0) * (e.tam / 1000) + (e.ls || 0) * t.length
}

const BR = (carro: string, layout: string) => `Branding Corporativo em ${carro}\n** Cobertura até 30% dos painéis\nInclui Laterais e Logotipo no “Chapéu”\n** Layout ${layout}`
const exemplo = {
  id: 'r', createdAt: '', updatedAt: '', numero: 'COT-001-JAN/26', data: '2026-01-15', clienteId: 'c', validadeDias: 30, estado: 'enviada', notas: EMPRESA.notaCotacao, notaMaterial: true,
  itens: [
    { qt: 1, titulo: 'Logotipo', subtitulo: 'Vectorização', descricao: 'Vectorização do Logotipo e Melhoria\n** Entregue em formato digital pronto para uso comum e produção', precoUnit: 8000 },
    { qt: 3, titulo: 'Branding em Camião - Taksim Wrap®', subtitulo: 'Camião Modelo A', descricao: BR('Camião Modelo A', 'já definido'), precoUnit: 40000 },
    { qt: 2, titulo: 'Branding em Camião - Taksim Wrap®', subtitulo: 'Camião Modelo B', descricao: BR('Viatura Camião Modelo B', 'já definido'), precoUnit: 38000 },
    { qt: 8, titulo: 'Kit de Identificação - Taksim Wrap®', subtitulo: 'Universal', descricao: 'Kit de Identificação da Compania\nInclui: 3 Números do Camião, 1 Par Proibição á passageiros e 1 Par de Sticker de Contactos\ne Informações da compania.\n** Layout por definir', precoUnit: 2000 }
  ]
} as Cotacao
const cliente = { id: 'c', nome: 'Cliente Exemplo', cidade: 'Maputo, Moçambique' } as Cliente

describe('cotação no modelo da empresa', () => {
  it('lays out a quote like the template (item boxes at 219.4 / 303.5 / 411.1 / 518.2)', () => {
    const paginas = paginar(exemplo, medir)
    expect(paginas.length).toBe(1)
    const ys = paginas[0].map((i) => i.y)
    ;[219.4, 303.5, 411.1, 518.2].forEach((y, i) => expect(Math.abs(ys[i] - y)).toBeLessThan(1.2))
    const svg = renderToStaticMarkup(
      <PaginaCotacao c={exemplo} cliente={cliente} empresa={EMPRESA} itens={paginas[0]} ultima pagina={1} total={1} medir={medir} />
    )
      .replace('href="/img/cotacao-fundo.jpg"', 'href="../../public/img/cotacao-fundo.jpg"')
      .replace('href="/img/logo.svg"', 'href="../../public/img/logo.svg"')
    const faces = [['light', 300, ''], ['light-italic', 300, 'italic'], ['book', 400, ''], ['book-italic', 400, 'italic'], ['medium', 500, ''], ['medium-italic', 500, 'italic'], ['bold', 700, ''], ['bold-italic', 700, 'italic']]
      .map(([f, w, s]) => `@font-face{font-family:'Gotham PS';src:url('../../public/fonts/gotham-${f}.woff') format('woff');font-weight:${w};font-style:${s || 'normal'}}`)
      .join('\n')
    fs.mkdirSync('test/out', { recursive: true })
    fs.writeFileSync('test/out/cotacao.html', `<!doctype html><meta charset="utf-8"><style>${faces}\n@page{size:A4;margin:0}html,body{margin:0}svg{display:block;width:210mm;height:297mm}</style>${svg}`)
  })
})
