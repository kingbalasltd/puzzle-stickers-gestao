const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

// "Beira – Sofala, Moçambique" ↔ cidade + país (the last comma splits them).
export const separarMorada = (m?: string) => {
  const s = (m || '').trim()
  const i = s.lastIndexOf(',')
  return i < 0 ? { cidade: s, pais: '' } : { cidade: s.slice(0, i).trim(), pais: s.slice(i + 1).trim() }
}
export const juntarMorada = (cidade: string, pais: string) => [cidade.trim(), pais.trim()].filter(Boolean).join(', ')

// The company's documents write 56.000,00 MT (dot thousands, comma decimals).
export const mt = (n: number) => `${nf2.format(n || 0)} MT`
export const mtCurto = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${nf2.format(n / 1_000_000).replace(/,00$/, '')} M MT`
  if (a >= 10_000) return `${nf0.format(Math.round(n / 1000))} mil MT`
  return `${nf0.format(n)} MT`
}
export const num2 = (n: number) => nf2.format(n || 0)
export const pct = (n: number) => `${Math.round(n * 100)}%`

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const DIAS3 = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const d = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00')

export const dataLonga = (iso: string) => {
  const x = d(iso)
  return `${DIAS[x.getDay()]}, ${x.getDate()} de ${MESES[x.getMonth()]} de ${x.getFullYear()}`
}
export const dataDoc = (iso: string) => {
  const x = d(iso)
  return `${x.getDate()} de ${MESES[x.getMonth()][0].toUpperCase() + MESES[x.getMonth()].slice(1)} de ${x.getFullYear()}`
}
export const dataCurta = (iso: string) => {
  if (!iso) return '—'
  const x = d(iso)
  return `${x.getDate()} ${MES3[x.getMonth()]}`
}
export const dataMedia = (iso: string) => {
  if (!iso) return '—'
  const x = d(iso)
  return `${x.getDate()} ${MES3[x.getMonth()]} ${x.getFullYear()}`
}
export const diaSemana3 = (iso: string) => DIAS3[d(iso).getDay()]
export const mesNome = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return `${MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)} ${y}`
}
export const mes3 = (ym: string) => MES3[Number(ym.split('-')[1]) - 1]
export const horaCurta = (iso: string) => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
export const quando = (iso: string) => `${dataMedia(iso)}, ${horaCurta(iso)}`

export const tamanho = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`)

export const iniciais = (nome: string) =>
  nome
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')

export const parseNum = (s: string) => {
  const t = String(s).trim().replace(/\s/g, '')
  if (!t) return 0
  // Accept "1.150,00", "1150,5" and "1150.5".
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(norm)
  return Number.isFinite(n) ? n : 0
}

export const waLink = (tel?: string, texto?: string) => {
  if (!tel) return ''
  let n = tel.replace(/\D/g, '')
  if (n.length === 9) n = '258' + n
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}
