# Regras de negócio, decisões e pedidos em aberto

Este capítulo junta as regras que o Momad definiu para a Puzzle Stickers em Outubro de 2026 e o que ainda está por fazer.

- **Parte A**: regras e decisões em vigor. Cada uma foi confirmada no código, com o ficheiro e a função onde está.
- **Parte B**: pedidos em aberto. Inclui os 5 pontos de 19 de Outubro, o plano para os resolver, as perguntas por responder e outros pendentes.

Notas de leitura:

- Os caminhos são relativos à raiz do repositório. Os valores estão em meticais (MT).
- Os dados reais da empresa vivem na nuvem e não estão neste repositório. Também não estão aqui os scripts de carregamento (`admin/dados`), os ficheiros reais (`admin/ficheiros`) nem os documentos reais da Académica (`test/fixtures`). Os testes que lêem esses PDFs também não estão aqui. A fonte Gotham (comercial) também não: copie os ficheiros `gotham-*.woff` da empresa para `public/fonts/`.
- Algumas operações sobre os dados reais foram feitas por esses scripts. Dois exemplos: a renumeração das cotações e requisições antigas, e a passagem dos materiais da Académica para os nomes oficiais. O capítulo assinala-as como tal.

---

## Parte A — Regras e decisões em vigor

### Resumo

| # | Regra | Onde está no código | Decidida em |
|---|---|---|---|
| A1 | Cotações e requisições numeradas por mês | `src/calc.ts` · `numeroDoMes` | 16 Out |
| A2 | IVA de 16% sempre incluído nas cotações | `src/calc.ts` · `totaisCotacao` | 17 Out |
| A3 | "Não serve de comprovativo fiscal" na cotação | `src/cotacaoPdf.tsx` · `PaginaCotacao` | 14 Out (layout dele), confirmada a 16 Out |
| A4 | A app nunca cria nem numera faturas | `src/pages/Rapido.tsx` · `EmitirFatura`, `EmitirRecibo` | 13–14 Out, confirmada a 16 Out |
| A5 | Fases do trabalho | `src/calc.ts` · `ETAPAS`, `TIPOS`; `src/pages/Fases.tsx` · `FasesTrabalho` | 16 Out |
| A6 | "A receber" só conta trabalho confirmado | `src/calc.ts` · `contaParaReceber`, `confirmado` | 16 Out |
| A7 | Serviços impressos (Wrap / Branding) | `src/materiaisCotacao.ts` · `IMPRESSO`, `frasePartes` | 17 Out |
| A8 | Materiais com Certificado / Não Certificado e garantia | `src/materiaisCotacao.ts` · `MATERIAIS_COTACAO`; `src/cotacaoPdf.tsx` · `linhasDoItem` | 17 Out |
| A9 | Uma opção por material, cada uma nas suas páginas | `src/cotacaoPdf.tsx` · `paginasCotacao` | 17 Out |
| A10 | Quantidade por linha | `src/pages/cotacaoFormulario.tsx` · `NovoImpresso` | 17 Out |
| A11 | Urgência: 45% de uma unidade, em linha própria | `src/calc.ts` · `comUrgencia` | 18 Out |
| A12 | Deslocação por escalões | `src/materiaisCotacao.ts` · `DESLOCACAO` | 17 Out |
| A13 | Desconto antes do IVA | `src/calc.ts` · `totaisCotacao` | 17 Out |
| A14 | Textos finais e notas de layout | `src/materiaisCotacao.ts` · `TEXTOS_FINAIS`, `NOTAS_ITEM` | 17–18 Out |
| A15 | Da cotação aceite ao trabalho | `src/pages/Cotacoes.tsx` · `aceitarNoTrabalho`, `converter` | 14–18 Out |
| A16 | Requisição com material por linha e preçário da Académica 2026 | `src/requisicaoPdf.tsx`; `src/pages/RequisicaoForm.tsx` | 16 Out |
| A17 | Despesas fixas pagas de dia 25 a dia 5 | `src/calc.ts` · `janelaFixa`, `fixasDoMes` | 16 Out |
| A18 | Caixa | `src/calc.ts` · `movimentosCaixa`, `saldoCaixa`, `resumoCaixaMes` | 16 Out |
| A19 | Gastos pessoais: repor ou autorizar | `src/pages/Pessoal.tsx` | 18 Out |
| A20 | Catálogos prontos a enviar | `src/pages/Catalogos.tsx` · `CATALOGOS` | 18 Out |
| A21 | Uma só palavra-passe | `src/App.tsx`; `src/nuvem.ts` · `terminarSessao` | 18 Out |

### A1. Numeração das cotações e requisições

- **Formato:** `COT-002-OUT/26` e `REQ-001-OUT/26`. O número tem o prefixo, 3 dígitos, o mês abreviado (JAN … DEZ) e o ano com 2 dígitos.
- **Contagem:** recomeça todos os meses. O número novo é o maior do mesmo mês e prefixo, mais 1 (`numeroDoMes` em `src/calc.ts`). O teste está em `src/calc.test.ts`: "numbers quotes and orders per month, restarting every month".
- **Quando é atribuído:** quando o registo é criado, com a data desse dia. Acontece em três sítios:
  - nova cotação: `novaCotacao`, em `src/pages/Cotacoes.tsx`;
  - cotação feita a partir de um trabalho: `fazerCotacao`, em `src/pages/Trabalho.tsx`;
  - nova requisição: `RequisicaoForm`, em `src/pages/RequisicaoForm.tsx`.
- **Onde aparece:**
  - No PDF da cotação, ao lado da palavra "Cotação".
  - No PDF da requisição, numa etiqueta amarela por baixo de "REQUISIÇÃO DE PRINTS". Entra também no nome do ficheiro, por exemplo `REQ-001-OUT-26_<nome do trabalho>.pdf` (`nomePdf` em `src/pdfPartilha.tsx`).
  - O nome do ficheiro da cotação não leva o código. Segue o formato dos ficheiros do Momad: `Puzzle_Stickers_Cotação_<cliente>_<assunto da primeira linha>` (`imprimirCotacao` em `src/print.tsx`).
- **Trabalhos:** têm outro código, anual, como `T-2026-001` (`proximoCodigo` em `src/state.tsx`).
- São números internos. Não são números de fatura (ver A4).
- As cotações e requisições que já existiam foram renumeradas na nuvem, por ordem de data, por um script de carregamento que não está no repositório.
- **Cuidado:** se `SEED_VERSAO` subir, a função `renumerar` em `src/seed.ts` volta a escrever estes números no formato antigo (`COT-2026-001`, `REQ-2026-001`). Antes de subir essa versão, é preciso tirar as cotações e as requisições dessa função.

### A2. IVA sempre incluído nas cotações

- **Regra (17 Out):** toda a cotação inclui IVA. Não há opção de cotação sem IVA.
- **Taxa:** `Empresa.taxaIva` (16%), editável em Definições, no cartão "Regras do negócio".
- **Preços das linhas:** escrevem-se sem IVA, no campo "Valor unitário (sem IVA)" (`ItemEditor`). O formulário mostra "16% · sempre incluído" no campo IVA (`EditorCotacao` em `src/pages/cotacaoFormulario.tsx`).
- **Cálculo** (`totaisCotacao` em `src/calc.ts`): bruto → desconto → sub-total → IVA → total.
- **PDF:** mostra SUB-TOTAL, IVA 16% e a barra amarela TOTAL (`blocoTotais` em `src/cotacaoPdf.tsx`).
- **Sinal:** 50% do total com IVA (`Empresa.sinalPct`).
- **Trabalho criado a partir da cotação:**
  - os trabalhos criados com "Converter" ficam com IVA (`comIva: true` em `converter`);
  - com "Cliente aceitou", o trabalho mantém a sua caixa de IVA, que vem ligada nos trabalhos novos.

