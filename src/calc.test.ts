import { describe, expect, it } from 'vitest'
import {
  addDiasUteis,
  contasAPagar,
  faseRequisicao,
  fixasDoMes,
  janelaFixa,
  normalizarEtapa,
  contaParaReceber,
  itensAgenda,
  secaoAgenda,
  prazoAtual,
  numeroDoMes,
  movimentosCaixa,
  saldoCaixa,
  resumoCaixaMes,
  resultadoDoMes,
  vencimentoFixa,
  ivaDoMes,
  proximaEtapa,
  resumoTrabalho,
  comUrgencia,
  totaisCotacao,
  totaisTrabalho,
  totaisRequisicao,
  totaisTrabalho
} from './calc'
import type { Documento, Trabalho } from './db'

const cfg = { taxaIva: 16, urgenciaPct: 45, sinalPct: 50 }

describe('lista de impressão', () => {
  it('reproduces a real print-list sheet (Cliente A) to the metical', () => {
    const t = totaisRequisicao(
      {
        precoImpressaoM2: 1150,
        precoLaminacaoM2: 850,
        comIva: true,
        linhas: [
          { qt: 1, ficheiro: 'P1', largura: 1.3, comprimento: 2.35 },
          { qt: 1, ficheiro: 'P2', largura: 1.3, comprimento: 2.35 },
          { qt: 1, ficheiro: 'P3', largura: 1.2, comprimento: 1.5 },
          { qt: 1, ficheiro: 'P4', largura: 1.25, comprimento: 1.85 }
        ]
      },
      16
    )
    expect(t.m2.toFixed(2)).toBe('10.22')
    expect(t.precoM2).toBe(2000)
    expect(t.subtotal).toBe(20445)
    expect(t.iva).toBe(3271.2)
    expect(t.total).toBe(23716.2)
  })

  it('prices each print with its own material (bundle, ContraVision only, banner)', () => {
    const t = totaisRequisicao(
      {
        precoImpressaoM2: 1150,
        precoLaminacaoM2: 850,
        comIva: true,
        linhas: [
          { qt: 1, ficheiro: 'P1', largura: 1.3, comprimento: 1.6, impressao: 'Vinil de wrap', precoImpressao: 1150, laminacao: 'Laminação de wrap', precoLaminacao: 850 },
          { qt: 1, ficheiro: 'P2', largura: 1.2, comprimento: 0.5, impressao: 'ContraVision', precoImpressao: 1150, laminacao: '', precoLaminacao: 0 },
          { qt: 1, ficheiro: 'P3', largura: 3, comprimento: 1, impressao: 'Banner', precoImpressao: 950, laminacao: '', precoLaminacao: 0 },
          // made before 16 Oct: no material of its own, so the list's 2.000/m²
          { qt: 1, ficheiro: 'P4', largura: 1, comprimento: 1 }
        ]
      },
      16
    )
    expect(t.precoM2).toBe(0) // mixed prices: no single price per m²
    expect(t.subtotal).toBe(4160 + 690 + 2850 + 2000)
    expect(t.iva).toBe(1552)
    expect(t.total).toBe(11252)
  })
})

describe('trabalho', () => {
  it('matches a real quote totals (Cliente B)', () => {
    const t = totaisTrabalho(
      { comIva: true, urgente: false, itens: [{ descricao: 'S14.5', qt: 1, precoUnit: 68000 }, { descricao: 'R33', qt: 1, precoUnit: 65000 }] },
      16,
      45
    )
    expect(t.subtotal).toBe(133000)
    expect(t.iva).toBe(21280)
    expect(t.total).toBe(154280)
  })

  it('adds the 45% taxa de urgência before IVA', () => {
    const t = totaisTrabalho({ comIva: true, urgente: true, itens: [{ descricao: 'Logo', qt: 1, precoUnit: 10000 }] }, 16, 45)
    expect(t.urgencia).toBe(4500)
    expect(t.subtotal).toBe(14500)
    expect(t.total).toBe(16820)
  })

  it('computes debt, deposit, cost and profit', () => {
    const job = {
      id: 'j', itens: [{ descricao: 'x', qt: 1, precoUnit: 100000 }], comIva: true, urgente: false,
      etapa: 'producao', tipo: 'producao', etapas: [], dataEntrada: '2026-10-01', prazo: '2026-10-05'
    } as unknown as Trabalho
    const r = resumoTrabalho(
      job,
      [{ id: 'p', trabalhoId: 'j', valor: 58000 } as any],
      [{ id: 'r', trabalhoId: 'j', linhas: [{ qt: 2, ficheiro: 'a', largura: 1, comprimento: 5 }], precoImpressaoM2: 1150, precoLaminacaoM2: 850, comIva: true } as any],
      [{ id: 'c', trabalhoId: 'j', valor: 5000 } as any],
      cfg,
      '2026-10-10'
    )
    expect(r.total).toBe(116000)
    expect(r.emDivida).toBe(58000)
    expect(r.sinalPago).toBe(true)
    expect(r.custoRequisicoes).toBe(20000)
    expect(r.custoTotal).toBe(25000)
    expect(r.lucro).toBe(75000)
    expect(r.atrasado).toBe(true)
    expect(r.dias).toBe(9)
  })
})

