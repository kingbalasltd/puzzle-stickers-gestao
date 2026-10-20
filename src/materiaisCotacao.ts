import type { MaterialCotacao } from './db'

// The materials in the company's quotes (17 Oct), written exactly as printed. The user can still type
// one that is not here.
export const MATERIAIS_COTACAO: MaterialCotacao[] = [
  { nome: 'TAKSIM® STX570 + STX571 (60 Microns)', certificado: false, garantia: 'até 2 anos', marca: 'Taksim®' },
  { nome: 'Mactac® JT10700 WG BFG XR + LF10700 UV Series (80 Microns)', certificado: true, garantia: 'até 5 à 7 anos', marca: 'Mactac®' },
  { nome: 'Avery Dennison® MPI 1105 SuperCast Series + DOL1460Z (82 Microns)', certificado: true, garantia: 'até 7 anos', marca: 'Avery Dennison®' },
  { nome: 'Taksim® Economy White Vinyl + Premium Lamination (80 Microns)', certificado: false, garantia: 'acima de 12 meses', marca: 'Vynil Comum' },
  { nome: 'TAKSIM® Premium Bubble Free + Premium Lamination (80 Microns)', certificado: false, garantia: 'acima de 3 anos', marca: 'Premium' },
  { nome: 'Vinyl Holográﬁco Genérico (50 Microns)', certificado: false, garantia: '' },
  { nome: 'Avery Dennison® Supreme™ PPF Xtreme Gloss (165µm)', certificado: true },
  { nome: 'HEXIS® BODYFENCE X', certificado: true },
  { nome: 'HEXIS® HEXLIGHTS2 (70µm)', certificado: true },
  { nome: 'HEXIS® BODYFENCE WINDSHIELD (70µm)', certificado: true }
]

// Last line of an item, as the company writes it.
export const NOTAS_ITEM = ['** Layout ainda por deﬁnir', '** Layout já deﬁnido', '** Layout já deﬁnido pelo cliente', '** Layout já deﬁnido pelo Cliente (Inclui melhoria, ou criação de novo Layout)']

// The closing texts of the company's quotes.
export const TEXTOS_FINAIS: { nome: string; texto: string }[] = [
  { nome: 'Padrão', texto: 'Após a aprovação da cotação, será elaborado um cronograma detalhado com todas as fases do trabalho. Nessa etapa, serão igualmente deﬁnidos os aspetos relativos às condições de pagamento. De forma a assegurar total clareza e alinhamento entre as partes.' },
  { nome: 'Pedir layouts', texto: 'Após a aprovação da cotação, solicitamos o envio dos layouts, a partir dos quais será elaborado um cronograma detalhado com todas as fases do trabalho. Nessa etapa, serão igualmente deﬁnidos os aspetos relativos às condições de pagamento. De forma a assegurar total clareza e alinhamento entre as partes.' },
  { nome: 'Criar layouts', texto: 'Após a aprovação da cotação, solicitamos o envio de dados para a criação e aprovação dos layouts, a partir dos quais será elaborado um cronograma detalhado com todas as fases do trabalho. Nessa etapa, serão igualmente deﬁnidos os aspetos relativos às condições de pagamento. De forma a assegurar total clareza e alinhamento entre as partes.' },
  { nome: 'Agendar viatura', texto: 'Após a aprovação da cotação, será elaborado um cronograma detalhado com as fases de execução dos trabalhos. Nessa etapa, serão igualmente deﬁnidos os aspetos relativos às condições de pagamento e agendamento da viatura, de forma a assegurar total clareza e alinhamento entre as partes.' },
  { nome: 'Projecto', texto: 'A presente cotação foi elaborada com base nas necessidades iniciais apresentadas e contempla os serviços e entregáveis descritos em cada item. O cronograma detalhado de execução será apresentado após a aprovação da proposta, a conﬁrmação das prioridades e a disponibilização atempada das informações e conteúdos necessários. Os valores apresentados poderão ser analisados e ajustados mediante negociação, tendo em conta o âmbito ﬁnal do projecto, as prioridades deﬁnidas e as condições de execução acordadas entre as partes. Qualquer serviço, alteração, produção ou funcionalidade adicional que não esteja expressamente incluído nesta cotação será previamente avaliado e apresentado através de um orçamento complementar. A execução dos trabalhos terá início após a aprovação formal da proposta e o alinhamento das condições de colaboração.' }
]

// Printed work (17 Oct): Full Wrap, Half Wrap (sometimes the whole side) and Branding (the
// set of elements that make up the look), each Artístico / Desportivo (drift crowd) or Corporativo
// (companies). Coverage and the parts included are buttons; the texts are the company's.
const PARTES = ['Frente', 'Traseira', 'Laterais', 'Portas', 'Capom', 'Bumper Frontal', 'Bumper Traseiro', 'Tejadilho', 'Bagageira', 'Guarda-lamas', 'Retrovisores', 'Pilares', 'Spoiler', 'Logotipos', 'Logotipo no "Chapéu"', 'Stickers Complementares']
export const IMPRESSO = {
  tipos: [
    { nome: 'Full Wrap', cobertura: 'Cobertura de 100% dos painéis', partes: ['Laterais', 'Capom', 'Bumper Frontal', 'Bumper Traseiro', 'Tejadilho', 'Bagageira', 'Stickers Complementares'] },
    { nome: 'Half Wrap', cobertura: 'Cobertura de toda a lateral', partes: ['Laterais', 'Stickers Complementares'] },
    { nome: 'Branding', cobertura: 'Cobertura até 30% dos painéis', partes: ['Laterais', 'Logotipos'] }
  ],
  coberturas: ['Cobertura de 100% dos painéis', 'Cobertura de toda a lateral', ...[30, 40, 50, 55, 60, 75, 85, 100].map((p) => `Cobertura até ${p}% dos painéis`)],
  partes: PARTES,
  estilos: ['Artístico', 'Desportivo', 'Corporativo'],
  impressao: 'Impresso em vynil  com aplicação do respectivo protector material 100% dedicado a wrap.'
}

// "Inclui Laterais, Capom, Bumper Frontal e Traseiro, Tejadilho, Bagageira e Stickers Complementares":
// the company's order, both bumpers in one, the stickers always last.
export function frasePartes(sel: string[]) {
  let xs = [...PARTES.filter((p) => sel.includes(p)), ...sel.filter((p) => !PARTES.includes(p))]
  if (xs.includes('Stickers Complementares')) xs = [...xs.filter((p) => p !== 'Stickers Complementares'), 'Stickers Complementares']
  const f = xs.indexOf('Bumper Frontal')
  const t = xs.indexOf('Bumper Traseiro')
  if (f >= 0 && t >= 0) {
    xs[f] = 'Bumper Frontal e Traseiro'
    xs.splice(t, 1)
  }
  if (!xs.length) return ''
  return `Inclui ${xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`}`
}

// Travel fee (17 Oct), by the one-way distance to the client.
export const DESLOCACAO = [
  { ida: 'Até 20 km', total: 'até 40 km', preco: 1500 },
  { ida: '21–35 km', total: '42–70 km', preco: 2500 },
  { ida: '36–50 km', total: '72–100 km', preco: 3500 }
]