### A3. "Não serve de comprovativo fiscal"

- Todas as páginas da cotação levam `**Não serve de comprovativo fiscal` por baixo do título "Cotação" (`PaginaCotacao` em `src/cotacaoPdf.tsx`).
- A lista de Cotações repete-o no subtítulo: "No formato da Puzzle Stickers · não servem de comprovativo fiscal" (`src/pages/Cotacoes.tsx`).
- O relatório de IVA impresso diz que não substitui a declaração oficial nem o programa de faturação certificado (`imprimirIva` em `src/print.tsx`).
- O PDF da requisição (`PaginaRequisicao` em `src/requisicaoPdf.tsx`) não leva esta frase (ver B5).

### A4. A app nunca cria nem numera faturas

- **Regra (desde os requisitos de 13–14 Out, confirmada a 16 Out):** a app regista as faturas e os recibos que o Momad passa no seu livro. Guarda o número desse livro e o ficheiro (foto ou PDF). Nunca gera um número de fatura nem um documento fiscal.
- **Base legal:** Código do IVA, art. 27 (Lei n.º 32/2007, alterada pela Lei n.º 10/2025, em vigor desde 1 de Janeiro de 2026).
  - A numeração sequencial, as tipografias autorizadas (n.º 7) e os programas certificados (n.º 9) aplicam-se a faturas e documentos equivalentes.
  - Cotações e requisições podem ter numeração própria, desde que levem "Não serve de comprovativo fiscal".
  - Esta leitura deve ser confirmada pelo contabilista.
- **No código:**
  - **Botão "Fatura" do Início** abre a janela "Emitir fatura" (`EmitirFatura` em `src/pages/Rapido.tsx`):
    - O campo "Número" tem a ajuda "O número do seu livro de faturas — a app não cria números". Sem número, não grava.
    - Só lista trabalhos confirmados, com valor, não cancelados e que ainda não têm fatura.
    - Uma fatura pode cobrir vários trabalhos do mesmo cliente (`Documento.trabalhoIds`).
    - Tem o modo "Fatura-recibo (já pago)", que fica como documento do dinheiro já recebido.
  - **Botão "Recibo" do Início** abre a janela "Emitir recibo" (`EmitirRecibo`):
    - O recibo fica sempre ligado a uma fatura (`Documento.faturaId`). Vários recibos na mesma fatura correspondem a pagamento em prestações.
    - O campo "Número do recibo" tem a ajuda "O do seu livro".
    - Com a caixa "Já carreguei em 'Pago' — é só o recibo", o recibo documenta os pagamentos já registados. Sem ela, a app cria os pagamentos nos trabalhos da fatura, a começar pela dívida mais antiga.
  - **Carregar documento** (janela "Carregar fatura ou recibo", `DocumentoForm` em `src/pages/Documentos.tsx`): o número escreve-se à mão; se ficar vazio, grava "s/n". A janela diz: "O sistema não emite faturas: guarda e organiza as do seu programa oficial e as dos fornecedores."
- **Dinheiro recebido sem documento:**
  - O botão "Pago" regista o pagamento.
  - Enquanto o pagamento não tiver recibo (`Pagamento.reciboId`), o trabalho mostra "Recebido X sem fatura/recibo — falta passar o documento." e o Início avisa "recebido sem fatura/recibo" (`semDocumento` em `src/calc.ts`).
  - "Passar fatura/recibo" abre o recibo da fatura do trabalho, se houver, ou então a fatura-recibo. Os dois ligam esses pagamentos ao documento (`documentarPagamentos` em `src/pages/Rapido.tsx`).

### A5. Fases do trabalho

- **Fases** (16 Out; `ETAPAS` em `src/calc.ts`): Pedido → Em negociação → Layout → Produção → Montagem → Entrega → Entregue.
- **Por tipo:** cada tipo de trabalho salta as fases de que não precisa (`TIPOS`). Todos terminam em Entregue.

| Tipo | Fases |
|---|---|
| Branding / wrap | Pedido, Em negociação, Layout, Produção, Montagem, Entrega, Entregue |
| Criação de imagem | Pedido, Em negociação, Design (é o Layout), Entrega, Entregue |
| Fornecimento | Pedido, Em negociação, Layout, Encomenda (é a Produção), Entrega, Entregue |
| Montagem | Pedido, Em negociação, Montagem, Entrega, Entregue |

- **Botões de cada fase** (`FasesTrabalho` em `src/pages/Fases.tsx`):
  - Pedido: "Fazer cotação" ou "Já está em negociação", e a data "Responder até".
  - Em negociação: "Cliente confirmou", que grava `confirmadoEm`.
  - Layout: "Aprovado", que grava `layoutAprovadoEm`.
  - Produção: "Pedido à Académica" abre uma nova requisição. "Pedido feito a (fora da app)" grava `pedidoFornecedorEm`. Para avançar há "Produção pronta".
  - Montagem: datas "De" e "Até", e o botão "Montagem feita".
  - Entrega: "Entregue" pede a data da entrega. Se o cliente ainda dever, pede também a data em que prometeu pagar (`pagamentoPrometido`, por defeito daqui a 7 dias).
- **Datas-limite:**
  - Cada fase pode ter uma data-limite (`Trabalho.prazos`), em "Datas de todas as fases".
  - `prazo` é a entrega prevista e pode ficar vazio.
  - Um trabalho está atrasado quando passou a data-limite da fase em que está ou a entrega prevista (`prazoAtual`, `resumoTrabalho`).
- **Confirmação automática:** passar além da negociação marca o trabalho como confirmado (`moverEtapa` em `src/acoes.ts`).
- **Trabalhos antigos:** os gravados antes de 16 de Outubro têm nomes antigos de fase. A app lê-os como os novos (`normalizarEtapa`, aplicado em `src/state.tsx`) e não reescreve os registos.
- **Sinal:** 50% para começar e o resto na entrega (`Empresa.sinalPct`). O Início avisa "a trabalhar sem sinal" quando um trabalho confirmado está em Layout, Produção ou Montagem sem o sinal pago (`src/pages/Painel.tsx`).

### A6. "A receber" só conta trabalho confirmado

- **Regra (16 Out):** só entra no "a receber" o trabalho que cumpre tudo isto (`contaParaReceber` em `src/calc.ts`):
  - não está cancelado;
  - tem valor;
  - tem dívida;
  - está confirmado.
- **Confirmado** (`confirmado`) quer dizer uma destas três coisas:
  - o Momad carregou em "Cliente confirmou";
  - o cliente já pagou alguma coisa;
  - o trabalho já passou da negociação.
- **Valor em negociação:** aparece à parte no Início, com a nota "não conta no a receber".
- **Onde se aplica:**
  - Início (`Painel`);
  - Recebimentos (`src/pages/Dividas.tsx`);
  - Clientes;
  - a etiqueta "falta" nos cartões de trabalho (`src/pages/comum.tsx`).
- **Faturas:** só se fatura trabalho confirmado (`EmitirFatura`, ver A4).
- **Teste:** "only counts confirmed or delivered work in 'a receber'" (`src/calc.test.ts`).

### A7. Serviços impressos (Wrap / Branding)

- **Onde:** no formulário da cotação, "Adicionar linha" → "Wrap / Branding" (`NovoImpresso` em `src/pages/cotacaoFormulario.tsx`). Os dados estão em `IMPRESSO` (`src/materiaisCotacao.ts`).
- **Serviço:**
  - Full Wrap;
  - Half Wrap (às vezes toda a lateral);
  - Branding (o conjunto de elementos que formam o visual).
- **Estilo:** pode escolher-se mais do que um.
  - Artístico;
  - Desportivo (público do drift);
  - Corporativo (empresas).
  - De início vêm marcados Artístico e Desportivo. Ao escolher Branding, fica só Corporativo.