describe('IVA mensal', () => {
  const d = (x: Partial<Documento>) => ({ deleted: false, base: 0, iva: 0, total: 0, ...x }) as Documento
  it('liquidado − dedutível, ignoring recibos and other months', () => {
    const docs = [
      d({ direcao: 'emitido', tipo: 'fatura', data: '2026-10-03', base: 133000, iva: 21280 }),
      d({ direcao: 'emitido', tipo: 'recibo', data: '2026-10-04', base: 0, iva: 21280 }),
      d({ direcao: 'recebido', tipo: 'fatura', data: '2026-10-12', base: 20445, iva: 3271.2 }),
      d({ direcao: 'emitido', tipo: 'nota-credito', data: '2026-10-20', base: 1000, iva: 160 }),
      d({ direcao: 'emitido', tipo: 'fatura', data: '2026-09-30', base: 50000, iva: 8000 })
    ]
    const m = ivaDoMes(docs, '2026-10')
    expect(m.liquidado).toBe(21120)
    expect(m.dedutivel).toBe(3271.2)
    expect(m.apagar).toBe(17848.8)
    expect(m.credito).toBe(0)
    expect(m.ignorados.length).toBe(1)
  })
  it('reports a credit when purchases exceed sales', () => {
    const m = ivaDoMes([d({ direcao: 'recebido', tipo: 'fatura', data: '2026-11-02', iva: 500 })], '2026-11')
    expect(m.apagar).toBe(0)
    expect(m.credito).toBe(500)
  })
})

