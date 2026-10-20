# Arquitetura e como continuar o desenvolvimento

Documento técnico do sistema **Puzzle Stickers · Gestão**, preparado pela KingBalas Ltd em outubro de 2026. É para o Momad e para quem continuar o desenvolvimento. Os caminhos de ficheiros são relativos à raiz do repositório.

## Visão geral

- É uma aplicação web instalável (PWA) de página única, feita em React + TypeScript e construída com Vite.
- Funciona sem internet. Todos os registos vivem no próprio aparelho, numa base IndexedDB chamada `puzzle-gestao` (biblioteca Dexie).
- Há uma cópia da empresa na nuvem (Supabase). Cada aparelho envia e recebe registos dessa cópia, e a última escrita ganha.
- Os documentos que a app produz (cotação, requisição de prints, relação do IVA, Mapa de crédito em Excel) são gerados no próprio aparelho.
- Os ficheiros carregados (fotos, PDFs, logótipos) ficam só no aparelho onde foram carregados.
- Não há servidor próprio. A app é um conjunto de ficheiros estáticos (`dist/`), e a nuvem só expõe cinco funções SQL.

```
 Ecrãs (src/pages) ──lêem──> useDados()  (src/state.tsx)
        │                         ▲  useLiveQuery
        │                         │
        └──gravam──> novo / guardar / apagar (src/db.ts), src/acoes.ts
                                  │
                         IndexedDB "puzzle-gestao" (Dexie)
                                  │  hooks marcam _loc (src/nuvem.ts)
                                  ▼
                 sincronizar():  enviar ──> puzzle_enviar
                                 puxar  <── puzzle_puxar
                                  │
                 Supabase · esquema privado "puzzle" (db/*.sql)
```

## Stack e dependências

Versões tal como estão em `package-lock.json`:

| Pacote | Versão | Para que serve |
|---|---|---|
| `react`, `react-dom` | 18.3.1 | Interface |
| `dexie` | 4.0.11 | Base de dados IndexedDB no aparelho |
| `dexie-react-hooks` | 1.1.7 | `useLiveQuery`: os ecrãs atualizam-se quando a base muda |
| `jspdf` + `html2canvas` | 2.5.2 + 1.4.1 | PDF real da requisição, gerado no aparelho |
| `pdfjs-dist` | 4.10.38 | Visualizador de PDFs, miniaturas e leitura do texto de PDFs |
| `xlsx` (SheetJS) | 0.20.3 | Ler listas de impressão em Excel (`src/leitura.ts`) e exportar o Mapa de crédito |
| `@fontsource/montserrat` | 5.1.1 | Fonte da interface, incluída no build |
| `vite` (dev) | 5.4.11 | Servidor de desenvolvimento e build |
| `@vitejs/plugin-react` (dev) | 4.3.4 | Suporte React no Vite |
| `vite-plugin-pwa` (dev) | 0.21.1 | Service worker (Workbox) e manifesto |
| `typescript` (dev) | 5.6.3 | Verificação de tipos (modo `strict`, `noUnusedLocals`) |
| `vitest` (dev) | 2.1.8 | Testes. Traz também o `vite-node`, que o carregador `admin/carregar.ts` usa |
| `fake-indexeddb` (dev) | 6.0.0 | IndexedDB em Node, para o carregador de dados |