- **Cobertura:** escolhe-se por botões e o texto continua editável. Opções: "Cobertura de 100% dos painéis"; "Cobertura de toda a lateral"; "Cobertura até 30, 40, 50, 55, 60, 75, 85 ou 100% dos painéis".
- **Valores iniciais por serviço:**

| Serviço | Cobertura inicial | Partes iniciais |
|---|---|---|
| Full Wrap | Cobertura de 100% dos painéis | Laterais, Capom, Bumper Frontal, Bumper Traseiro, Tejadilho, Bagageira, Stickers Complementares |
| Half Wrap | Cobertura de toda a lateral | Laterais, Stickers Complementares |
| Branding | Cobertura até 30% dos painéis | Laterais, Logotipos |

- **Partes disponíveis:** Frente, Traseira, Laterais, Portas, Capom, Bumper Frontal, Bumper Traseiro, Tejadilho, Bagageira, Guarda-lamas, Retrovisores, Pilares, Spoiler, Logotipos, Logotipo no "Chapéu" e Stickers Complementares. O campo "Outra parte…" permite escrever uma parte à mão.
- **Frase "Inclui…"** (`frasePartes`):
  - As partes seguem a ordem da lista. As partes escritas à mão vêm depois.
  - Com os dois bumpers marcados, juntam-se em "Bumper Frontal e Traseiro".
  - "Stickers Complementares" fica sempre em último.
  - Exemplo: "Inclui Laterais, Capom, Bumper Frontal e Traseiro, Tejadilho, Bagageira e Stickers Complementares".
- **Texto de cada linha gerada:**
  - Linha 1: a marca do material (ex.: "Taksim®"). Com várias opções, o PDF imprime "OPÇÃO n - <marca>".
  - Linha 2, a negrito: o serviço e a viatura (ex.: "Full Wrap Toyota Corolla").
  - Descrição:
    - primeira linha automática "<Serviço> <Estilos> em Viatura <viatura>". É editável e tem o botão "Voltar ao texto automático";
    - `** <cobertura>`;
    - a frase "Inclui…";
    - "Impresso em vynil com aplicação do respectivo protector material 100% dedicado a wrap."
  - Depois vêm o material a vermelho (A8) e a nota de layout (A14).
- **Outros objectos:** a caixa "É uma viatura" desliga-se para objectos que não são viaturas (ex.: um expositor com as medidas).
- O botão "Juntar à cotação (N opções)" põe as linhas na cotação.

### A8. Materiais: Certificado / Não Certificado e garantia

- **Lista inicial** (`MATERIAIS_COTACAO`), escrita como o Momad a imprime nas cotações:

| Material | Certificado | Garantia | Título da opção |
|---|---|---|---|
| TAKSIM® STX570 + STX571 (60 Microns) | Não | até 2 anos | Taksim® |
| Mactac® JT10700 WG BFG XR + LF10700 UV Series (80 Microns) | Sim | até 5 à 7 anos | Mactac® |
| Avery Dennison® MPI 1105 SuperCast Series + DOL1460Z (82 Microns) | Sim | até 7 anos | Avery Dennison® |
| Taksim® Economy White Vinyl + Premium Lamination (80 Microns) | Não | acima de 12 meses | Vynil Comum |
| TAKSIM® Premium Bubble Free + Premium Lamination (80 Microns) | Não | acima de 3 anos | Premium |
| Vinyl Holográfico Genérico (50 Microns) | Não | sem garantias | — |
| Avery Dennison® Supreme™ PPF Xtreme Gloss (165µm) | Sim | — | — |
| HEXIS® BODYFENCE X | Sim | — | — |
| HEXIS® HEXLIGHTS2 (70µm) | Sim | — | — |
| HEXIS® BODYFENCE WINDSHIELD (70µm) | Sim | — | — |

- **No gerador Wrap / Branding:** só aparecem como opção os materiais com título (os cinco primeiros). Os três primeiros vêm marcados.
- **Noutras linhas:** escolhe-se qualquer material no campo "Materiais (saem a vermelho)".
- **No PDF** (`linhasDoItem` em `src/cotacaoPdf.tsx`):
  - O nome sai a vermelho e sublinhado, seguido de " - Certificado" ou " - Não Certificado", a cinzento.
  - Um material Não Certificado sem garantia leva também "(Sem garantias)".
  - Com garantia, segue-se a linha "(A marca garante vida útil <garantia> se usado e conservado dentro dos padrões recomendados)".
- **Vários materiais:** uma linha pode ter mais do que um (ex.: impressão + cortes).
- **Nota de garantias:** quando a cotação tem trabalho com material (`comMaterial`), a última página leva uma nota. Diz que as garantias se dão com base nos certificados e que a Puzzle Stickers não dá garantia para materiais não certificados.
- **Cotações antigas de wrap** sem materiais por linha têm a caixa "Nota do material no rodapé (TAKSIM® STX570 + STX571, garantia até 2 anos)" (`Cotacao.notaMaterial`).
- **Material que não está na lista:** usa-se "Outro material (escrever)…", com Certificado / Não certificado e garantia. Ainda não fica guardado na lista (ver B5).

### A9. Opções por material, cada uma na sua página

- **Como se criam:** no gerador, cada material marcado cria uma linha com o seu preço, e cada linha fica numa opção (Opção 1, 2, 3; `ItemCotacao.opcao`). Com um só material marcado, a linha não fica numa opção. Também se pode pôr qualquer linha numa opção, nos botões "Opção" da linha.
- **As opções são alternativas e não se somam.** O total de cada opção soma as linhas sem opção (comuns, deslocação) e as linhas dessa opção (`totaisCotacao` → `opcoes`).
- **PDF (17 Out):** cada opção sai nas suas próprias páginas. Cada uma leva as linhas comuns, as linhas dessa opção e o seu próprio SUB-TOTAL / IVA / TOTAL (`paginasCotacao`).
  - O Momad não quis uma tabela de opções no lugar dos totais.
  - O cartão "Totais" do formulário lista o total de cada opção.
- **Lista de cotações:** mostra "desde <opção mais barata>" até o cliente escolher. Depois mostra o total da opção aceite (`valorCot` em `src/pages/Cotacoes.tsx`).
- **Aceitar:**
  - Escolhe-se a opção em "Qual opção o cliente escolheu?" (`Cotacao.opcaoAceite`). Sem escolha, a app avisa "Escolha a opção que o cliente aceitou".
  - Só as linhas comuns e as dessa opção passam ao trabalho.
  - O sinal mostrado é 50% da opção escolhida.

### A10. Quantidade

- **Valor da linha:** cada linha tem "Qt.", e o Valor Total é Qt × Valor Unitário. No PDF a quantidade sai com dois dígitos ("01").
- **No gerador:** o campo "Qt." fica ao lado da viatura.
  - Exemplo: branding em 5 viaturas → cada opção vale 5 × o preço por viatura.
  - O formulário mostra a conta enquanto se escreve (ex.: "5 × = 200.000,00 MT").
  - A linha recolhida mostra "5 × 40.000,00 MT".
- **Teste:** "sums each option across several cars" (`src/calc.test.ts`).

### A11. Taxa de urgência

- **Regra (18 Out):** a urgência marca-se por linha, não na cotação inteira (`ItemCotacao.urgente`). Faz-se nos botões do campo "Urgência (+45% do preço unitário da linha, uma vez)", no cartão "Deslocação, urgência e desconto".
- **Cálculo** (`comUrgencia` em `src/calc.ts`):
  - A app escreve "Taxa de urgência (45%)" como linha própria, logo a seguir à linha urgente.
  - Essa linha tem Qt 1 e vale 45% do preço unitário da linha urgente. Nunca se multiplica pela quantidade.
  - Pertence à mesma opção.
  - É gerada no cálculo e nunca é gravada (`gerada`).
