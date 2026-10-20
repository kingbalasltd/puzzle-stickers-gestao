import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { CSS_REQUISICAO, PaginaRequisicao, totaisLinhas, type LinhaMaterial } from './requisicaoPdf'
import { EMPRESA } from './seed'

// A sample order mixing materials, rendered to test/out/requisicao.html for a visual check.
const W = { impressao: 'Vinil de wrap', precoImpressao: 1150, laminacao: 'Laminação de wrap', precoLaminacao: 850 }
const linhas: LinhaMaterial[] = [
  { qt: 2, ficheiro: 'Exemplo_Camiao_Material_PRINT_1', largura: 1.3, comprimento: 1.6, ...W },
  { qt: 2, ficheiro: 'Exemplo_Camiao_Material_PRINT_2', largura: 1.3, comprimento: 1.7, ...W },
  { qt: 2, ficheiro: 'Exemplo_Camiao_Vidro_Traseiro', largura: 1.2, comprimento: 0.5, impressao: 'ContraVision', precoImpressao: 1150 },
  { qt: 4, ficheiro: 'Exemplo_Camiao_Logotipo_Portas', largura: 0.4, comprimento: 0.4, impressao: 'Vinil transparente premium', precoImpressao: 950, laminacao: 'Laminação transparente premium', precoLaminacao: 450 },
  { qt: 1, ficheiro: 'Exemplo_Faixa_Evento', largura: 3, comprimento: 1, impressao: 'Banner', precoImpressao: 950 }
]

describe('requisição com vários materiais', () => {
  it('prices each line with its own material and sums by material', () => {
    const t = totaisLinhas(linhas, 16)
    expect(t.porMaterial.get('Bundle Wrap')!.valor).toBe(17160) // 8,58 m² × 2.000
    expect(t.porMaterial.get('ContraVision')!.valor).toBe(1380)
    expect(t.porMaterial.get('Vinil transparente premium + Laminação transparente premium')!.valor).toBe(896)
    expect(t.subtotal).toBe(17160 + 1380 + 896 + 2850)
    const html = renderToStaticMarkup(
      <PaginaRequisicao numero="REQ-003-OUT/26" data="2026-10-16" nomeTrabalho="Exemplo_Camiao_Branding_Material" empresa={EMPRESA} linhas={linhas} fornecedor={{ nome: 'Académica Digital', contacto: 'Daanyaal Sidat', telefone: '+258 82 846 9590' } as any} />
    ).replace('src="/img/logo-doc.svg"', 'src="../../public/img/logo-doc.svg"').replace('src="/img/academica.png"', 'src="../../public/img/academica.png"')
    const faces = [['light', 300], ['book', 400], ['medium', 500], ['bold', 700]].map(([f, w]) => `@font-face{font-family:'Gotham PS';src:url('../../public/fonts/gotham-${f}.woff') format('woff');font-weight:${w}}`).join('\n')
    fs.mkdirSync('test/out', { recursive: true })
    fs.writeFileSync('test/out/requisicao.html', `<!doctype html><meta charset="utf-8"><style>${faces}\n@page{size:A4;margin:0}html,body{margin:0}${CSS_REQUISICAO}</style>${html}`)
  })
})
