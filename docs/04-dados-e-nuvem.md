# Dados, nuvem e segurança

Este capítulo explica onde ficam os dados do Puzzle Stickers · Gestão, como passam de um aparelho para outro e o que os protege. Tudo o que está aqui foi confirmado no código. Os caminhos dos ficheiros são relativos à raiz do repositório.

## Resumo

- Cada aparelho tem uma cópia completa dos dados numa base IndexedDB local, gerida pela biblioteca Dexie (`src/db.ts`). Por isso a app funciona sem internet.
- A cópia da empresa na nuvem fica num schema privado `puzzle`, numa base PostgreSQL do Supabase. Cada registo da app corresponde a uma linha, com o registo inteiro em JSON.
- A app só fala com a nuvem através de cinco funções públicas: `puzzle_entrar`, `puzzle_puxar`, `puzzle_enviar`, `puzzle_mudar_senha` e `puzzle_sair`. Para entrar é preciso a palavra-passe da empresa. Depois disso, cada chamada leva um token de sessão.
- Na sincronização, a app envia o que mudou no aparelho e depois puxa o que mudou na nuvem. Quando há conflito, a versão mais recente fica com o registo inteiro (*last-write-wins* por `updatedAt`).
- Os ficheiros (fotos, PDFs, logotipos) ficam só no aparelho onde foram carregados.
- Cronologia: a nuvem entrou em funcionamento a 15 de Outubro de 2026. A tabela `tarefas` passou a ser aceite a 16 de Outubro de 2026. A entrada passou a pedir só a palavra-passe da empresa a 18 de Outubro de 2026.

```
APARELHO (PWA)                                   NUVEM (Supabase)
IndexedDB "puzzle-gestao" (Dexie)                schema puzzle (privado)
 |- 16 tabelas de dados   -- puzzle_enviar -->    |- empresas  (código, hash da palavra-passe)
 |                        <-- puzzle_puxar --     |- sessoes   (hash do token, aparelho)
 |- ficheiros (só local)                          '- docs      (1 linha por registo, em JSON)
 '- meta (sessão e cursores, só local)           schema public: funções puzzle_* (RPC)
```

### Ficheiros principais

| Ficheiro | Papel |
|---|---|
| `src/db.ts` | Interfaces, base Dexie (`PuzzleDB`), versões e funções auxiliares |
| `src/nuvem.ts` | Sincronização, sessão, hooks Dexie e estado da nuvem |
| `src/state.tsx` | Carrega as tabelas de negócio para memória (`DadosProvider`) e define as permissões por papel (`PERM`) |
| `src/seed.ts` | Dados iniciais (empresa, catálogo, primeiro utilizador), correcções de arranque, `apagarExemplos()` e `repor()` |
| `src/main.tsx` | Instala os hooks, corre `semear()` num aparelho que já tem dados e arranca a sincronização |
| `src/App.tsx` | Ecrã `Ligar` (palavra-passe da empresa), ecrã de PIN (`Login`) e estado da nuvem na barra lateral |
| `src/pages/Definicoes.tsx` | Cartão Nuvem, cópia de segurança JSON, "Recomeçar este aparelho" |
| `db/001_puzzle_nuvem.sql` | Schema `puzzle`, tabelas e funções |
| `db/002_puzzle_tarefas.sql` | Acrescenta `tarefas` à lista de tabelas aceites pela nuvem |
| `admin/carregar.ts` | Carregador de lotes de dados reais, que escreve directamente na nuvem |

## Base de dados local (Dexie)

A base chama-se `puzzle-gestao` (classe `PuzzleDB` em `src/db.ts`). Cada aparelho e cada navegador tem a sua própria cópia.

### Versões, tabelas e índices

| Versão | Tabela | Interface | Índices (o primeiro é a chave) | Vai para a nuvem |
|---|---|---|---|---|
| 1 | `utilizadores` | `Utilizador` | `id, papel` | sim |
| 1 | `clientes` | `Cliente` | `id, nome` | sim |
| 1 | `fornecedores` | `Fornecedor` | `id, nome` | sim |
| 1 | `servicos` | `Servico` | `id, categoria` | sim |
| 1 | `trabalhos` | `Trabalho` | `id, codigo, clienteId, etapa, prazo, responsavelId` | sim |
| 1 | `pagamentos` | `Pagamento` | `id, trabalhoId, data` | sim |
| 1 | `requisicoes` | `Requisicao` | `id, trabalhoId, fornecedorId, data` | sim |
| 1 | `custos` | `Custo` | `id, trabalhoId, data` | sim |
| 1 | `documentos` | `Documento` | `id, data, direcao, trabalhoId, clienteId, fornecedorId` | sim |
| 1 | `cotacoes` | `Cotacao` | `id, clienteId, data` | sim |
| 1 | `ficheiros` | `Ficheiro` | `id` | **não** |
| 1 | `registos` | `Registo` | `id, em` | sim |
| 1 | `empresa` | `Empresa` | `id` | sim |
| 2 | `despesasFixas` | `DespesaFixa` | `id, categoria` | sim |
| 2 | `despesas` | `Despesa` | `id, data, fixaId, mes, categoria` | sim |
| 3 | `relatorios` | `Relatorio` | `id, data, utilizadorId` | sim |
| 4 | `meta` | `Nuvem` | `id` | **não** |
| 5 | `tarefas` | `Tarefa` | `id, data, trabalhoId` | sim |

Notas:

- Todas as chaves são `id` (texto). Só os campos da tabela acima estão indexados. Os outros campos não precisam de ser declarados, e um campo novo não indexado não pede versão nova.
- A app não faz consultas por índice: não há `.where()` nem `.orderBy()` em `src/`. O `DadosProvider` (`src/state.tsx`) lê 15 tabelas inteiras com `useLiveQuery` e guarda-as em memória. Não lê `registos`, `ficheiros` nem `meta`. Retira os registos apagados com `vivos()`. A empresa tem centenas de registos, não milhões.
- Para acrescentar uma tabela, cria-se uma `this.version(6).stores({...})` nova. As versões antigas nunca se alteram. Ver também [Tabela nova](#tabela-nova-passos-obrigatórios).

### Funções auxiliares (`src/db.ts`)

| Função | O que faz |
|---|---|
| `uid()` | Gera um id novo com `crypto.randomUUID()`. Se não existir, usa `id-` + texto aleatório + tempo |
| `agora()` | Devolve a data e hora actuais em ISO 8601 UTC (`toISOString()`) |
| `novo<T>(dados)` | Cria um objecto com `id`, `createdAt` e `updatedAt` iguais a agora. Os dados passados podem substituir estes campos |
| `guardar(tabela, reg)` | Põe `updatedAt` igual a agora e grava com `put` |
| `apagar(tabela, id)` | Apagamento suave: marca `deleted = true`, actualiza `updatedAt` e grava. O registo continua na base e na nuvem |
| `vivos(lista)` | Retira da lista os registos com `deleted` |
| `registar(por, acao, alvo?)` | Acrescenta uma linha ao histórico `registos` |
| `guardarFicheiro(file, nome?)` | Guarda um ficheiro na tabela `ficheiros` e devolve o id. As imagens passam antes por `comprimirImagem` |
| `comprimirImagem` (interna) | Reduz a imagem a 2000 px no máximo (JPEG, qualidade 0,82). Uma imagem que já cabe em 2000 px e tem menos de 900 KB fica como está. Se não a conseguir ler, guarda o original |

Regras práticas:

- Os dados de negócio apagam-se sempre com `apagar()`. `Table.delete()`, `bulkDelete()` e `clear()` não chegam à nuvem (ver [Hooks Dexie](#hooks-dexie)).
- Os logotipos de clientes seguem outro caminho: `guardarLogo` em `src/pages/Clientes.tsx`. Se a imagem tiver mais de 800 px ou mais de 600 KB, é redesenhada em PNG com 800 px no máximo, para manter a transparência. Caso contrário (ou se for SVG), guarda-se o original.
- Só o dono pode apagar. Um cliente só se apaga sem trabalhos (`src/pages/Clientes.tsx`) e um fornecedor sem requisições (`src/pages/Fornecedores.tsx`).

## Modelo de dados

Convenções:

- Os valores em dinheiro estão em meticais (MT).
- As datas de dia usam o formato `AAAA-MM-DD`. As marcas de tempo estão em ISO 8601 UTC.
- Os ids são texto. As ligações entre registos são ids simples, sem integridade referencial na base local nem na nuvem.

### Base

A maioria dos registos de negócio estende `Base`. As excepções são `Empresa`, `Registo`, `Ficheiro` e `Nuvem`.

| Campo | Tipo | Significado |
|---|---|---|
| `id` | `string` | Identificador único |
| `createdAt` | `string` | Momento da criação (ISO) |
| `updatedAt` | `string` | Momento da última alteração (ISO). É a versão usada na sincronização |
| `deleted` | `boolean?` | Registo apagado (apagamento suave) |
| `demo` | `boolean?` | Registo de exemplo dos primeiros protótipos. `apagarExemplos()` em `src/seed.ts` apaga estes registos só no aparelho |

Há também um campo interno, `_loc`, que não aparece nas interfaces. É a marca de alteração local que os hooks escrevem, e é retirado antes de o registo ir para a nuvem.

### Empresa

Registo único com id `'empresa'` (tabela `empresa`).

| Campo | Tipo | Significado |
|---|---|---|
| `id` | `'empresa'` | Chave fixa |
| `nome` | `string` | Nome comercial |
| `razaoSocial` | `string` | Razão social |
| `nuit` | `string` | NUIT da empresa |
| `morada`, `cidade` | `string` | Morada que aparece nos documentos |
| `telefones`, `email`, `instagram` | `string` | Contactos que aparecem nos documentos |
| `taxaIva` | `number` | Taxa de IVA em %. O seed põe 16 |
| `sinalPct` | `number` | Sinal para começar, em %. O seed põe 50 |
| `urgenciaPct` | `number` | Taxa de urgência em %. O seed põe 45 |
| `validadeCotacao` | `number` | Validade das cotações em dias. O seed põe 30 |
| `notaCotacao` | `string` | Texto final que as cotações novas trazem por defeito |
| `updatedAt` | `string` | Versão do registo |
| `seedVersao` | `number?` | Versão dos dados iniciais já aplicada (`SEED_VERSAO = 3` em `src/seed.ts`). Como o registo sincroniza, vale para a empresa: um aparelho que desce a empresa da nuvem já a recebe |
| `caixa` | `{ valor, data, em }?` | Saldo real (banco + M-Pesa + numerário) introduzido em "Acertar caixa", em Finanças → Resumo ou no Início (`CaixaModal` em `src/pages/Resumo.tsx`). `data` é o dia do acerto e `em` o momento. Pode voltar a acertar-se |

### Utilizador

| Campo | Tipo | Significado |
|---|---|---|
| `nome` | `string` | Nome |
| `papel` | `'dono' \| 'gerente' \| 'trabalhador'` | Papel, que decide o que a pessoa vê (`PERM` em `src/state.tsx`) |
| `funcao` | `string` | Função, em texto livre |
| `telefone` | `string` | Telefone |
| `pin` | `string` | PIN de 4 algarismos, usado para escolher quem está a usar o aparelho (ver [Papéis e PIN](#papéis-e-pin)) |
| `cor` | `string` | Cor do avatar |
| `ativo` | `boolean` | Só os utilizadores activos aparecem no ecrã de entrada |

### Cliente

| Campo | Tipo | Significado |
|---|---|---|
| `nome` | `string` | Nome do cliente |
| `logoId` | `string?` | Ficheiro com o logotipo. Aparece na cotação, por baixo de "Exmo (s)Sr(s)" |
| `contacto` | `string?` | Pessoa de contacto |
| `telefone`, `email`, `nuit` | `string?` | Contactos e NUIT |
| `cidade` | `string?` | "Cidade, País" num só campo. No formulário edita-se como dois campos (`separarMorada` e `juntarMorada` em `src/format.ts`) |
| `notas` | `string?` | Notas |

### Fornecedor

| Campo | Tipo | Significado |
|---|---|---|
| `nome` | `string` | Nome |
| `categoria` | `string` | O que fornece, em texto livre |
| `contacto`, `telefone`, `email`, `nuit`, `morada`, `site` | `string?` | Contactos |
| `notas` | `string?` | Notas |
| `logoId` | `string?` | Ficheiro com o logotipo. Aparece na lista e na ficha de fornecedores (`LogoForn` em `src/pages/Fornecedores.tsx`). O PDF da requisição não o usa: mostra uma imagem fixa da Académica quando o nome coincide e, nos outros casos, o nome (`logoFornecedor` em `src/requisicaoPdf.tsx`) |
| `materiais` | `MaterialFornecedor[]` | Preçário do fornecedor |
| `condicao` | `'proforma' \| 'credito' \| 'entrega' \| 'outra'?` | Forma de pagamento: "Pró-forma paga antes de produzir", "A crédito", "Paga na entrega" ou "Outra" |
| `temCredito` | `boolean?` | Há crédito aberto com este fornecedor |
| `prazoEntrega` | `string?` | Prazo de entrega habitual, em texto |
| `dadosBancarios` | `string?` | Dados para pagamento (contas, NIB) |

### MaterialFornecedor

Fica dentro de `Fornecedor.materiais` e não tem id.

| Campo | Tipo | Significado |
|---|---|---|
| `nome` | `string` | Produto ou serviço |
| `tipo` | `'impressao' \| 'laminacao' \| 'material' \| 'servico' \| 'outro'` | Tipo |
| `precoM2` | `number` | Preço por `unidade`, sem IVA. O nome do campo vem da primeira versão, quando tudo era ao m² |
| `unidade` | `string?` | m², metro, unidade, rolo... |
| `descricao` | `string?` | Descrição |

### Servico

O catálogo de serviços da empresa (tabela `servicos`). Os serviços do catálogo inicial têm ids fixos `srv-<nome-normalizado>` (`idCatalogo` em `src/seed.ts`). Assim, todos os aparelhos geram o mesmo id e a sincronização não cria duplicados.

| Campo | Tipo | Significado |
|---|---|---|
| `categoria` | `string` | Por exemplo, Logotipos ou Identidade Visual |
| `nome` | `string` | Nome do serviço |
| `preco` | `number` | Preço. 0 quer dizer "Sob proposta" |
| `diasMin`, `diasMax` | `number` | Prazo em dias. 0 quer dizer "Prazo por definir" |
| `inclui` | `string[]` | O que o serviço inclui |
| `ativo` | `boolean` | Serviço activo |
| `ordem` | `number?` | Posição no catálogo impresso. `correcoes()` acerta-a no arranque |

### Trabalho

| Campo | Tipo | Significado |
|---|---|---|
| `codigo` | `string` | Código interno `T-AAAA-NNN` (`proximoCodigo` em `src/state.tsx`) |
| `titulo` | `string` | Título |
| `clienteId` | `string` | Cliente |
| `tipo` | `TipoTrabalho` | `'branding' \| 'criacao' \| 'fornecimento' \| 'montagem' \| 'producao'`. O valor `'producao'` é o nome antigo de branding e é convertido no arranque (`correcoes()` em `src/seed.ts`) |
| `servicoId` | `string?` | Serviço do catálogo |
| `descricao` | `string` | Descrição |
| `itens` | `ItemTrabalho[]` | Partes do trabalho |
| `comIva` | `boolean` | O valor leva IVA |
| `urgente` | `boolean` | Aplica a taxa de urgência (`Empresa.urgenciaPct`) |
| `etapa` | `Etapa` | Fase actual |
| `etapas` | `PassagemEtapa[]` | Histórico das mudanças de fase |
| `dataEntrada` | `string` | Dia do pedido |
| `prazo` | `string` | Data de entrega prevista. `''` quer dizer sem data |
| `responsavelId` | `string?` | Utilizador responsável |
| `ficheiros` | `string[]` | Ids de ficheiros |
| `notas` | `NotaTrabalho[]` | Notas do trabalho |
| `cancelado` | `boolean?` | Trabalho cancelado. Deixa de contar nas dívidas e na agenda |
| `cotacaoId` | `string?` | Cotação em vigor |
| `pagamentoPrometido` | `string?` | Dia em que o cliente prometeu pagar o saldo depois da entrega |
| `confirmadoEm` | `string?` | O cliente confirmou (fim da negociação). A partir daqui o trabalho conta em "a receber". Também conta se já tiver um pagamento ou se tiver passado da negociação (`confirmado` e `contaParaReceber` em `src/calc.ts`) |
| `layoutAprovadoEm` | `string?` | Dia em que o layout foi aprovado |
| `pedidoFornecedorEm` | `string?` | Dia do pedido ao fornecedor, quando o pedido não foi feito por requisição na app |
| `montagemDe`, `montagemAte` | `string?` | Período da montagem |
| `prazos` | `Partial<Record<Etapa, string>>?` | Prazo opcional de cada fase |

Cada tipo de trabalho segue a sua sequência de fases (`TIPOS` em `src/calc.ts`):

| Tipo | Sequência |
|---|---|
| `branding` | pedido, negociacao, layout, producao, montagem, entrega, entregue |
| `criacao` | pedido, negociacao, layout (com o rótulo "Design"), entrega, entregue |
| `fornecimento` | pedido, negociacao, layout, producao (com o rótulo "Encomenda"), entrega, entregue |
| `montagem` | pedido, negociacao, montagem, entrega, entregue |

Os trabalhos gravados antes de 16 de Outubro de 2026 podem ter nomes de fase antigos (`EtapaAntiga`). Não há migração. O `DadosProvider` converte-os na leitura com `normalizarEtapa()` (`src/calc.ts`), tanto em `etapa` como em `etapas[]`. Um trabalho só fica gravado com os nomes novos quando volta a ser guardado. Os do tipo antigo `'producao'` são reescritos pelas correcções de arranque. A conversão é:

- entrada → pedido;
- cotacao e aprovacao → negociacao;
- design → layout;
- encomenda e recebido → producao;
- marcacao e acabamento → montagem;
- pronto → entrega.

### ItemTrabalho

Uma parte do trabalho. Fica dentro de `Trabalho.itens` e não tem id.

| Campo | Tipo | Significado |
|---|---|---|
| `descricao` | `string` | Descrição da parte |
| `detalhe` | `string?` | Detalhe |
| `qt` | `number` | Quantidade |
| `precoUnit` | `number` | Preço unitário. 0 quer dizer "por cotar" |
| `origem` | `'boca' \| 'cotacao' \| 'catalogo'?` | De onde veio o preço: combinado de boca, cotação ou catálogo |
| `servicoId` | `string?` | Serviço do catálogo |

### PassagemEtapa e NotaTrabalho

Ficam dentro do `Trabalho`.

| Interface | Campo | Tipo | Significado |
|---|---|---|---|
| `PassagemEtapa` | `etapa` | `Etapa` | Fase para onde o trabalho passou |
| | `em` | `string` | Quando (ISO) |
| | `por` | `string` | Id do utilizador |
| `NotaTrabalho` | `id` | `string` | Id da nota |
| | `em` | `string` | Quando (ISO) |
| | `por` | `string` | Id do utilizador |
| | `texto` | `string` | Texto |
| | `ficheiroId` | `string?` | Ficheiro anexo |

### Pagamento

Dinheiro recebido de um cliente.

| Campo | Tipo | Significado |
|---|---|---|
| `trabalhoId` | `string` | Trabalho |
| `data` | `string` | Dia |
| `valor` | `number` | Valor |
| `metodo` | `MetodoPagamento` | `'M-Pesa' \| 'e-Mola' \| 'Transferência' \| 'Numerário' \| 'POS' \| 'Cheque'` |
| `tipo` | `'sinal' \| 'parcial' \| 'final'` | Tipo de pagamento |
| `referencia` | `string?` | Referência |
| `reciboId` | `string?` | Documento emitido (recibo ou fatura-recibo) que registou o pagamento (`documentarPagamentos` em `src/pages/Rapido.tsx`). Um pagamento sem documento aparece como "sem fatura/recibo" (`semDocumento` em `src/calc.ts`) |

### Requisicao

Um pedido a um fornecedor. Tem dois tipos: a lista de impressão (ao m²) e a encomenda (por unidades). O ciclo é: lista, pró-forma, pagamento ou crédito, fatura e recibo, levantamento.

| Campo | Tipo | Significado |
|---|---|---|
| `numero` | `string` | `REQ-NNN-MÊS/AA`. A numeração recomeça cada mês (`numeroDoMes` em `src/calc.ts`) |
| `trabalhoId` | `string` | Trabalho. `''` quer dizer que não está ligada a um trabalho (por exemplo, "Várias" no mapa de crédito) |
| `fornecedorId` | `string` | Fornecedor |
| `data` | `string` | Dia |
| `tipo` | `'lista' \| 'encomenda'?` | Lista de impressão ou encomenda |
| `nomeTrabalho` | `string` | Nome do trabalho impresso na lista |
| `materialImpressao`, `precoImpressaoM2` | `string`, `number` | Impressão base da lista e preço por m². Cada linha pode ter a sua |
| `materialLaminacao`, `precoLaminacaoM2` | `string`, `number` | Laminação base da lista e preço por m² |
| `linhas` | `LinhaImpressao[]` | Prints |
| `itens` | `ItemEncomenda[]?` | Linhas da encomenda |
| `comIva` | `boolean` | Leva IVA |
| `estado` | `'rascunho' \| 'enviada' \| 'recebida'` | Estado. `'recebida'` quer dizer levantada |
| `anexoId` | `string?` | Ficheiro anexo |
| `notas` | `string?` | Notas |
| `enviadaEm` | `string?` | Dia em que foi enviada |
| `proforma` | `ProForma?` | Pró-forma do fornecedor |
| `pagamento` | `'pendente' \| 'pago' \| 'credito'?` | Situação do pagamento ao fornecedor |
| `pagamentos` | `PagamentoFornecedor[]?` | Pagamentos ao fornecedor. São permitidos pagamentos parciais |
| `creditoDesde` | `string?` | Desde quando está a crédito |
| `pagoEm`, `metodoPagamento`, `refPagamento` | `string?` | Dados do pagamento |
| `faturaDocId`, `reciboDocId` | `string?` | Documentos recebidos (fatura e recibo do fornecedor) |
| `levantadaEm` | `string?` | Dia do levantamento |
| `despesaLevantamentoId` | `string?` | Despesa com o custo do levantamento |

### LinhaImpressao

| Campo | Tipo | Significado |
|---|---|---|
| `qt` | `number` | Quantidade |
| `ficheiro` | `string` | Nome do ficheiro do print. É texto, não um ficheiro da app |
| `largura`, `comprimento` | `number` | Em metros. A área é qt × largura × comprimento (`m2Linha` em `src/calc.ts`) |
| `impressao`, `precoImpressao` | `string?`, `number?` | Material de impressão desta linha. Se faltar, vale o da lista. `''` quer dizer nenhum |
| `laminacao`, `precoLaminacao` | `string?`, `number?` | Laminação desta linha, com a mesma regra |

### ItemEncomenda, PagamentoFornecedor e ProForma

Ficam dentro da `Requisicao`.

| Interface | Campo | Tipo | Significado |
|---|---|---|---|
| `ItemEncomenda` | `descricao` | `string` | Produto |
| | `unidade` | `string` | Unidade |
| | `qt` | `number` | Quantidade |
| | `precoUnit` | `number` | Preço unitário |
| `PagamentoFornecedor` | `id` | `string` | Id do pagamento |
| | `data` | `string` | Dia |
| | `valor` | `number` | Valor |
| | `metodo` | `string` | Método, em texto livre |
| | `referencia` | `string?` | Referência |
| `ProForma` | `numero` | `string` | Número da pró-forma |
| | `data` | `string` | Dia |
| | `valor` | `number` | Total com IVA, tal como vem na pró-forma |
| | `ficheiroId` | `string?` | PDF ou foto |

### Custo

Os "Outros custos" de um trabalho, além das requisições.

| Campo | Tipo | Significado |
|---|---|---|
| `trabalhoId` | `string` | Trabalho |
| `data` | `string` | Dia |
| `descricao` | `string` | Descrição |
| `valor` | `number` | Valor |

### Documento

O arquivo de faturas e recibos, emitidos e recebidos. A app nunca numera faturas: o número é o do livro de faturas ou do documento recebido (os campos dizem "Nº do seu livro", em `src/pages/Rapido.tsx`).

| Campo | Tipo | Significado |
|---|---|---|
| `direcao` | `'emitido' \| 'recebido'` | Passado ao cliente ou recebido de um fornecedor |
| `tipo` | `TipoDocumento` | `'fatura' \| 'fatura-recibo' \| 'venda-dinheiro' \| 'recibo' \| 'nota-credito' \| 'outro'`. Contam para o IVA a fatura, a fatura-recibo, a venda a dinheiro e a nota de crédito (`contaParaIva` em `src/calc.ts`) |
| `numero` | `string` | Número do documento |
| `data` | `string` | Dia |
| `entidade` | `string` | Nome do cliente ou do fornecedor |
| `nuit` | `string?` | NUIT da entidade |
| `clienteId`, `fornecedorId` | `string?` | Cliente ou fornecedor |
| `trabalhoId` | `string?` | Primeiro trabalho coberto |
| `trabalhoIds` | `string[]?` | Todos os trabalhos cobertos (uma fatura pode cobrir vários) |
| `base`, `iva`, `total` | `number` | Valores |
| `ficheiroId` | `string?` | Foto ou PDF |
| `notas` | `string?` | Notas |
| `despesaId` | `string?` | Despesa que deu origem ao documento |
| `requisicaoId` | `string?` | Requisição (fatura ou recibo do fornecedor) |
| `faturaId` | `string?` | Num recibo, a fatura que paga. Vários recibos para a mesma fatura são prestações |

### Cotacao

| Campo | Tipo | Significado |
|---|---|---|
| `numero` | `string` | `COT-NNN-MÊS/AA`. A numeração recomeça cada mês (`numeroDoMes`) |
| `data` | `string` | Dia |
| `clienteId` | `string` | Cliente |
| `itens` | `ItemCotacao[]` | Linhas da cotação |
| `validadeDias` | `number` | Validade em dias. Começa com `Empresa.validadeCotacao` |
| `notas` | `string` | Texto final. Começa com `Empresa.notaCotacao` |
| `estado` | `'rascunho' \| 'enviada' \| 'aceite' \| 'recusada'` | Estado |
| `trabalhoId` | `string?` | Primeiro trabalho criado ao converter a cotação |
| `origemTrabalhoId` | `string?` | Trabalho onde a cotação foi feita |
| `notaMaterial` | `boolean?` | Imprime a nota do material no rodapé. Usa-se em cotações de wrap cujos itens não têm materiais |
| `desconto` | `number?` | Desconto em %, antes do IVA |
| `opcaoAceite` | `number?` | Opção que o cliente escolheu |

### ItemCotacao e MaterialCotacao

| Interface | Campo | Tipo | Significado |
|---|---|---|---|
| `ItemCotacao` | `qt` | `number` | Quantidade |
| | `titulo`, `subtitulo`, `descricao` | `string` (os dois últimos opcionais) | Textos da linha |
| | `precoUnit` | `number` | Preço unitário |
| | `materiais` | `MaterialCotacao[]?` | Materiais impressos por baixo da linha |
| | `nota` | `string?` | Última linha em negrito e itálico |
| | `opcao` | `number?` | Número da opção. Um item sem opção entra no total de todas as opções |
| | `secao` | `boolean?` | Linha de título de secção. Só o título é impresso |
| | `extra` | `boolean?` | Encargo como a deslocação. Vai com o trabalho e nunca vira trabalho próprio |
| | `urgente` | `boolean?` | Taxa de urgência só neste item, impressa numa linha própria a seguir |
| | `gerada` | `boolean?` | Linha que a app escreve (a da urgência). Nunca é gravada |
| `MaterialCotacao` | `nome` | `string` | Nome do material (impresso a vermelho) |
| | `certificado` | `boolean` | Material certificado ou não |
| | `garantia` | `string?` | Vida útil garantida pela marca. Vazio quer dizer sem garantias |
| | `marca` | `string?` | Nome da opção feita com este material (por exemplo, "OPÇÃO 1 - Taksim®") |

### Tarefa

Um afazer da agenda, com ou sem data, solto ou ligado a um trabalho (`novaTarefa` e `marcarTarefa` em `src/acoes.ts`).

| Campo | Tipo | Significado |
|---|---|---|
| `texto` | `string` | Texto |
| `data` | `string?` | Dia |
| `trabalhoId` | `string?` | Trabalho |
| `feitaEm` | `string?` | Quando foi marcada como feita |
| `por` | `string` | Id do utilizador que a criou |

### DespesaFixa

Um custo mensal recorrente. Em cada mês aparece como pendente, a pagar ou atrasada até existir uma `Despesa` com este `fixaId` e esse `mes` (`EstadoFixa` em `src/calc.ts`).

| Campo | Tipo | Significado |
|---|---|---|
| `nome` | `string` | Nome |
| `categoria` | `string` | Categoria |
| `valor` | `number` | Valor mensal |
| `dia` | `number` | Último dia para pagar |
| `abre` | `number?` | Primeiro dia para pagar. Se vier depois de `dia`, o prazo passa para o mês seguinte (por exemplo, de 25 a 5) |
| `entidade` | `string?` | A quem se paga |
| `utilizadorId` | `string?` | Trabalhador (na categoria Salários) |
| `inicio` | `string` | Mês de início, `AAAA-MM` |
| `ativo` | `boolean` | Despesa activa |
| `notas` | `string?` | Notas |

### Despesa

| Campo | Tipo | Significado |
|---|---|---|
| `data` | `string` | Dia |
| `descricao` | `string` | Descrição |
| `categoria` | `string` | Categoria |
| `valor` | `number` | Total pago, com IVA |
| `iva` | `number` | IVA dedutível incluído no valor. 0 quando não há fatura |
| `entidade`, `metodo` | `string?` | A quem se pagou e como |
| `fixaId` | `string?` | Despesa fixa a que corresponde |
| `mes` | `string?` | Mês (`AAAA-MM`) a que a despesa fixa se refere |
| `ficheiroId` | `string?` | Foto ou PDF |
| `notas` | `string?` | Notas |
| `documento` | `'fatura' \| 'venda-dinheiro' \| 'recibo' \| 'nenhum'?` | Documento que a loja entregou |
| `numeroDoc` | `string?` | Número desse documento |
| `pessoal` | `boolean?` | Gasto pessoal do dono feito com dinheiro da empresa. Sai da caixa mas não conta como custo |
| `pessoalEstado` | `'reposto' \| 'autorizado'?` | Como ficou resolvido: devolvido à empresa, ou aceite como uso próprio |
| `pessoalEm` | `string?` | Dia em que foi reposto ou autorizado |

### Relatorio

O relatório diário de um trabalhador (ou do próprio Momad).

| Campo | Tipo | Significado |
|---|---|---|
| `data` | `string` | Dia |
| `utilizadorId` | `string` | Quem escreveu |
| `feito` | `string` | O que fez ("O que fiz hoje") |
| `aFazer` | `string?` | O que falta fazer ("O que falta / amanhã") |
| `problemas` | `string?` | Problemas ou o que precisa |
| `trabalhosIds` | `string[]` | Trabalhos referidos |
| `fotos` | `string[]` | Ids de ficheiros |

### Ficheiro

Tabela `ficheiros`. **Não vai para a nuvem.**

| Campo | Tipo | Significado |
|---|---|---|
| `id` | `string` | Id, guardado pelos outros registos (`logoId`, `ficheiroId`, `anexoId`, `fotos`, `ficheiros`) |
| `nome` | `string` | Nome original |
| `mime` | `string` | Tipo (por exemplo, `image/jpeg` ou `application/pdf`) |
| `tamanho` | `number` | Bytes |
| `blob` | `Blob` | O conteúdo |
| `createdAt` | `string` | Quando foi guardado |

### Registo

O histórico de acções, escrito por `registar()` (por exemplo, "criou ...", "moveu ... para ..."). Vai para a nuvem, mas nenhum ecrã da app o mostra por agora.

| Campo | Tipo | Significado |
|---|---|---|
| `id` | `string` | Id |
| `em` | `string` | Quando (ISO). É a versão na sincronização |
| `por` | `string` | Id do utilizador |
| `acao` | `string` | Texto da acção |
| `alvo` | `string?` | Id do registo afectado |

### Nuvem

Tabela `meta`, chave `'nuvem'` (é a única linha). Guarda o estado que só pertence ao aparelho e **não vai para a nuvem**.

| Campo | Tipo | Significado |
|---|---|---|
| `id` | `'nuvem'` | Chave fixa |
| `token` | `string` | Token da sessão. `''` quer dizer que a sessão terminou mas o aparelho continua ligado à empresa |
| `empresa` | `string` | Código da empresa |
| `nome` | `string` | Nome da empresa na nuvem |
| `cursor` | `number` | Maior `seq` recebido da nuvem |
| `marca` | `string` | Hora (ISO) em que começou o último envio. `''` quer dizer "enviar tudo" |
| `esquema` | `number?` | Valor de `ESQUEMA` com que o aparelho puxou da última vez |

Fora da IndexedDB, o aparelho guarda no `localStorage` só preferências:

- `pg_sessao`: utilizador escolhido no ecrã de PIN;
- `pg_tema`: tema;
- `pg_dica`: a dica de instalação foi fechada;
- `pg_vista`: vista quadro ou lista dos trabalhos;
- `pg_dev_local`: modo local, que só funciona no servidor de desenvolvimento.

### Como as entidades se ligam

O trabalho está no centro:

```
Trabalho
 |-- clienteId ------------------------> Cliente
 |-- cotacaoId ------------------------> Cotacao (em vigor)
 |-- responsavelId --------------------> Utilizador
 |-- servicoId, itens[].servicoId -----> Servico
 |-- ficheiros[], notas[].ficheiroId --> Ficheiro (só no aparelho)
 |
 |<-- Cotacao.origemTrabalhoId (feita dentro do trabalho)
 |<-- Cotacao.trabalhoId (primeiro trabalho criado ao converter)
 |<-- Pagamento.trabalhoId ---- reciboId ------------> Documento (recibo ou fatura-recibo emitido)
 |<-- Requisicao.trabalhoId --- fornecedorId --------> Fornecedor
 |                          |-- faturaDocId, reciboDocId -> Documento (recebido)
 |                          '-- despesaLevantamentoId ---> Despesa
 |<-- Documento.trabalhoId / Documento.trabalhoIds[]
 |<-- Custo.trabalhoId
 |<-- Tarefa.trabalhoId
 '<-- Relatorio.trabalhosIds[]
```

Outras ligações:

```
Cliente <-- Cotacao.clienteId, Documento.clienteId
Documento (recibo) -- faturaId ------> Documento (fatura)
Documento -- despesaId --> Despesa ;  requisicaoId --> Requisicao ;  fornecedorId --> Fornecedor
Despesa -- fixaId + mes --> DespesaFixa -- utilizadorId --> Utilizador (salários)
Relatorio -- utilizadorId --> Utilizador
PassagemEtapa.por, NotaTrabalho.por, Tarefa.por, Registo.por --> Utilizador.id
Cliente.logoId, Fornecedor.logoId, Documento.ficheiroId, Despesa.ficheiroId,
ProForma.ficheiroId, Requisicao.anexoId, Relatorio.fotos[] --> Ficheiro
```

## Sincronização com a nuvem

### Servidor: schema `puzzle`

Criado por `db/001_puzzle_nuvem.sql`.

| Tabela | Colunas | Notas |
|---|---|---|
| `puzzle.empresas` | `id` (chave: código da empresa, em minúsculas), `nome`, `senha_hash`, `falhas`, `bloqueado_ate`, `criado_em` | A palavra-passe só existe em hash bcrypt |
| `puzzle.sessoes` | `token_hash` (chave: SHA-256 do token, em hex), `empresa_id`, `aparelho`, `criado_em`, `visto_em` | `aparelho` é um texto como "iPhone · Safari", gerado por `aparelho()` em `src/nuvem.ts` |
| `puzzle.docs` | `empresa_id`, `tabela`, `id` (chave composta), `dados` (jsonb com o registo inteiro), `versao`, `seq`, `servidor_em` | Uma linha por registo da app. Índice `docs_empresa_seq (empresa_id, seq)` |

- `sessoes` e `docs` apontam para `empresas` com `on delete cascade`: apagar uma empresa apaga as suas sessões e os seus registos.
- `seq` vem da sequência `puzzle.docs_seq`. A sequência é a mesma para todas as empresas do schema, por isso os números de uma empresa têm saltos. O que conta é que crescem sempre.
- As três tabelas têm RLS activo e nenhuma política. O schema tem `revoke all ... from public, anon, authenticated`. Pela API, ninguém lê nem escreve nestas tabelas directamente.
- As funções usam `extensions.crypt`, `extensions.gen_salt`, `extensions.digest` e `extensions.gen_random_bytes`, por isso a extensão pgcrypto tem de estar no schema `extensions`.
- As funções públicas ficam no schema `public`, que a API já expõe. O schema `puzzle` não precisa de ser exposto.
- Uma empresa cria-se à mão, por SQL. Não há função para isso (ver [Administração por SQL](#administração-por-sql)).

### Funções (RPC)

Todas são `security definer` e têm `set search_path = ''`, com referências sempre qualificadas. As cinco públicas só têm `execute` para `anon` e `authenticated`. Do lado da app, `rpc()` em `src/nuvem.ts` faz um `POST` ao endereço `API` (o caminho `/rest/v1/rpc/` do Supabase) mais o nome da função, com a chave pública nos cabeçalhos `apikey` e `Authorization`. Um erro HTTP vira `ErroNuvem` com a mensagem do servidor.

| Função | Parâmetros | Devolve | O que faz |
|---|---|---|---|
| `puzzle.empresa_do_token` (interna) | `p_token` | id da empresa | Procura a sessão pelo SHA-256 do token e actualiza `visto_em`. Se a sessão não existir, lança o erro `sessao` (código 28000). `anon` e `authenticated` não a podem chamar |
| `puzzle_entrar` | `p_empresa`, `p_senha`, `p_aparelho` | `{token, empresa, nome}` ou `{erro: 'credenciais' \| 'bloqueado'}` | Normaliza o código (`lower(trim())`), verifica o bloqueio e compara a palavra-passe com bcrypt. Numa falha, soma-a ao contador. Numa entrada certa, põe as falhas a 0, cria a sessão e devolve o token |
| `puzzle_puxar` | `p_token`, `p_desde` (0), `p_limite` (500) | `{docs: [{t, d}], ate}` | Devolve os registos com `seq > p_desde`, por ordem de `seq`. O limite fica sempre entre 1 e 1000. `ate` é o maior `seq` devolvido, ou `p_desde` quando não vem nada |
| `puzzle_enviar` | `p_token`, `p_docs` | `{aceites}` | Grava um lote (insere ou actualiza). Um registo só substitui o guardado se a sua versão for maior. Ver [Envio](#envio-enviar) |
| `puzzle_mudar_senha` | `p_token`, `p_atual`, `p_nova` | `{ok: true}` ou `{erro: 'senha' \| 'curta'}` | Confirma a palavra-passe actual, exige pelo menos 8 caracteres na nova, grava o hash bcrypt (custo 10) e apaga as outras sessões da empresa |
| `puzzle_sair` | `p_token` | nada | Apaga a sessão deste token |

### Migrações

- `db/001_puzzle_nuvem.sql` cria o schema, as tabelas, os índices e as seis funções.
- `db/002_puzzle_tarefas.sql` volta a criar `puzzle_enviar` com `'tarefas'` na lista de tabelas aceites. Foi aplicada no Supabase a 16 de Outubro de 2026, como migração `puzzle_002_tarefas`. No repositório, o ficheiro 001 já mostra a lista com `'tarefas'`. Numa base nova, correr o 001 e depois o 002 dá o mesmo resultado.

### Lista fixa de tabelas

Há duas listas que têm de ser iguais:

- `TABELAS` em `src/nuvem.ts`, do lado da app;
- o array `tabs` dentro de `puzzle_enviar`, do lado do servidor.

As 16 tabelas são:

- `empresa`, `utilizadores`, `clientes`, `fornecedores`;
- `servicos`, `trabalhos`, `pagamentos`, `requisicoes`;
- `custos`, `documentos`, `cotacoes`, `registos`;
- `despesasFixas`, `despesas`, `relatorios`, `tarefas`.

Ficam de fora `ficheiros` (os blobs) e `meta` (o estado do aparelho).

### Versão de um registo

`versao(d)` em `src/nuvem.ts` usa o primeiro destes campos que não estiver vazio: `updatedAt`, `em` (no caso dos registos de histórico) ou `createdAt`. As versões são textos ISO 8601 UTC, todos no mesmo formato. Por isso, comparar os textos é o mesmo que comparar as datas.

A app envia a versão no campo `v` de cada elemento. O servidor guarda esse valor na coluna `versao` e não o lê de dentro do registo. O servidor e a app comparam da mesma maneira, e só aceitam uma versão **estritamente maior**.

### Hooks Dexie

`instalarHooks()` em `src/nuvem.ts` é chamada em `src/main.tsx` antes de qualquer escrita, e também em `admin/carregar.ts`. Instala dois hooks em cada tabela de `TABELAS`:

- `creating`: numa escrita local, põe `_loc` igual a agora e marca uma sincronização. O `updatedAt` que vem no objecto mantém-se. É por isso que os registos do seed ficam com datas antigas.
- `updating`: numa escrita local que muda alguma coisa, marca uma sincronização e **força** `updatedAt` e `_loc` para agora. Qualquer alteração de um registo que já existe passa assim a ser a versão mais recente, mesmo que o código não tenha chamado `guardar()`.

As escritas que vêm da nuvem (`aplicar()`) correm numa transacção marcada `__remoto`. Os hooks ignoram essas escritas, por isso os registos ficam com a versão que trouxeram, sem `_loc`, e nunca são reenviados.

O que **não** sincroniza:

- não há hook `deleting`, por isso `delete()`, `bulkDelete()` e `clear()` só apagam no aparelho. No código, isto acontece:
  - em `apagarExemplos()` e `catalogoComIdsFixos()` (`src/seed.ts`);
  - em `entrar()`;
  - em `repor()`;
- as escritas nas tabelas `ficheiros` e `meta`.

### Envio (`enviar`)

1. Guarda a hora de início do envio.
2. Percorre todas as tabelas de `TABELAS`. Se `marca` estiver vazia (primeiro envio do aparelho para uma nuvem vazia), junta todos os registos. Caso contrário, junta só os que têm `_loc >= marca`.
3. Retira `_loc` e calcula a versão. Um registo sem versão não segue.
4. Envia em lotes de 200 (`LOTE`) para `puzzle_enviar`.
5. No fim, `marca` passa a ser a hora de início. As alterações feitas durante o envio têm `_loc` igual ou posterior a essa hora e vão no envio seguinte.

No servidor, `puzzle_enviar` faz isto:

- recusa o lote inteiro (erro `lote invalido`) se não for uma lista ou se tiver mais de 500 elementos;
- **ignora sem erro** cada elemento com um destes problemas:
  - tabela fora da lista;
  - `id` vazio;
  - versão vazia;
  - mais de **300.000 caracteres** (o elemento `{t, v, d}` inteiro, em texto JSON);
- insere o registo, ou actualiza-o só se `versao` guardada < `versao` nova. Uma actualização aceite recebe um `seq` novo e `servidor_em = now()`;
- devolve `aceites`, mas a app não lê este número.

### Descida (`puxar`)

1. Pede `puzzle_puxar` a partir de `cursor - 100`, nunca abaixo de 0. A sobreposição conta-se em números de `seq`, não em linhas. Serve para apanhar uma escrita que recebeu um `seq` mais baixo mas só ficou gravada depois de outra com `seq` mais alto.
2. `aplicar()` agrupa os registos por tabela e ignora tabelas desconhecidas e registos sem `id`. Depois, numa transacção `__remoto`, só grava os que não existem no aparelho ou que têm versão maior do que a local.
3. Se `ate` passar o cursor, o cursor avança.
4. Repete enquanto vierem páginas cheias (`PAGINA = 500`) e o cursor avançar, até 100 voltas por sincronização. O que faltar desce na sincronização seguinte.

Os registos da sobreposição voltam a descer, mas não mudam nada porque a versão é igual.

### Conflitos: last-write-wins

- A unidade de conflito é o **registo inteiro**, não o campo. Se dois aparelhos alterarem o mesmo trabalho sem ligação, fica a alteração com o `updatedAt` mais recente e a outra perde-se, mesmo que tenha mexido noutro campo.
- Exemplo:
  1. O aparelho A altera o trabalho X às 10:00, sem internet.
  2. O aparelho B altera o mesmo X às 10:05 e envia.
  3. Quando A volta a ter rede, o servidor recusa a versão das 10:00.
  4. A puxa a versão das 10:05 e a alteração de A desaparece.
- As versões vêm do relógio de cada aparelho (`agora()`). O fuso horário não importa, porque tudo é UTC. Um aparelho com o relógio adiantado ganha os conflitos e um atrasado perde-os.
- Apagar é só mais uma escrita (`deleted = true`). Se outro aparelho, que ainda não viu o apagamento, editar o mesmo registo mais tarde, a sua versão é mais recente e o registo volta a aparecer.

### Quando sincroniza

`iniciarSincronizacao()` (chamada em `src/main.tsx`) sincroniza:

- ao abrir a app;
- de 30 em 30 segundos;
- quando volta a rede (evento `online`);
- quando a app volta a ficar visível (`visibilitychange`);
- 1,5 segundos depois da última escrita local (`agendar()`, chamada pelos hooks; o temporizador recomeça a cada escrita);
- quando o utilizador toca no estado da nuvem (barra lateral) ou em "Sincronizar agora" (Definições, cartão Nuvem).

O ecrã `Ligar` também chama `sincronizar()` logo depois de entrar.

`sincronizar()` corre uma vez de cada vez. Se for chamada durante uma corrida, repete 300 ms depois de ela acabar. Cada corrida faz isto:

1. Lê `meta.nuvem`. Sem token, a fase fica `desligado`. Sem rede (`navigator.onLine === false`), fica `offline` e não tenta nada.
2. Se `esquema < ESQUEMA`, põe o cursor a 0. Ver [ESQUEMA](#esquema-forçar-uma-nova-descida).
3. Envia, puxa e só no fim grava `meta.nuvem` (cursor, marca, esquema). Se falhar a meio, a corrida seguinte repete o trabalho. Isto é seguro porque as versões impedem que uma escrita velha se sobreponha.
4. Se o erro for `sessao`, ver [Sair, sessão terminada e desligar](#sair-sessão-terminada-e-desligar). Os outros erros deixam a fase em `erro` (ou em `offline`, se a rede caiu) com a mensagem.

O texto de cada fase está em `textoNuvem()` (`src/App.tsx`):

| Fase | Texto |
|---|---|
| `parado` | "Na nuvem · HH:MM" (só "Na nuvem" antes da primeira sincronização) |
| `a-sincronizar` | "A sincronizar…" |
| `offline` | "Sem internet · guardado no aparelho" |
| `erro` | "Erro ao sincronizar · toque para tentar" |
| `desligado` | "Não ligado à nuvem" |

### ESQUEMA: forçar uma nova descida

`ESQUEMA = 2` em `src/nuvem.ts`. Uma versão antiga da app ignora, ao puxar, os registos de tabelas que não conhece, mas o cursor avança na mesma. Por isso, quando se acrescenta uma tabela, sobe-se `ESQUEMA`.

Cada aparelho com `esquema` menor põe o cursor a 0 uma vez e volta a descer tudo. Só as versões maiores são aplicadas, por isso nada se estraga. O valor passou a 2 quando entrou a tabela `tarefas`.

### Tabela nova: passos obrigatórios

1. Acrescentar `this.version(6).stores({ ... })` em `src/db.ts`, com a interface nova.
2. Acrescentar a tabela a `TABELAS` em `src/nuvem.ts`. Os hooks, o envio, `aplicar()` e `entrar()` usam esta lista.
3. Criar `db/003_...sql`, que volta a criar `puzzle_enviar` com a tabela no array `tabs`, e aplicá-lo no Supabase.
4. Subir `ESQUEMA` em `src/nuvem.ts`.
5. Se a interface precisar dos dados, carregar a tabela no `DadosProvider` (`src/state.tsx`). Ponderar também juntá-la à cópia de segurança (`exportar()` em `src/pages/Definicoes.tsx`).

A ordem importa: **aplicar a migração no servidor antes de publicar a app**. Se a app chegar primeiro, o servidor ignora em silêncio os registos da tabela nova e a `marca` avança. Esses registos só voltam a ser enviados quando forem alterados.

Um campo novo e opcional num registo existente não precisa de migração, porque o registo viaja inteiro em JSON.

### Ligar um aparelho (`entrar`)

O ecrã `Ligar` (`src/App.tsx`) aparece sempre que o aparelho não tem token (fora do modo local de desenvolvimento). Pede só a palavra-passe. O código da empresa já vem preenchido e só se mostra com o botão "Outra empresa". Depois de entrar, o ecrã chama `semear()` e `sincronizar()`.

| Situação | O que acontece |
|---|---|
| Aparelho novo (sem `meta.nuvem`) e nuvem vazia | Cria `meta` com cursor 0, `marca` vazia e `esquema` actual. Não desce nada. O `semear()` cria a empresa, o catálogo e o primeiro utilizador. A sincronização seguinte envia tudo o que está no aparelho, que passa a ser a primeira cópia |
| Aparelho novo e nuvem com dados | A app pergunta com `puzzle_puxar` (limite 1) se a nuvem tem dados. Se tiver, **apaga no aparelho as 16 tabelas** numa transacção, põe `marca` igual a agora e desce tudo. Os registos antigos do aparelho, criados antes da nuvem com ids próprios, desaparecem para não haver duplicados. Os ficheiros (blobs) ficam, porque os registos da nuvem podem apontar para eles. O ecrã avisa: "Este aparelho fica com os dados da empresa que estão na nuvem." |
| Aparelho que já esteve ligado (`meta` com token vazio) | Mantém o cursor e a marca e grava o token novo. Primeiro **envia** o que mudou no aparelho e só depois desce. O ecrã avisa: "O que mudou neste aparelho sobe para a nuvem quando entrar." |

Se a entrada falhar, o ecrã mostra "Código da empresa ou palavra-passe errados." ou "Demasiadas tentativas. Tente outra vez daqui a 10 minutos." (`entrar()` em `src/nuvem.ts`).

No arranque (`arrancar()` em `src/main.tsx`), `semear()` só corre se o aparelho já tiver o registo `empresa` ou estiver no modo local de desenvolvimento. Um aparelho novo não cria dados antes de se ligar.

### Sair, sessão terminada e desligar

| Acção | Onde | Efeito |
|---|---|---|
| Sair, com um só utilizador activo | Botão "Sair" ou cartão do utilizador | `terminarSessao()`: sincroniza, chama `puzzle_sair` e grava o token como `''` (a `meta` fica). Volta ao ecrã da palavra-passe e os dados locais ficam |
| Sair, com vários utilizadores activos | Mesmo sítio | Só limpa `pg_sessao` e volta ao ecrã de PIN. A sessão na nuvem continua |
| Sessão terminada pelo servidor | Automático | Uma chamada recebe `sessao` (palavra-passe mudada noutro aparelho, ou sessão apagada). O token fica `''`, os cursores ficam, aparece "A sessão terminou. Entre outra vez." e, ao entrar, as alterações pendentes sobem |
| Mudar palavra-passe | Definições, cartão Nuvem | `puzzle_mudar_senha`. As outras sessões são apagadas e os outros aparelhos voltam ao ecrã da palavra-passe na sincronização seguinte |
| Desligar este aparelho | Definições, cartão Nuvem | `desligar()`: sincroniza, chama `puzzle_sair` e **apaga `meta`**. Os dados locais ficam, mas na próxima ligação o aparelho é tratado como novo (ver a tabela anterior) |
| Recomeçar este aparelho | Definições, cartão Dados | `desligar()` seguido de `repor()`: apaga a base local inteira, incluindo os ficheiros, e recarrega |

O cartão Nuvem fica em Definições → Empresa, que só o dono vê (acção `definicoes`).

### Limites

| Limite | Valor | Onde |
|---|---|---|
| Tamanho de um registo enviado | 300.000 caracteres (JSON do elemento `{t, v, d}`) | `puzzle_enviar` |
| Elementos por chamada a `puzzle_enviar` | 500 no servidor; a app envia 200 | `puzzle_enviar`, `LOTE` |
| Registos por página ao puxar | a app pede 500; o servidor aceita entre 1 e 1000 | `PAGINA`, `puzzle_puxar` |
| Páginas por sincronização | 100 | `puxar()` |
| Sobreposição do cursor | 100 números de `seq` | `puxar()` |
| Texto do aparelho na sessão | 160 caracteres | `puzzle_entrar` |

### Cuidados conhecidos

- **Registos ignorados em silêncio.** Um registo com mais de 300.000 caracteres, ou de uma tabela que o servidor não aceita, não sobe e a app não dá erro. Como a `marca` avança, só volta a ser tentado depois de outra alteração.
- **Registo inteiro e relógios.** Ver [Conflitos](#conflitos-last-write-wins). Convém que os aparelhos tenham a hora certa automática.
- **Números internos.** `T-AAAA-NNN`, `COT-NNN-MÊS/AA` e `REQ-NNN-MÊS/AA` são calculados no aparelho a partir dos registos que ele conhece. Dois aparelhos sem ligação podem criar o mesmo número. Os ids nunca colidem.
- **Desligar sem internet.** `desligar()` tenta sincronizar, mas sem rede não envia nada e apaga `meta` na mesma. Se depois o aparelho se ligar a uma nuvem com dados, as tabelas locais são apagadas e as alterações pendentes perdem-se. Desligar só com internet.
- **Mudar de empresa no mesmo aparelho.** Os dados locais não estão separados por empresa. Há dois casos:
  - entrar noutra empresa ("Outra empresa") com a `meta` antiga mantém o cursor e a marca da primeira, e envia para a nova as alterações pendentes;
  - depois de "Desligar", uma empresa vazia recebe todos os dados do aparelho como primeira cópia.

  Antes de trocar de empresa, usar "Recomeçar este aparelho".
- **`SEED_VERSAO`.** Subir este valor em `src/seed.ts` faz correr outra vez `apagarExemplos()`, `semearReal()` e `renumerar()`. `renumerar()` refaz, por ordem de data, os códigos dos trabalhos e os números das requisições e cotações no formato `T-/REQ-/COT-AAAA-NNN`, e essas escritas sincronizam. Isto mudaria códigos de trabalhos e estragaria a numeração mensal das cotações e das requisições. Não subir sem rever `renumerar()`.
- **Correcções de arranque.** `correcoes()` (`src/seed.ts`) corre sempre que `semear()` corre: ordem do catálogo, ids fixos do catálogo e conversão de `producao` para `branding`. São escritas normais e sincronizam, excepto o apagamento dos ids antigos do catálogo, que é só local.
- **Apagar a app instalada.** No iPhone e no iPad, remover a app do ecrã principal apaga a base local dessa app, incluindo os ficheiros que só existem lá. Limpar os dados do site no navegador tem o mesmo efeito. Para actualizar a app usa-se "Atualizar app" (`atualizarApp()` em `src/versao.ts`), que remove o service worker e as caches sem tocar na IndexedDB.
- **Textos desactualizados.** O indicador no topo das páginas (`Page` em `src/App.tsx`) e o cartão Dados em Definições ainda descrevem o protótipo sem nuvem ("guardado no aparelho", "Na versão 1 passam a sincronizar").

## Segurança

### Onde está cada segredo

| Elemento | Onde fica | Notas |
|---|---|---|
| Chave pública (anon) do Supabase | Constante `KEY` em `src/nuvem.ts`, dentro do código publicado | É pública por desenho. Não deve ser tratada como segredo |
| Endereço da API | Constante `API` em `src/nuvem.ts` | Público |
| Palavra-passe da empresa | Só como hash bcrypt em `puzzle.empresas.senha_hash` | Nunca no código nem no repositório |
| Token de sessão | No aparelho, em IndexedDB (`meta.nuvem.token`). No servidor, só o SHA-256 | Dá acesso a todos os dados da empresa enquanto a sessão existir |
| PIN de cada utilizador | Campo `pin` do registo `Utilizador`, em texto simples, no aparelho e na nuvem | Não protege dados (ver abaixo) |
| Palavra-passe para o carregador | Variável de ambiente `PUZZLE_SENHA`, só durante a execução | Nunca em ficheiro |

### Chave pública

A chave anon vai dentro do JavaScript que qualquer pessoa descarrega, e isso está previsto. No que diz respeito a esta app, a chave só permite chamar as cinco funções `puzzle_*`. As tabelas do schema `puzzle` estão fechadas pelo `revoke` do schema e pelo RLS sem políticas.

Sem um token válido, `puzzle_puxar`, `puzzle_enviar` e `puzzle_mudar_senha` devolvem o erro `sessao`. A protecção real é a palavra-passe da empresa, que dá o token, e o próprio token.

### Palavra-passe da empresa

- Fica guardada só em bcrypt (`extensions.crypt` com `gen_salt('bf', 10)`).
- Um código de empresa errado e uma palavra-passe errada dão a mesma resposta (`credenciais`). Só uma empresa que existe pode responder `bloqueado`.
- **Bloqueio:** à 5.ª falha, as entradas ficam bloqueadas 10 minutos. O contador `falhas` só volta a zero com uma entrada certa. Por isso, depois do primeiro bloqueio, cada nova tentativa errada bloqueia mais 10 minutos.
- O bloqueio é por empresa, não por aparelho. Tentativas erradas vindas de qualquer lado impedem novas entradas para todos. Os aparelhos que já estão ligados continuam a sincronizar, porque usam o token.
- Mudar a palavra-passe exige uma sessão válida e a palavra-passe actual. A nova tem de ter pelo menos 8 caracteres. Todas as outras sessões terminam. Na mudança não há limite de tentativas, mas é preciso ter um token.
- Não há "esqueci a palavra-passe". Repor faz-se por SQL.

### Token de sessão

- São 32 bytes aleatórios (`gen_random_bytes`), entregues em hex. O servidor guarda só o SHA-256.
- No aparelho fica na IndexedDB (`meta`), não no `localStorage`.
- Não expira com o tempo. `visto_em` é actualizado em cada chamada que valida o token, mas só serve para informação. A sessão acaba de uma destas formas:
  - com `puzzle_sair`;
  - com uma mudança de palavra-passe noutro aparelho;
  - quando é apagada por SQL.
- Quem tiver acesso ao navegador de um aparelho ligado tem acesso aos dados. Num aparelho com um só utilizador, "Sair" apaga o token.

### Papéis e PIN

As permissões estão em `PERM` (`src/state.tsx`). Aplicam-se nos menus (`useAreas` em `src/App.tsx`), no ecrã "Sem acesso" e dentro das páginas através de `pode()`: botões de apagar, valores em dinheiro e trabalhos de outras pessoas.

| Papel | Acções permitidas |
|---|---|
| `dono` | `financas`, `iva`, `despesas`, `equipa`, `definicoes`, `apagar`, `todosTrabalhos`, `editarTrabalho` |
| `gerente` | `financas`, `todosTrabalhos`, `editarTrabalho` |
| `trabalhador` | nenhuma (vê Trabalhos, Agenda e Relatórios, e só os trabalhos de que é responsável) |

- **As permissões só existem na interface.** A nuvem tem uma palavra-passe por empresa e não sabe quem é o utilizador. Qualquer aparelho ligado desce todos os registos da empresa, incluindo despesas, salários e gastos pessoais, e pode escrever em qualquer tabela.
- O PIN tem 4 algarismos e é único entre os utilizadores (`src/pages/Equipa.tsx`). É comparado no navegador com `Utilizador.pin` (`Login` em `src/App.tsx`) e não tem limite de tentativas.
- Com um só utilizador activo, a app não pede PIN (`unico` em `src/App.tsx`).
- Quando o PIN ainda é o inicial, o ecrã de PIN mostra um aviso com o próprio PIN e pede para o mudar em Definições → Equipa.
- O PIN serve para escolher quem está a usar o aparelho, não para proteger dados. Antes de entregar a app a trabalhadores nos seus próprios telemóveis, convém pôr as permissões no servidor (por exemplo, sessões por utilizador e filtros nas funções `puzzle_*`).

### Ficheiros só no aparelho

- Os blobs (`ficheiros`) não sobem para a nuvem e não entram na cópia de segurança JSON. O cartão Nuvem diz isso ao utilizador: "Os ficheiros (PDF e fotos) ainda ficam só no aparelho onde foram carregados."
- Noutro aparelho, o registo aponta para um id que não existe lá:
  - a miniatura não aparece (`Thumb` em `src/ui.tsx` não desenha nada);
  - o visualizador mostra "Ficheiro não encontrado" (`src/Visualizador.tsx`);
  - o logotipo do cliente não sai na cotação (`logoDoCliente` em `src/cotacaoPdf.tsx`).
- Perdem-se com "Recomeçar este aparelho", com a remoção da app instalada ou com a limpeza dos dados do site. Ligar o aparelho a uma nuvem com dados não os apaga.
- Os ficheiros na nuvem são uma das decisões em aberto com o Momad (ver [Alterações de dados previstas](#alterações-de-dados-previstas-não-implementadas)).

### Cópia de segurança JSON

O botão "Descarregar cópia de segurança" fica em Definições, cartão Dados (`exportar()` em `src/pages/Definicoes.tsx`). Só o dono o vê.

- Gera o ficheiro `puzzle-gestao-copia-AAAA-MM-DD.json`, com o campo `exportado` (ISO) e o conteúdo completo de 11 tabelas:
  - `utilizadores`, `clientes`, `fornecedores`, `servicos`;
  - `trabalhos`, `pagamentos`, `requisicoes`, `custos`;
  - `documentos`, `cotacoes`, `empresa`.
- Inclui os registos apagados e o campo interno `_loc`.
- **Não inclui** `despesasFixas`, `despesas`, `relatorios`, `tarefas`, `registos` nem os ficheiros.
- A app não tem função para restaurar esta cópia.
- O ficheiro tem os PINs dos utilizadores e os dados financeiros. Deve ser tratado como confidencial.

A cópia completa das 16 tabelas é a que está na nuvem (`puzzle.docs`).

### Dados reais fora do repositório

- O código só traz dados de referência:
  - em `src/seed.ts`, os dados da empresa (`EMPRESA`), o catálogo de serviços (`CATALOGO`) e o primeiro utilizador;
  - em `src/requisicaoPdf.tsx`, o preçário 2026 da Académica (`PRECARIO_ACADEMICA_2026`).
- Os clientes, trabalhos, documentos e dívidas reais vivem na nuvem, não no código.
- O repositório **não inclui**:
  - `admin/dados`, com os scripts que carregaram os dados reais;
  - `admin/ficheiros`;
  - os documentos reais da Académica em `test/fixtures`.
  - `admin/referencia-academica.ts` (preçário e dados bancários do fornecedor; a app não o usa).

  Foram retirados por privacidade. Os testes que lêem PDFs reais também não estão aqui; em `src/leitura.test.ts` fica o teste de leitura de números.

### Carregador `admin/carregar.ts`

O carregador põe lotes de dados reais directamente na nuvem, sem os meter no código publicado. Funciona como mais um aparelho:

1. Usa uma IndexedDB em memória (`fake-indexeddb/auto`).
2. Desvia os pedidos a caminhos que começam por `/` para a pasta `public/`, como faria o servidor de desenvolvimento. O seed actual já não faz estes pedidos, por isso o desvio só serve a scripts que precisem dele.
3. Desliga a tabela `ficheiros`: `put` devolve só o id e `get` não devolve nada. Um script que chame `guardarFicheiro()` recebe um id, mas o ficheiro não fica guardado em lado nenhum.
4. Lê `PUZZLE_SENHA`. Se faltar, pára com "Falta PUZZLE_SENHA".
5. Instala os hooks e entra com o código da empresa que está fixo no script. Desce a nuvem inteira e mostra a contagem por tabela ("nuvem antes").
6. Corre `semear()` e depois o `export default async function` do script de dados, se lhe passarem um.
7. Lista o que vai enviar ("a enviar: N", com até 80 linhas `tabela/id`, e "(apagado)" nos apagados).
8. Sem `--seco`, sincroniza e mostra o estado final.
9. No fim, mesmo que o script falhe, chama `desligar()` e fecha a sessão. Com `--seco` não sincroniza antes de sair.

Como correr: o `vite-node` vem com o `vitest` (devDependencies). A palavra-passe é a actual da empresa e só existe na variável de ambiente.

```bash
# bash: pedir a palavra-passe sem a mostrar nem a deixar no histórico
read -rs PUZZLE_SENHA && export PUZZLE_SENHA
npx vite-node admin/carregar.ts admin/dados/AAAA-MM-DD-assunto.ts --seco   # ensaio, não envia
npx vite-node admin/carregar.ts admin/dados/AAAA-MM-DD-assunto.ts          # envia
unset PUZZLE_SENHA
```

```powershell
# PowerShell (Windows)
$env:PUZZLE_SENHA = '...'; npx vite-node admin/carregar.ts admin/dados/AAAA-MM-DD-assunto.ts --seco
Remove-Item Env:PUZZLE_SENHA
```

Os scripts de dados não estão no repositório. Seguem este formato:

```ts
// admin/dados/AAAA-MM-DD-assunto.ts
import { db, guardar } from '../../src/db'

export default async function () {
  const t = await db.trabalhos.get('<id do trabalho>')
  if (t) await guardar(db.trabalhos, { ...t, prazo: '2026-10-31' })
}
```

Um script que só lê, por exemplo um relatório de dívidas, corre com `--seco`.

### Administração por SQL

Estes comandos correm no editor SQL do Supabase, com permissões de administrador. Os valores entre `< >` substituem-se. Nunca se guardam palavras-passe em ficheiros.

```sql
-- criar uma empresa (código em minúsculas; palavra-passe com 8 caracteres ou mais)
insert into puzzle.empresas (id, nome, senha_hash)
values ('<codigo>', '<Nome>', extensions.crypt('<palavra-passe>', extensions.gen_salt('bf', 10)));

-- repor a palavra-passe (não termina as sessões; ver o comando seguinte)
update puzzle.empresas
   set senha_hash = extensions.crypt('<nova>', extensions.gen_salt('bf', 10))
 where id = '<codigo>';

-- obrigar todos os aparelhos a entrar outra vez
delete from puzzle.sessoes where empresa_id = '<codigo>';

-- ver os aparelhos ligados
select aparelho, criado_em, visto_em from puzzle.sessoes where empresa_id = '<codigo>' order by visto_em desc;

-- levantar o bloqueio por tentativas erradas
update puzzle.empresas set falhas = 0, bloqueado_ate = null where id = '<codigo>';
```

### Projecto Supabase

O schema `puzzle` vive no projecto Supabase `kb-academy`, da KingBalas, partilhado com outros sistemas (comentários no topo de `src/nuvem.ts` e de `db/001_puzzle_nuvem.sql`). Ficou aí por decisão de 15 de Outubro de 2026 e pode passar mais tarde para uma conta da própria empresa. Os dados da empresa ficam separados no schema `puzzle` e não há acesso directo a eles pela API.

Procedimento previsto para a mudança (ainda não feito):

1. Correr `db/001` e `db/002` no projecto novo.
2. Copiar as linhas de `puzzle.empresas` e `puzzle.docs`. Há duas formas de tratar o `seq`:
   - copiar sem a coluna `seq`, para a sequência nova os numerar;
   - copiá-la e acertar `puzzle.docs_seq` acima do maior `seq` copiado.
3. Mudar `API` e `KEY` em `src/nuvem.ts`.
4. Subir `ESQUEMA`, porque os cursores antigos não valem no projecto novo.
5. Publicar a app. Os aparelhos terão de entrar outra vez. As alterações pendentes sobem ao entrar.

## Alterações de dados previstas (não implementadas)

O plano para os 5 pontos em aberto com o Momad propõe só campos opcionais. Não há tabela nova, `ESQUEMA` fica em 2 e não há `db.version(6)`. Os registos que já estão na nuvem lêem-se sem migração. **Nada disto está no código.** Depende das respostas do Momad.

| Proposta | Campos novos (todos opcionais) |
|---|---|
| Fatura do fornecedor sem pró-forma e comprovativo de pagamento | `Requisicao.fatura` (`{numero, data, valor}`), `PagamentoFornecedor.ficheiroId`. Uma fase "Fatura por pagar", calculada em `src/calc.ts` |
| Cotação enviada e negociada (versões) | `Cotacao.enviadaEm`, `aceiteEm`, `recusadaEm`, `substituiId`, `substituidaPorId`. Um estado novo, `'substituida'` |
| Requisição com envio registado | `LinhaImpressao.id`, `Requisicao.enviadaVia`, `Requisicao.enviadaPor` |
| Partes com identidade | `ItemTrabalho.id`, `estado`, `semCusto`, `cotacaoItemId`; `ItemCotacao.id`, `semCusto`; `Requisicao.itemIds`; `Custo.itemId` |
| Pagamento por parte | `Pagamento.itemId` |

Perguntas ao Momad que mexem com dados e nuvem:

- Os ficheiros (faturas, recibos, comprovativos) ficam só no aparelho por agora, ou a nuvem de ficheiros entra neste plano?
- Quando a fatura do fornecedor tiver um valor diferente da lista, o custo e o lucro do trabalho passam a usar a fatura (sem IVA)?
- Uma cotação negociada leva número novo, ou mantém o número com "v2"?
- Os lotes de um cliente com vários camiões continuam a ser trabalhos separados, ou passam a ser partes de um só trabalho?
- Basta marcar cada pagamento como sendo de uma só parte, ou é preciso repartir um pagamento entre várias partes?
- Uma requisição "Várias" (uma lista do fornecedor para vários trabalhos) continua só no Mapa de crédito, ou passa a ligar-se a mais de um trabalho?