- **Percentagem:** 45% vem de `Empresa.urgenciaPct` (Definições, cartão "Regras do negócio").
- **Conversão:** a linha de urgência vai para o trabalho da sua linha.
- **Diferença a conhecer:** num trabalho criado à mão, a caixa "Urgente (+45%)" aplica 45% sobre o total das partes do trabalho (`totaisTrabalho`). Na cotação, a urgência é sempre por linha.
- **Teste:** "writes the taxa de urgência as a line after the urgent item only (45%)".

### A12. Deslocação por escalões

- **Valores** (`DESLOCACAO` em `src/materiaisCotacao.ts`), pela distância de ida até ao cliente:

| Distância (ida) | Ida e volta | Valor |
|---|---|---|
| Até 20 km | até 40 km | 1.500 MT |
| 21–35 km | 42–70 km | 2.500 MT |
| 36–50 km | 72–100 km | 3.500 MT |
| Mais longe | — | "Outro valor": distância e valor escritos à mão |

- **No formulário:** botões "Sem deslocação", os três escalões e "Outro valor".
- **Na cotação:**
  - Fica uma linha "Deslocação", com a distância na linha 2 e sem descrição.
  - Fica sempre em último lugar (`ordenar` em `src/pages/cotacaoFormulario.tsx`).
  - É marcada `extra: true`.
  - Não pertence a nenhuma opção, por isso soma no total de todas.
- **Conversão:** junta-se ao primeiro trabalho. Nunca é um trabalho próprio.

### A13. Desconto antes do IVA

- **Cálculo:** percentagem sobre o bruto, antes do IVA (`Cotacao.desconto`, `totaisCotacao`). Aplica-se a todas as linhas da opção, incluindo a urgência e a deslocação.
- **PDF:** SUB-TOTAL, DESCONTO n% a vermelho, IVA e TOTAL (`blocoTotais`).
- **Trabalho:** não tem desconto próprio. O desconto entra nos preços unitários (`precoNoTrabalho` em `src/pages/Cotacoes.tsx`), para o total do trabalho bater com o da cotação.
- **Teste:** "takes the discount off before IVA".

### A14. Textos finais, notas e aspecto da cotação

- **Texto final** (`TEXTOS_FINAIS`):
  - Há cinco textos: Padrão, Pedir layouts, Criar layouts, Agendar viatura e Projecto.
  - Todos são editáveis.
  - Por defeito usa-se o texto padrão da empresa (`Empresa.notaCotacao`, "Nota padrão das cotações" em Definições).
  - Um texto curto sai ao lado dos totais. Um texto longo (ex.: Projecto) sai a toda a largura, acima dos totais (`termos` em `src/cotacaoPdf.tsx`).
- **Nota final da linha** (`NOTAS_ITEM`), em negrito itálico:
  - `** Layout ainda por definir`;
  - `** Layout já definido`;
  - `** Layout já definido pelo cliente`;
  - `** Layout já definido pelo Cliente (Inclui melhoria, ou criação de novo Layout)`.
- **Título de secção:** faixa sem valores (ex.: "SERVIÇOS MENSAIS"). Nunca vira trabalho.
- **Validade:** 30 dias por defeito (`Empresa.validadeCotacao`). A lista mostra "expirou" quando uma cotação enviada passou do prazo.
- **Aspecto:**
  - Sempre A4, sem fotografias do trabalho. O Momad envia as imagens à parte.
  - O logótipo do cliente sai junto ao nome. Carrega-se no próprio formulário: "Logotipo do cliente (sai junto ao nome)".
  - O cliente tem "Cidade" e "País" (por defeito Moçambique), guardados juntos em `Cliente.cidade` (`separarMorada` / `juntarMorada` em `src/format.ts`).
- **Pré-visualização** (`PreviewCotacao`):
  - O botão "Preview" mostra as páginas A4 antes de guardar, incluindo o que está a ser preenchido no gerador.
  - No computador, as páginas aparecem também ao vivo ao lado do formulário ("Como sai a cotação").

### A15. Da cotação ao trabalho

- **Cotação feita dentro do trabalho:**
  - "Fazer cotação" (`fazerCotacao` em `src/pages/Trabalho.tsx`) junta todas as partes do trabalho numa só cotação, incluindo as combinadas de boca (`ItemTrabalho.origem`). Um trabalho em Pedido passa a Em negociação.
  - "Cliente aceitou" (`aceitarNoTrabalho`) troca as partes do trabalho pelas linhas aceites e confirma o trabalho. Se o trabalho ainda estiver em negociação ou antes, passa à fase seguinte.
- **Cotação solta:** o botão "Converter em trabalho(s)" (`converter`) pede primeiro o cliente e depois faz o seguinte:
  - cria um trabalho por linha de serviço;
  - adivinha o tipo pelo texto (`tipoDe`);
  - põe a entrega prevista a 10 dias úteis;
  - começa o trabalho já depois da negociação, confirmado.
- **Secções:** nunca viram trabalho.

### A16. Requisição de prints: material por linha e preçário da Académica 2026

- **Regra (16 Out):** cada print tem o seu próprio material, impressão + laminação (`LinhaImpressao.impressao`, `laminacao`). Um só material por lista era uma limitação do Excel.
- **Preçário da Académica 2026** (`PRECARIO_ACADEMICA_2026` em `src/requisicaoPdf.tsx`), por m², sem IVA, com os nomes oficiais:

| Produto | Tipo | MT/m² |
|---|---|---|
| Impressão com material da Puzzle Stickers | impressão | 800 |
| Vinil comum | impressão | 950 |
| Vinil comum laminado | impressão | 1.400 |
| Vinil de wrap | impressão | 1.150 |
| Vinil branco premium | impressão | 1.050 |
| Vinil transparente premium | impressão | 950 |
| ContraVision | impressão | 1.150 |
| Banner | impressão | 950 |
| Laminação de wrap | só laminação | 850 |
| Laminação transparente premium | só laminação, sobre qualquer vinil | 450 |

- **Bundle Wrap:** Vinil de wrap + Laminação de wrap = 2.000 MT/m². Aparece com esse nome no formulário e no PDF (`nomeMaterial`).
- **Nomes antigos:** a app lê os nomes das listas Excel ("Taksim Wrap", "Laminação (PREMIUM)") como os oficiais (`nomeOficial`).
- **Requisições antigas:** as anteriores a 16 de Outubro têm um material por lista. Esse material passa para cada print (`linhasComMaterial`).
- **De onde vêm os preços:**
  - `PRECARIO_ACADEMICA_2026` é a referência no código. A app não o usa directamente.
  - O formulário lê os preços da tabela do fornecedor (`Fornecedor.materiais`), editável em Fornecedores.
  - Na nuvem, os materiais da Académica e as requisições existentes passaram para os nomes oficiais, sem mudar os preços, por um script que não está no repositório.
- **Formulário** (`src/pages/RequisicaoForm.tsx`):
  - O material base é o Bundle Wrap quando o fornecedor o tem (`baseDe`). Os prints novos ficam com ele.
  - O botão "Aplicar a todos os prints" copia o material base para todas as linhas.
  - Cada linha tem as suas escolhas de impressão e laminação e mostra o valor ao vivo.
- **Contas** (`totaisRequisicao` em `src/calc.ts`, `totaisLinhas` em `src/requisicaoPdf.tsx`):
  - Para cada linha: Qt × largura × comprimento = m², e m² × preço/m² = valor sem IVA.
  - No fim soma-se o IVA de 16%, com a caixa "Fornecedor cobra IVA (16%)" marcada. A caixa vem marcada por defeito.
  - Teste: 7,92 m² em Bundle Wrap = 15.840 MT (`src/requisicaoPdf.render.test.tsx`).