describe('agenda', () => {
  it('skips weekends for catálogo working days', () => {
    expect(addDiasUteis('2026-10-16', 1)).toBe('2026-10-19') // Fri → Mon
    expect(addDiasUteis('2026-10-14', 5)).toBe('2026-10-21')
  })
  it("follows Momad's phases, each kind skipping what it does not need", () => {
    expect(proximaEtapa({ tipo: 'branding', etapa: 'negociacao' })).toBe('layout')
    expect(proximaEtapa({ tipo: 'branding', etapa: 'producao' })).toBe('montagem')
    expect(proximaEtapa({ tipo: 'criacao', etapa: 'layout' })).toBe('entrega')
    expect(proximaEtapa({ tipo: 'fornecimento', etapa: 'producao' })).toBe('entrega')
    expect(proximaEtapa({ tipo: 'montagem', etapa: 'negociacao' })).toBe('montagem')
    expect(proximaEtapa({ tipo: 'producao', etapa: 'layout' })).toBe('producao') // v1 alias = branding
    expect(proximaEtapa({ tipo: 'montagem', etapa: 'entregue' })).toBe(null)
  })
  it('reads the stage names saved before 16 Oct as the new phases', () => {
    expect(['entrada', 'cotacao', 'aprovacao', 'design', 'acabamento', 'pronto', 'entregue', 'producao'].map(normalizarEtapa))
      .toEqual(['pedido', 'negociacao', 'negociacao', 'layout', 'montagem', 'entrega', 'entregue', 'producao'])
  })
  it('only counts confirmed or delivered work in "a receber"', () => {
    const r = { total: 55680, emDivida: 55680, pago: 0 }
    expect(contaParaReceber({ etapa: 'negociacao' }, r)).toBe(false)
    expect(contaParaReceber({ etapa: 'negociacao', confirmadoEm: '2026-10-15' }, r)).toBe(true)
    expect(contaParaReceber({ etapa: 'producao' }, r)).toBe(true)
    expect(contaParaReceber({ etapa: 'pedido' }, { ...r, pago: 10000, emDivida: 45680 })).toBe(true) // paid something = confirmed
    expect(contaParaReceber({ etapa: 'entregue', cancelado: true }, r)).toBe(false)
  })
  it('puts tasks and phase dates in the agenda', () => {
    const job = (x: any) => ({ id: x.id, codigo: x.id, titulo: x.id, tipo: 'branding', etapas: [], itens: [], prazo: '', ...x }) as any
    const jobs = [
      job({ id: 'a', etapa: 'layout', prazos: { layout: '2026-10-15', producao: '2026-10-20' }, prazo: '2026-10-30' }),
      job({ id: 'b', etapa: 'montagem', montagemDe: '2026-10-15', montagemAte: '2026-10-18' }),
      job({ id: 'c', etapa: 'pedido' }),
      job({ id: 'd', etapa: 'entregue', prazo: '2026-10-01' })
    ]
    const tarefas = [{ id: 'k1', texto: 'Preparar apresentação', por: 'm' }, { id: 'k2', texto: 'Feita', data: '2026-10-16', feitaEm: 'x', por: 'm' }] as any
    const it = itensAgenda(jobs, tarefas)
    expect(it.map((i) => i.id).sort()).toEqual(['a:entrega', 'a:layout', 'a:producao', 'b:montagem', 'c:pedido', 'k1'])
    const sec = (id: string) => secaoAgenda(it.find((i) => i.id === id)!, '2026-10-16')
    expect(sec('a:layout')).toBe('atrasado')
    expect(sec('b:montagem')).toBe('hoje') // 15 → 18: running today
    expect(sec('a:producao')).toBe('semana')
    expect(sec('a:entrega')).toBe('depois')
    expect(sec('k1')).toBe('semData')
    expect(sec('c:pedido')).toBe('semData')
  })
  it("numbers quotes and orders Momad's way, restarting every month", () => {
    expect(numeroDoMes('REQ', [], '2026-10-16')).toBe('REQ-001-OUT/26')
    expect(numeroDoMes('COT', ['COT-001-OUT/26', 'COT-002-OUT/26', 'COT-007-SET/26', 'REQ-009-OUT/26'], '2026-10-20')).toBe('COT-003-OUT/26')
    expect(numeroDoMes('COT', ['COT-003-OUT/26'], '2026-11-02')).toBe('COT-001-NOV/26')
    expect(numeroDoMes('REQ', ['REQ-2026-013'], '2027-01-05')).toBe('REQ-001-JAN/27')
  })
  it('keeps the caixa: his balance, then clients in and purchases / fixed / suppliers out', () => {
    const movs = movimentosCaixa(
      [{ id: 'p', trabalhoId: 'j', data: '2026-10-20', valor: 50000, createdAt: '2026-10-20T10:00:00Z' } as any, { id: 'p0', trabalhoId: 'j', data: '2026-10-01', valor: 9999, createdAt: '2026-10-01T10:00:00Z' } as any],
      [{ id: 'c', data: '2026-10-18', descricao: 'Limpeza', categoria: 'Outros', valor: 1160, iva: 160, createdAt: '2026-10-18T09:00:00Z' } as any, { id: 'f', fixaId: 'x', mes: '2026-10', data: '2026-11-02', descricao: 'Salário', categoria: 'Salários', valor: 8700, iva: 0, createdAt: '2026-11-02T09:00:00Z' } as any],
      [{ id: 'r', numero: 'REQ-001-OUT/26', nomeTrabalho: 'Lista', pagamentos: [{ id: 'x', data: '2026-10-21', valor: 10000, metodo: 'Transferência' }] } as any]
    )
    // he said he had 100.000 on 16 Oct: the 1 Oct payment is already inside that number
    expect(saldoCaixa(movs, { valor: 100000, data: '2026-10-16', em: '2026-10-16T12:00:00Z' })).toBe(100000 + 50000 - 1160 - 8700 - 10000)
    const out = resumoCaixaMes(movs, '2026-10')
    expect([out.entrou, out.compras, out.fixas, out.fornecedores, out.saiu]).toEqual([59999, 1160, 0, 10000, 11160])
    expect(resumoCaixaMes(movs, '2026-11').fixas).toBe(8700) // cash leaves the day it is paid
  })
  it('a job is late when its current phase deadline passed', () => {
    expect(prazoAtual({ etapa: 'layout', prazo: '', prazos: { layout: '2026-10-10' } })).toBe('2026-10-10')
    expect(prazoAtual({ etapa: 'montagem', prazo: '', montagemDe: '2026-10-15', montagemAte: '2026-10-18' })).toBe('2026-10-18')
    expect(prazoAtual({ etapa: 'entrega', prazo: '2026-10-31' })).toBe('2026-10-31')
    expect(prazoAtual({ etapa: 'pedido', prazo: '' })).toBe(undefined)
  })
})

