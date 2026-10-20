import { describe, expect, it } from 'vitest'
import { numeroPt } from './leitura'

// The tests that read real supplier PDFs and Excel lists (pró-formas, invoices, print lists) use
// documents that are kept out of the public repository; only the number parsing is tested here.

describe('números', () => {
  it('reads both money formats', () => {
    expect(numeroPt('12 345,00')).toBe(12345)
    expect(numeroPt('1 234,00 MTn')).toBe(1234)
    expect(numeroPt('4,321.00')).toBe(4321)
    expect(numeroPt('56.000,00 MT')).toBe(56000)
    expect(numeroPt('7,23')).toBe(7.23)
  })
})