- **Documento** (`PaginaRequisicao`), layout aprovado pelo Momad:
  - título "REQUISIÇÃO DE PRINTS";
  - na caixa do fornecedor, só o logótipo (`public/img/academica.png` para a Académica; nos outros fornecedores, o nome);
  - nome do ficheiro em destaque, a negrito com barra amarela;
  - material em duas linhas;
  - sem total de m² e sem resumo por material, porque os materiais são diferentes;
  - rodapé "Preços por m², sem IVA, do preçário 2026 da …".
- **PDF:** sai como ficheiro real, não como janela de impressão (`emitirRequisicao` e `PdfHost` em `src/pdfPartilha.tsx`). Abre a janela "PDF pronto", com estas saídas:
  - "Partilhar (WhatsApp, email…)", pela folha de partilha, onde o aparelho o permite;
  - "Descarregar e abrir o WhatsApp" do fornecedor, onde não há partilha e o fornecedor tem telefone;
  - "Descarregar" e "Ver", sempre.
- **Circuito do fornecedor** (`Circuito` em `src/pages/RequisicaoForm.tsx`; fases em `faseRequisicao` e `FASES_REQ`):
  - Passos: lista enviada → pró-forma → pagamento (ou crédito) → fatura + recibo → levantada.
  - Fases mostradas: Rascunho, Lista enviada, Pró-forma por pagar, A crédito, Paga, Faturada, Levantada.
  - A fatura do fornecedor fica como documento recebido e conta no IVA dedutível.
  - A pró-forma não conta para o IVA.
  - O custo do levantamento (delivery) fica como despesa em "Transporte e combustível".

### A17. Despesas fixas: de dia 25 a dia 5

- **Regra (16 Out):** as despesas fixas pagam-se do dia 25 de um mês ao dia 5 do mês seguinte.
- **Dados:**
  - `DespesaFixa.abre` é o primeiro dia de pagamento e `dia` é o último.
  - Quando `abre` é maior que `dia`, o prazo cai no mês seguinte (`janelaFixa` em `src/calc.ts`).
- **Estados** (`fixasDoMes`): pendente, a pagar (janela aberta), atrasada e paga.
- **Nova despesa fixa:** começa com 25 a 5 (`FixaForm` em `src/pages/Despesas.tsx`).
- **Início:** verifica o mês anterior e o actual, porque a janela de 25 a 5 atravessa o início do mês.
- **Resultado do mês** (`resultadoDoMes`):
  - Conta a despesa fixa no mês a que se refere (`Despesa.mes`), não na data em que foi paga.
  - Conta as requisições na data delas, sem os rascunhos.
- **Teste:** "pays fixed expenses from the 25th to the 5th of the next month".

### A18. Caixa

- **Regra (16 Out):** a app mostra o dinheiro da empresa como uma caixa: quanto há, o que entrou e o que saiu.
- **Movimentos** (`movimentosCaixa` em `src/calc.ts`):
  - Entradas: pagamentos de clientes e reposições de gastos pessoais.
  - Saídas: compras, despesas fixas pagas, pagamentos a fornecedores (`Requisicao.pagamentos`) e gastos pessoais.
- **Saldo** (`saldoCaixa`):
  - Parte do valor que o Momad escreve uma vez em "Acertar caixa", a pergunta "Quanto tem hoje? (banco + M-Pesa + numerário)" (`Empresa.caixa`; `CaixaModal` em `src/pages/Resumo.tsx`).
  - A partir daí, soma as entradas e tira as saídas.
- **Início:** faixa "Caixa" com Em caixa, Valor dos trabalhos, Falta receber e Eu devo.
- **Finanças → Resumo** (só o dono):
  - Entrou, Saiu, Saldo do mês e Em caixa;
  - O que saiu;
  - movimentos;
  - gastos por categoria;
  - últimos 6 meses.
- **Duas leituras do custo do fornecedor:**
  - No caixa, conta quando é pago.
  - No resultado do mês (página Despesas), conta na data da requisição.
  - Pagar a um fornecedor nunca conta como segunda despesa.
- **Compra** (botão "Compra" do Início, `DespesaForm` em `src/pages/Despesas.tsx`):
  - Documento da compra: Fatura, Venda a dinheiro, Recibo ou Sem documento.
  - Fatura e venda a dinheiro ficam também como documento recebido em Faturas e recibos. Com IVA, contam no IVA dedutível.

### A19. Gastos pessoais: repor ou autorizar

- **Regra (18 Out):** são gastos pessoais do dono pagos com dinheiro da empresa. Saem do caixa, mas não são custo do negócio.
- **Onde:** Finanças → Pessoal (`src/pages/Pessoal.tsx`), só para o dono.
- **Dados:** `Despesa.pessoal = true`, categoria "Pessoal", sem IVA.
- **Fora das contas:** ficam fora da lista de Despesas e do resultado do mês (`resultadoDoMes`).
- **Como se resolvem:** cada gasto fica "por resolver" até uma destas acções:
  - "Repor": grava `pessoalEstado = 'reposto'` e `pessoalEm`. O dinheiro volta a entrar no caixa nesse dia, como "Reposição pessoal".
  - "Autorizar": grava `pessoalEstado = 'autorizado'`. Fica como uso do dono e não volta ao caixa.
  - Com mais de um gasto por resolver há também "Repor tudo" e "Autorizar tudo". No gasto há "Voltar a por resolver".
- **Resumo:** mostra o cartão "Gastos pessoais por resolver". O cartão Entrou indica "clientes + X repostos por si".

### A20. Catálogos

- **Separador Cotações → Catálogos** (`src/pages/Catalogos.tsx`, lista `CATALOGOS`). Os perfis de trabalhador não o vêem.

| Catálogo | Ano | Páginas | Nota |
|---|---|---|---|
| Criação de Imagem | 2026 | 21 | — |
| Sticker Kits | 2025 | 10 | — |
| Produção | 2020 | 10 | marcado "antigo" |

- **Ficheiros:** os PDFs e as capas estão em `public/catalogos` e vêm com a app. O link funciona para qualquer cliente e o ficheiro é igual em todos os aparelhos.
- **Acções:**
  - "Partilhar PDF", pela folha de partilha, ou descarga onde não houver partilha;
  - "Enviar link", pelo WhatsApp;
  - "Ver";
  - copiar o link.
- **Links:** abrem o PDF e não a app (`navigateFallbackDenylist` em `vite.config.ts`).
- **Catálogo novo:** põe-se o PDF e a capa JPG em `public/catalogos` e acrescenta-se uma entrada em `CATALOGOS`.
- **Catálogo de serviços:** é outro, em Definições → Catálogo. Tem os serviços e preços do "Catálogo Criação de Imagem 2026" (`CATALOGO` em `src/seed.ts`, ids fixos `srv-…`, pela ordem do PDF).
  - Nos trabalhos de criação, todas as partes vêm deste catálogo (`soCatalogo` em `src/pages/Partes.tsx`).
  - Nas cotações, a escolha "Criação de imagem" acrescenta o serviço com o seu preço (`CatalogoCriacao`).

### A21. Uma só palavra-passe

- **Regra (18 Out):** a entrada pede só a palavra-passe da empresa.
- **Ecrã de entrada** (`Ligar` em `src/App.tsx`):
  - Pede só a "Palavra-passe".
  - O código da empresa fica escondido em "Outra empresa".
- **Um só utilizador activo** (`unico`): a palavra-passe basta e não há PIN.
- **Sair** (`terminarSessao` em `src/nuvem.ts`):
  - Sincroniza e termina a sessão.
  - Os dados ficam no aparelho.
  - Ao voltar, a app só pede a palavra-passe.
- **Equipa:** o ecrã de PIN só aparece quando houver mais do que um utilizador activo. Os perfis dono / gerente / trabalhador já existem (`PERM` em `src/state.tsx`).
- **Mudar a palavra-passe:** no cartão "Nuvem" da página Definições, botão "Mudar palavra-passe da empresa" (`mudarSenha`). A nova tem de ter pelo menos 8 caracteres.
- **Servidor:** guarda a palavra-passe cifrada (bcrypt). Depois de 5 tentativas erradas, bloqueia a entrada durante 10 minutos (`db/001_puzzle_nuvem.sql`).

