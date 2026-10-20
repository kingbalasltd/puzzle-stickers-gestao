# Documentos PDF, catálogos e cálculos

Este capítulo explica como a aplicação produz os documentos que saem para fora: a cotação, a requisição de prints e a relação do IVA. Explica também como envia os catálogos da Puzzle Stickers e como faz as contas. Todas as contas de dinheiro estão em `src/calc.ts`. Os testes que fixam os números estão no fim do capítulo.

## Visão geral

| Documento | Ficheiros | Como é desenhado | Como sai |
|---|---|---|---|
| Cotação | `src/cotacaoPdf.tsx`, `src/print.tsx`, `src/pages/cotacaoFormulario.tsx`, `src/materiaisCotacao.ts` | Página A4 em SVG, medidas em pontos | Diálogo de impressão do sistema ("Guardar em PDF" / Partilhar) |
| Requisição de prints | `src/requisicaoPdf.tsx`, `src/pdfPartilha.tsx` | Página A4 em HTML, medidas em mm | Ficheiro PDF gerado no próprio aparelho, na janela "PDF pronto" |
| Relação do IVA | `src/print.tsx` (botões em `src/pages/Iva.tsx`) | Página A4 em HTML | Diálogo de impressão (botão "PDF") e ficheiro CSV (botão "Excel") |
| Catálogos | `src/pages/Catalogos.tsx`, `public/catalogos/` | PDFs já prontos | Partilha do ficheiro, link por WhatsApp, ver, copiar link |

Regras comuns:

- A aplicação **nunca emite faturas**. Cotações e requisições têm numeração interna (`numeroDoMes`). As faturas e os recibos continuam com o número do livro do Momad.
- A cotação imprime sempre "**Não serve de comprovativo fiscal".
- Os valores saem no formato dos documentos dele, `68.000,00 MT` (função `mt` em `src/format.ts`). As datas dos documentos saem como "14 de Outubro de 2026" (`dataDoc`).
- A cotação e a requisição usam o Gotham (família `Gotham PS`). São 8 ficheiros `gotham-*.woff` (light, book, medium e bold, cada um normal e itálico) que têm de estar em `public/fonts/`. Não estão neste repositório por serem de uma fonte comercial: sem eles, o navegador usa outra fonte e os PDFs perdem o aspecto original. Os `@font-face` estão em `src/styles.css`, com `font-display: block`. A relação do IVA usa Montserrat.

---

## Cotação

### Ficheiros e responsabilidades

| Ficheiro | O que faz |
|---|---|
| `src/cotacaoPdf.tsx` | Desenha a página (`PaginaCotacao`), pagina (`paginar`, `paginasCotacao`), monta o bloco de totais (`blocoTotais`), mede texto (`medirCanvas`), carrega as fontes (`carregarFontes`) e o logotipo do cliente (`logoDoCliente`) |
| `src/print.tsx` | `imprimirCotacao`: prepara imagens e fontes, desenha todas as páginas em `#print-root` e chama `window.print()` |
| `src/pages/cotacaoFormulario.tsx` | Formulário da cotação (`EditorCotacao`), gerador de wrap/branding (`NovoImpresso`), linhas do catálogo de criação (`CatalogoCriacao`), Preview ao vivo (`PreviewCotacao`) |
| `src/materiaisCotacao.ts` | Textos fixos do Momad: materiais, notas de item, textos finais, serviços impressos, partes da viatura, tabela de deslocação |
| `src/pages/Cotacoes.tsx` | Lista e página da cotação: botões Preview, PDF e Guardar, aceitação, conversão em trabalhos |

### A página A4 em SVG

A página foi reconstruída a partir do ficheiro original da cotação da Puzzle Stickers (Illustrator, 14 de Outubro de 2026). Todas as posições foram medidas nesse ficheiro.

- Tamanho: `A4 = { w: 595.276, h: 841.89 }`, em pontos. O SVG usa `viewBox="0 0 595.276 841.89"`.
- Cada texto é um `<text>` desenhado pelo componente interno `T`, com o tamanho, o peso, o itálico, a cor e a linha de base do original.
- O Illustrator do Momad aperta o texto mais do que a fonte pura. Por isso:
  - vários estilos têm um `ls` (letter-spacing) próprio, por exemplo preços −0,42, descrições −0,24 e nome do cliente −0,58;
  - alguns textos fixos usam `textLength` (largura medida no original) com `lengthAdjust="spacing"`;
  - os textos justificados esticam os espaços entre palavras (`wordSpacing`), nunca as letras.

#### Estilos principais (objecto `E`)

| Estilo | Peso / itálico / tamanho / ls | Cor | Uso |
|---|---|---|---|
| `med14` | 500, 14 | preto | "Cotação" |
| `numero` | 400, 10 | #555555 | número COT- ao lado de "Cotação" |
| `medIt9` | 500 itálico, 9 | #333333 | "**Não serve de comprovativo fiscal" |
| `lightIt9` | 300 itálico, 9, ls −0,21 | #333333 | "Válida por N dias · página p/t" |
| `med13` | 500, 13 | preto | data |
| `cliente12` | 700, 12, ls −0,58 | preto | nome do cliente |
| `book12` / `bold12` | 400 / 700, 12 | preto | linha 1 / linha 2 do item |
| `preco12` | 500, 12, ls −0,42 | preto | valor unitário e total do item; valor da última linha de totais |
| `precoBook12` | 400, 12, ls −0,43 | preto | valores das outras linhas de totais |
| `bold13` / `precoBold13` | 700, 13 / 700, 13, ls −0,51 | preto | rótulo e valor do TOTAL |
| `descPrimeira` | 500 itálico, 10, ls −0,24 | #333333 | primeira linha da descrição |
| `descLinha` | 300 itálico, 10, ls −0,24 | #333333 | restantes linhas |
| `descDestaque` | 700 itálico, 10, ls −0,24 | #666666 | linhas "** Layout…" e nota do item |
| `descMaterial` | 400 itálico, 10, ls −0,24 | #ff0000 | nome do material |
| `descSufixo` | 400 itálico, 10, ls −0,24 | #666666 | "- Certificado" / "- Não Certificado" |
| `notaJust` | 300 itálico, 10, ls −0,24 | #666666 | texto final justificado |
| `garantia` | 300 itálico, 10 | #1a1a1a | nota das garantias |

#### Medir e quebrar texto

- `Medir` é o tipo `(texto, estilo) => largura`. A aplicação usa `medirCanvas`: mede com o `measureText` de um canvas 2D (reutilizado) e soma `ls × número de caracteres`.
- As fontes têm de estar carregadas antes de medir. `carregarFontes()` carrega as 8 variantes (4 pesos, normal e itálico) com `document.fonts.load`. O Preview e a impressão esperam por ela.
- `quebrar(texto, estilo, largura, medir)` parte o texto por parágrafos (`\n`) e depois por palavras. Ignora os parágrafos vazios.
- A largura útil das descrições é `LARGURA_DESC = COL.totX1 − 30,39 = 564,9 − 30,39 = 534,51 pt`.
- Os textos copiados do original usam a ligadura "ﬁ" (U+FB01), como no ficheiro dele. Para comparar textos, a função interna `normal()` troca "ﬁ" por "fi", junta espaços e remove hífenes de fim de linha.

### Imagens de fundo

| Ficheiro | Quando é usado | Conteúdo |
|---|---|---|
| `public/img/cotacao-fundo.jpg` | Última página com só duas linhas de totais (SUB-TOTAL e IVA), ou seja, sem desconto. No código é `original = ultima && n === 2` | A arte original do Momad, sem texto, com as caixas de totais e a linha amarela |
| `public/img/cotacao-fundo-livre.jpg` | Todas as outras páginas: as de continuação e a última página com desconto | O mesmo fundo sem as caixas de totais |
| `public/img/cotacao-barra-total.jpg` | Só na última página com fundo livre (com desconto) | A barra amarela do TOTAL, recortada do original, a toda a largura, em y = 770,887, com 45,808 de altura |
| `public/img/logo.svg` | Todas as páginas | Logotipo em (343,76; 31,18), 218,92 × 51,17 |

`public/img/cot-pattern.jpg` serviu de apoio para reconstruir o fundo livre. O código não a usa.

Com o fundo original, as caixas e a linha amarela já vêm na imagem e a aplicação só escreve os textos. Com o fundo livre, a aplicação desenha as caixas e a linha amarela e coloca a barra do TOTAL.

### Cabeçalho