Notas:
- O `xlsx` não vem do registo npm. Instala-se a partir de `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, por isso o `npm install` precisa de acesso a esse endereço.
- `jspdf`, `html2canvas`, `pdfjs-dist` e `xlsx` só são carregados quando são precisos (`import()` dinâmico). Não pesam no arranque.
- O projeto não usa biblioteca de rotas, framework de CSS nem gestor de estado. As rotas são por hash (`src/state.tsx`), o estilo é um único `src/styles.css` e o estado vem de contextos React.
- O Wrangler (publicação) não está no `package.json`: é chamado com `npx wrangler@4`.

Scripts (`package.json`):

| Comando | Faz |
|---|---|
| `npm run dev` | `vite --port 5195 --host`: servidor de desenvolvimento, também visível na rede local |
| `npm run dev:fixed` | `vite --port 5195 --strictPort`: sempre na porta 5195, e falha se ela estiver ocupada |
| `npm run build` | `tsc --noEmit && vite build`: verifica os tipos e gera `dist/` |
| `npm run preview` | `vite preview --port 5196`: serve `dist/` localmente |
| `npm test` | `vitest run`: corre todos os testes uma vez |

## Estrutura de pastas

```
.
├─ index.html          página única: #root (app) e #print-root (impressão)
├─ vite.config.ts      Vite + React + PWA; carimbo de versão; versao.json; ambiente dos testes
├─ tsconfig.json       TypeScript strict; verifica só src/ (sem os testes)
├─ package.json, package-lock.json
├─ README.md, .gitignore
├─ docs/               esta documentação
├─ db/                 SQL da nuvem: 001_puzzle_nuvem.sql, 002_puzzle_tarefas.sql
├─ admin/carregar.ts   carrega lotes de dados reais para a nuvem (corre em Node)
├─ mock/               pré-visualização do formulário de cotação (só em desenvolvimento)
├─ public/             servido tal como está
│  ├─ img/             logótipos, ícones, arte de fundo da cotação
│  ├─ fonts/           vazia no repositório: aqui entram os 8 gotham-*.woff da empresa
│  └─ catalogos/       3 catálogos em PDF + capas .jpg
├─ src/                código da app
│  └─ pages/           ecrãs
└─ test/               dump.mjs (ajuda) e fixtures/gotham-advances.json
```

O que **não** está no repositório (ver `.gitignore`):
- `admin/dados/`: scripts com os dados reais da empresa.
- `admin/ficheiros/`: documentos reais.
- `test/fixtures/*.pdf` e `test/fixtures/*.xlsx`: documentos reais da Académica Digital, retirados por privacidade. Os testes que os liam também ficaram de fora.
- `public/fonts/gotham-*`: a fonte Gotham é comercial (licença da empresa). Para os documentos saírem iguais aos originais, copie os 8 ficheiros `gotham-*.woff` da empresa para `public/fonts/`. Os nomes estão nos `@font-face` de `src/styles.css`.
- Pastas e ficheiros gerados ou locais: `node_modules/`, `dist/`, `test/out/`, `.wrangler/`, `*.log`, `.env*`.

Os dados reais vivem na nuvem, não no código. Os exemplos do `mock/` e dos testes usam nomes genéricos.

### Ficheiros principais de `src/`

| Ficheiro | Papel | Exportações principais |
|---|---|---|
| `main.tsx` | Arranque: importa o CSS, regista o service worker, instala os hooks da nuvem, corre o seed num aparelho que já tem dados, inicia a sincronização e monta `<App/>` em `StrictMode` | — |
| `App.tsx` | Portas de entrada (`Ligar`, `Login`), concha da app (`Shell`: menu, separadores, rotas), `Page` (cabeçalho comum), aviso de versão nova, dica de instalação e estado da nuvem | `App`, `Page`, `PAPEL_NOME`, `textoNuvem` |
| `state.tsx` | Rotas por hash, sessão e permissões, todos os dados em memória, códigos sequenciais, estado online, tema | `useRota`, `ir`, `useSessao`, `SessaoProvider`, `useDados`, `DadosProvider`, `proximoCodigo`, `useOnline`, `useTema` |
| `db.ts` | Modelo de dados (interfaces), base Dexie (versões 1 a 5) e funções de gravação | `db`, `uid`, `agora`, `novo`, `guardar`, `apagar`, `vivos`, `registar`, `guardarFicheiro` |
| `nuvem.ts` | Sincronização com a nuvem, sessão da empresa e modo local de desenvolvimento | `TABELAS`, `devLocal`, `instalarHooks`, `sincronizar`, `agendar`, `iniciarSincronizacao`, `entrar`, `desligar`, `terminarSessao`, `mudarSenha`, `useNuvem`, `estadoNuvem` |
| `seed.ts` | Dados iniciais (empresa, catálogo Criação de Imagem 2026, utilizador dono) e correções que correm em cada arranque | `EMPRESA`, `CATALOGO`, `semear`, `apagarExemplos`, `repor` |
| `calc.ts` | Regras de negócio puras, sem React: fases e tipos, totais, IVA, despesas, ciclo do fornecedor, agenda, numeração e caixa | `ETAPAS`, `TIPOS`, `normalizarEtapa`, `resumoTrabalho`, `totaisRequisicao`, `totaisCotacao`, `comUrgencia`, `ivaDoMes`, `resultadoDoMes`, `faseRequisicao`, `mapaCredito`, `itensAgenda`, `numeroDoMes`, `movimentosCaixa`, `saldoCaixa` |
| `acoes.ts` | Ações partilhadas que gravam | `moverEtapa`, `novaTarefa`, `marcarTarefa`, `adicionarNota` |
| `format.ts` | Formatos em português (valores em MT, datas), leitura de números, ligação de WhatsApp, cidade/país | `mt`, `mtCurto`, `dataLonga`, `dataDoc`, `parseNum`, `waLink`, `separarMorada`, `juntarMorada` |
| `ui.tsx` | Componentes de base | `Icon`, `Logo`, `Modal`, `Confirm`, `Field`, `Avatar`, `Empty`, `Seg`, `ToastHost`/`useToast`, `UploadZone`, `Thumb`, `useFicheiro`, `abrirFicheiro`, `useMenu`, `useVer` |
| `Visualizador.tsx` | Visualizador de ficheiros dentro da app (desenha os PDFs página a página com pdf.js) e miniaturas | `VisualizadorHost`, `Miniatura` |
| `leitura.ts` | Leitura automática de PDFs com texto (pró-forma, fatura e recibo da Académica; listas de impressão) e de listas em Excel | `lerFicheiro`, `lerAcademica`, `lerListaPdf`, `lerListaGrelha`, `lerListaExcel`, `textoPdf`, `carregarPdfjs`, `numeroPt` |
| `print.tsx` | Documentos pelo diálogo de impressão (`#print-root` + `window.print`) e CSV do IVA | `imprimirCotacao`, `imprimirIva`, `exportarIvaExcel`, `imprimirLista` (que chama `emitirRequisicao`) |
| `pdfPartilha.tsx` | PDF real gerado no aparelho (html2canvas + jsPDF) e janela "PDF pronto" (Partilhar, Descarregar, abrir o WhatsApp, Ver) | `renderizarPdf`, `PdfHost`, `emitirRequisicao` |
| `cotacaoPdf.tsx` | Página A4 da cotação em SVG (em pontos de PDF), igual ao original do Momad, com páginas por opção | `PaginaCotacao`, `paginar`, `paginasCotacao`, `blocoTotais`, `medirCanvas`, `carregarFontes`, `logoDoCliente` |
| `requisicaoPdf.tsx` | Documento "Requisição de prints" em HTML A4 e o preçário da Académica 2026 | `PaginaRequisicao`, `CSS_REQUISICAO`, `PRECARIO_ACADEMICA_2026`, `nomeOficial`, `nomeMaterial`, `totaisLinhas`, `linhasComMaterial` |
| `materiaisCotacao.ts` | Materiais, notas, textos finais, gerador de trabalho impresso e tabela de deslocação da cotação | `MATERIAIS_COTACAO`, `NOTAS_ITEM`, `TEXTOS_FINAIS`, `IMPRESSO`, `frasePartes`, `DESLOCACAO` |
| `versao.ts` | Versão do build e atualização forçada | `VERSAO`, `versaoCurta`, `versaoNoServidor`, `atualizarApp` |
| `styles.css` | Todo o estilo da interface, mais os `@font-face` da Gotham | — |
| `*.test.ts`, `*.test.tsx` | Testes (ver "Testes") | — |

### Ecrãs em `src/pages/`

| Ficheiro | Onde aparece | Papel |
|---|---|---|
| `Painel.tsx` | `#/painel` (Início) | Hoje, Próximos 7 dias e Sem data; contadores Pedidos, Em negociação, Em curso e Para entregar; botões rápidos (Novo pedido, Cotação, Fatura, Recibo, Compra); "O que precisa de atenção" (alertas); faixa Caixa |
| `Trabalhos.tsx` | `#/trabalhos` | Quadro por fase (com arrastar) ou lista; pesquisa; filtros por tipo, responsável, atrasados e sem valor |
| `Trabalho.tsx` | `#/trabalhos/:id` | Ficha do trabalho com os separadores Detalhes, Requisições, Pagamentos, Faturas e recibos, Notas e histórico. Inclui `PagamentoForm` e `CustoForm` |
| `TrabalhoForm.tsx` | janela | Criar ou editar um trabalho (tipo, cliente, partes) |
| `Partes.tsx` | formulários | Editor das partes do trabalho. Em criação de imagem as partes vêm só do catálogo (`soCatalogo`) |
| `Fases.tsx` | ficha do trabalho | `FasesTrabalho`: fase atual, botão para avançar, prazos por fase, janela de entrega (`EntregaModal`) |
| `comum.tsx` | vários | `EtapaBadge`, `PrazoBadge`, `JobCard`, `ProgressoPago`, métodos de pagamento |
| `Agenda.tsx` | `#/agenda` | Tarefas e datas das fases (Atrasado, Hoje, Próximos 7 dias, Mais tarde, Sem data) e vista do mês. Inclui `NovaTarefa` e `TarefasDoTrabalho` |
| `Relatorios.tsx` | `#/relatorios` | Relatórios diários da equipa |
| `Rapido.tsx` | botões do Início e botão "+" | `NovoPedido`, `EmitirFatura` (regista a fatura do livro do Momad e liga-a a um ou mais trabalhos), `EmitirRecibo` |
| `Cotacoes.tsx` | `#/cotacoes`, `#/cotacoes/:id` | Lista e editor; `novaCotacao`; aceitar a cotação e convertê-la em trabalho(s) |
| `cotacaoFormulario.tsx` | editor de cotação e `mock/` | `EditorCotacao` (linhas, gerador Wrap / Branding, catálogo, deslocação, urgência, desconto) e `PreviewCotacao` |
| `Catalogos.tsx` | `#/catalogos` | Catálogos em PDF: Partilhar PDF, Enviar link, Ver, Copiar link |
| `Clientes.tsx` | `#/clientes`, `#/clientes/:id` | Lista, ficha, `ClienteForm`, `LogoCliente` |
| `Fornecedores.tsx` | `#/fornecedores`, `#/fornecedores/:id` | Lista e ficha com o catálogo de materiais e as requisições; `FornecedorForm` |
| `Requisicoes.tsx` | `#/requisicoes`, `#/requisicoes/:id` | Lista por mês com contagem por fase; abre a requisição `:id` |
| `RequisicaoForm.tsx` | janela | Lista de impressão ou encomenda, e o Circuito de 5 passos: Lista enviada, Pró-forma, Pagamento ao fornecedor, Fatura e recibo do fornecedor, Impressão levantada ("Recebida / levantada" numa encomenda) |
| `ContasPagar.tsx` | `#/contas-pagar` (Mapa de crédito) | Mapa de crédito aos fornecedores, pagamentos parciais, exportação para Excel no formato da folha do Momad |
| `Resumo.tsx` | `#/resumo` | Caixa: entrou, saiu, saldo, "Acertar caixa" (`CaixaModal`), últimos 6 meses |
| `Dividas.tsx` | `#/dividas` (Recebimentos) | Ecrã "Pagamentos e dívidas": quem deve e pagamentos recebidos |
| `Despesas.tsx` | `#/despesas` | Despesas fixas (com janela de pagamento), compras e resultado do mês; `DespesaForm` |
| `Pessoal.tsx` | `#/pessoal` | Gastos pessoais pagos com dinheiro da empresa (Repor ou Autorizar) |
| `Documentos.tsx` | `#/documentos` (Faturas e recibos) | Arquivo de documentos emitidos e recebidos; `DocumentoForm`, `DocLinha` |
| `Iva.tsx` | `#/iva` | Relação mensal do IVA: botão "PDF" (impressão) e botão "Excel" (CSV) |
| `Catalogo.tsx` | `#/catalogo` | Catálogo de serviços (Criação de Imagem 2026) |
| `Equipa.tsx` | `#/equipa` | "Equipa e acessos": utilizadores, papéis e PINs |
| `Definicoes.tsx` | `#/definicoes` | Dados da empresa, regras do negócio, cópia de segurança, "Recomeçar este aparelho" e o cartão Nuvem |
| `Importar.tsx` | nenhum | Importação em massa de listas e documentos da Académica. **Não está ligado a nenhum ecrã** (ver armadilhas) |

### Recursos em `public/`

| Ficheiro | Uso |
|---|---|
| `img/logo.svg` | Logótipo da interface, da cotação e da relação do IVA. Só tem `viewBox` e usa a cor `currentColor`. A interface aplica-lhe o filtro `--logo-filter`, que no tema escuro o inverte |
| `img/logo-doc.svg` | O mesmo logótipo com `width`/`height` e cor fixa (#111111), para documentos que passam pelo html2canvas (requisição) |
| `img/academica.png` | Logótipo do fornecedor na requisição, só quando o fornecedor é a Académica (`logoFornecedor` em `requisicaoPdf.tsx`). Nos outros casos aparece o nome |
| `img/cotacao-fundo.jpg`, `img/cotacao-fundo-livre.jpg`, `img/cotacao-barra-total.jpg` | Arte de fundo da cotação |
| `img/icon-192.png`, `img/icon-512.png`, `img/icon-maskable-512.png`, `img/apple-touch-icon.png`, `img/favicon.png` | Ícones do manifesto e do `index.html` |
| `img/cot-pattern.jpg`, `img/mark.png` | O código não os usa |
| `fonts/gotham-*.woff` | Gotham em 8 estilos (light, book, medium e bold, normal e itálico), só para os documentos. **Não estão no repositório**: copiar os ficheiros da empresa |
| `catalogos/*.pdf` e `catalogos/*.jpg` | 3 catálogos e as capas, para o ecrã Catálogos. A lista está em `CATALOGOS`, em `src/pages/Catalogos.tsx` |

## Modelo de dados e nuvem (resumo)

Mais detalhe no capítulo 4 (Dados, nuvem e segurança).

### Registos no aparelho (`src/db.ts`)

- Os registos das tabelas de negócio herdam `Base`: `id`, `createdAt`, `updatedAt`, `deleted?` e `demo?`. As exceções são `Empresa` (só tem `updatedAt`), `Registo` (usa `em`), `Ficheiro` e `Nuvem`.
- Para criar usa-se `novo()`, para gravar `guardar()` (que atualiza `updatedAt`) e para apagar `apagar()`. Apagar marca `deleted: true` e nunca remove o registo.
- `guardarFicheiro()` guarda um ficheiro em `ficheiros`. Uma imagem com mais de 2000 px, ou com 900 KB ou mais, é comprimida para JPEG com no máximo 2000 px.

| Tabela | Desde a versão Dexie | Vai para a nuvem | Conteúdo |
|---|---|---|---|
| `empresa` | 1 | sim | Registo único `'empresa'`: dados da empresa, IVA, sinal, urgência, validade e nota das cotações, `seedVersao`, `caixa` |
| `utilizadores` | 1 | sim | Pessoas, papel, PIN, ativo |
| `clientes` | 1 | sim | Clientes. `logoId` aponta para `ficheiros` |
| `fornecedores` | 1 | sim | Fornecedores e o seu catálogo (`materiais`) |
| `servicos` | 1 | sim | Catálogo Criação de Imagem 2026, com ids fixos `srv-…` |
| `trabalhos` | 1 | sim | Tipo, partes (`itens`), fase, prazos, notas, ficheiros |
| `pagamentos` | 1 | sim | Pagamentos dos clientes (`reciboId` quando já têm documento) |
| `requisicoes` | 1 | sim | Listas de impressão e encomendas, e o ciclo do fornecedor |
| `custos` | 1 | sim | Outros custos de um trabalho |
| `documentos` | 1 | sim | Faturas, faturas-recibo, recibos, vendas a dinheiro e notas de crédito, emitidos e recebidos. É a base do IVA |
| `cotacoes` | 1 | sim | Cotações |
| `ficheiros` | 1 | **não** | O conteúdo dos ficheiros (fotos, PDFs, logótipos) |
| `registos` | 1 | sim | Histórico de ações, escrito por `registar()` |
| `despesasFixas` | 2 | sim | Custos fixos mensais |
| `despesas` | 2 | sim | Compras, despesas e gastos pessoais |
| `relatorios` | 3 | sim | Relatórios diários |
| `meta` | 4 | **não** | Registo `'nuvem'`: sessão do aparelho e cursores de sincronização |
| `tarefas` | 5 | sim | Tarefas da agenda |

### Sincronização (`src/nuvem.ts`)

- **O que sincroniza:** as 16 tabelas em `TABELAS`. Ficam de fora `ficheiros` e `meta`.
- **Carimbo local:** `instalarHooks()` liga os hooks Dexie `creating` e `updating` em todas as `TABELAS`.
  - Cada escrita local recebe `_loc`, e uma atualização recebe também um `updatedAt` novo.
  - Cada escrita agenda uma sincronização para 1,5 s depois.
  - O que chega da nuvem é gravado numa transação marcada `__remoto`, por isso não volta a subir.
  - Não há hook de remoção: um `delete()` físico não chega aos outros aparelhos.
- **Versão de um registo:** `updatedAt` (ou, se faltar, `em` ou `createdAt`). Ganha a versão mais recente, no servidor e no aparelho (`aplicar`).
- **Ciclo `sincronizar()`:**
  1. Envia, em lotes de 200, tudo o que tem `_loc` igual ou posterior a `marca` (o primeiro envio de um aparelho manda tudo).
  2. Puxa por `seq`, a partir de `cursor − 100`, em páginas de 500 (até 100 páginas por ciclo).
  3. Grava `meta.nuvem`.
- **Quando corre:** ao arrancar, a cada 30 s, quando a rede volta, quando a app volta ao primeiro plano e 1,5 s depois de uma escrita. Corre uma vez de cada vez; um pedido que chega a meio fica para logo a seguir.
- **`ESQUEMA`** (hoje `2`): quando um aparelho tem um número menor, o cursor volta a 0 e ele puxa tudo outra vez.
- **Estado visível:** `useNuvem()` e `textoNuvem()` (`App.tsx`). Os textos são "A sincronizar…", "Na nuvem · hh:mm", "Sem internet · guardado no aparelho", "Erro ao sincronizar · toque para tentar" e "Não ligado à nuvem".
  - No computador aparecem no fundo do menu lateral, e tocar no texto sincroniza.
  - No telemóvel o menu lateral não aparece: o estado e o botão "Sincronizar agora" estão em Definições → Nuvem.
- **Servidor** (`db/001_puzzle_nuvem.sql`, `db/002_puzzle_tarefas.sql`):
  - Esquema privado `puzzle` com as tabelas `empresas`, `sessoes` e `docs`. O RLS está ativo e não há acesso direto.
  - Cada registo é uma linha JSON em `puzzle.docs`, com `empresa_id`, `tabela`, `id`, `dados`, `versao`, `seq` e `servidor_em`.
  - Cinco funções públicas `security definer`: `puzzle_entrar`, `puzzle_puxar`, `puzzle_enviar`, `puzzle_mudar_senha` e `puzzle_sair`. A função privada `puzzle.empresa_do_token` valida o token.
  - A palavra-passe da empresa é guardada com bcrypt. 5 tentativas erradas bloqueiam a entrada durante 10 minutos.
  - O token de sessão é aleatório e o servidor só guarda o hash SHA-256.
  - Mudar a palavra-passe termina as sessões dos outros aparelhos, e a nova tem de ter pelo menos 8 caracteres.
  - `puzzle_enviar` aceita no máximo 500 registos por pedido, só das tabelas da sua lista `tabs`, e ignora registos com mais de 300 000 caracteres. Só substitui um registo quando a versão recebida é mais recente.

## Estado global (`src/state.tsx`)

### `useDados()`: todos os dados em memória

- `DadosProvider` lê de uma vez, com um único `useLiveQuery`, as 15 tabelas de dados (todas menos `ficheiros`, `registos` e `meta`). Qualquer escrita numa delas volta a desenhar os ecrãs. A ideia é que uma gráfica tem centenas de registos, não milhões.
- Os registos apagados são filtrados com `vivos()`.
- Ordenações:

| Tabela | Ordem |
|---|---|
| `trabalhos` | código, decrescente |
| `cotacoes` | número (texto), decrescente |
| `requisicoes`, `documentos`, `despesas`, `relatorios` | data, decrescente |
| `clientes`, `fornecedores` | nome |
| `servicos` | `ordem` (a ordem do PDF do catálogo) |
| `despesasFixas` | dia |
| `tarefas` | data; as que não têm data vão para o fim |

- `resumo(t)` devolve `resumoTrabalho()` de `calc.ts` (totais, pago, em dívida, sinal, custos, lucro, atraso), em cache por `id + updatedAt`.
- Para buscar por id: `cliente(id)`, `user(id)` e `fornecedor(id)`.
- `pronto` fica `false` até à primeira leitura, e a `Shell` não desenha nada até lá. Se não houver registo `empresa`, usa-se `EMPRESA` de `seed.ts`.
- **Nomes antigos das fases** (anteriores a 16 de outubro de 2026) são traduzidos na leitura por `normalizarEtapa()` (`calc.ts`, mapa `ANTIGAS`). A leitura não reescreve os registos, por isso os dados crus na nuvem podem ter nomes antigos.

### `useSessao()`: utilizador e permissões

- Dá `user` (o `Utilizador` com sessão aberta), `sair()` e `pode(acao)`.
- As permissões estão em `PERM`:

| Ação | Dono | Gerente | Trabalhador |
|---|---|---|---|
| `financas` | sim | sim | — |
| `todosTrabalhos` | sim | sim | — |
| `editarTrabalho` | sim | sim | — |
| `iva`, `despesas`, `equipa`, `definicoes`, `apagar` | sim | — | — |

- Um trabalhador só vê os trabalhos de que é responsável (`responsavelId`). Pode mover a fase dos seus trabalhos (`Fases.tsx`), mas não vê valores.
- As permissões só filtram a **interface**. Os dados no aparelho são sempre todos (ver armadilhas).

### Rotas por hash

- `useRota()` lê `location.hash` (por defeito `/painel`) e devolve `parts` e `query`. `ir(caminho)` muda o hash. Cada mudança volta ao topo da página.
- As rotas por hash funcionam sem internet e a partir do ícone no ecrã principal, sem regras no servidor.
- Em `App.tsx`, o `<main>` usa como `key` o caminho e os parâmetros. Por isso, cada mudança de rota volta a montar o ecrã.
- A navegação está em `AREAS` (`App.tsx`). Cada área tem separadores. Um separador pode exigir uma ação (`acao`) ou estar escondido do trabalhador (`naoTrab`):

| Área | Separadores (rota) | Quem vê |
|---|---|---|
| Início | `painel` | dono, gerente |
| Trabalhos | `trabalhos`, `agenda`, `relatorios` | todos |
| Cotações | `cotacoes` (financas), `catalogos` | dono, gerente |
| Clientes | `clientes` | dono, gerente |
| Fornecedores | `fornecedores`, `requisicoes`, `contas-pagar` (financas) | dono, gerente |
| Finanças | `resumo` (despesas), `dividas` (financas), `despesas` (despesas), `documentos` (iva), `iva` (iva), `pessoal` (despesas) | conforme a ação |
| Definições | `definicoes` (definicoes), `catalogo`, `equipa` (equipa) | conforme a ação |

- Uma rota desconhecida ou sem permissão mostra "Sem acesso" (`Bloqueado`).
- Parâmetros em uso, por exemplo:
  - `#/trabalhos/<id>?tab=pagamentos` e `?entregar=1`
  - `#/despesas?mes=AAAA-MM` (o mesmo em `iva` e `resumo`)
  - `#/trabalhos?tipo=…&f=atrasados&etapa=…&novo=1` (também `f=semvalor`)
- No telemóvel (até 899 px):
  - o menu lateral dá lugar a uma barra inferior com até 6 áreas, sem Definições;
  - Definições abre-se por um botão no fim do Início;
  - nos ecrãs Início, Agenda e Clientes aparece o botão flutuante "+" (Novo pedido), exceto para trabalhadores. Este botão só existe no telemóvel.

### Outros

- `proximoCodigo('T', …)` gera o código seguinte de trabalho no formato `T-AAAA-NNN`. Cotações e requisições usam `numeroDoMes()` de `calc.ts`, nos formatos `COT-NNN-MMM/AA` e `REQ-NNN-MMM/AA`, e a contagem recomeça todos os meses.
- `useOnline()` diz se há rede. `useTema()` guarda o tema em `localStorage` (`pg_tema`), põe `data-theme` no `<html>` e atualiza a `theme-color`.
- Chaves de `localStorage`: `pg_sessao` (utilizador com sessão aberta), `pg_tema`, `pg_vista` (quadro ou lista), `pg_dica` (dica de instalação fechada) e `pg_dev_local` (só em desenvolvimento).

## Arranque e login

### Sequência de arranque (`src/main.tsx`)

1. `registerSW({ immediate: true })` regista o service worker e pede atualizações a cada 60 s e sempre que a app volta ao primeiro plano.
2. `instalarHooks()` corre antes de qualquer escrita.
3. `arrancar()`: se o aparelho já tem o registo `empresa` (ou se está em modo local de desenvolvimento), corre `semear()`. Num aparelho já semeado, isso só aplica `correcoes()`. Um aparelho novo não semeia nada antes de entrar na nuvem.
4. `iniciarSincronizacao()`.
5. Monta `<App/>` dentro de `<StrictMode>`.

### Portas de entrada (`src/App.tsx`)

`App` decide o que mostrar:

1. Sem token da nuvem (e fora do modo local), mostra **`Ligar`**.
2. Com token, mas sem utilizador resolvido, mostra **`Login`** (PIN).
3. Caso contrário, monta `ToastHost`, `SessaoProvider`, `DadosProvider`, `VisualizadorHost`, `Shell` e `PdfHost`.

**`Ligar`**: liga o aparelho à cópia da empresa.
- Pede só a palavra-passe. O código da empresa (`puzzle` por defeito) fica escondido atrás do botão "Outra empresa".
- Ao entrar, corre `entrar()`, depois `semear()` e depois `sincronizar()`.
- `entrar()` (`nuvem.ts`) trata três casos:
  - **Aparelho novo e nuvem com dados:** apaga as tabelas sincronizadas do aparelho (os ficheiros ficam) e desce a cópia da nuvem. Assim não há duplicados.
  - **Aparelho novo e nuvem vazia:** os dados do aparelho passam a ser a primeira cópia.
  - **Aparelho que já esteve ligado** (a sessão tinha terminado): primeiro envia o que mudou cá, depois puxa.
- O aparelho fica identificado no servidor como, por exemplo, "iPhone · Safari".

**Utilizador único:**
- Com exatamente **um** utilizador ativo, a palavra-passe da empresa é o único login e não se pede PIN (variável `unico`). Foi um pedido do Momad de 18 de outubro de 2026.
- O ecrã de PIN só aparece quando houver equipa.

**`Login` (PIN):**
- Lista as pessoas ativas (dono, gerente, trabalhador, por esta ordem) e pede um PIN de 4 dígitos.
- O PIN é comparado no aparelho com `Utilizador.pin`.
- A sessão fica em `localStorage` (`pg_sessao`). Um trabalhador entra na Agenda; os outros entram no Início.

**Sair, desligar, recomeçar:**

| Ação | Onde | O que acontece |
|---|---|---|
| Sair, com um só utilizador | menu lateral; fim do Início no telemóvel | `terminarSessao()`: sincroniza, fecha a sessão no servidor e deixa o token vazio. A app volta a pedir a palavra-passe e os dados ficam no aparelho |
| Sair, com equipa | menu lateral; fim do Início no telemóvel; barra inferior do trabalhador | Apaga `pg_sessao` e volta ao ecrã de PIN. O aparelho continua ligado |
| Desligar este aparelho | Definições → Nuvem | `desligar()`: sincroniza, fecha a sessão e apaga `meta.nuvem`. Ao voltar a entrar, se a nuvem tiver dados, as tabelas sincronizadas do aparelho são substituídas pela cópia da nuvem |
| Recomeçar este aparelho | Definições → Dados | `desligar()` e depois `repor()`: apaga toda a base do aparelho, **incluindo os ficheiros**, e recarrega |
| Sessão terminada | automático | O servidor responde `sessao` (por exemplo, a palavra-passe foi mudada noutro aparelho). O token fica vazio, os cursores ficam guardados e o ecrã Ligar mostra "A sessão terminou. Entre outra vez." Ao voltar a entrar, o aparelho envia o que tinha pendente |

## PWA e atualização

### Configuração (`vite.config.ts`)

- `VitePWA` com `registerType: 'autoUpdate'`: o service worker novo instala-se sem pedir confirmação.
- O manifesto tem:
  - `name` "Puzzle Stickers · Gestão" e `short_name` "Puzzle Gestão";
  - `lang` `pt-MZ`, `start_url` e `scope` `/`, `display` `standalone`;
  - cores `#0b0b0c`;
  - ícones de 192, 512 e 512 *maskable*.
- Workbox:
  - `globPatterns`: `**/*.{js,mjs,css,html,png,svg,woff2}`, `img/*.jpg` e `fonts/*.woff`. É isto que fica disponível sem internet.
  - `navigateFallback: '/index.html'`.
  - `navigateFallbackDenylist: [/^\/catalogos\//]`. Sem isto, abrir `/catalogos/<id>.pdf` (por exemplo, o link enviado a um cliente) mostrava a app em vez do PDF.
  - `maximumFileSizeToCacheInBytes`: 4 MB.
- **Não** ficam em cache:
  - os PDFs e as capas de `catalogos/`, que precisam de internet (dois dos PDFs passam dos 4 MB);
  - `versao.json`, de propósito.
- `index.html` tem `noindex, nofollow`, as meta tags `apple-mobile-web-app-*` e dois contentores: `#root` e `#print-root`.

### Versão e atualização (`src/versao.ts`)

- No build, `vite.config.ts` cria `VERSAO = new Date().toISOString()`, ou seja, a hora em UTC:
  - injeta-a no código como `__VERSAO__`;
  - um plugin próprio (`versao`) escreve `/versao.json` com `{ v }`.
- `versaoCurta()` mostra a versão como "dd/mm hh:mm" na hora de Maputo (UTC+2). Aparece no menu lateral e em Definições → Nuvem ("Versão da app").
- `VersaoNova` (`App.tsx`) pergunta ao servidor pela versão (`versaoNoServidor()`, com `cache: 'no-store'`):
  - ao abrir, ao voltar ao primeiro plano e a cada 2 minutos;
  - se a versão do servidor for mais recente, mostra "Há uma versão nova (…). Os seus dados ficam guardados." com o botão **Atualizar**.
- `atualizarApp()` remove o service worker, apaga as caches e recarrega. **Não mexe na IndexedDB**: os dados ficam. O mesmo botão existe em Definições → Nuvem ("Atualizar app").
- No iPhone ou iPad, apagar a app do ecrã principal apaga os dados locais desse aparelho, incluindo os ficheiros, que não estão na nuvem. Para forçar uma versão nova usa-se "Atualizar", nunca reinstalar.

### Instalação

`DicaInstalar` (`App.tsx`) explica como instalar:
- no iPhone ou iPad: Partilhar → Adicionar ao ecrã principal;
- no Mac com Safari: Ficheiro → Adicionar à Dock;
- nos outros navegadores: "Instalar app" / "Adicionar ao ecrã principal".

Não aparece se a app já estiver instalada ou se a dica tiver sido fechada (`pg_dica`).

## Estilos e fontes

- **Um só ficheiro:** `src/styles.css` (cerca de 660 linhas), importado em `main.tsx`.
- **Tokens em `:root`**:
  - tema escuro por defeito: `--y: #ffc406` (o amarelo da marca), `--bg`, `--card`, `--line`, `--tx`, `--ok`, `--warn`, `--bad`, `--info`, `--r`;
  - tema claro em `:root[data-theme='light']`;
  - `--safe-b` e `--safe-t` para as margens seguras do iPhone.
- **Layout:**
  - `.shell` com o menu lateral `.side` no computador;
  - até 899 px: o `.side` desaparece e entram a barra inferior `.tabbar`, o botão flutuante `.fab` e as classes `.hide-m`, `.so-m` e `.so-m-block`.
- **Impressão:** `#print-root` está escondido no ecrã. Em `@media print` esconde-se `#root` e mostra-se `#print-root`. A página é A4 com margem 0.
- **Montserrat** (interface): pesos 400 a 800 de `@fontsource/montserrat`, importados no topo do CSS. O build inclui-os em `assets/`. A relação do IVA (CSS em `print.tsx`, classes `.pr`) também usa Montserrat.
- **Gotham** (documentos):
  - 8 regras `@font-face` com a família `'Gotham PS'` (300, 400, 500 e 700, normal e itálico), que apontam para `/fonts/gotham-*.woff` com `font-display: block`;
  - usada só pela cotação (`F = 'Gotham PS'` em `cotacaoPdf.tsx`) e pela requisição (`CSS_REQUISICAO`);
  - antes de gerar um documento, a app espera pelas fontes (`carregarFontes()`; `document.fonts.load` em `renderizarPdf`);
  - os ficheiros não estão no repositório. Sem eles, o navegador usa outra fonte e os documentos perdem o aspeto original.
- **Os estilos dos documentos ficam à parte do CSS da app:**
  - `CSS` em `print.tsx` (classes `.pr`);
  - `CSS_REQUISICAO` em `requisicaoPdf.tsx`, tudo com o prefixo `.rq`, injetado só enquanto o PDF é gerado;
  - a cotação é SVG (`.pr-svg` para imprimir, `.a4-prev` para pré-visualizar, ambas em `styles.css`).

### Como cada documento é gerado

Mais detalhe no capítulo 5 (Documentos PDF, catálogos e cálculos).

| Documento | Como | Onde |
|---|---|---|
| Cotação | SVG A4 em pontos (595,276 × 841,89). O fundo é a arte original. O texto é Gotham, com as medidas do original. Há páginas por opção. Sai pelo diálogo de impressão | `cotacaoPdf.tsx`; `imprimirCotacao` em `print.tsx` |
| Requisição de prints | HTML A4 (`.rq`), depois html2canvas e jsPDF. Abre a janela "PDF pronto" com "Descarregar" e "Ver". Mostra também "Partilhar" se o aparelho consegue partilhar ficheiros. Se não consegue e o fornecedor tem telefone, mostra "Descarregar e abrir o WhatsApp" (`wa.me` no telemóvel, `whatsapp://` no computador) | `requisicaoPdf.tsx`; `emitirRequisicao` em `pdfPartilha.tsx` |
| Relação do IVA | HTML A4 pelo diálogo de impressão. O CSV tem BOM, separador `;` e finais de linha `\r\n` | `imprimirIva` e `exportarIvaExcel` em `print.tsx` |
| Mapa de crédito | `.xlsx` gerado com SheetJS (botão "Excel") | `exportarMapa` em `ContasPagar.tsx` |

**Regra do negócio:** a app **não emite nem numera faturas ou recibos**. Os formulários registam o número do livro do Momad (`Rapido.tsx`). Só trabalhos, cotações e requisições têm numeração interna. A própria cotação imprime "**Não serve de comprovativo fiscal", e a lista de cotações diz que elas "não servem de comprovativo fiscal".

## Página de pré-visualização `mock/` (só em desenvolvimento)

- `mock/cotacao.html` e `mock/cotacao.tsx` mostram o formulário de cotação (`EditorCotacao`) e a página A4 (`PreviewCotacao`) com cotações de exemplo. Não pedem login nem usam a base de dados.
- Abre-se com o servidor de desenvolvimento ligado: `http://localhost:5195/mock/cotacao.html`.
  - `?v=pc` (por defeito): formulário ao lado da página A4.
  - `?v=fone`: formulário com a largura de um telemóvel (390 px).
  - `?v=a4`: só as páginas A4. Aceita vários exemplos separados por vírgula e serve para imprimir.
  - `&ex=wrap` (por defeito), `&ex=escola` ou `&ex=mensal` escolhe o exemplo; `&aberto=N` abre a linha N.
- Não entra no build, porque o `vite build` só usa `index.html` como entrada. Também não é verificado pelo `tsc`, que só olha para `src/`.

## Como continuar

### Requisitos

- Node.js 20 ou mais recente. O `pdfjs-dist` 4.10 pede Node 20. Os testes foram corridos com Node 24.
- Acesso à internet no `npm install` (registo npm e `cdn.sheetjs.com`).
- Os 8 ficheiros `gotham-*.woff` da empresa, para os documentos saírem iguais aos originais.
- Para publicar: uma conta Cloudflare (Wrangler 4, chamado com `npx`).

### Instalar e correr

```bash
npm install
# copiar os 8 gotham-*.woff da empresa para public/fonts/
npm run dev:fixed      # http://localhost:5195
```

- `npm run dev` faz o mesmo com `--host`, o que deixa abrir a app noutro aparelho da mesma rede.
- A origem `localhost:5195` tem a sua própria IndexedDB. Da primeira vez aparece o ecrã **Ligar**.
- Há duas formas de trabalhar:
  1. **Entrar com a palavra-passe da empresa.** Atenção: está a trabalhar com os **dados reais**, e cada alteração sobe para a nuvem.
  2. **Usar o modo local de desenvolvimento** (abaixo).

### Modo local de desenvolvimento (`pg_dev_local`)

Na consola do navegador, em `http://localhost:5195`:

```js
localStorage.setItem('pg_dev_local', '1'); location.reload()
```

- `devLocal()` (`src/nuvem.ts`) só devolve `true` quando `import.meta.env.DEV` está ativo. No build esse código desaparece, por isso a produção nunca o usa.
- O modo local salta o ecrã Ligar. `semear()` cria a empresa, o catálogo e um utilizador dono, e a app abre sem PIN.
- Sem ligação à nuvem nada sobe ("Não ligado à nuvem"). Os dados ficam só nessa origem do navegador.
- Para sair: `localStorage.removeItem('pg_dev_local')`.
- Cuidado: se essa origem já foi ligada à nuvem com a palavra-passe, a sincronização continua a correr com os dados reais, mesmo em modo local. Para limpar, use Definições → "Recomeçar este aparelho" ou apague os dados do site `localhost:5195`.

### Testes

```bash
npm test          # corre uma vez
npx vitest        # fica a observar alterações
```

No repositório: **4 ficheiros e 30 testes, todos a passar**.

| Ficheiro | Testes | O que cobre |
|---|---|---|
| `src/calc.test.ts` | 27 | Lista de impressão (totais iguais a uma folha Excel real, material por linha); trabalho (totais de uma cotação real, urgência de 45% antes do IVA, dívida, sinal, custo, lucro); IVA do mês (liquidado − dedutível, crédito); fases e agenda (dias úteis, fases por tipo, nomes antigos, "a receber", itens da agenda, atraso); numeração mensal; caixa; despesas fixas (vencimento, estados, janela do dia 25 ao dia 5) e resultado do mês; ciclo da Académica (totais de pró-formas reais, sequência de fases, encomendas); mapa de crédito (totais da folha do Momad); cotação (urgência por linha, desconto antes do IVA, total por opção, várias viaturas) |
| `src/leitura.test.ts` | 1 | Leitura de números nos formatos "14 460,00", "1 150,00 MTn", "4,176.00", "68.000,00 MT" e "7,23" (`numeroPt`) |
| `src/cotacaoPdf.render.test.tsx` | 1 | Paginação da cotação de referência: as caixas dos itens ficam a menos de 1,2 pt das posições do original (219,4 / 303,5 / 411,1 / 518,2). Mede o texto com `test/fixtures/gotham-advances.json`. Escreve `test/out/cotacao.html`, para imprimir no Chrome e comparar |
| `src/requisicaoPdf.render.test.tsx` | 1 | Preço de cada linha com o seu material (8,58 m² de Bundle Wrap = 17.160 MT) e somas por material. Escreve `test/out/requisicao.html` |

- Os testes que liam os PDFs e as folhas Excel reais (pró-formas, fatura, listas de impressão) usavam documentos reais e não estão no repositório.
- Os HTML de `test/out/` apontam para `public/fonts/gotham-*.woff`. Sem as fontes, a comparação visual não vale.
- Não há testes automáticos para os ecrãs, para a sincronização (`nuvem.ts`), para o seed, nem para a geração de PDF no aparelho (`pdfPartilha.tsx`). Isso valida-se no navegador, no computador e no telemóvel.
- `test/dump.mjs` imprime o texto que o pdf.js extrai da primeira página de um PDF. Serve para escrever ou verificar leitores: `node test/dump.mjs ficheiro.pdf`.

### Build

```bash
npm run build      # tsc --noEmit && vite build
npm run preview    # http://localhost:5196
```

- `dist/` contém `index.html`, `assets/`, `sw.js`, `workbox-*.js`, `manifest.webmanifest`, `versao.json`, `img/`, `fonts/` e `catalogos/`.
- Pesa cerca de 20 MB, dos quais cerca de 14 MB são os catálogos.
- O aviso do Vite sobre blocos maiores que 500 kB é esperado.
- Sem as fontes Gotham em `public/fonts/`, o build passa na mesma, com avisos `didn't resolve at build time`. Ver a armadilha 10.

### Publicar (deploy atual)

```bash
npm test
npm run build
npx wrangler@4 deploy --assets dist --name puzzle-gestao --compatibility-date 2026-10-01
```

- Antes do build, confirme que `public/fonts/` tem os 8 `gotham-*.woff`.
- Da primeira vez num computador é preciso `npx wrangler@4 login` com a conta Cloudflare da KingBalas Ltd.
- Não há `wrangler.toml`: o comando define tudo. É um Worker só de ficheiros estáticos (static assets).
- Depois de publicar, os aparelhos recebem a versão nova sozinhos (service worker e aviso "Há uma versão nova").
- Para confirmar, compare a "Versão da app" em Definições → Nuvem com `dist/versao.json`. O ficheiro está em UTC e a app mostra a hora de Maputo (+2 h).
- Se o SQL mudou, aplique-o no Supabase **antes** de publicar a app.

### Onde está alojado hoje

| Peça | Onde | Conta | Notas |
|---|---|---|---|
| App (`dist/`) | Cloudflare Workers, static assets, Worker `puzzle-gestao` | KingBalas Ltd | `https://puzzle-gestao.apps-mz.workers.dev`, com `noindex` |
| Registos | Supabase, projeto `kb-academy`, esquema privado `puzzle` | KingBalas Ltd | O projeto serve também outros sistemas da KingBalas Ltd, e os dados da Puzzle Stickers estão isolados neste esquema. A app só chama as funções `public.puzzle_*`. O URL e a chave pública estão em `src/nuvem.ts` (constantes `API` e `KEY`). Pode passar para uma conta do Momad (ver abaixo) |
| Ficheiros | Só nos aparelhos (IndexedDB) | — | Não há cópia na nuvem |
| Catálogos | `public/catalogos`, publicados com a app | — | — |
| Fontes Gotham | Publicadas com a app em `/fonts/` | — | Não estão no repositório |

A chave em `src/nuvem.ts` é a chave pública (anon) do Supabase. É pública por desenho: sem o token de sessão da empresa, as funções não devolvem nada.

### Alojar noutra conta

As duas peças são independentes. Pode mudar só a nuvem, só a app, ou as duas.

#### Nuvem: projeto Supabase próprio

1. **Criar o projeto** no Supabase, na conta do Momad.
2. **Correr o SQL.** No SQL Editor, correr por ordem `db/001_puzzle_nuvem.sql` e `db/002_puzzle_tarefas.sql`.
   - O 001 já aceita a tabela `tarefas`. O 002 repete a mesma função `puzzle_enviar`, por isso corrê-lo a seguir não faz mal.
   - As funções usam a extensão pgcrypto no esquema `extensions` (`extensions.crypt`, `digest`, `gen_random_bytes`, `gen_salt`). Os projetos Supabase trazem-na. Se faltar: `create extension if not exists pgcrypto with schema extensions;`.
   - Não é preciso expor o esquema `puzzle` na API.
3. **Criar a empresa.** Os ficheiros SQL não a criam:
   ```sql
   insert into puzzle.empresas (id, nome, senha_hash)
   values ('puzzle', 'Puzzle Stickers',
           extensions.crypt('<palavra-passe>', extensions.gen_salt('bf', 10)));
   ```
   - `puzzle` é o código que o ecrã Ligar usa por defeito e o que `admin/carregar.ts` usa. O código vai em minúsculas.
   - Use pelo menos 8 caracteres, que é o mínimo que `puzzle_mudar_senha` exige.
4. **Copiar os dados.**
   - Pare a app: todos os aparelhos mostram "Na nuvem" e ninguém está a editar.
   - Exporte do projeto atual as linhas de `puzzle.docs` com `empresa_id = 'puzzle'` (colunas `empresa_id`, `tabela`, `id`, `dados`, `versao`) e insira-as no projeto novo. `seq` e `servidor_em` preenchem-se sozinhos.
5. **Apontar a app para o projeto novo.** Em `src/nuvem.ts`:
   - `API = 'https://<ref-do-projeto>.supabase.co/rest/v1/rpc/'`;
   - `KEY` = a chave pública (anon) do projeto novo.
   - `rpc()` envia a chave nos cabeçalhos `apikey` e `Authorization: Bearer`, que é o formato da chave anon (JWT). Se usar as chaves novas do tipo *publishable*, teste primeiro.
6. **Subir `ESQUEMA`** em `src/nuvem.ts` (de `2` para `3`), no mesmo build.
   - Cada aparelho guarda um cursor (`seq`) do servidor antigo, e no servidor novo os `seq` recomeçam. Um cursor alto faria o aparelho saltar registos.
   - Com `ESQUEMA` maior, o cursor volta a 0 na sincronização seguinte e o aparelho puxa tudo uma vez. Só são aplicadas versões mais recentes, por isso é seguro.
7. **Testar e publicar:** `npm test`, `npm run build` e publicar.
8. **Em cada aparelho**, o token antigo não existe no servidor novo, por isso a app pede a palavra-passe (a nova). Ao entrar, envia o que estiver pendente e puxa tudo.

`admin/carregar.ts` importa `src/nuvem.ts` e usa as mesmas constantes. Passa a apontar para o projeto novo sem mais alterações.

#### App: qualquer alojamento estático

- `dist/` é só ficheiros estáticos. As rotas são por hash, por isso não precisa de regras de reescrita no servidor.
- Tem de ser servida em HTTPS, na **raiz** de um domínio. O manifesto usa `start_url` e `scope` `/`, e o código pede caminhos absolutos (`/img/…`, `/fonts/…`, `/catalogos/…`, `/versao.json`). Num subcaminho (por exemplo `…/puzzle-gestao/`) estes caminhos partem-se.
- Para usar outra conta Cloudflare: `npx wrangler@4 login` com essa conta e o mesmo comando de deploy. O endereço passa a ser `https://puzzle-gestao.<subdomínio-da-conta>.workers.dev`, ou um domínio próprio.
- **Mudar de endereço é mudar de origem**, e cada origem tem a sua IndexedDB vazia:
  - cada aparelho tem de voltar a entrar (puxa tudo da nuvem) e reinstalar a app no ecrã principal;
  - **os ficheiros carregados no endereço antigo não passam** (ver armadilha 1);
  - mudar só a nuvem, mantendo o endereço, não tem este problema.

### Carregar lotes de dados na nuvem (`admin/carregar.ts`)

Serve para meter dados reais na nuvem sem os pôr no código.

```bash
PUZZLE_SENHA='<palavra-passe da empresa>' npx vite-node admin/carregar.ts admin/dados/<script>.ts --seco
```

Em PowerShell:

```powershell
$env:PUZZLE_SENHA = '<palavra-passe da empresa>'; npx vite-node admin/carregar.ts admin/dados/<script>.ts --seco
```

- Corre como mais um aparelho:
  1. abre uma IndexedDB em memória (`fake-indexeddb`);
  2. entra na empresa `puzzle` e puxa tudo;
  3. corre `semear()` e depois a função `export default` do script;
  4. lista o que vai subir e sincroniza;
  5. no fim fecha sempre a sessão (`desligar`), mesmo que o script falhe.
- `--seco` mostra o que subiria e não envia nada. Use-o sempre primeiro.
- Um script de dados é um módulo em `admin/dados/` com `export default async function`. Usa as funções da app: `db`, `novo`, `guardar` e `apagar` de `src/db.ts`, e as regras de `src/calc.ts`. A pasta não está no repositório, porque tem os dados reais.
- Os ficheiros não são carregados: `db.ficheiros` está desativado neste modo.

### Regras para mudar o código

- **Regras de negócio** vão para `src/calc.ts` como funções puras, com teste em `src/calc.test.ts`.
- **Gravar** com `novo()`, `guardar()` e `apagar()` de `src/db.ts` (ou com as ações de `src/acoes.ts`).
  - Apagar é sempre marcar `deleted`; nunca `table.delete()` em tabelas sincronizadas.
  - As únicas remoções físicas estão em `seed.ts` (`apagarExemplos` e `catalogoComIdsFixos`), e não chegam aos outros aparelhos.
- **Campos novos** são opcionais, porque os registos antigos na nuvem não os têm.
  - Um campo novo numa tabela existente não precisa de SQL nem de versão Dexie nova, porque o registo vai inteiro como JSON.
  - Só precisa de versão Dexie se o campo for um índice.
- **Nomes antigos** traduzem-se na leitura, sem reescrever registos. Exemplos: `normalizarEtapa` em `calc.ts`; `nomeOficial` e `linhasComMaterial` em `requisicaoPdf.tsx`. O tipo `producao` é lido como `branding` (`tipoInfo`), e `correcoes()` em `seed.ts` também o converte no arranque.
- **Faturas e recibos** nunca são emitidos nem numerados pela app; só se regista o número do livro. As cotações levam o aviso de que não servem de comprovativo fiscal.
- **Documentos iguais aos originais:** só mexer na geometria de `cotacaoPdf.tsx` ou de `requisicaoPdf.tsx` com os testes de render a passar e uma comparação visual (`test/out/`, com as fontes Gotham presentes).
- **Textos** em português; valores no formato `68.000,00 MT` (`mt` em `format.ts`).
- **Dados reais** nunca no código: vão para a nuvem com `admin/carregar.ts`.
- **Antes de cada publicação:** `npm test` e `npm run build`. Depois, confirmar a versão num aparelho.

### Trabalho planeado (por aprovar)

O plano de 19 de outubro de 2026 parte dos 5 pontos levantados pelo Momad e organiza-os em 6 partes:
- tudo é aditivo e opcional;
- não cria tabelas novas nem sobe `ESQUEMA`;
- os registos reais na nuvem leem-se sem migração;
- antes da Parte 1: versão de base no git e `npm test` a passar.

| Parte | Esforço | Resumo |
|---|---|---|
| 1 | médio | Fatura da Académica registada sem pró-forma; pagamento ao fornecedor com comprovativo; nova fase "Fatura por pagar"; acesso direto a partir do trabalho. Hoje, o Passo 3 do Circuito (`RequisicaoForm.tsx`) só deixa pagar depois de registar a pró-forma ou pôr a crédito |
| 2 | médio | Dossier do trabalho: cartão "Percurso" (cotação → requisição → faturas da produção → fatura ao cliente) e linha do tempo completa, derivados por funções puras num ficheiro novo, `src/dossier.ts` |
| 3 | médio | Cotação marcada como "Enviada" com data; "Negociar" separado de "Editar"; cadeia de versões ligada por id |
| 4 | médio | Requisição como a cotação: faixa de estado, pré-visualização A4, marcada como enviada ao partilhar, Guardar só se mudou |
| 5 | grande | Partes com identidade: estado por parte, "sem custo", ligação à requisição e à linha da cotação |
| 6 | pequeno | Pagamento do cliente associado a uma parte |

O plano tem 12 decisões para o Momad tomar antes. Entre elas: o número da cotação negociada, o custo pela fatura ou pela lista, os ficheiros na nuvem, e se o `Importar.tsx` deve ser ligado ou não.

## Armadilhas conhecidas e dívida técnica

### 1. Os ficheiros ficam só no aparelho

- **Onde:**
  - `TABELAS` em `src/nuvem.ts` não inclui `ficheiros`;
  - mesmo que um ficheiro fosse metido num registo, `puzzle_enviar` (`db/*.sql`) ignora registos com mais de 300 000 caracteres;
  - `admin/carregar.ts` desativa `db.ficheiros`.
- **O que fica só no aparelho:**
  - fotos e PDFs de faturas, recibos, pró-formas e despesas;
  - ficheiros dos trabalhos e anexos das notas;
  - logótipos dos clientes (`Cliente.logoId`, impressos na cotação) e dos fornecedores;
  - fotos dos relatórios.
- **Consequências:**
  - noutro aparelho o registo aparece, mas o ficheiro não abre, e a cotação sai sem o logótipo do cliente;
  - a cópia de segurança de Definições não inclui ficheiros;
  - os ficheiros perdem-se se a app for apagada do ecrã principal, se os dados do site forem limpos, com "Recomeçar este aparelho" ou ao mudar o endereço da app;
  - Definições → Nuvem já avisa disto.
- **Caminho possível:** um bucket privado no Supabase Storage, com uma função que valide o token da empresa. A sincronização faz-se pelo `id` do ficheiro, que os registos já guardam.

### 2. Finais de linha (LF e CRLF)

- Todos os ficheiros de texto do projeto estão em LF. O repositório não tem `.gitattributes`.
- O resultado depende da configuração do Git de cada computador:
  - o instalador do Git para Windows costuma propor `core.autocrlf=true`, e é o caso no computador de desenvolvimento da KingBalas Ltd;
  - com essa definição, um clone em Windows fica com CRLF na pasta de trabalho, e o Git volta a converter para LF no commit;
  - num computador com `core.autocrlf=false`, um editor que grave em CRLF faz o ficheiro inteiro aparecer alterado no diff;
  - scripts e ferramentas que procuram texto exato (patches, substituições) falham quando o ficheiro tem outro final de linha.
- **Fazer:** fixar LF com um `.gitattributes` na raiz e, depois de o criar, correr `git add --renormalize .`:
  ```
  * text=auto eol=lf
  *.pdf binary
  *.woff binary
  *.png binary
  *.jpg binary
  *.xlsx binary
  ```
- **Exceção intencional:** o CSV do IVA (`exportarIvaExcel` em `src/print.tsx`) usa `\r\n` e BOM para o Excel o abrir bem. Não "corrigir".

### 3. html2canvas e SVG sem tamanho

- `renderizarPdf` (`src/pdfPartilha.tsx`) desenha o documento com html2canvas. O html2canvas corta um SVG que só tem `viewBox`, sem `width`/`height`.
- `public/img/logo.svg` é assim, e usa `currentColor` para acompanhar o tema. Por isso `PaginaRequisicao` usa `public/img/logo-doc.svg`, que tem tamanho e cor fixos.
- **Regra:** qualquer SVG num documento que passe pelo html2canvas precisa de `width`, `height` e cores fixas.
- A cotação (SVG com texto em Gotham) continua a sair pelo diálogo de impressão (`imprimirCotacao`). Passá-la para PDF real exige outro caminho: segundo as notas do projeto, o html2canvas não aplica as fontes web dentro de um SVG.

### 4. URL de blob e `StrictMode`

- `src/main.tsx` monta a app em `<StrictMode>`. Em desenvolvimento, o React corre cada efeito, a sua limpeza e o efeito outra vez.
- Se uma URL for criada com `URL.createObjectURL` num `useMemo` e revogada na limpeza de um `useEffect`, a primeira limpeza revoga-a e o `useMemo` não a volta a criar. O link fica morto.
- **Padrão certo:** criar a URL dentro do `useEffect`, guardá-la em estado e revogá-la na limpeza desse mesmo efeito. É o que fazem `PdfProntoModal` (`src/pdfPartilha.tsx`) e `useFicheiro` (`src/ui.tsx`).
- **Pendente menor:** `Miniatura` (`src/Visualizador.tsx`), o logótipo do cliente em `imprimirCotacao` (`logoDoCliente`) e `exportar()` em `src/pages/Definicoes.tsx` criam URLs que nunca são revogadas. É uma pequena fuga de memória.

### 5. `img.decode()` com a app em segundo plano

- `decode()` espera por um frame pintado. Com a app em segundo plano (por exemplo, o Momad muda para o WhatsApp enquanto o PDF é gerado), esse frame não chega e a promessa fica pendurada.
- `renderizarPdf` limita cada `decode()` a 2,5 s (`Promise.race` com `espera(2500)`).
- `imprimirCotacao` (`src/print.tsx`) faz `decode()` das imagens da cotação **sem** limite. Se o problema aparecer, aplique o mesmo `Promise.race`.

### 6. `seed.renumerar` é perigoso se `SEED_VERSAO` subir

- **O que faz:** `semear()` (`src/seed.ts`) corre `apagarExemplos()`, `semearReal()`, `renumerar()` e `correcoes()` sempre que `Empresa.seedVersao` é menor que `SEED_VERSAO` (hoje `3`).
  - `renumerar()` reescreve **todos** os códigos por ordem de data, no formato antigo: `T-AAAA-NNN`, `REQ-AAAA-NNN` e `COT-AAAA-NNN`.
  - `apagarExemplos()` apaga fisicamente os registos com `demo: true`. Essa remoção não chega aos outros aparelhos.
- **O problema:** as cotações e as requisições reais usam a numeração mensal (`COT-002-OUT/26`, `REQ-001-OUT/26`), e esses números já foram enviados a clientes e fornecedores. Subir `SEED_VERSAO` reescrevia-os em cada aparelho, e as alterações subiam para a nuvem.
- **Fazer:**
  - não subir `SEED_VERSAO`;
  - pôr as correções de arranque em `correcoes()`, que corre sempre e tem de poder repetir-se sem efeitos;
  - se um dia for mesmo preciso subir, retirar antes as cotações e as requisições de `renumerar()`.

### 7. `src/pages/Importar.tsx` sem uso

- `ImportarModal` e `BotaoCarregar` ("Carregar ficheiros": várias listas e documentos da Académica de uma vez) não são importados em lado nenhum. Segundo as notas do projeto, os botões saíram dos ecrãs a 18 de outubro de 2026. O build não os inclui, mas o `tsc` verifica-os.
- A leitura automática (`src/leitura.ts`) continua em uso no Circuito da requisição, para ler a pró-forma ou a fatura da Académica. O pdf.js continua em uso no visualizador.
- Os leitores de listas (`lerListaPdf`, `lerListaGrelha`, `lerListaExcel`) só são usados pelo `Importar.tsx`.
- A leitura só funciona em PDFs com texto. Os documentos digitalizados e as fotos não têm texto e são preenchidos à mão.
- **Decisão em aberto:** ligar como botão secundário depois de testar com os documentos reais, ou remover.

### 8. Ordem das cotações por número entre meses

- `DadosProvider` ordena `d.cotacoes` pelo texto do número, por ordem decrescente (`src/state.tsx`).
- Com a numeração mensal, essa ordem não é a cronológica:
  - `"COT-001-NOV/26"` < `"COT-003-OUT/26"`;
  - `"COT-001-JAN/27"` < `"COT-002-DEZ/26"`.
- Quando muda o mês, a lista de cotações (`Cotacoes.tsx`) e a ficha do cliente mostram cotações novas abaixo de antigas.
- **Fazer:** ordenar primeiro por `data` (e `createdAt`) e só depois por número. Qualquer cadeia de versões de cotação deve seguir ligações por id, nunca o número.

### 9. Uma tabela nova exige SQL, `TABELAS` e `ESQUEMA`

Passos, por esta ordem:

1. `src/db.ts`: criar a interface (com `extends Base`), declarar a tabela em `PuzzleDB` e acrescentar `this.version(6).stores({ … })`. Nunca alterar versões que já existem.
2. `db/003_….sql`: `create or replace` de `public.puzzle_enviar` com o nome novo na lista `tabs`, como em `db/002_puzzle_tarefas.sql`, e correr no Supabase **antes** de publicar. Sem isto, o servidor ignora os registos dessa tabela sem dar erro.
3. `src/nuvem.ts`: acrescentar o nome a `TABELAS` (os hooks passam a cobri-la sozinhos) e subir `ESQUEMA`. Um aparelho com uma versão antiga da app ignora os registos que não conhece mas avança o cursor. Só volta a puxá-los se o cursor recomeçar.
4. `src/state.tsx`: se os ecrãs precisarem da tabela, juntá-la à leitura do `DadosProvider` e à interface `Dados`.
5. `src/pages/Definicoes.tsx`: juntá-la à cópia de segurança (`exportar`).
6. Testes para as regras novas em `calc.ts`.

### 10. Fontes Gotham fora do repositório

- `public/fonts/gotham-*` está no `.gitignore`, porque a Gotham é uma fonte comercial.
- Num clone novo, a pasta `public/fonts/` fica vazia. O `npm run build` passa na mesma: só avisa que `/fonts/gotham-*.woff` não foi resolvido no build.
- Se publicar esse `dist/`, o site deixa de ter as fontes. A cotação e a requisição passam a sair com outra fonte, e a medição de texto da cotação deixa de bater com o original.
- **Fazer:** copiar os 8 ficheiros da empresa para `public/fonts/` antes de qualquer build que vá ser publicado.

### Outra dívida técnica confirmada no código

| Assunto | Onde | Situação e o que fazer |
|---|---|---|
| Permissões só na interface | `pode()` em `state.tsx`, `AREAS` em `App.tsx` | A nuvem conhece a empresa, não as pessoas: qualquer aparelho ligado recebe todos os registos. Quando os trabalhadores usarem a app, vai ser preciso ter sessões por pessoa e filtrar os dados no servidor |
| PIN em texto simples | `Utilizador.pin` (`db.ts`), `Login` (`App.tsx`) | O PIN é comparado no aparelho e sincronizado com os outros registos. O utilizador criado pelo seed tem um PIN inicial fixo, e o ecrã de PIN mostra-o enquanto não for mudado. Com um só utilizador, não se pede PIN. Antes de criar equipa, mudar os PINs em Definições → Equipa |
| Números gerados no aparelho | `proximoCodigo` (`state.tsx`), `numeroDoMes` (`calc.ts`) | Sem sequência no servidor, dois aparelhos a criar ao mesmo tempo (ou um sem internet) podem gerar o mesmo número. Como só contam registos não apagados, o número de um registo apagado pode voltar a ser usado |
| Cópia de segurança incompleta | `exportar()` em `Definicoes.tsx` | Exporta 11 tabelas e deixa de fora `despesasFixas`, `despesas`, `relatorios`, `tarefas`, `registos` e `ficheiros`. Usar `TABELAS` de `nuvem.ts` |
| Histórico invisível | `registar()` em `db.ts` | Grava ações em `registos` (que sincroniza), mas nenhum ecrã lê essa tabela. O separador "Notas e histórico" mostra notas, passagens de fase e pagamentos |
| Textos do protótipo | `Page` em `App.tsx` ("guardado no aparelho" e a dica "Neste protótipo…"); cartão Dados em `Definicoes.tsx` | São de antes da nuvem. Atualizar |
| Cotação e IVA por impressão | `imprimirCotacao` e `imprimirIva` em `print.tsx` | Só a requisição sai como PDF real com Partilhar. O Momad pediu "sempre em PDF" |
| Licença da Gotham | `public/fonts/gotham-*.woff` | Os ficheiros já não estão no repositório, mas o site publicado serve-os em `/fonts/`. Confirmar que a licença da empresa cobre a publicação web |
| Catálogos sem internet | `globPatterns` em `vite.config.ts` | Os PDFs e as capas de `catalogos/` não ficam em cache, por isso não abrem sem rede |
| Imagens sem uso | `public/img/cot-pattern.jpg`, `public/img/mark.png` | O código não as usa, mas entram na pré-cache (cerca de 118 KB) |