describe('despesas', () => {
  const fixa = (x: any) => ({ id: x.id, nome: x.id, categoria: 'Renda', valor: 1000, dia: x.dia, inicio: x.inicio || '2026-01', ativo: x.ativo ?? true }) as any
  it('clamps the due day to the month length', () => {
    expect(vencimentoFixa({ dia: 31 }, '2026-02')).toBe('2026-02-28')
    expect(vencimentoFixa({ dia: 5 }, '2026-10')).toBe('2026-10-05')
  })
  it('marks fixed expenses paga / atrasada / pendente', () => {
    const fs = [fixa({ id: 'a', dia: 5 }), fixa({ id: 'b', dia: 10 }), fixa({ id: 'c', dia: 30 }), fixa({ id: 'd', dia: 1, inicio: '2026-11' }), fixa({ id: 'e', dia: 1, ativo: false })]
    const ds = [{ id: 'p', fixaId: 'a', mes: '2026-10', data: '2026-10-04', valor: 1000, iva: 0 } as any]
    const r = fixasDoMes(fs, ds, '2026-10', '2026-10-14')
    expect(r.map((x) => `${x.fixa.id}:${x.estado}`)).toEqual(['a:paga', 'b:atrasada', 'c:pendente'])
  })
  it("pays Momad's fixed expenses from the 25th to the 5th of the next month", () => {
    const f = { ...fixa({ id: 'sal', dia: 5, inicio: '2026-10' }), abre: 25 }
    expect(janelaFixa(f, '2026-10')).toEqual({ abre: '2026-10-25', vencimento: '2026-11-05' })
    expect(janelaFixa(f, '2026-12')).toEqual({ abre: '2026-12-25', vencimento: '2027-01-05' })
    const estado = (hoje: string, ds: any[] = []) => fixasDoMes([f], ds, '2026-10', hoje)[0].estado
    expect(estado('2026-10-16')).toBe('pendente')
    expect(estado('2026-10-25')).toBe('a-pagar')
    expect(estado('2026-11-05')).toBe('a-pagar')
    expect(estado('2026-11-06')).toBe('atrasada')
    expect(estado('2026-11-06', [{ id: 'p', fixaId: 'sal', mes: '2026-10', data: '2026-11-02', valor: 1000, iva: 0 }])).toBe('paga')
    // October's salary paid on 2 Nov is an October cost.
    const r = resultadoDoMes('2026-10', [], [], [], [{ data: '2026-11-02', mes: '2026-10', categoria: 'Salários', valor: 8700, iva: 0 } as any], 16)
    expect(r.despesas).toBe(8700)
  })
  it('monthly result = vendas − custos dos trabalhos − despesas (sem IVA)', () => {
    const r = resultadoDoMes(
      '2026-10',
      [{ direcao: 'emitido', tipo: 'fatura', data: '2026-10-03', base: 100000, iva: 16000 } as any, { direcao: 'emitido', tipo: 'recibo', data: '2026-10-05', base: 0 } as any],
      [
        { data: '2026-10-12', estado: 'enviada', linhas: [{ qt: 1, ficheiro: 'x', largura: 1, comprimento: 5 }], precoImpressaoM2: 1150, precoLaminacaoM2: 850, comIva: true } as any,
        // a draft that never went to the supplier is not a cost yet
        { data: '2026-10-14', estado: 'rascunho', linhas: [{ qt: 2, ficheiro: 'y', largura: 1, comprimento: 5 }], precoImpressaoM2: 1150, precoLaminacaoM2: 850, comIva: true } as any
      ],
      [{ data: '2026-10-13', valor: 2500 } as any],
      [{ data: '2026-10-05', categoria: 'Renda', valor: 25000, iva: 0 } as any, { data: '2026-10-15', categoria: 'Internet e telefone', valor: 4640, iva: 640 } as any],
      16
    )
    expect(r.vendas).toBe(100000)
    expect(r.custosTrabalhos).toBe(12500)
    expect(r.despesas).toBe(29000)
    expect(r.resultado).toBe(58500)
    expect(r.porCategoria.get('Internet e telefone')).toBe(4000)
  })
})