---

## Parte B — Pedidos em aberto

Nada desta parte está construído, salvo onde se diz o contrário.

### B1. Os 5 pontos de 19 de Outubro

A 19 de Outubro o Momad pediu que o trabalho funcione como um dossier, com tudo o que lhe diz respeito num só sítio. Pediu estes cinco pontos:

| Ponto | O que o Momad pediu | Partes do plano (B2) |
|---|---|---|
| 1 | **Requisição como a cotação:** ver o A4 antes de enviar, guardar só quando algo muda, e o sistema saber se a lista já foi enviada | Parte 4 |
| 2 | **Faturas da produção e o trabalho com tudo:** onde registar a fatura que pagou à Académica, pagar com comprovativo, e ver no trabalho as faturas do cliente separadas das da produção | Partes 1 e 2 |
| 3 | **Trabalho como conjunto:** cotação, requisição, pró-forma, pagamentos, faturas e recibos visíveis dentro do trabalho | Parte 2 |
| 4 | **Estado e pagamento por parte:** cada parte com o seu estado, partes feitas na empresa sem custo (ex.: o logotipo), e o caso "o cliente pagou só o logotipo" | Partes 5 e 6 (e a cadeia de versões da Parte 3) |
| 5 | **Negociar a cotação com versões:** "Editar" corrige erros e "Negociar" cria uma versão nova ligada à anterior (ex.: 10 camiões passam a 5). A primeira fica registada como enviada | Parte 3 |

**Estado:** o plano está feito e nada está construído. Espera o OK do Momad e as respostas às perguntas de B4.

### B2. O plano em 6 partes

**Princípio:**

- O trabalho já é o dossier. Cotação, requisição, pró-forma, pagamentos (dos dois lados), faturas e recibos já apontam para ele por id. Não se cria base nova: a app junta essa informação e mostra-a dentro do trabalho.
- Cada "já enviei?" passa a ser um acto com data, gravado no próprio registo (requisição e cotação).
- "Negociar" cria uma versão nova, ligada à anterior, em vez de reescrever.
- O circuito do fornecedor passa a aceitar a ordem real: fatura antes da pró-forma, pagamento depois.
- Tudo é aditivo e opcional. A app lê os registos reais da nuvem sem migração, sem tabela nova e sem subir `ESQUEMA` (`src/nuvem.ts`).

**Pré-requisito:** antes da Parte 1, um commit de base do estado actual e `npm test` a passar. Os testes cobrem `calc`, `leitura` e os dois renders de PDF.

| Ordem | Parte | Pontos | Esforço |
|---|---|---|---|
| 1 | Fatura da produção sem pró-forma: pagamento com comprovativo, fase "Fatura por pagar", entradas a partir do trabalho | 2 | médio |
| 2 | Dossier do trabalho: cartão "Percurso" e histórico completo | 2, 3 | médio |
| 3 | Cotação: "Enviada" com data, botão "Negociar" separado de "Editar", cadeia de versões | 5, 4 | médio |
| 4 | Requisição como a cotação: faixa de estado, preview A4, "enviada" ao partilhar, Guardar só se mudou | 1 | médio |
| 5 | Partes com identidade: estado por parte, "feito na empresa / sem custo", ligação à requisição e à linha da cotação | 4 | grande |
| 6 | Pagamento do cliente por parte ("pagou só o logotipo") | 4 | pequeno |

#### Parte 1 — Fatura da produção sem pró-forma

- **Hoje** (verificado em `src/pages/RequisicaoForm.tsx` e `src/calc.ts`):
  - O Passo 3 "Pagamento ao fornecedor" recusa pagar sem pró-forma ou crédito ("Primeiro registe a pró-forma").
  - O valor da fatura é sempre o da pró-forma ou o total da lista (`guardarFatura`).
  - Registar a fatura não marca a lista como enviada. Registar a pró-forma marca.
  - `faseRequisicao` não tem "fatura por pagar" e mostra "Lista enviada".
  - `contasAPagar` e `mapaCredito` deixam essa requisição de fora, por isso o "Pagar" do Mapa de crédito não aparece.
  - O Início avisa "à espera da pró-forma".
  - `PagamentoFornecedor` não guarda comprovativo.
  - O Passo 4 (fatura e recibo) já funciona sem pró-forma. O aspecto "em espera" é só visual.
- **Proposta:**
  - **Circuito da requisição:**
    - O Passo 4 ganha um campo editável "Valor da fatura (com IVA)". Guardar a fatura marca também a lista como enviada.
    - O Passo 3 abre com pró-forma, fatura ou crédito. Cada pagamento aceita um comprovativo (foto ou PDF). O "Pagar" do Mapa de crédito fica igual.
    - O Passo 5 deixa de depender da pró-forma.
    - Nova fase "Fatura por pagar": na etiqueta, no Mapa de crédito e num alerta do Início. Quando já há fatura, o alerta "à espera da pró-forma" deixa de aparecer.
  - **No trabalho:**
    - Cada requisição mostra uma sub-linha (enviada · PF · FT · RC · levantada) e os botões "Fatura da Académica" e "Pagar".
    - "Carregar" em Faturas e recibos pergunta primeiro qual é o documento: fatura passada ao cliente, ou fatura/recibo da Académica desta produção.
    - O Resumo financeiro mostra "lista X · fatura Y".
- **Dados novos:**
  - `Requisicao.fatura { numero, data, valor }`;
  - `PagamentoFornecedor.ficheiroId`;
  - fase `fatura` em `FASES_REQ`;
  - `valorRequisicao` = valor da fatura; sem fatura, o da pró-forma; sem pró-forma, o total da lista.
- **Riscos:**
  - O lucro dos trabalhos reais muda quando a fatura difere da lista (pergunta 6).
  - Os comprovativos ficam só no aparelho onde foram carregados (pergunta 11).

#### Parte 2 — Dossier do trabalho: cartão "Percurso"

- **Hoje:**
  - O trabalho só conhece uma cotação (`Trabalho.cotacaoId`).
  - A informação está espalhada por 5 separadores.
  - "Faturas e recibos" mistura emitidos e recebidos.
  - O histórico só tem notas, fases e pagamentos do cliente.
  - Os pagamentos à Académica não aparecem no trabalho.
  - As requisições só se vêem na fase Produção.
- **Proposta:**
  - **Ficheiro novo `src/dossier.ts`** com `dossierTrabalho(t, d)`: só junta o que já existe, não grava nada, e tem teste próprio.
  - **Cartão "Percurso do trabalho"** no topo de Detalhes, só para quem tem a permissão `financas`, com três blocos:
    - Cotação: a cadeia de versões.
    - Produção: cada requisição, com as suas acções.
    - Dinheiro: duas colunas, Cliente e Académica.
  - **Faturas e recibos:** divide-se em "Que passei ao cliente" e "Da produção (Académica)", agrupadas por requisição.
  - **Pagamentos:** ganha a secção "Pagos à Académica".
  - **Histórico:** passa a incluir todos os passos: cotação criada, enviada, negociada e aceite, lista enviada, pró-forma, pagamentos, faturas e levantamento. Cada passo abre o registo.
  - Não se acrescenta um 6.º separador.
- **Dados novos:** nenhum.
- **Riscos:**
  - A página fica comprida no telemóvel. Por isso as secções ficam recolhidas, com uma linha de resumo.
  - As requisições "Várias" sem trabalho continuam fora (pergunta 10).

#### Parte 3 — Cotação: "Enviada", "Negociar" e versões

