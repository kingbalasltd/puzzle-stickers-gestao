import { describe, expect, it } from 'vitest'
import { numeroPt } from './leitura'

// The tests that read real supplier PDFs and Excel lists (pró-formas, invoices, print lists) use
// documents that are kept out of the public repository; only the number parsing is tested here.

describe('números', () => {
  it('reads both money formats', () => {
    expect(numeroPt('14 460,00')).toBe(14460)
    expect(numeroPt('1 150,00 MTn')).toBe(1150)
    expect(numeroPt('4,176.00')).toBe(4176)
    expect(numeroPt('68.000,00 MT')).toBe(68000)
    expect(numeroPt('7,23')).toBe(7.23)
  })
})