describe('ciclo Académica (documentos reais)', () => {
  const wrap = (linhas: [number, number, number][]) => ({
    precoImpressaoM2: 1150, precoLaminacaoM2: 850, comIva: true,
    linhas: linhas.map(([qt, largura, comprimento], i) => ({ qt, ficheiro: `P${i + 1}`, largura, comprimento }))
  })
  it('matches four real Académica pró-formas and a client sheet', () => {
    const pf1 = totaisRequisicao(wrap([[1, 1.2, 2.7], [1, 1.2, 2.2], [1, 1.2, 2], [1, 1.2, 2], [1, 1.2, 1.5], [0, 1.2, 1.5], [0, 1.2, 1.5]]), 16)
    expect(pf1.m2.toFixed(2)).toBe('12.48')
    expect(pf1.total).toBe(28953.6)
    const pf2 = totaisRequisicao(wrap([[1, 1.25, 2.1], [1, 1.25, 2.1], [1, 1.1, 1.8]]), 16)
    expect(pf2.subtotal).toBe(14460)
    expect(pf2.total).toBe(16773.6)
    const pf4 = totaisRequisicao(wrap([[1, 1.2, 1.35], [1, 0.8, 1.5]]), 16)
    expect(pf4.total).toBe(6542.4)
    const folha = totaisRequisicao(wrap([[1, 1.55, 1.9], [1, 1.28, 1.45], [1, 1.55, 2.1]]), 16)
    expect(folha.subtotal).toBe(16112)
    expect(folha.total).toBe(18689.92)
  })
  it('follows list → pró-forma → crédito → paga → fatura → levantada', () => {
    const r: any = { linhas: [], estado: 'rascunho', comIva: true, precoImpressaoM2: 0, precoLaminacaoM2: 0, data: '2026-09-28' }
    expect(faseRequisicao(r)).toBe('rascunho')
    r.enviadaEm = '2026-09-28'
    expect(faseRequisicao(r)).toBe('enviada')
    r.proforma = { numero: '8959/2026', data: '2026-10-01', valor: 16773.6 }
    expect(faseRequisicao(r)).toBe('proforma')
    expect(contasAPagar([r], 16)[0].valor).toBe(16773.6)
    r.pagamento = 'credito'; r.creditoDesde = '2026-10-01'; r.levantadaEm = '2026-10-03'
    expect(faseRequisicao(r)).toBe('credito')
    expect(contasAPagar([r], 16)[0].credito).toBe(true)
    r.pagamento = 'pago'; r.faturaDocId = 'f'
    expect(faseRequisicao(r)).toBe('levantada')
    expect(contasAPagar([r], 16).length).toBe(0)
  })
  it('sums encomendas by unit price', () => {
    const t = totaisRequisicao({ tipo: 'encomenda', itens: [{ descricao: 'Rolo vinil', unidade: 'rolo', qt: 2, precoUnit: 12500 }], linhas: [], precoImpressaoM2: 0, precoLaminacaoM2: 0, comIva: true } as any, 16)
    expect(t.total).toBe(29000)
  })
})