- **Hoje:**
  - O estado escolhe-se à mão numa lista (Rascunho, Enviada, Aceite, Recusada).
  - O PDF e o Preview não mudam o estado.
  - Não há data de envio.
  - "Guardar" sobrescreve a cotação mesmo depois de enviada ou aceite.
  - Um trabalho tem uma só cotação.
- **Proposta:**
  - **Cartão "Estado"** com "Marcar como enviada", que grava a data.
    - Depois de gerar o PDF, a app pergunta "Já enviou ao cliente?" (pergunta 3).
    - O Preview nunca marca.
  - **"Negociar"**, visível em cotações enviadas ou recusadas:
    - Copia a cotação para uma nova, com número novo e em rascunho, ligada à anterior.
    - A anterior passa a "Substituída": só leitura, com Ver e PDF.
    - Os trabalhos passam a apontar para a nova. Se forem vários, a app pergunta quais.
  - **Editar uma cotação já enviada** pede confirmação (avisar ou bloquear: pergunta 4).
  - **PDF:** pode dizer "Substitui a cotação …" (pergunta 2).
  - **Cadeia no trabalho:** "v1 COT-003 · enviada · 10 camiões → v2 COT-005 · 5 camiões · aceite".
  - **Alerta por cotação** enviada há dias sem resposta.
- **Dados novos:**
  - `Cotacao.enviadaEm`, `aceiteEm`, `recusadaEm`, `substituiId`, `substituidaPorId`;
  - estado `substituida`.
- **Riscos:**
  - Ao aceitar, as versões anteriores têm de passar a "substituida". Senão continuam pendentes na lista, na ficha do cliente e no Início.
  - Os totais e as listas que contam cotações enviadas têm de deixar de fora as substituídas.

#### Parte 4 — Requisição como a cotação

- **Hoje:**
  - A requisição é uma janela com 2 separadores.
  - "Guardar" está sempre activo.
  - "Marcar como enviada" está escondido no Passo 1 do 2.º separador.
  - A janela "PDF pronto" não diz se o ficheiro foi partilhado.
  - As linhas identificam-se pela posição e saltam quando se remove uma.
- **Proposta:**
  - **Faixa de estado fixa** nos dois separadores (ex.: "REQ-002 · 4 prints · 12,8 m² · 34.800 MT · Enviada a 10 Out"). Se ainda não foi enviada, diz "Ainda não enviada" e mostra o botão "Marcar como enviada".
  - **Botão "Preview"** com o A4 tal como vai sair, reutilizando `PaginaRequisicao`. No computador, o A4 fica ao vivo ao lado do formulário.
  - **Ao partilhar ou descarregar o PDF:** a caixa "Enviei à Académica" vem marcada e pode desmarcar-se. Ao fechar, grava "Enviada hoje", com Desfazer.
  - **"Guardar"** só fica activo quando há alterações.
  - **Lista já enviada:** alterá-la mostra um aviso e pede confirmação.
  - **Linhas** com id estável.
  - **Lista de requisições** mostra "Enviada 10 Out".
  - **Opção 4b:** página inteira `/requisicoes/:id`, como a cotação (pergunta 5).
- **Dados novos:**
  - `LinhaImpressao.id`;
  - `Requisicao.enviadaVia` e `enviadaPor`, opcionais;
  - `PdfPronto.onPartilhado`.
- **Riscos:**
  - Não mexer em `PaginaRequisicao` nem em `renderizarPdf`. O preview só os embrulha.
  - O teste `src/requisicaoPdf.render.test.tsx` tem de continuar a passar.

#### Parte 5 — Partes com identidade

- **Hoje:**
  - `ItemTrabalho` não tem id: cada parte identifica-se pela posição.
  - Aceitar a cotação substitui todas as partes.
  - Requisições e custos só se ligam ao trabalho.
  - Há uma fase por trabalho.
  - Os lotes de um mesmo cliente estão hoje como trabalhos separados que partilham a cotação.
- **Proposta:**
  - **Tabela de partes** com duas colunas novas:
    - "Estado": Por iniciar, Em curso, Feito ou Entregue.
    - "Produção": "Feito na empresa · sem custo", ou a requisição e a sua fase.
  - **Caixa "Feito na empresa (sem custo de produção)"** na parte (o caso do logotipo).
  - **Ao aceitar a cotação,** as partes juntam-se por id e mantêm o estado e os pagamentos.
  - **Nova requisição a partir do trabalho:** pergunta "Para que partes?".
  - As fases continuam por trabalho (pergunta 7). Os lotes continuam a ser trabalhos (pergunta 8).
- **Dados novos:**
  - `ItemTrabalho.id`, `estado`, `semCusto`, `cotacaoItemId`;
  - `ItemCotacao.id`, `semCusto`;
  - `Requisicao.itemIds`;
  - `Custo.itemId`.
- **Riscos:**
  - É a única parte que mexe no centro do modelo (os itens).
  - Os ids das partes existentes têm de ser gravados na primeira abertura do trabalho.
  - Ao aceitar, as partes juntam-se por id, nunca pelo texto.

#### Parte 6 — Pagamento do cliente por parte

- **Proposta:**
  - O "Pago" pergunta "Este pagamento é de que parte?". Por defeito fica "Todo o trabalho".
  - A tabela de partes ganha a coluna "Pago".
  - O Resumo financeiro do trabalho não muda.
  - Exemplo: o cliente paga só o logotipo → o valor regista-se nessa parte → o logotipo fica "Pago" e o trabalho continua com o resto em falta.
- **Dados novos:** `Pagamento.itemId` (uma parte por pagamento).
- **Depende da Parte 5.**

### B3. Factos verificados no código que o plano tem de respeitar

- **Ficheiros só no aparelho:**
  - Os ficheiros (fotos e PDFs) não vão para a nuvem: `TABELAS` em `src/nuvem.ts` não inclui `ficheiros`, e o servidor rejeita registos com mais de 300 000 caracteres.
  - O que se carrega num telemóvel não abre no computador. O cartão "Nuvem" em Definições já o diz.
- **Tabela nova:** obriga a mudar `TABELAS` em `src/nuvem.ts` e a lista aceite em `puzzle_enviar` (`db/002_puzzle_tarefas.sql`), e a subir `ESQUEMA`. Nenhuma parte do plano cria tabela nova.
- **Última gravação ganha:** a sincronização guarda o registo inteiro. Se dois aparelhos editarem o mesmo trabalho, perde-se a alteração de um deles. Já hoje é assim.
- **Faturas digitalizadas:** a fatura real da Académica é uma imagem sem texto, e a leitura automática (`lerFicheiro` em `src/leitura.ts`) não a lê. O caminho que funciona é registá-la à mão no Passo 4. O teste dessa fatura não está neste repositório, porque usa o documento real.
- **Total de faturas digitais:** `carregarLido` (`src/pages/RequisicaoForm.tsx`) ignora o total lido numa fatura digital. A Parte 1 precisa desta correcção.
- **Ordem das versões:**
  - As cotações vêm ordenadas pelo número em texto (`src/state.tsx`). Entre meses essa ordem falha: "COT-001-NOV/26" fica antes de "COT-003-OUT/26".
  - A cadeia de versões tem de seguir as ligações (`substituiId`), nunca o número.
  - Recomenda-se número novo para a versão negociada e não um sufixo "v2". O sufixo partiria `renumerar` em `src/seed.ts` e o PDF.
- **Cotação partilhada:** uma cotação pode estar ligada a vários trabalhos. O "Negociar" tem de perguntar que trabalhos passam a apontar para a nova.
- **Importação em massa:** `src/pages/Importar.tsx` (`ImportarModal`, `BotaoCarregar`) existe, mas não está ligado a nenhuma página. Nunca correu com dados reais e não lê imagens digitalizadas.

### B4. Perguntas por responder ao Momad

