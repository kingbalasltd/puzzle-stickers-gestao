# Puzzle Stickers · Gestão

Sistema de gestão da **PUZZLE STICKERS** (Maputo, Moçambique): trabalhos e agenda, cotações no formato da empresa, requisições à Académica, pagamentos, faturas e recibos, despesas, caixa, IVA, gastos pessoais e catálogos.

- **Em produção:** https://puzzle-gestao.apps-mz.workers.dev
- **Desenvolvido por:** KingBalas Ltd

## Documentação

A documentação completa está na pasta [`docs/`](docs/), também num único PDF: [`docs/Documentacao-Puzzle-Gestao.pdf`](docs/Documentacao-Puzzle-Gestao.pdf).

| Capítulo | Para quem |
| --- | --- |
| [1. Visão geral e como usar](docs/01-visao-geral-e-uso.md) | Dono e equipa |
| [2. Regras de negócio, decisões e pedidos em aberto](docs/02-regras-e-pedidos.md) | Dono e quem desenvolve |
| [3. Arquitetura e como continuar o desenvolvimento](docs/03-arquitetura-e-como-continuar.md) | Quem desenvolve |
| [4. Dados, nuvem e segurança](docs/04-dados-e-nuvem.md) | Quem desenvolve |
| [5. Documentos PDF, catálogos e cálculos](docs/05-documentos-e-calculos.md) | Quem desenvolve |

## Começar

Precisa de Node.js 20 ou mais recente.

```bash
npm install
npm run dev:fixed      # abre em http://localhost:5195
npm test               # testes dos cálculos e dos documentos
npm run build          # gera a pasta dist/ (é isto que se publica)
```

Publicação actual (Cloudflare Workers, ficheiros estáticos):

```bash
npx wrangler@4 deploy --assets dist --name puzzle-gestao --compatibility-date 2026-10-01
```

A app guarda os dados no próprio aparelho (IndexedDB) e sincroniza com a nuvem (Supabase, schema `puzzle`). O SQL da nuvem está em [`db/`](db/). Os detalhes, incluindo como alojar noutra conta, estão no capítulo 3 e no capítulo 4.

## O que não está no repositório

- **Dados reais da empresa:** clientes, trabalhos, pagamentos e documentos vivem na nuvem, não no código. A pasta `admin/dados/` (scripts que carregaram os dados iniciais) e `admin/ficheiros/` ficaram de fora por privacidade.
- **Documentos reais de fornecedores e de clientes** usados nos testes de leitura de PDFs. Esses testes não estão no repositório; os testes dos cálculos e dos documentos correm normalmente. Os nomes de clientes nos exemplos foram trocados por nomes genéricos.
- **A fonte Gotham** (fonte comercial, licenciada pela empresa). Para os PDFs saírem iguais aos originais, copie os ficheiros `gotham-*.woff` da empresa para `public/fonts/` (nomes em `src/styles.css`). Sem eles, a app usa outra fonte.
- **Palavras-passe e acessos:** nenhum. A chave em `src/nuvem.ts` é a chave pública do Supabase, feita para estar no navegador. O acesso aos dados depende da palavra-passe da empresa.
- Uma cópia dos dados pode ser descarregada na app em **Definições → Descarregar cópia de segurança**.

## Estrutura

```
src/            código da app (React + TypeScript)
  pages/        ecrãs
  db.ts         modelo de dados (Dexie / IndexedDB)
  calc.ts       cálculos (totais, IVA, caixa, fases)
  nuvem.ts      sincronização com a nuvem
  cotacaoPdf.tsx, requisicaoPdf.tsx, pdfPartilha.tsx   documentos PDF
public/         imagens, fontes, ícones e catálogos
db/             SQL da nuvem (Supabase)
admin/          carregador de dados por linha de comandos
mock/           página de pré-visualização da cotação (só em desenvolvimento)
test/           ficheiros de apoio aos testes
docs/           documentação
```

---

© 2026 KingBalas Ltd. Todos os direitos reservados. Desenvolvido para a PUZZLE STICKERS.