import { mapaCredito, estadoPagamento } from './calc'
describe('mapa de crédito Académica (Excel do Momad)', () => {
  const r = (x: any) => ({ linhas: [], precoImpressaoM2: 0, precoLaminacaoM2: 0, comIva: true, estado: 'enviada', numero: x.n, data: x.d, ...x }) as any
  const reqs = [
    r({ n: 'A', d: '2026-09-15', proforma: { numero: 'Várias', data: '2026-09-15', valor: 37437.7 }, pagamento: 'credito', pagamentos: [{ id: 'p', data: '2026-09-15', valor: 18718.8, metodo: 'Transferência' }], levantadaEm: '2026-09-15' }),
    r({ n: 'B', d: '2026-09-28', proforma: { numero: '8960/2026', data: '2026-10-01', valor: 6542.4 }, pagamento: 'credito' }),
    r({ n: 'C', d: '2026-09-28', proforma: { numero: '8957/2026', data: '2026-10-01', valor: 28953.6 }, pagamento: 'credito' }),
    r({ n: 'D', d: '2026-09-28', proforma: { numero: '8959/2026', data: '2026-10-01', valor: 16773.6 }, pagamento: 'credito' }),
    r({ n: 'E', d: '2026-09-28', proforma: { numero: '8958/2026', data: '2026-10-01', valor: 16773.6 }, pagamento: 'credito' }),
    r({ n: 'F', d: '2026-10-06', tipo: 'encomenda', itens: [{ descricao: 'Traseira', unidade: 'un', qt: 1, precoUnit: 4800 }], pagamento: 'credito' }),
    r({ n: 'G', d: '2026-10-13', tipo: 'encomenda', itens: [{ descricao: 'Acabamentos', unidade: 'un', qt: 1, precoUnit: 2160 }], proforma: { numero: '9034/2026', data: '2026-10-13', valor: 2505.6 }, pagamento: 'credito' })
  ]
  it('reproduces his totals', () => {
    const m = mapaCredito(reqs, 16)
    expect(m.total).toBe(114554.5)
    expect(m.pago).toBe(18718.8)
    expect(m.aberto).toBe(95835.7)
    expect(estadoPagamento(reqs[0])).toBe('Parcial')
    expect(estadoPagamento(reqs[1])).toBe('Pendente')
    expect(m.linhas[0].fase).toBe('credito')
  })
})

describe('cotação (17 Out: sempre com IVA)', () => {
  it('writes the taxa de urgência as a line after the urgent item only (45%)', () => {
    const t = totaisCotacao({ desconto: 10, itens: [{ qt: 1, titulo: 'Branding', precoUnit: 100000, urgente: true }, { qt: 1, titulo: 'Deslocação', precoUnit: 1500, extra: true }] }, 16, 45)
    expect([t.bruto, t.desconto, t.sub, t.iva, t.total]).toEqual([146500, 14650, 131850, 21096, 152946])
    const linhas = comUrgencia([{ qt: 2, titulo: 'Taksim®', subtitulo: 'Full Wrap S15', precoUnit: 160000, urgente: true, opcao: 1 }], 45)
    // 2 cars, urgent: 45% of one car, once (qt 1)
    expect(linhas[1]).toMatchObject({ titulo: 'Taxa de urgência (45%)', subtitulo: 'Full Wrap S15', qt: 1, precoUnit: 72000, opcao: 1, gerada: true })
  })
  it('takes the discount off before IVA (example: 120.000 − 10%)', () => {
    const t = totaisCotacao({ desconto: 10, itens: [{ qt: 1, titulo: 'Range Rover', precoUnit: 65000 }, { qt: 1, titulo: 'BMW X3', precoUnit: 55000 }] }, 16)
    expect([t.bruto, t.desconto, t.sub, t.iva, t.total]).toEqual([120000, 12000, 108000, 17280, 125280])
  })
  it('gives each option its own total, with the items common to all (monthly services quote)', () => {
    const fixo = [{ qt: 1, titulo: 'Website', precoUnit: 15000 }, { qt: 1, titulo: 'Spot', precoUnit: 18000 }, { qt: 1, titulo: 'Redes', precoUnit: 4000 }]
    const t = totaisCotacao({ itens: [{ qt: 1, secao: true, titulo: 'Projecto', precoUnit: 999 }, ...fixo, { qt: 1, opcao: 1, titulo: 'Básico', precoUnit: 10000 }, { qt: 1, opcao: 2, titulo: 'Essencial', precoUnit: 15000 }, { qt: 1, opcao: 3, titulo: 'Avançado', precoUnit: 20000 }] }, 16)
    expect(t.opcoes.map((o) => o.total)).toEqual([54520, 60320, 66120])
    expect(t.total).toBe(54520) // headline value = the cheapest option
  })
  it('sums each option across several cars (6 cars, 2 options each)', () => {
    const carros = [[80000, 135000], [100000, 151000], [105000, 157000], [98000, 141000], [83000, 128000], [98000, 141000]]
    const t = totaisCotacao({ itens: carros.flatMap(([a, b]) => [{ qt: 1, opcao: 1, titulo: 'Taksim', precoUnit: a }, { qt: 1, opcao: 2, titulo: 'Mactac', precoUnit: b }]) }, 16)
    expect(t.opcoes.map((o) => o.sub)).toEqual([564000, 853000])
  })
})