| Elemento | Posição (pt) | Notas |
|---|---|---|
| "Cotação" + número | x 30,39, y 43,08 | O número (`Cotacao.numero`) fica 7 pt à direita da palavra. Só sai se existir |
| "**Não serve de comprovativo fiscal" | y 57,07 | Fixo |
| "Válida por N dias" | y 69,69 | N = `validadeDias`. Acrescenta " · página p/t" quando há mais de uma página |
| Data | y 91,77 | `dataDoc(c.data)` |
| "Exmo (s)Sr(s):" + nome do cliente | y 114,54 (nome em x 118,08) | Nome em negrito |
| Logotipo do cliente | (30,9; 116,4), 83,4 × 32,2 | Só quando o cliente tem `logoId` |
| Cidade do cliente | y 158,73 com logotipo, 130 sem | `Cliente.cidade` ("Cidade, País") |
| Contactos da empresa | alinhados à direita em x 550,5, a partir de y 104,05, de 13,4 em 13,4 | `telefones`, `email`, `instagram`, `cidade` da `Empresa` |
| Cabeçalho da tabela | y 196,5 | "Qt.", "Descrição", "Valor Unitário", "Valor Total" |

O logotipo do cliente é um ficheiro guardado no aparelho (`db.ficheiros`). `logoDoCliente(cliente)` devolve um URL temporário para ele. Os ficheiros **não** sincronizam com a nuvem (a tabela `ficheiros` não está em `TABELAS` de `src/nuvem.ts`). Por isso o logotipo só aparece no aparelho onde foi carregado.

### Tabela de itens

Colunas (`COL`, em pontos):

| Coluna | De | Até |
|---|---|---|
| Qt. | 30,4 | 64,0 |
| Descrição | 67,9 | 348,9 |
| Valor unitário | 352,8 | 456,9 |
| Valor total | 460,8 | 564,9 |

Cada item (`ItemCotacao`) desenha:

- quatro caixas cinzentas (#f2f2f2, contorno #9d9d9c) com 39,4 pt de altura;
- a quantidade com dois dígitos ("01"), centrada em x 46,2;
- a linha 1 (`titulo`) em Book 12 e, por baixo, a linha 2 (`subtitulo`) em negrito;
- quando o item pertence a uma opção, o título "OPÇÃO n - título" (as linhas geradas pela aplicação não levam este prefixo);
- os valores unitário e total (`qt × precoUnit`), alinhados à direita;
- por baixo das caixas, as linhas de descrição, a partir de y + 53,3, de 12 em 12 pt.

As linhas por baixo do item (função `linhasDoItem`) saem por esta ordem:

1. **Descrição** (`descricao`), quebrada em linhas. Regras de estilo (`estiloLinhaDesc`):
   - uma linha que começa por "** layout" sai em negrito itálico cinzento;
   - a primeira linha sai em Medium itálico, excepto se começar por "•", "-" ou "–" (as listas ficam todas em Light);
   - as restantes saem em Light itálico.
2. **Materiais** (`materiais`), um por linha:
   - o nome a vermelho, sublinhado a vermelho (0,5 pt);
   - a seguir, em cinzento, "- Certificado", "- Não Certificado", ou "- Não Certificado (Sem garantias)" quando não é certificado e não tem garantia;
   - se o material tem `garantia`, uma linha extra: "(A marca garante vida útil {garantia} se usado e conservado dentro dos padrões recomendados)".
3. **Nota do item** (`nota`), em negrito itálico cinzento (ex.: "** Layout já definido").

Um **título de secção** (`secao: true`) é uma faixa cinzenta (#e6e6e6) de 26,5 pt, com filetes amarelos (#e8c94f) em cima e em baixo e o título em maiúsculas. Não tem valores e não entra nos totais.

Alturas usadas na paginação:

| Bloco | Altura ocupada | Espaço depois (`folga`) |
|---|---|---|
| Item sem linhas por baixo | 39,4 + 12 = 51,4 | 0 |
| Item com L linhas | 39,4 + 13,9 + 12 × (L − 1) + 18,6 | 18,6 |
| Secção | 26,5 + 12 = 38,5 | 12 |

A `folga` é o espaço depois do bloco. Não conta para decidir se o bloco cabe na página.

### Paginação: `paginar()`

`paginar(c, medir)` recebe a cotação (itens, `notaMaterial`, `desconto`, `notas`) e devolve uma lista de páginas. Cada página é uma lista de `ItemPos`, com a posição `y` de cada item.

Constantes:

| Constante | Valor | Significado |
|---|---|---|
| `TOPO_ITENS` | 219,4 | Onde começa o primeiro item de cada página |
| `FIM_CONTINUA` | 790 | Até onde descem os itens numa página que continua |
| `fimUltima` | `topoBloco(n) − 12,8 − (43 se notaMaterial) − altura do texto final a toda a largura` | Até onde descem os itens na última página, para caber o bloco de totais |

Passos:

1. `n` = número de linhas de totais: 2 (SUB-TOTAL e IVA), ou 3 com desconto.
2. Cada item vira um bloco com altura e folga (tabela acima).
3. `dispor(itens, fim)` enche as páginas por ordem, a partir de `TOPO_ITENS`. Quando o bloco seguinte não cabe até `fim` e a página já tem algum item, abre página nova. **Um título de secção nunca fica sozinho no fundo da página**: para caber, a secção precisa também da altura do item seguinte.
4. Primeiro dispõe tudo com `FIM_CONTINUA`.
5. Depois verifica a última página. Se o último item passa de `fimUltima`:
   - essa página passa a ser uma página de continuação cheia;
   - só o último item (com os títulos de secção logo antes dele) passa para uma página nova;
   - repete até caber, no máximo 50 voltas.
6. Se a página já só tem esse item e mesmo assim não cabe, junta uma última página só com os totais.

Resultado: as páginas de continuação vão até ao rodapé, e a última página leva, em regra, o último item junto com os totais. Foi o que o Momad pediu em 17 de Outubro de 2026: "a página a seguir deve ter muita coerência".

### Uma série de páginas por opção: `paginasCotacao()`

`paginasCotacao(cotacao, medir, urgenciaPct)` devolve `{ c, itens, ultima }[]`, a lista de todas as páginas a imprimir.

1. Aplica `comUrgencia` aos itens. Assim as linhas "Taxa de urgência" existem no documento.
2. Junta os números de opção dos itens que não são secção.
3. Com **mais de uma opção**, cria um grupo por opção: os itens sem opção (comuns a todas) mais os itens dessa opção. Com uma opção ou nenhuma, há um só grupo.
4. Pagina cada grupo com `paginar`. Cada grupo termina na sua última página, com o seu SUB-TOTAL / IVA / TOTAL.

Foi uma decisão do Momad (17 de Outubro de 2026): não quis as opções como linhas no bloco de totais. Quer cada opção nas suas páginas, como nas cotações dele.

A numeração "página p/t" e o aviso "continua na página n →" contam todas as páginas, de todas as opções seguidas.

### Bloco de totais: `blocoTotais()`

`blocoTotais(c, taxaIva, urgenciaPct)` chama `totaisCotacao` e devolve:

- `linhas`: SUB-TOTAL (`bruto`), "DESCONTO x%" a vermelho com o valor precedido de "-" (só quando há desconto), e "IVA x%";
- `barra`: TOTAL.

A urgência não é uma linha de totais. É uma linha própria da tabela, logo a seguir ao item urgente.

Geometria (`BLOCO`, `CAIXAS`):

- As linhas de totais sobem a partir da última, em y = 740,46, de 32,72 em 32,72 pt. Cada linha tem 26,5 pt de altura e duas caixas: rótulo (359,98–454,56) e valor (459,79–564,51).
- Mais linhas (o desconto) empurram o bloco para cima. A barra do TOTAL (texto em y 799,31) nunca se mexe.
- O bloco abre com uma linha amarela em `H = topoBloco(n) = 740,46 − 32,72 × (n − 1) − 39,92`, que fica em 667,82 sem desconto e em 635,10 com desconto. Com o fundo original, esta linha já vem na imagem. Com o fundo livre, a aplicação desenha-a.
- A última linha (IVA) usa Medium e as outras Book. O valor do desconto sai a vermelho.

### Texto final, notas e garantias (última página)

A função `termos()` arruma o texto final (`Cotacao.notas`):

| Caso | Onde sai | Regras |
|---|---|---|
| É o texto padrão (comparado com `normal()`) | Coluna à esquerda dos totais, a partir de H + 47,24 | Quebras e larguras fixas do original (`NOTA_PADRAO_LINHAS`, `NOTA_LARGURAS`). Linhas 1 e 3 justificadas, as outras forçadas à largura medida |
| Outro texto que cabe na coluna | Mesma coluna, largura 320,42 | Cabem 5 linhas sem desconto e 8 com desconto. Todas justificadas excepto a última |
| Outro texto que não cabe | A toda a largura (534,51), por cima do bloco de totais | Altura = linhas × 12 + 12. Os itens da última página acabam mais acima. Todas as linhas justificadas excepto a última |

A justificação (`justificada`) calcula o `wordSpacing` que leva a linha à largura pedida: (largura alvo − largura medida) ÷ número de espaços.

Outros textos da última página:

- **Nota do material** (`Cotacao.notaMaterial`). São três linhas por cima dos totais:
  1. "Todos os Materiais serão impressos em vynil com aplicação do respectivo protector material 100% dedicado a wrap.";
  2. "TAKSIM® STX570 + STX571 (60 Microns)" a vermelho sublinhado, seguido de "- Não Certificado";
  3. a garantia "até 2 anos".

  É o modelo antigo, para cotações de wrap cujos itens não têm materiais próprios. Em `src/pages/Cotacoes.tsx`, a caixa "Nota do material no rodapé" só aparece quando nenhum item tem materiais e algum título ou descrição fala de "taksim" ou "wrap". Nesses casos fica ligada por defeito. Se algum item tiver materiais, a nota fica sempre desligada.
- **Nota das garantias**: duas linhas logo abaixo da linha amarela ("** As garantias sobre a duração e qualidade do material serão dadas com base nos certificados…"). Só aparece quando a cotação é de material (`comMaterial`), ou seja, quando a nota do material está ligada, quando algum item tem materiais, ou quando o título, a linha 2 ou a descrição de algum item fala de vinil/vynil, wrap, branding, laminação, PPF, Taksim, Mactac, Avery ou Hexis.

### Páginas de continuação

Uma página que não é a última:

- usa o fundo livre, sem bloco de totais;
- desenha uma linha amarela em y 812,77;
- escreve "continua na página n →" alinhado à direita (x 564,2), em y 804.

### Preview ao vivo

`PreviewCotacao({ c, cliente, empresa })` em `src/pages/cotacaoFormulario.tsx`:

- espera por `carregarFontes()` (até lá não mostra nada) e carrega o logotipo do cliente;
- chama `paginasCotacao(c, medirCanvas, empresa.urgenciaPct)` e desenha cada página com `PaginaCotacao` dentro de `.a4-prev` (o SVG ocupa a largura disponível).

Em `src/pages/Cotacoes.tsx` o Preview aparece em dois sítios:

- na coluna da direita ("Como sai a cotação"), escondida no telemóvel;
- na janela do botão **Preview** da barra de cima, com os botões Fechar e PDF.

O Preview mostra a `vista`, que é a cotação a ser editada (mesmo sem Guardar) **mais** o rascunho do gerador de wrap/branding antes de "Juntar à cotação". Na vista, as linhas do rascunho ficam no fim, depois da Deslocação. Ao juntar, passam para antes das linhas extra (função `ordenar`). Os totais do formulário também incluem o rascunho.

### Impressão: `imprimirCotacao()`

`imprimirCotacao(c, d)` em `src/print.tsx`:

1. Carrega as fontes (`carregarFontes`) e o logotipo do cliente.
2. Descodifica antes as imagens (`cotacao-fundo.jpg`, `cotacao-fundo-livre.jpg`, `cotacao-barra-total.jpg`, `logo.svg` e o logotipo do cliente). As `<image>` do SVG carregam por conta própria e a função de impressão só espera pelas `<img>`. Sem este passo, a impressão podia sair sem a arte.
3. Calcula as páginas com `paginasCotacao` e desenha cada uma num `div.pr-svg` (210 × 297 mm).
4. A função interna `imprimir()`:
   - desenha tudo em `#print-root` (definido em `index.html`);
   - espera pelas `<img>`;
   - troca `document.title` pelo nome do ficheiro, que o browser propõe ao guardar em PDF;
   - chama `window.print()` 250 ms depois e limpa tudo no evento `afterprint`.
5. Nome do ficheiro: `Puzzle_Stickers_Cotação_{cliente}_{linha 2 ou linha 1 do primeiro item}`, com espaços, "/" e ":" trocados por "_". O número COT- não entra no nome.

O CSS de impressão (`src/styles.css`, `@media print`):

- define `@page { size: A4; margin: 0 }`;
- esconde a aplicação (`#root`, avisos e janelas) e mostra só `#print-root`;
- força `print-color-adjust: exact`.

Notas:

- Os botões **PDF** (barra de cima e janela de Preview) gravam primeiro a cotação (`salvar({ notaMaterial })`) e imprimem o registo gravado. Um rascunho do gerador que ainda não foi juntado **não** sai no PDF.
- A cotação ainda não passa pela janela "PDF pronto" da requisição. O ficheiro PDF é criado pelo "Guardar em PDF" do sistema. Limitação conhecida: a captura com html2canvas não aplica as fontes web dentro de SVG, por isso a cotação continua no diálogo de impressão.

### Conteúdos fixos: `src/materiaisCotacao.ts`

#### `MATERIAIS_COTACAO`: materiais das cotações do Momad (17 de Outubro de 2026)

| Material (como sai na cotação) | Certificado | Garantia | `marca` (título da opção) |
|---|---|---|---|
| TAKSIM® STX570 + STX571 (60 Microns) | Não | até 2 anos | Taksim® |
| Mactac® JT10700 WG BFG XR + LF10700 UV Series (80 Microns) | Sim | até 5 à 7 anos | Mactac® |
| Avery Dennison® MPI 1105 SuperCast Series + DOL1460Z (82 Microns) | Sim | até 7 anos | Avery Dennison® |
| Taksim® Economy White Vinyl + Premium Lamination (80 Microns) | Não | acima de 12 meses | Vynil Comum |
| TAKSIM® Premium Bubble Free + Premium Lamination (80 Microns) | Não | acima de 3 anos | Premium |
| Vinyl Holográfico Genérico (50 Microns) | Não | — | — |
| Avery Dennison® Supreme™ PPF Xtreme Gloss (165µm) | Sim | — | — |
| HEXIS® BODYFENCE X | Sim | — | — |
| HEXIS® HEXLIGHTS2 (70µm) | Sim | — | — |
| HEXIS® BODYFENCE WINDSHIELD (70µm) | Sim | — | — |

Só os cinco primeiros têm `marca`, por isso só esses aparecem como opções no gerador de wrap/branding.

#### Outros conteúdos

| Constante | Conteúdo |
|---|---|
| `NOTAS_ITEM` | "** Layout ainda por definir", "** Layout já definido", "** Layout já definido pelo cliente", "** Layout já definido pelo Cliente (Inclui melhoria, ou criação de novo Layout)" |
| `TEXTOS_FINAIS` | Cinco textos finais: Padrão, Pedir layouts, Criar layouts, Agendar viatura, Projecto. O "Projecto" é longo e, por isso, sai a toda a largura |
| `IMPRESSO.tipos` | Full Wrap ("Cobertura de 100% dos painéis"; Laterais, Capom, Bumper Frontal, Bumper Traseiro, Tejadilho, Bagageira, Stickers Complementares) · Half Wrap ("Cobertura de toda a lateral"; Laterais, Stickers Complementares) · Branding ("Cobertura até 30% dos painéis"; Laterais, Logotipos) |
| `IMPRESSO.coberturas` | 100% dos painéis, toda a lateral, e "até" 30, 40, 50, 55, 60, 75, 85 e 100% dos painéis |
| `IMPRESSO.partes` | 16 partes: Frente, Traseira, Laterais, Portas, Capom, Bumper Frontal, Bumper Traseiro, Tejadilho, Bagageira, Guarda-lamas, Retrovisores, Pilares, Spoiler, Logotipos, Logotipo no "Chapéu", Stickers Complementares |
| `IMPRESSO.estilos` | Artístico, Desportivo, Corporativo |
| `IMPRESSO.impressao` | "Impresso em vynil com aplicação do respectivo protector material 100% dedicado a wrap." |
| `DESLOCACAO` | Até 20 km de ida (até 40 km no total): 1.500 MT · 21–35 km (42–70 km): 2.500 MT · 36–50 km (72–100 km): 3.500 MT |

`frasePartes(sel)` escreve a frase "Inclui …" pela ordem do Momad:

- primeiro as partes na ordem de `IMPRESSO.partes`, depois as partes escritas à mão;
- "Stickers Complementares" vai sempre para o fim;
- os dois bumpers juntam-se em "Bumper Frontal e Traseiro";
- liga as partes com vírgulas e põe "e" antes da última. Sem partes, devolve "".

Exemplo com as partes do Full Wrap: "Inclui Laterais, Capom, Bumper Frontal e Traseiro, Tejadilho, Bagageira e Stickers Complementares".

### Formulário: `src/pages/cotacaoFormulario.tsx`

`EditorCotacao` segue a organização que o Momad pediu em 18 de Outubro de 2026: "cada linha é um serviço/produto".

| Secção | O que faz |
|---|---|
| Cliente | Escolher ou criar cliente ("+ Novo cliente…"). Cidade e país gravam-se no cliente ao sair do campo (`separarMorada` / `juntarMorada` em `src/format.ts`; país por defeito Moçambique). Carregar o logotipo do cliente. Data e validade (dias) |
| Linhas | Cada linha fechada mostra um resumo. Aberta, mostra `ItemEditor`: opção (Nenhuma / 1 / 2…), linha 1, linha 2 (a negrito), detalhes (uma ideia por linha), materiais, nota final, quantidade, valor unitário sem IVA |
| "Adicionar linha" | Wrap / Branding (gerador `NovoImpresso`), Criação de imagem (`CatalogoCriacao`), Outro serviço ou produto (linha em branco), Título de secção |
| Deslocação, urgência e desconto | Deslocação por botões ("Sem deslocação", as três bandas de `DESLOCACAO`, ou "Outro valor" com km e valor). Urgência ligada linha a linha. Desconto em %. IVA fixo, "sempre incluído" |
| Texto final | Botões com `TEXTOS_FINAIS` e área de texto livre |
| Totais | Com várias opções, uma linha por opção (sub-total + IVA, total). Sem opções: Sub-total, Desconto, IVA, TOTAL |

Regras do formulário:

- A deslocação é uma linha `{ qt: 1, titulo: 'Deslocação', subtitulo: banda ou km, extra: true }`. As linhas `extra` ficam sempre no fim da cotação (função `ordenar`).
- A urgência marca `ItemCotacao.urgente`. O botão mostra o acréscimo: `r2(precoUnit × urgenciaPct / 100)`.
- **Gerador Wrap / Branding (`NovoImpresso`)**:
  - escolhe-se o serviço (Branding passa o estilo para Corporativo), os estilos, a viatura ou objecto ("É uma viatura") com a quantidade, a cobertura, as partes e o layout;
  - marcam-se os materiais com `marca` (os três primeiros vêm marcados) e escreve-se um preço para cada um;
  - cria **um item por material marcado**. O título é a marca e a linha 2 é "{serviço} {viatura}". A descrição tem a primeira linha automática ("{serviço} {estilos} em Viatura {viatura}", editável), "** {cobertura}", a frase das partes e o texto de impressão. A nota é o layout escolhido;
  - com mais de um material, cada item recebe a sua opção (1, 2, 3…). O botão diz "Juntar à cotação (N opções)".
- **Criação de imagem**: lista os serviços activos do catálogo (`Servico`) por categoria. Ao escolher um, cria uma linha com o nome, os "inclui" numa lista com "•" e o preço do catálogo.
- O seletor de materiais usa sempre `MATERIAIS_COTACAO`, porque a página `Cotacoes.tsx` não passa outra lista. Um material escrito à mão ("Outro material (escrever)…") entra só nessa linha. A caixa "Guardar na lista de materiais" ainda não grava nada.

---

## Requisição de prints

### Ficheiros

| Ficheiro | O que faz |
|---|---|
| `src/requisicaoPdf.tsx` | Preçário da Académica 2026, nomes oficiais, preço por linha, totais (`totaisLinhas`), a página (`PaginaRequisicao`) e o CSS (`CSS_REQUISICAO`) |
| `src/pdfPartilha.tsx` | `renderizarPdf` (HTML → PDF no aparelho), janela "PDF pronto" (`PdfHost`), `emitirRequisicao` |
| `src/print.tsx` | `imprimirLista`, que chama `emitirRequisicao` |

O PDF abre a partir de vários sítios:

- os botões "PDF" e "PDF da lista" em `src/pages/RequisicaoForm.tsx`, que gravam a requisição antes de gerar o PDF;
- os ícones nas listas de `Requisicoes.tsx`, `Fornecedores.tsx` e `Trabalho.tsx`.

Só existe para requisições do tipo lista. As encomendas (`tipo: 'encomenda'`) não têm PDF.

### Preçário e materiais

`PRECARIO_ACADEMICA_2026` tem os preços por m², sem IVA, com os nomes do preçário (16 de Outubro de 2026):

| Nome | Tipo | Preço/m² |
|---|---|---|
| Impressão com material da Puzzle Stickers | impressão | 800 |
| Vinil comum | impressão | 950 |
| Vinil comum laminado | impressão | 1.400 |
| Vinil de wrap | impressão | 1.150 |
| Vinil branco premium | impressão | 1.050 |
| Vinil transparente premium | impressão | 950 |
| ContraVision | impressão | 1.150 |
| Banner | impressão | 950 |
| Laminação de wrap | laminação | 850 |
| Laminação transparente premium | laminação | 450 |

Esta lista serviu para carregar o preçário no registo do fornecedor, através de um script de administração que não está no repositório. Na aplicação, o formulário lê os preços de `Fornecedor.materiais` (dados na nuvem), não desta constante.

Funções de apoio:

| Função | Recebe | Devolve / regra |
|---|---|---|
| `nomeOficial(nome)` | Nome antigo | "Taksim…", "vinil de wrap" ou "vynil de wrap" → "Vinil de wrap"; laminação + transparente → "Laminação transparente premium"; laminação + premium/wrap → "Laminação de wrap"; qualquer outro nome fica igual |
| `linhasComMaterial(r)` | Requisição | Linhas com material próprio (`impressao` ou `laminacao` definidos). As requisições anteriores a 16 de Outubro de 2026 tinham um material para a lista inteira: cada linha recebe esse material (nome oficial) e os preços da lista |
| `nomeMaterial(l)` | Linha | "Bundle Wrap" quando é vinil de wrap + laminação de wrap. Senão "impressão + laminação", ou "—" |
| `precoM2(l)` | Linha | `precoImpressao + precoLaminacao` (Bundle Wrap = 1.150 + 850 = 2.000) |
| `valorLinha(l)` | Linha | `r2(m2Linha(l) × precoM2(l))` |

### `totaisLinhas(linhas, taxaIva)`

- Usa só as linhas com quantidade, largura e comprimento maiores que zero (`usadas`). Só estas saem no PDF.
- `porMaterial`: m², valor e preço agrupados por `nomeMaterial`. É calculado mas não aparece no PDF, porque o Momad não quis o resumo por material.
- `m2`: soma dos m². Também não aparece no PDF, porque os materiais são diferentes.
- `subtotal = r2(soma de valorLinha)`, `iva = r2(subtotal × taxa / 100)`, `total = r2(subtotal + iva)`.

### A página: `PaginaRequisicao`

Recebe `numero`, `data`, `nomeTrabalho`, `fornecedor`, `empresa`, `linhas` e `notas`. É uma página HTML com 210 mm de largura e pelo menos 297 mm de altura.

| Zona | Conteúdo |
|---|---|
| Topo | Logotipo `public/img/logo-doc.svg` (62 mm) · "REQUISIÇÃO DE PRINTS" · número numa etiqueta amarela (#ffc406) · data (`dataDoc`) · barra amarela por baixo |
| Caixa do fornecedor | Só o logotipo do fornecedor: `public/img/academica.png` quando o nome contém "Académica" (ou "Academica"). Para outro fornecedor, o nome em negrito |
| Caixa do trabalho | "Trabalho", `nomeTrabalho` com "_" trocados por espaços, e "N prints" |
| Tabela | Nº, Ficheiro, Material, Qt., L × C (m), m², Preço m², Valor. Larguras fixas: 7 / 64 / 33 / 8 / 21 / 10 / 20 / 21 mm |
| Ficheiro | 10 pt, negrito, preto, com barra amarela à esquerda. Depois de cada "_" há um espaço invisível (U+200B) para o nome poder quebrar |
| Material | "Bundle Wrap" com a linha "Vinil de wrap + laminação de wrap" por baixo. Nos outros casos, a impressão (ou a laminação, se for só laminação) e, quando há as duas, a linha "+ {laminação}" por baixo |
| Fim | Notas à esquerda. À direita: Sub-total, "IVA x%" e TOTAL a amarelo |
| Rodapé | "Preços por m², sem IVA, do preçário 2026 da {fornecedor}." e o nome, os telefones e o email da empresa |

Decisões do Momad (16 de Outubro de 2026):

- título "REQUISIÇÃO DE PRINTS";
- caixa do fornecedor só com o logotipo;
- sem resumo por material e sem total de m²;
- nome do ficheiro em destaque;
- célula do material em duas linhas.

O logotipo usa `logo-doc.svg`, que tem largura, altura e cor sólida definidas, porque o html2canvas corta um SVG sem largura e altura.

### Do HTML ao PDF: `renderizarPdf(node, css)`

Devolve um `Blob` PDF. Funciona offline e nada sai do aparelho. As bibliotecas são ficheiros `.js` da aplicação, guardados pela PWA.

1. Importa `jspdf` e `html2canvas` só quando é preciso (import dinâmico).
2. Junta o CSS à página e desenha o documento numa `div` fora do ecrã (left −12000 px, 210 mm de largura).
3. Carrega o Gotham nos pesos 300, 400, 500 e 700 e espera por `document.fonts.ready`.
4. Espera pelas imagens com `decode()`, no máximo 2,5 s cada, porque com a aplicação em segundo plano o `decode()` nunca termina.
5. Captura com `html2canvas` (escala 2,5, fundo branco).
6. Corta a imagem em fatias com a proporção A4 (altura = largura × 297/210). Cada fatia vira uma página JPEG (qualidade 0,92) de 210 × 297 mm. Ignora uma sobra de menos de 4 px no fim.
7. Limpa tudo no `finally`.

### Janela "PDF pronto"

`PdfHost` é montado uma vez em `src/App.tsx`. Recebe um `PdfPronto` `{ blob, nome, texto, telefone?, destino? }` através da variável interna `mostrar` de `src/pdfPartilha.tsx`. Hoje só `emitirRequisicao` a usa. Um documento novo que queira esta janela deve ser emitido por uma função nesse ficheiro. A janela existe porque os telemóveis só abrem a folha de partilha a partir de um toque directo.

| Botão | Quando aparece | O que faz |
|---|---|---|
| Partilhar (WhatsApp, email…) | O aparelho consegue partilhar ficheiros (`navigator.canShare({ files })`) | Abre a folha de partilha com o ficheiro, o título e o texto |
| Descarregar e abrir o WhatsApp da {destino} | O aparelho não partilha ficheiros e o fornecedor tem telefone | Descarrega o PDF e abre o WhatsApp na conversa, com a mensagem escrita: `wa.me` no telemóvel, `whatsapp://send` no computador. O PDF tem de ser anexado à mão a partir das Transferências |
| Descarregar | Sempre | Grava o ficheiro |
| Ver | Sempre | Abre o PDF num separador |

A janela mostra também o nome do ficheiro e o tamanho em KB. O link do ficheiro é criado uma vez por janela e libertado ao fechar.

### `emitirRequisicao(r, d)`

- Desenha `PaginaRequisicao` com `linhasComMaterial(r)` e `CSS_REQUISICAO`.
- Nome do ficheiro: `{número com "/" trocado por "-"}_{nome do trabalho com espaços, "/", "\" e ":" trocados por "_"}.pdf`, por exemplo `REQ-003-OUT-26_Nome_Do_Trabalho.pdf`. Sem nome do trabalho, usa "Requisicao".
- Texto da mensagem: "Bom dia! Segue a requisição de prints {número} — {nome do trabalho, com "_" trocados por espaços} ({n} prints). Aguardo a pró-forma. Obrigado — Puzzle Stickers".
- Telefone: o do fornecedor. Destino: a primeira palavra do nome do fornecedor.

### Diferenças a conhecer

- **IVA**: o PDF calcula sempre o IVA (`totaisLinhas`). `totaisRequisicao`, usado no resto da aplicação, só o soma quando `comIva` está ligado.
- **Arredondamento**: o PDF arredonda linha a linha e soma. `totaisRequisicao` soma sem arredondar e só arredonda no fim. Com um só preço, multiplica os m² totais pelo preço, como a folha Excel do Momad. Pode haver diferenças de cêntimos.
- **Quebra de página**: o corte em páginas é feito em píxeis. Uma requisição muito longa pode partir uma linha da tabela entre duas páginas.
- **Telefone**: para o WhatsApp, esta janela só tira os dígitos, por isso o número do fornecedor tem de estar gravado com o indicativo (258…). A função `waLink` de `src/format.ts` acrescenta o 258 aos números de 9 dígitos, mas esta janela não a usa.
- **Contagem de prints**: a mensagem conta as linhas com quantidade maior que zero. O PDF conta as linhas com quantidade e medidas.

---

## Relação do IVA (PDF e CSV)

Em `src/print.tsx`, com os números de `ivaDoMes` (ver Cálculos). Os botões "PDF" e "Excel" estão em `src/pages/Iva.tsx`.

- `imprimirIva(mes, r, d)` faz uma página A4 em HTML (fonte Montserrat) com:
  - logotipo, razão social e NUIT;
  - "Relação do IVA", o mês e "Regime normal · taxa {taxa da empresa}%";
  - três caixas: IVA liquidado, IVA dedutível, e IVA a pagar ou crédito a reportar;
  - duas tabelas, "Faturas emitidas (vendas)" e "Faturas recebidas (compras)", com as colunas Data, Tipo, Número, Entidade, NUIT, Base, IVA e Total;
  - um rodapé a dizer que é um resumo de apoio e não substitui a declaração oficial.

  Sai pelo diálogo de impressão, com o título "Relacao IVA {mes} Puzzle Stickers". Nas notas de crédito, cada linha mostra o IVA negativo e a base sem sinal. A linha de totais de cada tabela subtrai base e IVA.
- `exportarIvaExcel(mes, r, d)` gera um CSV em UTF-8 com BOM, separador ";", fim de linha CRLF e números no formato 1.234,56. No topo leva o título, a razão social com o NUIT e os três valores. Depois vêm as colunas Direção, Data, Tipo, Número, Entidade, NUIT, Base, IVA e Total. Nas notas de crédito, base e IVA saem negativos e o Total sai sem sinal. O ficheiro chama-se `Relacao_IVA_{mes}_Puzzle_Stickers.csv`.

O CSS deste ficheiro (`CSS`) ainda tem estilos de versões antigas da lista e da cotação (classes `li-*` e `ct-*`) que já não são usados.

---

## Catálogos

Os catálogos estão em `src/pages/Catalogos.tsx`, no separador **Cotações → Catálogos**. O separador fica escondido para o papel de trabalhador (`naoTrab` em `src/App.tsx`). O Momad pediu-os em 18 de Outubro de 2026, para os enviar em poucos toques.

| id | Nome | Ano | Páginas | Tamanho | Notas |
|---|---|---|---|---|---|
| `criacao-de-imagem-2026` | Criação de Imagem | 2026 | 21 | 4,7 MB | Capa deitada |
| `sticker-kits-2025` | Sticker Kits | 2025 | 10 | 5,7 MB | |
| `producao-2020` | Produção | 2020 | 10 | 3,1 MB | Marcado "antigo" |

Os ficheiros estão em `public/catalogos/{id}.pdf` e as capas em `public/catalogos/{id}.jpg`. Vão com a aplicação, por isso o link é o mesmo em todos os aparelhos.

| Acção | O que faz |
|---|---|
| Partilhar PDF | Descarrega o PDF e abre a folha de partilha. Se o aparelho não partilhar ficheiros, descarrega com o nome "Catálogo {nome} · Puzzle Stickers {ano}.pdf" |
| Enviar link | Abre o WhatsApp sem contacto escolhido, com o texto "Olá! Segue o nosso catálogo de {nome}: {endereço}/catalogos/{id}.pdf" |
| Ver | Abre o PDF num separador (a capa também o abre) |
| Copiar link | Copia o link. Se a cópia falhar, mostra o link num aviso |

Configuração da PWA (`vite.config.ts`):

- `navigateFallbackDenylist: [/^\/catalogos\//]` faz os links abrirem o PDF e não a aplicação.
- Os padrões de pré-cache do Workbox não incluem `catalogos/`. Os PDFs e as capas precisam de rede.

Para juntar um catálogo:

1. Pôr `{id}.pdf` e `{id}.jpg` em `public/catalogos/`.
2. Acrescentar uma entrada a `CATALOGOS`.

---

## Cálculos: `src/calc.ts`

### Arredondamento

`r2(n) = Math.round((n + Number.EPSILON) × 100) / 100`. As quantias passam por aqui. Os m² não são arredondados.

Valores por defeito da empresa (`EMPRESA` em `src/seed.ts`): IVA 16%, sinal 50%, urgência 45%, validade da cotação 30 dias.

### Cotação

#### `comUrgencia(itens, pct)`

- **Recebe**: os itens da cotação e a percentagem de urgência.
- **Devolve**: os itens, com uma linha nova logo a seguir a cada item urgente (`urgente`, desde que não seja secção). A linha nova tem:
  - `titulo`: "Taxa de urgência (45%)";
  - `subtitulo`: a linha 2 do item, ou a linha 1;
  - `qt: 1`;
  - `precoUnit = r2(precoUnit do item × pct / 100)`;
  - a mesma `opcao` do item;
  - `extra: true`, `gerada: true`.
- **Regras**:
  - cobra-se 45% de **uma** unidade, uma só vez: num item com 5 carros não se cobra 5 vezes (Momad, 18 de Outubro de 2026);
  - sem percentagem, ou se já houver uma linha `gerada`, devolve os itens sem mudar nada. Por isso pode ser chamada duas vezes sem duplicar (`paginasCotacao` e depois `totaisCotacao`);
  - as linhas geradas não se gravam na cotação, porque são criadas sempre que é preciso. Na conversão em trabalhos, a linha de urgência passa a ser uma parte do trabalho do seu item.

#### `totaisCotacao(c, taxaIva, urgenciaPct = 0)`

- **Recebe**: a cotação (itens e `desconto` em %), a taxa de IVA e a urgência.
- **Devolve**: `{ bruto, desconto, sub, iva, total, opcoes }`. `opcoes` é uma lista de `{ opcao, bruto, desconto, sub, iva, total }`. Quando há opções, os valores principais são os da opção mais barata e vêm também com o seu `opcao`.
- **Regras**:
  1. Aplica `comUrgencia` e ignora as secções.
  2. `bruto = r2(Σ qt × precoUnit)`, `desconto = r2(bruto × desconto% / 100)`, `sub = r2(bruto − desconto)`, `iva = r2(sub × taxa / 100)`, `total = r2(sub + iva)`.
  3. O desconto sai **antes** do IVA e aplica-se a todas as linhas, incluindo a urgência e a deslocação.
  4. Toda a cotação leva IVA (Momad, 17 de Outubro de 2026).
  5. Com opções, cada opção soma os seus itens mais os itens sem opção (os comuns, deslocação incluída).
  6. O valor principal (`total` e os outros) é o da cotação inteira ou, quando há opções, o da **opção mais barata**. A lista de cotações mostra "desde X" até o cliente escolher a opção (`opcaoAceite`).

Na conversão em trabalhos (`src/pages/Cotacoes.tsx`), o trabalho fica com `comIva: true` e o desconto já aplicado aos preços unitários das partes (`precoNoTrabalho`). Assim o trabalho soma o mesmo que a cotação.

### Requisição

#### `m2Linha(l)`

Devolve `qt × largura × comprimento`. Os campos em falta contam como 0.

#### `totaisRequisicao(r, taxaIva)`

- **Recebe**: a requisição (linhas, preços da lista, `comIva` e, opcionalmente, `tipo` e `itens`) e a taxa de IVA.
- **Devolve**: `{ m2, precoM2, subtotal, iva, total }`.
- **Regras**:
  - **Encomenda** (`tipo: 'encomenda'`): `subtotal = r2(Σ qt × precoUnit)`. `m2` e `precoM2` são 0.
  - **Lista**:
    - `m2` é a soma dos m², sem arredondar.
    - Preço de cada linha: se a linha tem material próprio (`impressao` ou `laminacao` definidos, mesmo vazios), usa `precoImpressao + precoLaminacao`. Senão, usa o preço da lista (`precoImpressaoM2 + precoLaminacaoM2`).
    - Se todas as linhas com área têm o mesmo preço, `precoM2` é esse preço e `subtotal = r2(m2 × precoM2)`. É a conta da folha Excel do Momad.
    - Com preços diferentes, `precoM2 = 0` e `subtotal = r2(Σ m² da linha × preço da linha)`.
  - `iva = r2(subtotal × taxa / 100)` só com `comIva`. `total = r2(subtotal + iva)`.

### Trabalho

#### `totaisTrabalho(t, taxaIva, urgenciaPct)`

- **Recebe**: o trabalho (`itens`, `comIva`, `urgente`), a taxa de IVA e a urgência.
- **Devolve**: `{ base, urgencia, subtotal, iva, total }`.
- **Regras**:
  - `base = r2(Σ qt × precoUnit)`;
  - `urgencia = r2(base × pct / 100)` quando o trabalho é urgente;
  - `subtotal = r2(base + urgencia)`. O IVA só entra com `comIva`.
  - A urgência do trabalho aplica-se a toda a base. Um trabalho criado a partir de uma cotação traz `urgente: false`, e a urgência entra como uma parte.

#### `resumoTrabalho(t, pagamentos, requisicoes, custos, cfg, hoje)`

- **Recebe**: o trabalho, todos os pagamentos, requisições e custos, `cfg = { taxaIva, urgenciaPct, sinalPct }` e o dia de hoje.
- **Devolve**: `ResumoTrabalho`. Em `src/state.tsx` é calculado para cada trabalho (`d.resumo`).

| Campo | Regra |
|---|---|
| `subtotal`, `iva`, `total` | De `totaisTrabalho` |
| `pago` | Soma dos pagamentos do trabalho que não foram apagados |
| `emDivida` | `max(0, total − pago)`. É 0 se o trabalho foi cancelado |
| `sinalEsperado` | `r2(total × sinalPct / 100)` |
| `sinalPago` | `pago + 0,005 ≥ sinalEsperado` |
| `custoRequisicoes` | Soma dos `subtotal` (sem IVA) das requisições do trabalho que não foram apagadas. Inclui rascunhos |
| `m2` | Soma dos m² dessas requisições |
| `custoOutros` | Soma dos `Custo` do trabalho |
| `custoTotal`, `lucro`, `margem` | `lucro = subtotal − custoTotal`; `margem = lucro / subtotal` (0 sem subtotal) |
| `dias` | Dias desde `dataEntrada` até à data da fase "entregue", ou até hoje |
| `atrasado` | Não cancelado, não entregue, e `prazo` ou `prazoAtual` já passou |

O custo mede-se sem IVA, porque o IVA das faturas dos fornecedores recupera-se na declaração mensal. A mão de obra não é custo do trabalho: os salários são despesas fixas e entram no resultado do mês.

### Ciclo do fornecedor

#### `FASES_REQ` e `faseRequisicao(r, taxaIva = 16)`

| Fase | Nome no ecrã | Cor |
|---|---|---|
| `rascunho` | Rascunho | #8a8f98 |
| `enviada` | Lista enviada | #1e9bff |
| `proforma` | Pró-forma por pagar | #ff8a00 |
| `credito` | A crédito | #e84393 |
| `paga` | Paga | #7c5cff |
| `faturada` | Faturada | #00b3a4 |
| `levantada` | Levantada | #2bb673 |

A fase é calculada, nunca gravada. Ordem de decisão:

1. `temValor` é verdadeiro quando há pró-forma, pagamento a crédito ou pagamentos. `pago` é `temValor` com saldo ≤ 0,005.
2. Levantada (`levantadaEm`, ou o estado antigo `recebida`): "credito" se tem valor e ainda não está paga, senão "levantada".
3. Fatura recebida (`faturaDocId`) e paga: "faturada".
4. Paga: "paga".
5. `pagamento === 'credito'`: "credito".
6. Tem pró-forma: "proforma".
7. Enviada (`enviadaEm` ou estado `enviada`): "enviada".
8. Nos outros casos: "rascunho".

#### Valor, pago e saldo

| Função | Regra |
|---|---|
| `valorRequisicao(r)` | Valor da pró-forma, se existir. Senão, o `total` de `totaisRequisicao` |
| `pagoRequisicao(r)` | Soma de `r.pagamentos`. Os registos antigos marcados `pago` sem lista de pagamentos contam como pagos por inteiro |
| `saldoRequisicao(r)` | `max(0, valor − pago)` |
| `estadoPagamento(r)` | "Pendente" (nada pago), "Parcial" (saldo > 0,005) ou "Pago" |

#### `contasAPagar(reqs, taxaIva)`

Devolve o que se deve aos fornecedores: as requisições não apagadas, com pró-forma ou a crédito, com saldo > 0,005. Para cada uma devolve `{ r, valor (saldo), total, pago, desde, credito }`. `desde` é `creditoDesde`, ou a data da pró-forma, ou a data da requisição. A lista é ordenada por `desde` e depois pelo número da pró-forma (ou da requisição, quando não há pró-forma).

#### `mapaCredito(reqs, taxaIva)`: o "Mapa de controlo de crédito"

- **Entra**: requisições não apagadas com pró-forma, crédito, pagamentos ou marca `pago`.
- **Cada linha**: `{ r, valor, pago, saldo, estado, fase }`, ordenada pela data da requisição e pelo número da pró-forma.
- **Totais**: `total`, `pago` e `aberto`, arredondados.
- O teste reproduz os totais do Excel do Momad: 114.554,50 / 18.718,80 / 95.835,70.

### Caixa

`Movimento = { data, em?, tipo: 'entrada' | 'saida', origem, valor, texto, ref? }`. A origem é `cliente`, `compra`, `fixa`, `fornecedor`, `pessoal` ou `reposicao`.

#### `movimentosCaixa(pagamentos, despesas, requisicoes, taxaIva = 16)`

| Fonte | Movimento |
|---|---|
| Cada `Pagamento` não apagado | Entrada `cliente`. O texto é a referência, ou "Pagamento de cliente" |
| Cada `Despesa` não apagada | Saída `pessoal` se `pessoal`, `fixa` se tem `fixaId`, `compra` nos outros casos. Valor com IVA |
| Despesa pessoal reposta (`pessoalEstado: 'reposto'` com `pessoalEm`) | Entrada `reposicao` no dia da reposição, com o texto "Reposição: …" |
| Cada pagamento de uma requisição | Saída `fornecedor`, com o texto "{número} · {trabalho}" |
| Requisição antiga marcada paga, sem lista de pagamentos, com `pagoEm` | Saída `fornecedor` com o valor da requisição |

Ordena por data e depois pela hora de criação (`em`). Uma despesa pessoal autorizada (`pessoalEstado: 'autorizado'`) sai da caixa e não volta.

#### `saldoCaixa(movs, caixa?)`

- Sem `Empresa.caixa` (o saldo real que o Momad escreve uma vez em "Acertar caixa"), devolve `undefined`.
- Com caixa, devolve `caixa.valor` + entradas − saídas **depois** desse momento. Conta os dias seguintes e os movimentos do mesmo dia criados depois (`em > caixa.em`).
- Os movimentos do mesmo dia sem hora (pagamentos a fornecedores) consideram-se já incluídos no saldo.

#### `resumoCaixaMes(movs, mes)`

Devolve `{ entrou, reposicoes, compras, fixas, fornecedores, pessoal, saiu, saldo, movimentos }` do mês (AAAA-MM):

- `entrou` = todas as entradas, reposições incluídas;
- `saiu = compras + fixas + fornecedores + pessoal`;
- `saldo = entrou − saiu`.

É uma vista de caixa: cada valor conta no dia em que o dinheiro se mexe. O salário de Outubro pago a 2 de Novembro conta em Novembro.

### Resultado do mês

#### `resultadoDoMes(mes, docs, requisicoes, custos, despesas, taxaIva)`

Devolve `{ vendas, custosTrabalhos, despesas, resultado, porCategoria }`, tudo sem IVA.

| Parcela | Regra |
|---|---|
| `vendas` | Soma das bases dos documentos emitidos no mês que contam para IVA. As notas de crédito subtraem |
| `custosTrabalhos` | Subtotais das requisições do mês (pela data da requisição) que **não** estão em rascunho, mais os `Custo` do mês |
| `despesas` | `despesaSemIva` das despesas do mês que não são pessoais. O mês é `Despesa.mes` (despesa fixa) ou o mês da data |
| `resultado` | `vendas − custosTrabalhos − despesas` |
| `porCategoria` | Despesas sem IVA por categoria |

`despesaSemIva(d) = r2(valor − iva)`.

Há duas vistas do custo do fornecedor:

- o **resultado** conta-o na data da requisição;
- a **caixa** conta-o quando é pago.

As despesas pessoais nunca são custo da empresa.

### IVA

| Função | Regra |
|---|---|
| `contaParaIva(tipo)` | Contam `fatura`, `fatura-recibo`, `venda-dinheiro` e `nota-credito`. Os recibos não contam |
| `ivaDoMes(docs, mes)` | Documentos não apagados do mês que contam para IVA, separados em emitidos e recebidos. As somas levam sinal (nota de crédito = −1). Devolve `emitidos`, `recebidos`, `baseVendas`, `baseCompras`, `liquidado`, `dedutivel`, `apagar` (se o saldo for > 0), `credito` (se for < 0) e `ignorados` (os documentos do mês que não contam) |
| `ivaDeBase(base, taxa)` | `r2(base × taxa / 100)` |
| `baseDeTotal(total, taxa)` | `r2(total / (1 + taxa / 100))` |

### Despesas fixas

| Função | Recebe | Devolve / regra |
|---|---|---|
| `CATEGORIAS_DESPESA` | — | 12 categorias, de "Salários" a "Outros" |
| `addMeses(mes, n)` | "AAAA-MM", n | O mês n meses depois (ou antes) |
| `janelaFixa(f, mes)` | Despesa fixa (`dia`, `abre`), mês | `{ abre, vencimento }`. Se `abre > dia`, o vencimento passa para o mês seguinte. É a regra do Momad: paga do dia 25 ao dia 5 do mês seguinte. O dia fica limitado ao último dia do mês (31 → 28 em Fevereiro) |
| `vencimentoFixa(f, mes)` | O mesmo | Só o vencimento |
| `fixasDoMes(fixas, despesas, mes, hoje)` | Despesas fixas e despesas | Fixas não apagadas que já começaram (`inicio ≤ mes`) e estão activas, ou que foram pagas nesse mês. Estado: `paga` (há despesa com `fixaId` e `mes`), `atrasada` (o vencimento já passou), `a-pagar` (janela aberta), `pendente`. Ordenadas por vencimento. Sem `abre`, passa de pendente a atrasada sem passar por "a pagar" |

### Numeração: `numeroDoMes(prefixo, existentes, data)`

- **Recebe**: "COT" ou "REQ", os números que já existem e a data.
- **Devolve**: o número seguinte do mês, ex.: `COT-003-OUT/26`, `REQ-001-NOV/26`.
- **Regras**:
  - o sufixo é o mês em três letras (JAN … DEZ) e o ano com dois dígitos;
  - procura o maior número com o mesmo prefixo e sufixo, soma 1 e escreve-o com 3 dígitos;
  - a contagem recomeça em cada mês;
  - os números noutro formato (ex.: `REQ-2026-013`) são ignorados.
- O formato foi definido pelo Momad em 16 de Outubro de 2026. Não serve para faturas.

### Fases e agenda

#### Tabelas

- `ETAPAS`: as 7 fases, cada uma com nome, nome curto e cor: Pedido, Em negociação, Layout, Produção, Montagem, Entrega, Entregue.
- `TIPOS`: os 4 tipos de trabalho e as fases de cada um.

| Tipo | Fases (`seq`) | Nomes próprios (`ROTULOS`) |
|---|---|---|
| `branding` (Branding / wrap) | pedido, negociacao, layout, producao, montagem, entrega, entregue | — |
| `criacao` (Criação de imagem) | pedido, negociacao, layout, entrega, entregue | layout = "Design" |
| `fornecimento` | pedido, negociacao, layout, producao, entrega, entregue | producao = "Encomenda" |
| `montagem` (só mão de obra) | pedido, negociacao, montagem, entrega, entregue | — |

O tipo antigo `producao` é lido como `branding` (`tipoInfo`).

#### Funções

| Função | Regra |
|---|---|
| `normalizarEtapa(e)` | Lê os nomes de fase anteriores a 16 de Outubro de 2026 como os novos: entrada → pedido; cotacao e aprovacao → negociacao; design → layout; marcacao e acabamento → montagem; encomenda e recebido → producao; pronto → entrega. É aplicada na leitura (`src/state.tsx`) e os registos antigos não são reescritos |
| `etapasDoTipo(tipo)` | A sequência de fases do tipo |
| `etapaInfo(e, tipo?)` | Nome e cor da fase, com o nome próprio do tipo |
| `proximaEtapa(t)` / `etapaAnterior(t)` | Fase seguinte ou anterior na sequência do tipo, ou `null` |
| `confirmado(t, pago)` | Verdadeiro se o cliente confirmou (`confirmadoEm`), se já pagou alguma coisa, ou se a fase já passou da negociação |
| `contaParaReceber(t, r)` | Entra em "a receber" só se não está cancelado, tem total, ainda deve (> 0,005) e está confirmado. Os trabalhos em negociação ficam de fora |
| `prazoAtual(t)` | Prazo da fase actual. Entregue: nenhum. Entrega: `prazo`. Montagem: `montagemAte`, `montagemDe` ou `prazos.montagem`. Outras fases: `prazos[etapa]` |
| `itensAgenda(trabalhos, tarefas)` | Para cada trabalho não cancelado e não entregue, junta as datas das fases que faltam, a actual incluída: montagem (com intervalo), "Entrega prevista" e "{fase} — data limite" ("Responder ao pedido" na fase de pedido). Um pedido sem data aparece como "Pedido por tratar". Junta também todas as tarefas por fazer |
| `secaoAgenda(i, hoje)` | `semData`; `atrasado` (o fim já passou); `hoje` (começou e ainda não acabou, por isso uma montagem em curso fica em Hoje); `semana` (próximos 7 dias); `depois` |
| `semDocumento(pagamentos, trabalhoId?)` | Pagamentos sem fatura-recibo ou recibo (`reciboId`), ordenados por data |

#### Datas

| Função | Regra |
|---|---|
| `diaISO`, `hojeISO` | Data local AAAA-MM-DD |
| `diasEntre(a, b)` | Dias de a até b |
| `addDias(iso, n)` | Soma n dias. Usa o meio-dia para evitar saltos de hora |
| `addDiasUteis(iso, n)` | Soma n dias de segunda a sexta. Não conta feriados. O catálogo fala em "dias úteis". Um trabalho convertido de uma cotação recebe um prazo de 10 dias úteis |

---

## Testes que fixam estes números

Correm com `npm test` (Vitest, ambiente `node`).

### `src/calc.test.ts`

| Grupo | O que fixa |
|---|---|
| Lista de impressão | Uma folha real: 10,2225 m² (10,22 no ecrã) × 2.000 = 20.445,00, mais IVA 3.271,20, dá 23.716,20. Com materiais misturados por linha: `precoM2` 0, subtotal 9.700, IVA 1.552, total 11.252 |
| Trabalho | Uma cotação real: 133.000 + 21.280 = 154.280. Urgência de 45% antes do IVA: 10.000 → 14.500 → 16.820. `resumoTrabalho`: total 116.000, dívida 58.000, sinal pago, custo 20.000 + 5.000, lucro 75.000, atrasado, 9 dias |
| IVA mensal | Liquidado 21.120 (com a nota de crédito descontada), dedutível 3.271,20, a pagar 17.848,80, um recibo ignorado. Crédito de 500 quando as compras passam as vendas |
| Agenda | Dias úteis (sexta → segunda). Fases por tipo e o tipo antigo `producao`. `normalizarEtapa`. `contaParaReceber`. `itensAgenda` e `secaoAgenda`. `numeroDoMes` (recomeço mensal e formato antigo ignorado). Caixa: saldo de 100.000 a 16 Out → 130.140; resumo de Outubro e salário de Outubro pago em Novembro. `prazoAtual` |
| Despesas | Vencimento no dia 31 → 28 de Fevereiro. Estados paga / atrasada / pendente. Janela 25 → 5, incluindo Dezembro → Janeiro, com os estados pendente, a pagar, atrasada e paga. O salário de Outubro pago em Novembro conta no resultado de Outubro. `resultadoDoMes` = 100.000 − 12.500 − 29.000 = 58.500, sem contar rascunhos |
| Ciclo Académica | Totais de quatro pró-formas reais (28.953,60; 16.773,60 com subtotal 14.460, valor de duas delas; 6.542,40) e de uma lista em Excel (16.112 / 18.689,92). Sequência rascunho → enviada → pró-forma → crédito → levantada. Encomenda: 2 × 12.500 + IVA = 29.000 |
| Mapa de crédito | Totais do Excel do Momad: 114.554,50 / 18.718,80 / 95.835,70. Estados Parcial e Pendente. Fase crédito |
| Cotação | Urgência como linha própria + desconto: 146.500 / 14.650 / 131.850 / 21.096 / 152.946. Linha de urgência com qt 1 e 72.000 para 2 × 160.000. Desconto antes do IVA: 120.000 − 10% → 125.280. Opções com itens comuns: 54.520 / 60.320 / 66.120 (valor principal 54.520). Seis carros com duas opções: sub-totais 564.000 / 853.000 |

### Testes de render

- `src/cotacaoPdf.render.test.tsx`:
  - pagina uma cotação real de 14 de Outubro de 2026 com `paginar` e confirma que cabe numa página, com as caixas dos itens em 219,4 / 303,5 / 411,1 / 518,2 (diferença menor que 1,2 pt);
  - escreve `test/out/cotacao.html`, para imprimir com o Chrome e comparar com o PDF original;
  - para medir sem browser, usa `test/fixtures/gotham-advances.json`, com a largura de cada caractere do Gotham. Este ficheiro está no repositório.
- `src/requisicaoPdf.render.test.tsx`:
  - confirma `totaisLinhas` com materiais misturados: Bundle Wrap 17.160 (8,58 m² × 2.000), ContraVision 1.380, vinil transparente premium + laminação transparente premium 896, Banner 2.850, subtotal 22.286;
  - escreve `test/out/requisicao.html` para uma verificação visual.

Mudar `TOPO_ITENS`, `ITEM`, `BLOCO` ou a largura das descrições (`COL.totX1`, de que depende `LARGURA_DESC`) em `src/cotacaoPdf.tsx` altera as posições que o teste da cotação verifica.

Os testes que lêem PDFs e listas reais de fornecedores não estão neste repositório, porque usam documentos reais. Em `src/leitura.test.ts` fica o teste de leitura de números.

---

## Pontos em aberto ligados a este capítulo

### Planeados, à espera de decisão do Momad

Estão planeados mas **não implementados**.

- **Fatura da Académica sem pró-forma**:
  - campo `Requisicao.fatura` (número, data, valor com IVA) e uma fase nova, "Fatura por pagar", em `FASES_REQ` / `faseRequisicao`;
  - `valorRequisicao` passaria a preferir a fatura, depois a pró-forma, depois a lista;
  - `contasAPagar` e `mapaCredito` passariam a incluir as faturas;
  - os pagamentos ao fornecedor ganhariam um comprovativo (`ficheiroId`).
  - Falta decidir se o custo do trabalho passa a usar a base da fatura quando difere da lista.
- **Cotação negociada**: datas de envio (`enviadaEm`) e versões ligadas (`substituiId`, `substituidaPorId`, estado `substituida`). Falta decidir:
  - se a versão nova leva número novo ou o mesmo número com "v2";
  - se o PDF deve dizer "Substitui a cotação …";
  - se corrigir uma cotação já enviada só avisa ou fica bloqueado.
- **Requisição como a cotação**: faixa de estado, Preview A4 ao vivo, "Guardar" só quando há alterações e uma caixa "Enviei" na janela "PDF pronto" (pré-marcada, nunca automática) que grava a data de envio. Falta decidir se chega melhorar a janela actual ou se a requisição passa a ter página inteira.
- **Ficheiros na nuvem** (logotipos de clientes, faturas, comprovativos). Hoje ficam no aparelho onde foram carregados.

### Pendente técnico

- **Cotação como ficheiro PDF** na janela "PDF pronto", como a requisição. É preciso outro caminho que não o html2canvas, porque este não aplica as fontes web dentro do SVG.

## Notas para quem continua

- Não grave linhas com `gerada: true` na cotação. `comUrgencia` não acrescenta urgência quando já há linhas geradas.
- Carregue sempre as fontes antes de medir texto (`carregarFontes`). Medir com a fonte de recurso desarruma as quebras e a paginação.
- O resumo do trabalho conta as requisições em rascunho como custo. O resultado do mês não as conta.
- O Gotham é uma fonte comercial: não está neste repositório e o site publicado serve os ficheiros de `public/fonts/`. Convém confirmar que a licença da Puzzle Stickers cobre este uso.