1. **Número da versão negociada:** número novo (ex.: COT-005-OUT/26, com "substitui a COT-003" registado na app) ou o mesmo número com "v2"? Recomenda-se número novo, porque a numeração mensal e o PDF já funcionam assim.
2. **"Substitui" no PDF:** o PDF da cotação negociada deve dizer ao cliente "Substitui a cotação COT-003-OUT/26", ou isso fica só interno?
3. **Marcar "enviada":** depois de gerar o PDF, a app pergunta "Já enviou? [Sim, hoje]"? Marca sozinha, com Desfazer? Ou só por botão? Recomenda-se perguntar.
4. **Correcção numa cotação já enviada:** basta avisar, ou a app bloqueia e obriga a usar "Negociar"?
5. **Requisição:** chega melhorar a janela actual (faixa de estado, preview, "enviada" ao partilhar, Guardar só se mudou)? Ou prefere uma página inteira, como a cotação?
6. **Custo e lucro:** quando a fatura da Académica difere da lista, o custo e o lucro do trabalho passam a usar a fatura (sem IVA)? Hoje usam sempre a lista. A app mostraria "lista X · fatura Y".
7. **Estado das partes:** chega um estado simples por parte (por iniciar / em curso / feito / entregue), com as fases a continuarem por trabalho? Ou prefere as fases completas em cada parte?
8. **Encomendas em lotes** (ex.: vários camiões do mesmo cliente feitos por fases): cada lote continua a ser um trabalho separado? Ou passam a 1 trabalho com uma parte por lote?
9. **"Pagou só o logotipo":** basta marcar cada pagamento como "da parte X" (uma parte por pagamento)? Ou é preciso repartir um pagamento entre várias partes?
10. **Requisição "Várias"** (uma lista da Académica para vários trabalhos): continua só no Mapa de crédito, ou deve ficar ligada a mais de um trabalho e aparecer em cada um?
11. **Ficheiros na nuvem:** faturas, recibos e comprovativos ficam só no aparelho onde são carregados (o computador não vê o que foi carregado no telemóvel). Fica assim por agora, ou a nuvem de ficheiros entra neste plano?
12. **Importação em massa:** quer ligar já a carga de vários PDFs da Académica de uma vez, como botão secundário, ou fica para depois? Esta função só lê PDFs digitais.

### B5. Outros pedidos pendentes

- **PPF, Proteção (vidros fumados, faróis, para-brisas) e Chrome delete**
  - A pesquisa está feita e a proposta foi enviada ao Momad. Temas recolhidos:
    - PPF: frente parcial, frente completa, "track pack", carroçaria completa, faróis, para-brisas, conchas dos puxadores.
    - Vidros: película tingida, de carbono ou cerâmica, de 5% a 70% de transmissão de luz, faixa de para-brisas e película de segurança.
    - Chrome delete: frisos das janelas, grelha, emblemas, puxadores, capas dos espelhos e barras de tejadilho, em preto brilhante ou mate.
  - Os materiais PPF e HEXIS já estão na lista (A8), mas estes serviços não têm gerador próprio.
  - O Momad não tem cotações antigas destes serviços. Tem amostras e o preçário do fornecedor. Falta uma sessão com ele para definir pacotes, marcas e preços.
  - O limite legal de escurecimento de vidros em Moçambique não foi confirmado. Não deve aparecer na app sem fonte oficial.
- **Página "Legislação"**
  - Ainda não existe. A ideia é listar as leis com links oficiais.
  - Fontes já identificadas:
    - Lei n.º 13/2023 (Lei do Trabalho, em vigor desde 21 de Fevereiro de 2024, revogou a Lei n.º 23/2007);
    - Código do IVA com as alterações da Lei n.º 10/2025 (em vigor desde 1 de Janeiro de 2026).
- **Novo visual**
  - Pedido: a app com o aspecto da cotação (Gotham, gradiente amarelo, padrão claro e ícones melhores no menu).
  - Primeiro faz-se uma maqueta para o Momad aprovar. Só depois se constrói.
- **Ficheiros na nuvem**
  - Estes ficheiros ficam só no aparelho onde foram carregados:
    - fotos e PDFs de faturas, recibos, pró-formas e comprovativos;
    - logótipos dos clientes;
    - ficheiros de arte.
  - Consequência: o logótipo do cliente só sai na cotação no aparelho onde foi carregado.
  - Próximo passo previsto: guardar os ficheiros no servidor, com uma função que os receba e entregue.
  - Os catálogos não são afectados, porque vêm com a app.
- **Catálogo de wrap**
  - O ficheiro do Momad ("Catálogo Wrap Projecto") só tem a capa.
  - Falta o PDF final. Quando chegar, junta-se em `public/catalogos` com uma entrada em `CATALOGOS`.
- **Outros pontos vistos no código:**
  - **PDF da cotação:** ainda abre a janela de impressão do sistema (`imprimirCotacao` em `src/print.tsx`). A requisição já gera o ficheiro pronto a partilhar. O método da requisição (html2canvas) não desenha bem as fontes da cotação, que estão dentro do SVG, por isso é preciso outro caminho.
  - **Lista de materiais da cotação:** é fixa (`MATERIAIS_COTACAO`). A caixa "Guardar na lista de materiais" de "Outro material" ainda não grava nada. Está prevista uma lista guardada nos dados da empresa.
  - **Frase fiscal na requisição:** o PDF da requisição não leva "Não serve de comprovativo fiscal". Falta confirmar com o Momad, e se preciso com o contabilista, se deve levar.
  - **Equipa:** os perfis e os relatórios diários existem, mas por agora só o Momad usa a app. Os acessos da equipa ficam para quando houver equipa.
  - **Fonte Gotham:** é uma fonte comercial e não está neste repositório. Os ficheiros copiam-se para `public/fonts/` (ver capítulo 3).

### B6. Estado de cada pedido

Legenda: **Feito** = já funciona na app; **Planeado** = plano feito, à espera do OK do Momad; **Por fazer** = pedido aceite, ainda sem plano detalhado; **À espera** = depende de algo do Momad.

| # | Pedido | Pedido em | Estado | Próximo passo |
|---|---|---|---|---|
| 1 | Requisição como a cotação | 19 Out | Planeado (Parte 4) | OK do Momad e pergunta 5 |
| 2 | Faturas da produção | 19 Out | Planeado (Partes 1 e 2) | OK do Momad e perguntas 6, 11 e 12 |
| 3 | Trabalho como conjunto (dossier) | 19 Out | Planeado (Parte 2) | OK do Momad e pergunta 10 |
| 4 | Estado e pagamento por parte | 19 Out | Planeado (Partes 5 e 6) | OK do Momad e perguntas 7, 8 e 9 |
| 5 | Negociar a cotação com versões | 19 Out | Planeado (Parte 3) | OK do Momad e perguntas 1 a 4 |
| 6 | PPF, Proteção e Chrome delete | 17–18 Out | À espera | Sessão com o Momad: pacotes, marcas e preços |
| 7 | Página Legislação | 18 Out | Por fazer | Construir a página com links oficiais |
| 8 | Novo visual | 18 Out | Por fazer | Maqueta para aprovação |
| 9 | Ficheiros na nuvem | 15 Out | Por fazer | Guardar os ficheiros no servidor, com uma função própria (pergunta 11) |
| 10 | Catálogo de wrap | 18 Out | À espera | PDF final do Momad |
| 11 | PDF da cotação como ficheiro partilhável | 16 Out | Por fazer | Escolher o método de geração |
| 12 | Lista de materiais da cotação editável | 17 Out | Por fazer | Guardar materiais novos nos dados da empresa |
| 13 | Importação em massa de PDFs da Académica | — | O código existe, mas não está ligado | Pergunta 12 |
| 14 | Acessos da equipa e relatórios diários | 14 Out | Feito, por activar | Quando houver equipa a usar a app |
| — | Regras A1 a A21 | 13–18 Out | Feito | Manter os testes a passar (`npm test`) |
