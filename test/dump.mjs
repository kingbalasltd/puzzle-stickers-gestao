// Dev helper: print pdf.js text items of a PDF (to write/verify the parsers).
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs'

for (const f of process.argv.slice(2)) {
  const data = new Uint8Array(fs.readFileSync(f))
  const doc = await getDocument({ data }).promise
  const p = await doc.getPage(1)
  const tc = await p.getTextContent()
  console.log('=====', f, doc.numPages)
  console.log(JSON.stringify(tc.items.map((i) => i.str + (i.hasEOL ? '⏎' : ''))))
}
