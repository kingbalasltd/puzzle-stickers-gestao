# Visão geral e como usar

Este capítulo descreve o sistema **Puzzle Stickers · Gestão** como estava em outubro de 2026: o que faz, onde está cada coisa e como se trabalha no dia a dia. Foi escrito para o Momad e para quem continuar o desenvolvimento.

Convenções deste capítulo:
- Os botões, separadores e campos aparecem **a negrito**, com o nome que têm no ecrã.
- "MT" quer dizer meticais. "Sem IVA" é o valor base. O IVA é de 16%.
- Cada secção termina com uma linha **Código:** que indica os ficheiros principais. Os caminhos são relativos à raiz do repositório.
- "Computador" quer dizer ecrã largo (Mac, PC, iPad na horizontal). "Telemóvel" quer dizer ecrã estreito, com menos de 900 px (telemóvel, iPad na vertical).

Autor: KingBalas Ltd.

---

## 1. O que o sistema faz

O sistema é uma aplicação web que se instala como app (PWA). Funciona no iPhone, no iPad, no Mac e no PC, também sem internet. A primeira entrada num aparelho precisa de internet. Os dados da empresa sincronizam-se pela nuvem.

| Parte do negócio | O que o sistema faz |
|---|---|
| Pedidos | Regista o que o cliente pediu antes de haver preço, para nada se perder. |
| Cotações | Faz cotações no formato da Puzzle Stickers: linhas de serviço, materiais a vermelho, opções (ex.: Taksim / Mactac / Avery), deslocação, urgência e desconto. Gera o PDF. |
| Trabalhos | Acompanha cada trabalho por fases, com datas, tarefas, ficheiros, notas e histórico. |
| Produção | Prepara a requisição de prints para a Académica Digital (ou outro fornecedor), com o material de cada linha. Gera um PDF pronto a enviar por WhatsApp. Acompanha o circuito: pró-forma, pagamento (ou crédito), fatura e recibo, levantamento. |
| Dinheiro dos clientes | Sinal, pagamentos parciais e final, quem deve, datas prometidas, avisos. |
| Faturas e recibos | Arquiva, com foto ou PDF, as faturas e os recibos emitidos (do livro do Momad) e os recebidos (de fornecedores e compras). |
| Contas da empresa | Caixa, compras, despesas fixas mensais, gastos pessoais e resultado do mês. |
| IVA | Relação mensal do IVA (liquidado − dedutível), em PDF e numa folha CSV que abre no Excel, para o contabilista. |
| Equipa | Perfis dono, gerente e trabalhador, agenda de cada um e relatórios diários. |

O que o sistema **não** faz:
- **Não emite faturas nem recibos.** Só regista os que o Momad passa no seu livro de faturas. O campo do número diz "Nº do seu livro" e a app nunca cria esse número.
- As cotações e as requisições são documentos comerciais. A cotação imprime a frase "Não serve de comprovativo fiscal".
- Não controla stock.

**Código:** `src/App.tsx`, `src/state.tsx`, `src/db.ts` (interfaces de todos os registos), `src/calc.ts` (todas as contas).

---

## 2. Entrar na app

### 2.1 Endereço e instalação

Endereço: `https://puzzle-gestao.apps-mz.workers.dev`

Se a app ainda não estiver instalada, depois de entrar aparece no topo um aviso com as instruções. Fecha-se com **X** e não volta a aparecer nesse aparelho.

| Aparelho | Como instalar |
|---|---|
| iPhone / iPad (Safari) | **Partilhar** → **Adicionar ao ecrã principal** |
| Mac (Safari) | Menu **Ficheiro** → **Adicionar à Dock** |
| Outros navegadores | No menu do navegador, escolher **Instalar app** ou **Adicionar ao ecrã principal** |

### 2.2 Entrar: uma palavra-passe

1. Abra a app. Aparecem o logótipo, a palavra "Gestão" e o campo **Palavra-passe**.
2. Escreva a palavra-passe da empresa e toque em **Entrar**. Enquanto liga, o botão diz "A ligar…".
3. Na primeira vez, o aparelho liga-se à nuvem e recebe os dados da empresa. Se a nuvem já tiver dados, essa cópia substitui o que o aparelho tinha antes. Os ficheiros guardados no aparelho não se perdem.
4. Quando o aparelho volta a entrar (depois de **Sair** ou de a sessão terminar), primeiro envia o que mudou nele e só depois recebe o resto.
5. Enquanto houver só uma pessoa ativa na equipa, a app abre logo, sem PIN.

Notas:
- **Outra empresa** mostra o campo **Código da empresa**. No uso normal não é preciso.
- Depois de 5 tentativas erradas, a entrada fica bloqueada durante 10 minutos.
- Para mudar a palavra-passe, vá a **Definições → Empresa → cartão Nuvem → Mudar palavra-passe da empresa**. Preencha **Palavra-passe atual** e **Nova (mínimo 8 caracteres)** e toque em **Guardar**.
  - Os outros aparelhos terminam a sessão e pedem a palavra-passe nova.
  - O que esses aparelhos ainda não tinham enviado sobe quando voltarem a entrar.

### 2.3 Quando houver equipa: PIN

Com duas ou mais pessoas ativas em **Definições → Equipa**, depois da palavra-passe aparece **Quem está a entrar?**:
1. Toque no seu nome.
2. Escreva o PIN de 4 números, no teclado do ecrã ou do computador. **Trocar** volta à lista de pessoas.
3. O dono e o gerente abrem no **Início**. O trabalhador abre na **Agenda**.

O aparelho lembra-se de quem entrou e não volta a pedir o PIN até essa pessoa tocar em **Sair**. Se a pessoa ainda tiver o PIN inicial, o ecrã lembra que o pode mudar em **Definições → Equipa**.

### 2.4 Sair

| Onde | Como |
|---|---|
| Computador | Toque no nome, no fundo do menu lateral ("Terminar sessão"). |
| Telemóvel (dono e gerente) | No fim do **Início**, botão **Sair**. |
| Telemóvel (trabalhador) | Botão **Sair** na barra de baixo. |

- **Com uma só pessoa na equipa,** **Sair** termina a sessão neste aparelho e volta à palavra-passe. Antes de sair, a app tenta enviar o que falta. Os dados ficam no aparelho.
- **Com equipa,** **Sair** volta a **Quem está a entrar?**. O aparelho continua ligado à nuvem.

### 2.5 Nuvem e sincronização

- Cada alteração sobe para a nuvem cerca de 1,5 segundos depois. A app também sincroniza a cada 30 segundos, quando volta ao ecrã e quando a internet regressa.
- Sem internet, tudo fica guardado no aparelho e sobe mais tarde.
- No computador, o estado aparece no menu lateral, por baixo do nome. Tocar nessa linha sincroniza logo. No telemóvel, o estado está em **Definições → Empresa → Nuvem**, onde também está o botão **Sincronizar agora**. O estado pode ser:
  - "Na nuvem · hh:mm"
  - "A sincronizar…"
  - "Sem internet · guardado no aparelho"
  - "Erro ao sincronizar · toque para tentar"
  - "Não ligado à nuvem"
- Se dois aparelhos mudarem o mesmo registo, fica a alteração mais recente.
- **Os ficheiros (fotos, scans, PDFs e logótipos dos clientes) ainda não vão para a nuvem.** Ficam só no aparelho onde foram carregados (ver secção 9).

### 2.6 Atualizações

- Depois de entrar, a app procura uma versão nova ao abrir, ao voltar ao ecrã e a cada 2 minutos. Quando encontra uma, aparece a faixa "Há uma versão nova (…). Os seus dados ficam guardados." com o botão **Atualizar**.
- Também pode atualizar em **Definições → Empresa → Nuvem → Atualizar app**.
- A versão em uso aparece no fundo do menu lateral ("Versão dd/mm hh:mm") e no cartão Nuvem ("Versão da app").
- Atualize sempre com **Atualizar**. **Não apague o ícone da app do ecrã principal.** No iPhone e no iPad isso pode apagar os dados guardados nesse aparelho, incluindo os ficheiros que só existem lá.

**Código:** `src/App.tsx` (`Ligar`, `Login`, `EstadoNuvem`, `VersaoNova`, `DicaInstalar`), `src/nuvem.ts` (`entrar`, `sincronizar`, `iniciarSincronizacao`, `terminarSessao`, `mudarSenha`, `desligar`), `src/versao.ts` (`atualizarApp`, `versaoNoServidor`), `db/001_puzzle_nuvem.sql` (`puzzle_entrar`, `puzzle_mudar_senha`).

---

## 3. Perfis: o que cada pessoa vê

Há três perfis. Em outubro de 2026, só o Momad usava o sistema. Os perfis já estão prontos para quando a equipa entrar.

| Área → separador | Dono | Gerente | Trabalhador |
|---|---|---|---|
| Início | Sim | Sim, mas sem o botão **Compra**, sem o cartão do IVA, sem os avisos de despesas fixas e sem acertar a caixa | Não (abre na Agenda) |
| Trabalhos → Trabalhos | Todos | Todos | Só os atribuídos a si ("Os meus trabalhos") |
| Trabalhos → Agenda | Toda a equipa | Toda a equipa | Só a sua ("A minha agenda") |
| Trabalhos → Relatórios | Vê os de todos | Vê os de todos | Só os seus |
| Cotações → Cotações | Sim | Sim | Não |
| Cotações → Catálogos | Sim | Sim | Não |
| Clientes | Sim | Sim | Não |
| Fornecedores → Fornecedores, Requisições | Sim | Sim | Não |
| Fornecedores → Mapa de crédito | Sim | Sim | Não |
| Finanças → Recebimentos | Sim | Sim | Não |
| Finanças → Resumo, Despesas, Faturas e recibos, IVA, Pessoal | Sim | Não | Não |
| Definições → Empresa, Equipa | Sim | Não | Não |
| Definições → Catálogo | Vê e edita | Vê (e cria trabalhos a partir dele) | Não |
| Novo pedido, Novo trabalho, editar ou cancelar trabalhos | Sim | Sim | Não |
| Valores dentro do trabalho (preços, pagamentos, lucro) | Sim | Sim | Não |
| Apagar trabalhos, cotações, clientes, fornecedores, pagamentos, documentos e requisições | Sim | Não | Não |

O trabalhador:
- avança as fases dos trabalhos atribuídos a si;
- junta fotos, notas e tarefas;
- escreve o relatório do dia.

Não vê valores, a lista de clientes nem as finanças. Se abrir um trabalho que não é seu, vê "Este trabalho não está atribuído a si".

**Código:** `src/state.tsx` (`PERM`, `pode`), `src/App.tsx` (`AREAS`, `useAreas`), `src/pages/Equipa.tsx` (`PODE`).

---

## 4. Navegação

| Área | Separadores | Para quê |
|---|---|---|
| Início | — | O dia de hoje, botões rápidos, avisos e caixa |
| Trabalhos | Trabalhos · Agenda · Relatórios | Quadro dos trabalhos, agenda e relatórios diários |
| Cotações | Cotações · Catálogos | Cotações e envio dos catálogos em PDF |
| Clientes | — | Fichas dos clientes |
| Fornecedores | Fornecedores · Requisições · Mapa de crédito | Fornecedores e preçários, pedidos de produção, crédito |
| Finanças | Resumo · Recebimentos · Despesas · Faturas e recibos · IVA · Pessoal | Dinheiro, documentos e IVA |
| Definições | Empresa · Catálogo · Equipa | Dados da empresa, regras, nuvem, catálogo e equipa |

- **No computador:**
  - O menu à esquerda tem as áreas, e os separadores aparecem no topo de cada página.
  - Ao lado de **Trabalhos** aparece o número de trabalhos atrasados.
  - No fundo do menu ficam **Claro / Escuro** (tema), o nome (para sair), o estado da nuvem e a versão.
- **No telemóvel:**
  - A barra em baixo tem Início, Trabalhos, Cotações, Clientes, Fornecedores e Finanças.
  - **Definições**, o botão do tema e **Sair** estão no fim do **Início**.
  - Os botões do topo mostram só o ícone.
- **Botão amarelo +:** só existe no telemóvel. Fica no canto do Início, da Agenda e de Clientes e abre **Novo pedido**. O trabalhador não o tem.
- Nas páginas de detalhe, a seta **Voltar** no topo regressa à lista.

Endereços internos (para quem desenvolve):
- Listas e páginas: `#/painel`, `#/trabalhos`, `#/agenda`, `#/relatorios`, `#/cotacoes`, `#/catalogos`, `#/clientes`, `#/fornecedores`, `#/requisicoes`, `#/contas-pagar`, `#/resumo`, `#/dividas`, `#/despesas`, `#/documentos`, `#/iva`, `#/pessoal`, `#/definicoes`, `#/catalogo`, `#/equipa`.
- Detalhe de um registo: `#/trabalhos/<id>`, `#/cotacoes/<id>`, `#/clientes/<id>`, `#/fornecedores/<id>`, `#/requisicoes/<id>`.
- Parâmetros usados pela app: `?tab=pagamentos`, `?etapa=…`, `?mes=AAAA-MM`, `?entregar=1`.

**Código:** `src/App.tsx` (`AREAS`, `Shell`, `Page`), `src/state.tsx` (`useRota`, `ir`).

---

## 5. Os ecrãs, um a um

### 5.1 Início

| Bloco | O que mostra e o que permite |
|---|---|
| Saudação | "Bom dia / Boa tarde / Boa noite" com o nome, quantas coisas há para hoje e quantas há nos próximos 7 dias. |
| Botões rápidos | **Novo pedido**, **Cotação** (abre uma cotação nova), **Fatura**, **Recibo** e **Compra**. |
| Contadores | **Pedidos**, **Em negociação** (com o valor, que "não conta no a receber"), **Em curso** (layout, produção, montagem) e **Para entregar**. Pedidos, Em negociação e Para entregar abrem Trabalhos já filtrado. Em curso abre o quadro sem filtro. |
| **Hoje** | Até 10 itens da agenda, atrasados e de hoje. **Agenda →** abre a agenda. |
| **Próximos 7 dias** | Até 8 itens desta semana. |
| **Sem data** | Até 6 pedidos e tarefas que ainda não têm data. |
| **O que precisa de atenção** | Até 8 avisos, com os mais graves primeiro. Tocar num aviso abre o sítio certo. Só o dono e o gerente os veem. |
| **Quem me deve** | Os 6 clientes com mais dívida. Tocar num cliente abre a ficha dele. **Tudo →** abre Recebimentos. |
| **IVA de <mês>** | Só o dono vê. Mostra liquidado, dedutível e a pagar (ou crédito). Tocar abre o IVA. |
| **Caixa** | **Em caixa**: só o dono toca para acertar. **Valor dos trabalhos**: confirmados ainda por receber, e quanto já entrou. **Falta receber**. **Eu devo**: pró-formas por pagar e crédito a fornecedores, abre o Mapa de crédito. |

Avisos que podem aparecer em **O que precisa de atenção**:

| Aviso | Quando aparece |
|---|---|
| "T-… · entregue sem o pagamento final" | Trabalho entregue, ainda com dívida e sem data prometida. |
| "<Cliente> prometeu pagar até <data> — N dias de atraso" | A data prometida passou. |
| "<Cliente> paga hoje" / "<Cliente> paga a <data>" | Faltam 2 dias ou menos para a data prometida. |
| "T-… · em negociação há N dias" | 7 dias ou mais em negociação, sem data de resposta marcada. |
| "T-… · a trabalhar sem sinal" | Trabalho confirmado em Layout, Produção ou Montagem sem o sinal pago. |
| "T-… · pronto para entregar" | Em Entrega, com valor a cobrar. |
| "T-… · valor de venda por definir" | Trabalho confirmado com total 0. |
| "T-… · recebido sem fatura/recibo" | Há pagamentos sem documento passado. |
| "REQ-… · à espera da pró-forma há N dias" | Lista enviada ao fornecedor há 1 dia ou mais, sem pró-forma. |
| "Pró-forma <nº> por pagar" | Pró-forma registada e não paga. |
| "<Cliente> já pagou T-… — liquidar o crédito" | Requisição a crédito e o cliente já pagou o trabalho todo. |
| "<despesa> · por pagar desde <data>" ou "N despesas fixas de <mês> em atraso" | Só para o dono. Despesas fixas que passaram o prazo. |
| "<despesa> · pagar até <data>" ou "N despesas fixas de <mês> · pagar até <data>" | Só para o dono. O prazo de pagamento já abriu. Verifica o mês anterior e o atual. |

**Código:** `src/pages/Painel.tsx` (`Painel`), `src/pages/Resumo.tsx` (`useCaixa`, `CaixaModal`), `src/calc.ts` (`contaParaReceber`, `contasAPagar`, `fixasDoMes`, `semDocumento`).

### 5.2 Trabalhos

#### Separador Trabalhos

- **Vistas:** **Quadro** ou **Lista**. O aparelho lembra-se da escolha.
- **Procurar:** pelo código, cliente, título ou descrição.
- **Filtros:**
  - por tipo: **Todos os tipos**, cada um com o número de trabalhos;
  - por pessoa: **Toda a equipa**, só para o dono e o gerente.
- **Limpar filtro:** tira os filtros que vieram do Início.
- **Novo trabalho** (dono e gerente) abre o formulário completo (ver 6.1).
- **Trabalhos cancelados:** saem do quadro, da lista e da agenda, mas continuam na ficha do cliente.

**Quadro:**
- Há uma coluna por fase. Com "Todos os tipos" aparecem só as fases que têm trabalhos, mais Pedido e Entregue. Ao escolher um tipo, aparece o caminho completo desse tipo.
- Pode arrastar um cartão para outra coluna. Se o tipo não tiver essa fase, a app avisa.
- Arrastar para Entregue um trabalho com dívida abre a janela de entrega.
- Os trabalhos entregues há mais de 30 dias saem do quadro, mas continuam na Lista.

**Cartão do trabalho:**
- Mostra o código e o tipo, o título, o cliente e o prazo ("3d atrasado", "Hoje", "Amanhã", "2 dias" ou a data).
- Para quem vê valores, mostra também "falta X", "Sem sinal", "X em negociação", "paga dd/mm" ou "Valor por definir".
- O raio indica um trabalho urgente. O círculo com iniciais é o responsável.

**Lista:** colunas Trabalho (com "URGENTE" quando é o caso), Cliente, Etapa, Prazo (com a data de entrada), Responsável e, para quem vê valores, Total e Pago.

#### Separador Agenda

- **Nova tarefa:** caixa **Nova tarefa…** com **Hoje**, **Amanhã**, data, trabalho (ou **Sem trabalho**) e **Adicionar**.
- **Vistas:**
  - **Lista**, com as secções **Atrasado**, **Hoje**, **Próximos 7 dias**, **Mais tarde** e **Sem data**;
  - **Mês**, em grelha, com as setas e **Hoje** para voltar ao mês atual.
- **Filtro:** o dono e o gerente podem filtrar por pessoa (**Toda a equipa**).
- **O que aparece:** as tarefas por fazer e as datas das fases que ainda faltam em cada trabalho ("Responder ao pedido", "<Fase> — data limite", "Montagem" de/até e "Entrega prevista"). Um pedido sem data aparece em **Sem data** como "Pedido por tratar".
- O círculo à esquerda de uma tarefa marca-a como feita. Tocar num item ligado a um trabalho abre esse trabalho.

#### Separador Relatórios

- **O meu relatório de hoje:** **O que fiz hoje**, **Em que trabalhos**, **O que falta / amanhã (opcional)**, **Problemas ou o que preciso (opcional)**, **Fotos (opcional)** e depois **Enviar relatório**. Depois de enviado, aparece **Editar**.
- O dono e o gerente veem o cartão **Hoje**, com cada trabalhador marcado como "enviou" ou "ainda não enviou".
- Em **Anteriores** ficam os relatórios dos últimos 45 dias. O dono e o gerente veem os de todos e podem filtrar por pessoa. O trabalhador vê os seus.

#### Página de um trabalho

**No topo:**
- Título, código, cliente e tipo.
- O botão **⋯** ("Mais ações") tem:
  - **Voltar para <fase anterior>**;
  - **Editar trabalho** e **Cancelar trabalho** (dono e gerente);
  - **WhatsApp do cliente** (quando o cliente tem telefone);
  - **Apagar trabalho** (só o dono).
- Um trabalho cancelado mostra uma faixa com **Reativar**.

Se houver dinheiro recebido sem documento, aparece a faixa "Recebido X sem fatura/recibo — falta passar o documento.", com o botão **Passar fatura/recibo** (ver 6.7).

**Cartão das fases** (linha de passos no topo):
- Cada passo mostra a data em que foi feito ou o limite ("até dd mmm"). Um limite que já passou fica a vermelho.
- Tocar num passo leva o trabalho para essa fase. Para trás, a app pede confirmação.
- Por baixo fica o painel da fase atual, com os botões próprios (ver 6.4).
- **Saltar <fase> →** passa à fase seguinte. Não aparece em Pedido nem em Entrega.
- **Datas de todas as fases** abre os prazos de todas as fases que faltam.

**Separadores do trabalho:**

| Separador | Conteúdo |
|---|---|
| **Detalhes** | Cartão **Trabalho**: cliente, tipo, fase, "Prometeu pagar" (quando há), entrada, entrega prevista, responsável, serviço do catálogo, cotação, urgência e descrição.<br>**Partes do trabalho** (só com valores): botão **Parte** (ou **Do catálogo** na criação de imagem) e **Fazer cotação** (ou o atalho para a cotação). Cada parte diz "por cotar", "combinado de boca", "da cotação" ou "catálogo". Seguem-se taxa de urgência, sub-total, IVA e TOTAL, e "Material já pedido: X sem IVA" quando há requisições.<br>**Tarefas** deste trabalho.<br>**Ficheiros e fotos da arte**: arte, layouts, fotos. |
| **Requisições** | Requisições a fornecedores deste trabalho: **Nova** e, em cada lista, o ícone de PDF.<br>**Outros custos**: botão **Custo**, com **Descrição**, **Valor sem IVA (MT)** e **Data**. Serve para transporte, consumíveis, aplicação externa. |
| **Pagamentos** | Pagamentos do cliente e **Registar pagamento**. |
| **Faturas e recibos** | Documentos ligados ao trabalho e **Carregar**. |
| **Notas e histórico** | Escrever uma nota e tocar em **Guardar**. Linha do tempo com notas, mudanças de fase e pagamentos. |

Os separadores Requisições, Pagamentos e Faturas e recibos só aparecem a quem vê valores.

**Coluna da direita:**
- **Resumo financeiro** (só com valores):
  - total, sub-total + IVA e uma barra com o que está pago;
  - **Pago** / **Falta** e "Sinal pago" ou "Sinal em falta";
  - botões **Pago** (quando há dívida) e **Parcial**;
  - em baixo: Requisições (m²), Outros custos, Custo total e **Lucro** com a margem. Custos e lucro são sem IVA.
- **Tempo:** há quantos dias o trabalho está em curso (ou quanto levou), a entrega prevista e o prazo do catálogo.
- **Cliente:** nome, cidade ou telefone, **WhatsApp** e **Ficha →**.

#### Tipos de trabalho e as suas fases

| Tipo | Fases |
|---|---|
| Branding / wrap | Pedido → Em negociação → Layout → Produção → Montagem → Entrega → Entregue |
| Criação de imagem | Pedido → Em negociação → Design → Entrega → Entregue |
| Fornecimento | Pedido → Em negociação → Layout → Encomenda → Entrega → Entregue |
| Montagem (só mão de obra) | Pedido → Em negociação → Montagem → Entrega → Entregue |

Os trabalhos antigos, com os nomes de fase usados antes de 16 de outubro, são lidos com estes nomes novos. Os registos não são reescritos.

**Código:** `src/pages/Trabalhos.tsx`, `src/pages/Trabalho.tsx` (`TrabalhoDetalhe`, `PagamentoForm`, `CustoForm`), `src/pages/Fases.tsx` (`FasesTrabalho`, `EntregaModal`), `src/pages/Agenda.tsx` (`Agenda`, `NovaTarefa`, `TarefasDoTrabalho`), `src/pages/Relatorios.tsx`, `src/pages/comum.tsx` (`JobCard`, `PrazoBadge`), `src/calc.ts` (`TIPOS`, `etapasDoTipo`, `normalizarEtapa`, `itensAgenda`, `secaoAgenda`, `resumoTrabalho`).

### 5.3 Cotações

#### Separador Cotações (lista)

- **Nova cotação** fica no topo.
- Colunas:
  - Cotação: o número e os assuntos das linhas;
  - Cliente, Data;
  - Validade: diz "expirou" quando a cotação está Enviada e o prazo passou;
  - Estado;
  - Total: numa cotação com opções, aparece "desde X" até o cliente escolher.

#### Editor da cotação

No topo do editor estão o número e o estado, e os botões **Preview**, **PDF** e **Guardar**. **Guardar** só fica ativo quando há alterações.

Do lado esquerdo, por esta ordem:
1. **Cliente (Exmo(s) Sr(s))**: escolher da lista, ou **+ Novo cliente…** / **Novo**. Depois de escolher aparecem:
   - **Cidade** e **País**, que se gravam na ficha do cliente;
   - **Logotipo do cliente (sai junto ao nome)**;
   - **Data** e **Válida por (dias)**.
2. As linhas da cotação. Cada linha fechada mostra o número, "Opção N", "Urgente", o título, a quantidade × preço (quando há mais de uma), a Linha 2, os materiais e o total. Tocar abre a linha.
3. **Adicionar linha** (ver 6.2). Numa cotação nova, a escolha da primeira linha já vem aberta.
4. **Deslocação, urgência e desconto**.
5. **Texto final**.
6. **Totais**, sempre atualizados.

Do lado direito:
- **Estado**: Rascunho, Enviada, Aceite ou Recusada;
- o cartão **Cliente aceitou?**, com o sinal de 50% (da opção escolhida, quando há opções);
- a pré-visualização "Como sai a cotação" (só no computador);
- **Apagar cotação** (só o dono).

Quando as linhas falam de Taksim ou de wrap mas não têm materiais próprios, aparece a caixa **Nota do material no rodapé (TAKSIM® STX570 + STX571, garantia até 2 anos)**.

#### Separador Catálogos

Os catálogos da Puzzle Stickers prontos a enviar. Os PDFs fazem parte da app e estão em todos os aparelhos.

| Catálogo | Ano | Páginas |
|---|---|---|
| Criação de Imagem | 2026 | 21 |
| Sticker Kits | 2025 | 10 |
| Produção (marcado "antigo") | 2020 | 10 |

Botões de cada catálogo:
- **Partilhar PDF** abre a partilha do aparelho. Onde não há partilha, descarrega o PDF.
- **Enviar link** abre o WhatsApp com o link público.
- **Ver** abre o PDF.
- O ícone de copiar copia o link.

**Código:** `src/pages/Cotacoes.tsx` (`Cotacoes`, `CotacaoEditor`, `novaCotacao`), `src/pages/cotacaoFormulario.tsx` (`EditorCotacao`, `NovoImpresso`, `CatalogoCriacao`, `PreviewCotacao`), `src/materiaisCotacao.ts`, `src/cotacaoPdf.tsx` (`paginasCotacao`, `PaginaCotacao`), `src/pages/Catalogos.tsx` (`CATALOGOS`).

### 5.4 Clientes

- **Lista:**
  - Procurar cliente.
  - Colunas Cliente (com a cidade), Contacto, Trabalhos (e quantos em curso) e, para quem vê valores, Faturado e Em dívida.
  - "Faturado" soma o valor com IVA de todos os trabalhos não cancelados do cliente, incluindo os que ainda estão em negociação. Não depende das faturas registadas.
  - "Em dívida" só conta trabalhos confirmados.
- **Novo cliente:** **Nome / empresa**, **Pessoa de contacto**, **Telefone / WhatsApp**, **Email**, **NUIT**, **Cidade** e **País**, **Logotipo do cliente** e **Notas**.
  - Cidade e País saem na cotação como "Cidade, País". O país vem preenchido com Moçambique.
- **Ficha do cliente:**
  - No topo: **WhatsApp** (quando há telefone), **Editar** e **Trabalho** (novo trabalho para este cliente).
  - Números: Trabalhos, Faturado, Em dívida e Último trabalho.
  - Listas de trabalhos, contactos, cotações, e faturas e recibos.
  - **Apagar cliente** só aparece ao dono, e só se o cliente não tiver trabalhos.
- Não é preciso criar o cliente antes. No **Novo pedido** e no **Novo trabalho** basta escrever o nome: se o cliente não existir, é criado ao guardar.

**Código:** `src/pages/Clientes.tsx` (`Clientes`, `ClienteDetalhe`, `ClienteForm`, `LogoCliente`), `src/format.ts` (`separarMorada`, `juntarMorada`).

### 5.5 Fornecedores

#### Separador Fornecedores

**Cartões:** cada fornecedor tem um cartão com o logótipo, o que fornece, "crédito aberto" (quando há), o número de produtos, o número de requisições e "Deve X" ou "Nada em dívida".

**Novo fornecedor:**
- **Nome**, **O que fornece**, **Pessoa de contacto**, **WhatsApp / telefone** (serve para enviar as listas pela app), **Email**, **NUIT** e **Morada**.
- Tabela **Produtos e serviços**: nome, descrição, tipo (Impressão / Laminação / Material / Serviço / Outro), unidade e preço sem IVA. **Produto / serviço** acrescenta uma linha.
- **Como costuma pagar**: Pró-forma paga antes de produzir, A crédito, Paga na entrega ou Outra.
- **Prazo de entrega habitual**, **Tenho crédito aberto com este fornecedor**, **Dados para pagamento (contas, NIB…)**, **Logotipo** e **Notas**.

**Produtos nas requisições:** os produtos de tipo **Impressão** e **Laminação** aparecem nas listas de impressão (por m²). Nas encomendas pode escolher qualquer produto do fornecedor.

**Página do fornecedor:**
- No topo: WhatsApp e **Editar**.
- Números: **Devo**, Requisições, m² impressos e Total (c/ IVA).
- Cartões **Tabela de preços**, **Requisições**, **Condições e contactos**, **Por pagar** e **Faturas e recibos** (só o dono).
- **Apagar fornecedor** só aparece ao dono, e só sem requisições.

**Preçário da Académica Digital:** está registado na ficha da Académica com os nomes oficiais (por m², sem IVA). A mesma lista está no código como `PRECARIO_ACADEMICA_2026`.

| Material | Tipo | MT/m² |
|---|---|---|
| Impressão com material da Puzzle Stickers | Impressão | 800 |
| Vinil comum | Impressão | 950 |
| Vinil comum laminado | Impressão | 1.400 |
| Vinil de wrap | Impressão | 1.150 |
| Vinil branco premium | Impressão | 1.050 |
| Vinil transparente premium | Impressão | 950 |
| ContraVision | Impressão | 1.150 |
| Banner | Impressão | 950 |
| Laminação de wrap | Laminação | 850 |
| Laminação transparente premium | Laminação | 450 |

Vinil de wrap + Laminação de wrap = **Bundle Wrap** (2.000 MT/m²).

#### Separador Requisições

- **Nova requisição** cria uma requisição sem trabalho. Para a ligar a um trabalho, escolha-o no formulário ou crie-a a partir do trabalho.
- Botões de filtro por fase, com contagem: **Todas** e cada fase que tenha requisições.
- As requisições aparecem agrupadas por mês, com o total de m² e de valor.
- Cada linha mostra o número, o fornecedor, a pró-forma, o trabalho (ou "sem trabalho"), os m², a fase, o valor e, nas listas de impressão, o botão de PDF.

Fases de uma requisição:

| Fase | Quando |
|---|---|
| Rascunho | Preparada, ainda não enviada. |
| Lista enviada | Marcada como enviada (ou com a pró-forma registada). |
| Pró-forma por pagar | Pró-forma registada e por pagar. |
| A crédito | Posta a crédito e ainda com saldo, mesmo que o material já tenha sido levantado. |
| Paga | Paga na totalidade. |
| Faturada | Paga e com a fatura do fornecedor registada. |
| Levantada | Material levantado (ou recebido) e nada em dívida. |

#### Separador Mapa de crédito

É o mapa do Excel "Mapa de controlo de crédito", dentro da app.
- **Fornecedor:** quando há mais de um fornecedor no mapa, escolhe-se aqui.
- **Números:** **Total dos trabalhos**, **Total pago**, **Crédito em aberto** e **Pode liquidar já** (requisições cujo cliente já pagou o trabalho).
- **Vistas:** **Em aberto** ou **Todos**.
- **Colunas:**
  - Data, com há quantos dias;
  - Trabalho, com "cliente já pagou" a laranja;
  - Fatura / pró-forma;
  - Estado do trabalho: Enviado, Em produção ou Concluído;
  - Valor, Pago e Saldo;
  - Pagamento: Pendente, Parcial ou Pago;
  - Material: data do levantamento.
- **Botões:**
  - **Pagar** abre o pagamento, que pode ser parcial.
  - **Excel** exporta um ficheiro .xlsx no formato da folha original.
- No fim aparecem os **Dados para pagamento** do fornecedor.

Entram no mapa as requisições com pró-forma, as que estão a crédito e as que já têm pagamentos.

**Código:** `src/pages/Fornecedores.tsx` (`Fornecedores`, `FornecedorDetalhe`, `FornecedorForm`), `src/pages/Requisicoes.tsx`, `src/pages/RequisicaoForm.tsx` (`RequisicaoForm`, `Circuito`, `FaseBadge`), `src/pages/ContasPagar.tsx` (`ContasPagar`, `PagarModal`, `exportarMapa`), `src/requisicaoPdf.tsx` (`PRECARIO_ACADEMICA_2026`, `nomeMaterial`), `src/calc.ts` (`faseRequisicao`, `FASES_REQ`, `mapaCredito`, `contasAPagar`).

### 5.6 Finanças

#### Resumo (só o dono)

Mostra o dinheiro que entrou e saiu, mês a mês. As setas mudam o mês.
- **Números do mês:**
  - **Entrou**: pagamentos dos clientes, mais gastos pessoais repostos;
  - **Saiu**: compras, despesas fixas, pagamentos a fornecedores e gastos pessoais;
  - **Saldo do mês**;
  - **Em caixa**: tocar para acertar.
- Quando há gastos pessoais por resolver, aparece uma faixa com o total. Tocar abre Pessoal.
- **O que saiu:** Compras, Despesas fixas, Pagamentos a fornecedores, Gastos pessoais (quando há) e Total. Os valores são com IVA, como saíram da caixa.
- **Movimentos do mês:** cada entrada e cada saída. Tocar abre o trabalho, a requisição ou as despesas.
- **Gastos por categoria** e **Últimos 6 meses**, com barras de entrada e saída. Tocar num mês abre esse mês.

#### Recebimentos (título "Pagamentos e dívidas")

- **Números:**
  - **Total a receber**: só trabalhos confirmados;
  - **Prontos por cobrar**: trabalhos em Entrega ou entregues;
  - **Em negociação**: não conta no total;
  - **Aguardam sinal**: quantos são e a soma dos sinais.
- Dois botões escolhem a vista:
  - **Quem deve:** cada trabalho com dívida, com a data prometida, o último pagamento, o botão **Pago** e o botão de WhatsApp com a mensagem de lembrete já escrita. Tocar na linha abre os pagamentos do trabalho.
  - **Pagamentos recebidos:** todos os pagamentos, agrupados por mês.

#### Despesas (só o dono)

- No topo: **Despesas fixas** (abre a lista das despesas fixas) e **Despesa** (nova). As setas mudam o mês.
- Números: **Gasto no mês**, **Despesas fixas do mês**, **IVA dedutível** e **Resultado do mês**.
- **Despesas fixas de <mês>** (com **Gerir**). Cada despesa mostra o estado:
  - "a partir de dd": ainda não é altura de pagar;
  - **Pagar até dd**;
  - **Em atraso · pagar**;
  - "Paga".
- **Todas as despesas**, com filtro por categoria.
- **Resultado de <mês>** (sem IVA): Faturado (sem IVA) − Material dos trabalhos (fornecedores) − Compras e despesas da empresa = Resultado.
- **Por categoria** (tocar filtra a lista) e **Custo fixo mensal**: o mínimo que a empresa precisa de faturar por mês, mais os materiais.
- Os gastos pessoais não aparecem aqui.

#### Faturas e recibos (só o dono)

- **Carregar** no topo.
- Filtros **Todos / Emitidos / Recebidos**, por mês, e procura por número, cliente ou fornecedor.
- Os documentos aparecem agrupados por mês, com o atalho **Relação do IVA →**.
- Uma faixa avisa quantos documentos ainda não têm foto ou scan.
- Cada linha mostra:
  - o tipo e o número, a data, a entidade e o trabalho;
  - se veio de uma despesa e se tem ficheiro;
  - o total e o IVA (ou "não conta p/ IVA").
- Tocar abre o documento para corrigir. Só o dono pode apagar.

#### IVA (só o dono)

- **Mês:** com as setas ou escolhido diretamente.
- **Exportar:** **Excel** (ficheiro CSV que abre no Excel) e **PDF** ("Relação do IVA").
- **Números:** **IVA liquidado** (faturas emitidas), **IVA dedutível** (faturas de fornecedores) e **IVA a pagar** ou **Crédito a reportar**.
- **Lembrete:** entregar ao contabilista, com uma data sugerida (o último dia do mês seguinte). O prazo confirma-se com o contabilista.
- **Aviso:** trabalhos que tiveram pagamento no mês sem fatura emitida registada.
- **Listas:** **Emitidos (vendas)** e **Recebidos (compras)**. Os recibos do mês ficam fora da conta.

#### Pessoal (só o dono)

Gastos pessoais do Momad pagos com dinheiro da empresa. Saem da caixa, mas não são custo da empresa, por isso ficam fora das despesas e do resultado do mês.
- **Gasto pessoal** no topo.
- Números: **Por resolver**, **Reposto este ano** e **Autorizado este ano**.
- Cada gasto por resolver tem dois botões:
  - **Repor**: o dinheiro volta à caixa no dia em que toca no botão;
  - **Autorizar**: fica como uso próprio.
- Com mais de um gasto por resolver aparecem **Repor tudo** e **Autorizar tudo**.
- Em baixo, com setas para mudar o mês, ficam os gastos já resolvidos.

**Código:** `src/pages/Resumo.tsx`, `src/pages/Dividas.tsx`, `src/pages/Despesas.tsx` (`Despesas`, `DespesaForm`, `FixasModal`, `FixaForm`), `src/pages/Documentos.tsx` (`Documentos`, `DocumentoForm`, `DocLinha`), `src/pages/Iva.tsx`, `src/pages/Pessoal.tsx`, `src/print.tsx` (`imprimirIva`, `exportarIvaExcel`), `src/calc.ts` (`movimentosCaixa`, `saldoCaixa`, `resumoCaixaMes`, `resultadoDoMes`, `ivaDoMes`).

### 5.7 Definições

#### Empresa (só o dono)

**Guardar**, no topo, grava os dois primeiros cartões.
- **Empresa (aparece nos documentos):** Nome comercial, NUIT, Razão social, Morada, Cidade, Telefones, Email e Instagram.
- **Regras do negócio:** Taxa de IVA (%), Sinal para começar (%), Taxa de urgência (%), Validade das cotações (dias) e Nota padrão das cotações.
- **Dados:** **Descarregar cópia de segurança** e **Recomeçar este aparelho** (ver secção 7).
  - Quando há registos de exemplo, aparece também **Apagar os dados de exemplo (N)**.
  - O texto deste cartão ainda fala em "protótipo", mas a sincronização com a nuvem já funciona (cartão Nuvem).
- **Nuvem:**
  - a que empresa o aparelho está ligado e o estado;
  - **Sincronizar agora**, **Mudar palavra-passe da empresa** e **Desligar este aparelho**;
  - a versão da app e **Atualizar app**.

#### Catálogo

O catálogo Criação de Imagem 2026 (preços sem IVA), pela ordem do PDF.
- No topo, uma faixa com a taxa de urgência e o sinal.
- Cada serviço mostra:
  - o preço (ou "Sob proposta"), o prazo em dias e o que inclui;
  - **Criar trabalho**, que abre um trabalho novo de criação de imagem com esse serviço (não aparece nos Extras).
- O dono pode acrescentar serviços (**Serviço**) e editá-los: Categoria, Nome, Preço (sem IVA), Dias mín., Dias máx., Inclui (um por linha) e Ativo. O gerente só vê.

#### Equipa (só o dono)

- Os três perfis e o que cada um pode fazer.
- Tabela com a pessoa, o perfil, a função e os trabalhos em curso.
- **Adicionar** (ou tocar numa pessoa) abre o formulário:
  - **Nome**, **Perfil**, **Função**, **Telefone** e **Cor**;
  - **PIN (4 números)**: não pode repetir o de outra pessoa;
  - **Pode entrar no sistema**.
- O dono não pode mudar o próprio perfil nem desativar-se.
- Assim que houver duas pessoas ativas, a entrada passa a pedir o PIN depois da palavra-passe (ver 2.3).

**Código:** `src/pages/Definicoes.tsx` (`Definicoes`, `CartaoNuvem`), `src/pages/Catalogo.tsx` (`Catalogo`, `ServicoForm`), `src/pages/Equipa.tsx` (`Equipa`, `UserForm`), `src/seed.ts` (`EMPRESA`).

---

## 6. O dia a dia, passo a passo

O caminho normal de um trabalho:

**Pedido → cotação → cliente aceita → fases → requisição à Académica → pagamentos do cliente → fatura e recibo → entrega → caixa, despesas e IVA.**

### 6.1 Registar um pedido novo

Use quando o cliente pediu algo e ainda não há preço.

1. **Início → Novo pedido** (ou, no telemóvel, o botão amarelo **+**).
2. **Cliente:** escreva o nome. Se não existir, aparece "Cliente novo — fica registado".
3. **O que pediu:** o pedido, por palavras. A primeira linha passa a ser o título.
4. **Tipo:** Branding / wrap, Criação de imagem, Fornecimento ou Montagem.
5. **Responder até (opcional):** a data em que quer responder ao cliente.
6. **Guardar pedido.**

O trabalho fica com o código seguinte (T-2026-…), na fase Pedido, e entra na agenda: na data de resposta ou, sem data, em "Sem data".

Para um trabalho com mais detalhe (já com preço, ou que já vai a meio), use **Trabalhos → Novo trabalho**:
1. **1. Tipo de trabalho:** o formulário mostra as fases desse tipo.
2. **Em que fase está?** Serve para registar um trabalho que já vai a meio. A partir de Layout (Design na criação), o trabalho conta como confirmado.
3. **2. Cliente:** escreva o nome.
4. **3. Partes do trabalho**, sem IVA:
   - Com preço, a parte fica "combinado de boca". Sem preço, fica por cotar.
   - **Do catálogo (ex.: vectorização)** junta um serviço do catálogo.
   - Na criação de imagem, todas as partes vêm do catálogo, com o preço do catálogo. Nos serviços "sob proposta", escreve o valor.
5. **Urgente (+45%)** e **IVA 16%**. Os totais aparecem por baixo.
6. **Título (opcional)**, **Descrição / detalhes (opcional)**, **Data do pedido** e **Prazo de entrega**.
   - O prazo vem a 7 dias úteis. Quando junta um serviço do catálogo, passa a seguir o prazo máximo do catálogo, em dias úteis, até o mudar à mão.
   - **Responsável** só aparece quando há mais de uma pessoa ativa.
7. **Criar trabalho.** A app abre o trabalho novo.

### 6.2 Fazer a cotação

**Duas maneiras de começar:**
- **A partir do trabalho:** na fase Pedido (ou Em negociação), toque em **Fazer cotação**. O botão também está no cartão **Partes do trabalho**.
  - A cotação nasce com as partes do trabalho. Se o trabalho não tiver partes, começa com uma linha com o título dele.
  - Um trabalho em Pedido passa a **Em negociação**.
- **Cotação solta:** **Início → Cotação** ou **Cotações → Nova cotação**. Se o cliente aceitar, vira trabalho (ver 6.3).

A cotação recebe um número do mês: COT-001-OUT/26, COT-002-OUT/26… O mês é o do dia em que a cotação é criada, e a contagem recomeça em cada mês.

**Passo 1 — Cliente.**
- Escolha o cliente ou crie-o com **+ Novo cliente…**.
- Confirme **Cidade** e **País**. Sem cidade aparece o aviso "Falta a cidade: sai na cotação por baixo do nome".
- Carregue o logótipo do cliente, se quiser que saia junto ao nome.
- Acerte **Data** e **Válida por (dias)**.

**Passo 2 — Linhas.** Toque em **Adicionar linha**. Aparecem quatro escolhas:

| Escolha | Para quê |
|---|---|
| **Wrap / Branding** | Full Wrap, Half Wrap ou Branding impresso. Escreve o texto e cria uma opção por material. |
| **Criação de imagem** | Logotipo, identidade visual, editorial… Vem do catálogo, já com o preço e o que inclui. |
| **Outro serviço ou produto** | Linha livre: escreve o texto e o preço. |
| **Título de secção** | Faixa de título (ex.: PROJECTO GESTÃO MENSAL). Não tem preço e nunca vira trabalho. |

**Wrap / Branding, campo a campo** (cartão "Serviço impresso"):
1. **Serviço:** Full Wrap (cobertura de 100% dos painéis), Half Wrap (toda a lateral) ou Branding (até 30%, estilo Corporativo). Cada um traz a cobertura e as partes habituais.
2. **Estilo:** Artístico, Desportivo e/ou Corporativo.
3. **Viatura** e **Qt.** (ex.: 5 camiões). Para outro objeto (ex.: um congelador), desmarque **É uma viatura**.
4. **Primeira linha da descrição:** é escrita sozinha. Pode mudá-la, e **Voltar ao texto automático** repõe-na.
5. **Cobertura:** botões (de 100%, toda a lateral, até 30/40/50/55/60/75/85/100%) ou texto livre.
6. **Inclui:** Frente, Traseira, Laterais, Portas, Capom, Bumper Frontal, Bumper Traseiro, Tejadilho, Bagageira, Guarda-lamas, Retrovisores, Pilares, Spoiler, Logotipos, Logotipo no "Chapéu", Stickers Complementares, e **Outra parte…**. A frase sai como "Inclui …", com os dois bumpers juntos e os stickers no fim.
7. **Opções:** marque os materiais a propor (Taksim®, Mactac®, Avery Dennison®, Vynil Comum, Premium; os três primeiros vêm marcados) e escreva o preço sem IVA de cada um. Com Qt. maior que 1, o preço é por viatura e aparece a conta (ex.: "5 × = 225.000,00 MT").
8. **Layout:** a nota final (Layout ainda por definir, Layout já definido, …pelo cliente, …+ melhoria).
9. **Juntar à cotação (N opções):** só fica ativo com a viatura escrita e pelo menos um material marcado.
   - Cada material marcado vira uma linha "Opção 1", "Opção 2"… No PDF, a linha sai como "OPÇÃO 1 - Taksim®", com o material a vermelho e a garantia da marca.
   - Com um só material, a linha não tem opção.

O que está a preencher já aparece na pré-visualização e nos totais antes de tocar em **Juntar**.

**Editar uma linha** (tocar nela):
- **Opção:** Nenhuma, 1, 2, 3… Uma linha sem opção entra no total de todas as opções.
- **Linha 1**, **Linha 2 (a negrito)** e **Detalhes (em itálico, uma ideia por linha)**.
- **Materiais (saem a vermelho):** da lista **+ Material…**, ou **Outro material (escrever)…**, com Não certificado / Certificado e a garantia, e depois **Juntar**.
- **Nota final**, **Qt.** e **Valor unitário (sem IVA)**.
- **Fechar**, ou o caixote para apagar a linha.

**Passo 3 — Deslocação, urgência e desconto.**
- **Deslocação:** **Sem deslocação**, **Até 20 km · 1.500,00 MT**, **21–35 km · 2.500,00 MT**, **36–50 km · 3.500,00 MT** (distância de ida), ou **Outro valor** (escreve os km e o valor). Sai como última linha e soma em todas as opções.
- **Urgência:** toque nas linhas urgentes. Logo a seguir a cada uma aparece a linha "Taxa de urgência (45%)", que vale 45% do preço de **uma** unidade dessa linha (não multiplica pela quantidade).
- **Desconto (%):** é tirado do sub-total, antes do IVA.
- **IVA:** 16%, sempre incluído.

**Passo 4 — Texto final.** Botões **Padrão**, **Pedir layouts**, **Criar layouts**, **Agendar viatura** e **Projecto**, ou texto livre.

**Passo 5 — Ver e enviar.**
1. **Totais:** por opção (sub-total + IVA e total), ou Sub-total, Desconto, IVA e TOTAL.
2. **Preview** (ícone do olho, no topo): mostra as páginas A4 tal como vão sair, mesmo antes de guardar. Tem **Fechar** e **PDF**.
3. **PDF:** guarda a cotação e abre a janela de impressão do aparelho. Escolha **Guardar em PDF** (ou **Partilhar**).
   - O ficheiro chama-se "Puzzle_Stickers_Cotação_<cliente>_<Linha 2 da primeira linha, ou a Linha 1>".
4. Depois de enviar ao cliente, mude **Estado** para **Enviada** e toque em **Guardar**. O estado não muda sozinho.

Como sai o PDF:
- Numa cotação com opções, cada opção sai nas suas páginas: as linhas comuns mais essa opção, com SUB-TOTAL, IVA e TOTAL próprios.
- O desconto sai a vermelho (DESCONTO x%), entre o sub-total e o IVA.
- Quando as linhas não cabem numa página, a página diz "continua na página N →" e o cabeçalho mostra "página N/M".

### 6.3 O cliente aceitou

**Cotação feita a partir do trabalho:**
1. Abra a cotação. No cartão **Cliente aceitou?**, se houver opções, escolha a opção (ex.: "Opção 2 · 249.400,00 MT").
2. Toque em **Cliente aceitou**.
3. A cotação fica Aceite e o trabalho é atualizado:
   - As partes do trabalho passam a ser as linhas aceites. O desconto já vem nos preços, para o total do trabalho bater com a cotação, e a urgência entra como linha.
   - Se o trabalho estava em Pedido ou Em negociação, passa à fase seguinte.
   - O trabalho conta como confirmado e abre nos Pagamentos. A mensagem mostra o sinal de 50%.

**Cotação solta:**
1. Confirme o cliente (é obrigatório) e, se houver opções, escolha a opção aceite.
2. Toque em **Converter em trabalho** (ou **Converter em trabalhos**).
3. Cada linha de serviço vira um trabalho, já confirmado, na fase a seguir à negociação, com o cliente, o valor e a descrição.
   - Com opções, só passam as linhas comuns e as da opção escolhida.
   - A linha de urgência vai com a sua linha, e a deslocação vai com o primeiro trabalho.
   - As secções não viram trabalho.
   - No fim, a app abre o primeiro trabalho.
4. A app escolhe o tipo de trabalho pelo texto da linha:
   - "wrap", "branding", "vinil", "viatura" ou "camião" → Branding / wrap;
   - "camisete", "t-shirt" ou "caneca" → Fornecimento;
   - "montagem" ou "PPF" → Montagem;
   - o resto → Criação de imagem.
   A entrega prevista fica a 10 dias úteis. Confirme o tipo e a data em **Editar trabalho**.

**Sem cotação** (preço combinado de boca): no trabalho, na fase Em negociação, toque em **Cliente confirmou**. O trabalho passa a contar no "a receber".

Um trabalho conta como confirmado quando acontece uma destas coisas:
- tocou-se em **Cliente confirmou** ou **Cliente aceitou**;
- o cliente pagou alguma coisa;
- o trabalho já passou da negociação.

### 6.4 Avançar as fases do trabalho

| Fase | Botões e datas no painel |
|---|---|
| Pedido | **Fazer cotação**, **Já está em negociação**, **Responder até** |
| Em negociação | **Cliente confirmou**, a cotação (ou **Fazer cotação**), **Resposta até** |
| Layout (Design na criação) | **Aprovado**, **Layout até** |
| Produção (Encomenda no fornecimento) | Lista das requisições com a fase; **Produção pronta**; **Pedido à Académica**; **Pedido feito a (fora da app)** com **Hoje**; **Produção até** |
| Montagem | **Montagem feita**, **De** e **Até** |
| Entrega | **Entregue**, **Pago** (quando há dívida), **Entrega prevista** |
| Entregue | Data da entrega, quanto falta receber e a data prometida; **Pago** |

Outras formas de mudar de fase:
- Tocar num passo da linha das fases (para trás, a app pede confirmação).
- **⋯ → Voltar para <fase anterior>**.
- Arrastar o cartão no quadro.
- **Saltar <fase> →**.

Passar da negociação para a frente, por qualquer destas formas, marca o trabalho como confirmado.

**Entregar:**
1. Na fase Entrega, toque em **Entregue**.
2. Na janela "Entregar T-…", confirme a **Data da entrega**.
3. Se o cliente ainda deve, preencha **O cliente prometeu pagar até**. A data vem com hoje + 7 dias.
4. Toque em **Confirmar entrega**.

A data prometida aparece no trabalho, no cartão do quadro, em Recebimentos e nos avisos do Início.

### 6.5 Requisição à Académica

**Criar:**
1. Escolha por onde começa:
   - no trabalho, na fase Produção, **Pedido à Académica**;
   - no separador **Requisições** do trabalho, **Nova**;
   - sem trabalho, **Fornecedores → Requisições → Nova requisição**.
2. No separador **Prints**:
   - **Trabalho** (ou "— sem trabalho (ex.: vários clientes) —"), **Fornecedor** e **Data**.
   - Tipo: **Lista de impressão (m²)** ou **Encomenda (unidades)**. Só se pode mudar antes de a lista ser enviada ou de haver pró-forma.
   - **Nome do trabalho:** vem preenchido com o cliente e o título. Serve para os nomes dos ficheiros (NOME_PRINT_1, NOME_PRINT_2…).
   - **Material base:** a impressão e a laminação dos prints novos. Vem Bundle Wrap quando o fornecedor tem vinil de wrap e laminação de wrap. **Aplicar a todos os prints** copia o material base para todas as linhas.
3. Os prints, linha a linha:
   - **Qt.**, nome do ficheiro, **Largura** e **Comprimento** (em metros) e os m².
   - Cada linha tem a sua impressão e a sua laminação, com o valor da linha ao lado.
   - **Print** junta uma linha. **Gerar nomes** escreve os nomes dos ficheiros.
   - Uma linha com Qt. 0 fica na lista mas não conta.
4. **Fornecedor cobra IVA (16%)**, **Notas** e os totais (Sub-Total, IVA e TOTAL).
5. **Guardar.**
   - Para guardar, a requisição precisa do fornecedor e de pelo menos um print com medidas. Os prints sem nome recebem "<nome>_PRINT_N".
   - O número é do mês em que a requisição foi criada: REQ-001-OUT/26.

Numa **Encomenda**, as linhas são **Itens**: produto (escolhido do preçário do fornecedor ou escrito), quantidade, unidade e preço.

**PDF e WhatsApp:**
1. Toque em **PDF**. O botão está no fundo da janela da requisição, no Passo 1 do circuito (**PDF da lista**) e como ícone nas listas.
   - A app guarda a requisição e gera, no próprio aparelho, a "REQUISIÇÃO DE PRINTS".
   - O documento tem o número, a data, o logótipo da Académica (nos outros fornecedores sai o nome), o nome do trabalho e uma tabela com Nº, Ficheiro, Material, Qt., L × C (m), m², Preço m² e Valor.
   - No fim vêm Sub-total, IVA 16% e TOTAL. Só saem os prints com quantidade e medidas.
2. Abre a janela **PDF pronto**, com o ficheiro "REQ-…_<nome do trabalho>.pdf":
   - **Partilhar (WhatsApp, email…)**, onde o aparelho deixa partilhar ficheiros (iPhone, iPad).
   - Onde não há partilha de ficheiros (ex.: Mac), **Descarregar e abrir o WhatsApp da Académica**. Descarrega o PDF e abre a conversa do fornecedor com a mensagem escrita. Só falta anexar o PDF que ficou nas Transferências. Este botão precisa do WhatsApp do fornecedor registado.
   - **Descarregar** e **Ver**.

**O circuito** fica no separador **Pró-forma, pagamento e faturas** (no telemóvel, **Pagamento e faturas**).

**1. Lista enviada**
- **PDF da lista**, **WhatsApp <fornecedor>** (mensagem pronta a pedir a pró-forma) e **Marcar como enviada**.
- **Desfazer** volta atrás.

**2. Pró-forma**
- Preencha **Nº da pró-forma**, **Data**, **Valor total (com IVA)** e o ficheiro (**Carregar a pró-forma (PDF)**). Num PDF digital da Académica, a app lê sozinha o número, a data e o valor.
- Toque em **Guardar pró-forma**. Isto também marca a lista como enviada, se ainda não estava.
- Depois aparece "Igual à lista" ou "Diferença de X face à lista", com **Ver original** e **Editar**.
- A pró-forma não conta para o IVA.

**3. Pagamento ao fornecedor**
- Abre depois da pró-forma, ou ao tocar em **Ficar a crédito**. **Ficar a crédito** só aparece nos fornecedores marcados com crédito aberto.
- Mostra o valor, os pagamentos e o **Saldo**.
- Preencha **Valor a pagar** (pode ser só uma parte), **Data**, **Método** e **Referência**, e toque em **Registar pagamento**.
- A crédito, mostra há quantos dias está e avisa quando o cliente já pagou o trabalho.

**4. Fatura e recibo do fornecedor**
- Preencha **Nº da fatura**, **Data** e o ficheiro (**Carregar a fatura (PDF ou foto)**; pode ser fatura + recibo no mesmo PDF).
- Se já tiver o recibo, preencha **Nº do recibo (se já tiver)** e **Data do recibo**.
- Toque em **Guardar fatura**. A fatura entra no IVA dedutível do mês da sua data.
- O recibo pode vir depois: **Nº do recibo**, **Data**, **Vem no mesmo ficheiro da fatura** e **Guardar recibo**.

**5. Impressão levantada** (numa encomenda, **Recebida / levantada**)
- Preencha **Data** e **Custo do delivery (opcional)** e toque em **Marcar como levantada**.
- O custo do delivery vai para Despesas, na categoria Transporte e combustível.
- **Desfazer** volta atrás.

**Pagar créditos mais tarde:** use **Fornecedores → Mapa de crédito → Pagar**, ou o Passo 3 da requisição. Quando o cliente paga o trabalho todo, o Início avisa "liquidar o crédito" e o Mapa mostra o valor em **Pode liquidar já**.

Pagar ao fornecedor não é uma segunda despesa:
- O material conta no resultado do mês da data da requisição, desde que ela não esteja em Rascunho.
- Na caixa, o material sai no dia em que é pago (ver 6.9).

### 6.6 Receber do cliente

A regra da empresa: 50% de sinal para começar, o resto na entrega.

| Onde | Botão | O que faz |
|---|---|---|
| Trabalho → **Resumo financeiro** | **Pago** | Regista tudo o que falta. Pode mudar o valor. |
| Trabalho → **Resumo financeiro** | **Parcial** | Abre o separador Pagamentos com um pagamento novo. |
| Trabalho → separador **Pagamentos** | **Registar pagamento** | Pagamento novo. Tocar num pagamento existente edita-o, e o dono também o pode apagar. |
| Fases Entrega e Entregue | **Pago** | Igual ao **Pago** do resumo. |
| Finanças → **Recebimentos** → Quem deve | **Pago** | Igual, sem abrir o trabalho. |

Campos do pagamento:
- **Valor (MT)** e **Data**;
- **Tipo**: Sinal (50%), Parcial ou Final (na entrega);
- **Método**: M-Pesa, e-Mola, Transferência, Numerário, POS ou Cheque;
- **Referência (opcional)**: ID da transação, nº do talão;
- atalhos **Sinal 50%** e **Tudo o que falta**.

O sinal sugerido é 50% do total com IVA. Enquanto não estiver pago, o trabalho mostra "Sinal em falta". Se o trabalho já estiver em Layout, Produção ou Montagem, o Início avisa "a trabalhar sem sinal".

### 6.7 Fatura e recibo (número do livro)

A app não numera faturas. Escreva sempre o número do **seu livro**.

**Caso A — o cliente já pagou (fatura-recibo):**
1. Registe o dinheiro com **Pago**. O trabalho passa a mostrar "Recebido X sem fatura/recibo".
2. Toque em **Passar fatura/recibo** (na faixa do trabalho). Se o trabalho ainda não tiver fatura, abre **Fatura-recibo**.
3. Preencha **Número** (do livro) e **Data**, confirme o **Valor sem IVA** e carregue a foto ou o PDF.
4. Toque em **Guardar fatura**. Os pagamentos sem documento, até ao total da fatura-recibo, ficam ligados a ela, e o aviso desaparece.

**Caso B — fatura primeiro, pagamento depois:**
1. **Início → Fatura.** Aparecem os trabalhos confirmados que ainda não têm fatura.
2. Escolha o **Cliente** e os **Trabalhos desta fatura**. Uma fatura pode cobrir vários trabalhos.
3. Escolha **Documento: Fatura** e preencha **Número**, **Data**, **Valor sem IVA** (vem calculado, mas pode mudar) e o ficheiro. Toque em **Guardar fatura**.
4. Quando o cliente pagar: **Início → Recibo** (ou **Passar fatura/recibo** no trabalho). Escolha a **Fatura** e aparece o que falta.
5. Preencha **Valor recebido**, **Número do recibo**, **Data**, **Método** e o ficheiro, e toque em **Guardar recibo**.
   - O valor pode ser só uma parte. Vários recibos para a mesma fatura = pagamento em prestações.
   - **Já carreguei em "Pago" — é só o recibo** vem marcado quando há pagamentos sem recibo. Deixe-o marcado se já tinha tocado em **Pago**: o recibo fica ligado a esses pagamentos (dos mais antigos para os mais recentes) e o dinheiro não é contado duas vezes.
   - Se a caixa estiver desmarcada, a app regista o pagamento nos trabalhos dessa fatura, pela ordem em que estão na fatura. O último trabalho fica com o resto.

Faturas, faturas-recibo e vendas a dinheiro emitidas contam no IVA liquidado do mês da sua data. Os recibos não contam para o IVA, porque o IVA está na fatura.

**Documentos antigos ou de outra origem:**
1. Abra **Finanças → Faturas e recibos → Carregar**, ou, no trabalho, o separador **Faturas e recibos → Carregar**.
2. Escolha **Emitido por mim** ou **Recebido**.
3. Escolha o tipo: Fatura, Fatura-recibo, Venda a dinheiro, Recibo, Nota de crédito ou Outro.
4. Preencha o número, a entidade, a data, o NUIT e os valores (**Sei o valor sem IVA** ou **Sei o total**).

A nota de crédito abate no IVA.

### 6.8 Entrega com saldo em falta

1. Entregue com **Entregue** (ver 6.4) e marque a data em que o cliente prometeu pagar.
2. A partir de dois dias antes, o Início avisa "<Cliente> paga a <data>". No próprio dia, avisa "<Cliente> paga hoje".
3. Se a data passar, o aviso fica vermelho: "prometeu pagar até <data> — N dias de atraso".
4. Em **Recebimentos**, o botão de WhatsApp abre a conversa com o lembrete escrito ("…foi entregue. Valor em falta: X…").
5. Quando o cliente pagar, toque em **Pago** e depois passe a fatura ou o recibo (ver 6.7).

### 6.9 Caixa, compras, despesas fixas e gastos pessoais

**Acertar a caixa** (só o dono):
1. **Início → Em caixa** (ou **Finanças → Resumo → Em caixa**).
2. Preencha **Quanto tem hoje? (banco + M-Pesa + numerário)** e toque em **Guardar**.
3. A partir daí, a app soma o que os clientes pagam e tira as compras, as despesas fixas pagas, os pagamentos a fornecedores e os gastos pessoais. Os gastos pessoais repostos voltam a entrar. Pode acertar outra vez sempre que quiser.

**Compras e despesas pontuais:**
1. **Início → Compra** abre "Nova compra", já com Fatura escolhida. **Finanças → Despesas → Despesa** abre "Nova despesa", com Sem documento.
2. Preencha **Descrição**, **Categoria**, **Valor pago (MT)**, **Data**, **Método**, **Pago a (opcional)** e **Notas**.
3. Em **Documento da compra**, escolha **Fatura**, **Venda a dinheiro**, **Recibo** ou **Sem documento**. Depois o número e a foto ou o PDF.
4. Com Fatura ou Venda a dinheiro:
   - a compra fica também em Faturas e recibos;
   - **Tem IVA (conta como IVA dedutível)** vem marcado, e o **IVA incluído** é calculado (16% dentro do valor). Pode corrigir esse valor;
   - com IVA, a compra entra no IVA dedutível do mês.

**Despesas fixas (salários, renda, EDM, internet…):**
1. **Finanças → Despesas → Despesas fixas → Nova despesa fixa.**
2. Preencha:
   - **Nome**, **Categoria** e **Valor mensal (MT)**;
   - **Paga-se a partir do dia** (vazio = só há um dia de pagamento) e **Até ao dia**;
   - **A partir de** (mês), **Pago a (opcional)** e **Trabalhador (opcional)** (só em Salários);
   - **Notas** e **Ativa (aparece todos os meses)**.

   Exemplo da empresa: de dia 25 a dia 5. Quando o primeiro dia é maior do que o último, o prazo é no mês seguinte: as despesas de outubro pagam-se de 25 de outubro a 5 de novembro.
3. Todos os meses, cada despesa fixa aparece no cartão do mês.
   - Para a pagar, toque em **Pagar até dd** (ou **Em atraso · pagar**), confirme os dados e toque em **Marcar como paga**.
   - Para corrigir, abra-a e toque em **Desmarcar**.

**Gastos pessoais:**
1. **Finanças → Pessoal → Gasto pessoal**: preencha **O que foi**, **Valor**, **Data**, **Como pagou** e **Notas**.
2. O gasto fica "por resolver" e aparece no Resumo.
3. Depois resolve-o de uma de duas maneiras:
   - **Repor**: devolveu o dinheiro à empresa, e ele volta à caixa nesse dia;
   - **Autorizar**: fica como uso próprio.

   Para desfazer, abra o gasto e toque em **Voltar a por resolver**.

**Duas formas de ver o dinheiro:**

| Ecrã | Pergunta a que responde | Como conta |
|---|---|---|
| Finanças → **Resumo** | Quanto dinheiro entrou e saiu? | Com IVA. O fornecedor conta no dia em que é pago. Inclui os gastos pessoais. |
| Finanças → **Despesas → Resultado do mês** | A empresa ganhou ou perdeu? | Sem IVA. Faturado − material dos trabalhos − compras e despesas da empresa.<br>O material conta no mês da data da requisição (os rascunhos não contam) e inclui os outros custos dos trabalhos.<br>As despesas fixas contam no mês a que se referem. Não entram gastos pessoais. |

O lucro de cada trabalho (no Resumo financeiro do trabalho) é o valor de venda sem IVA, menos as requisições (valor da lista, sem IVA), menos os outros custos. A mão de obra não entra no custo do trabalho: os salários são despesas fixas e entram no resultado do mês.

### 6.10 O IVA do mês

1. Confirme que todas as faturas emitidas no mês estão registadas (ver 6.7). O ecrã do IVA avisa quais trabalhos receberam dinheiro no mês sem fatura emitida.
2. Confirme as faturas recebidas: as da Académica (Passo 4 da requisição), as das compras (Fatura ou Venda a dinheiro com IVA) e as carregadas à mão.
3. Abra **Finanças → IVA** e escolha o mês.
4. Veja o **IVA liquidado**, o **IVA dedutível** e o **IVA a pagar** (ou **Crédito a reportar**).
5. Gere o **PDF** (Relação do IVA) e o **Excel** para o contabilista. O PDF diz que é um resumo de apoio e que não substitui a declaração oficial.

**Código (secção 6):** `src/pages/Rapido.tsx` (`NovoPedido`, `EmitirFatura`, `EmitirRecibo`, `documentarPagamentos`), `src/pages/TrabalhoForm.tsx` (`TrabalhoForm`), `src/pages/Partes.tsx` (`EditorPartes`, `LinhaParte`, `soCatalogo`), `src/pages/Trabalho.tsx` (`fazerCotacao`, `PagamentoForm`), `src/pages/Cotacoes.tsx` (`aceitarNoTrabalho`, `converter`, `tipoDe`), `src/pages/cotacaoFormulario.tsx` (`NovoImpresso`, `ItemEditor`, `Materiais`), `src/materiaisCotacao.ts` (`IMPRESSO`, `DESLOCACAO`, `TEXTOS_FINAIS`, `NOTAS_ITEM`, `frasePartes`), `src/print.tsx` (`imprimirCotacao`, `imprimirLista`), `src/pdfPartilha.tsx` (`emitirRequisicao`, `renderizarPdf`, `PdfHost`), `src/requisicaoPdf.tsx` (`PaginaRequisicao`), `src/leitura.ts` (`lerFicheiro`), `src/acoes.ts` (`moverEtapa`), `src/calc.ts` (`totaisCotacao`, `comUrgencia`, `numeroDoMes`, `totaisRequisicao`, `janelaFixa`).

---

## 7. Cópia de segurança e cuidados com os dados

**Onde estão os dados:**
- Os registos (trabalhos, cotações, clientes, pagamentos, documentos, despesas, tarefas, relatórios…) estão na nuvem e em cada aparelho ligado. A nuvem é a cópia principal.
- Os ficheiros (fotos, scans, PDFs e logótipos) estão só no aparelho onde foram carregados. Os catálogos em PDF são a exceção: fazem parte da app.

**Descarregar cópia de segurança** (Definições → Empresa → Dados):
- Descarrega o ficheiro `puzzle-gestao-copia-AAAA-MM-DD.json`.
- Inclui: empresa, equipa, clientes, fornecedores, catálogo, trabalhos, pagamentos, requisições, outros custos, faturas e recibos (só os dados, sem o ficheiro) e cotações.
- **Não inclui:** despesas (nem as fixas nem os gastos pessoais), tarefas, relatórios diários, o registo de ações nem os ficheiros.
- A app não tem botão para repor esta cópia. Repor a partir dela é trabalho de programação.
- O ficheiro tem os dados da empresa e da equipa, incluindo os PINs. Guarde-o num lugar seguro.

**Botões que mexem nos dados do aparelho:**

| Botão | O que faz | Cuidado |
|---|---|---|
| **Sair** | Termina a sessão. Os dados ficam no aparelho. | Nenhum. |
| **Desligar este aparelho** (cartão Nuvem) | Envia o que falta, deixa de sincronizar e volta a pedir a palavra-passe. | Ao voltar a entrar, se a nuvem tiver dados, o aparelho fica com a cópia da nuvem. |
| **Recomeçar este aparelho** (cartão Dados) | Tenta enviar o que falta, desliga da nuvem e apaga todos os dados deste aparelho. | Os registos voltam da nuvem quando entrar outra vez. Perdem-se as alterações que não chegaram a subir (por exemplo, sem internet). **Perdem-se os ficheiros que só existiam neste aparelho.** |
| Apagar um registo (só o dono) | O registo fica marcado como apagado e desaparece em todos os aparelhos. | A app não tem "desfazer" para isto. |

Antes de **Recomeçar** ou de trocar de aparelho, confirme que o estado diz "Na nuvem" e que os ficheiros importantes existem noutro sítio.

**Código:** `src/pages/Definicoes.tsx` (`exportar`, `CartaoNuvem`), `src/seed.ts` (`repor`), `src/nuvem.ts` (`TABELAS`, `desligar`), `src/db.ts` (`apagar`, `guardarFicheiro`).

---

## 8. Regras e números em resumo

| Regra | Valor atual | Onde se muda |
|---|---|---|
| IVA | 16%; nas cotações está sempre incluído | Definições → Empresa → **Taxa de IVA (%)** |
| Sinal para começar | 50% do total com IVA | **Sinal para começar (%)** |
| Taxa de urgência | 45%. No trabalho, sobre o valor das partes. Na cotação, uma linha própria com 45% de uma unidade da linha urgente | **Taxa de urgência (%)** |
| Validade das cotações | 30 dias de origem; pode mudar em cada cotação | **Validade das cotações (dias)** |
| Deslocação | Até 20 km: 1.500 · 21–35 km: 2.500 · 36–50 km: 3.500 · mais longe: valor escrito | Código: `src/materiaisCotacao.ts` (`DESLOCACAO`) |
| Desconto | % sobre o sub-total da cotação, antes do IVA | Em cada cotação |
| Código dos trabalhos | T-2026-001, T-2026-002… (o ano é o da criação) | Automático |
| Número das cotações | COT-001-OUT/26; recomeça todos os meses | Automático |
| Número das requisições | REQ-001-OUT/26; recomeça todos os meses | Automático |
| Faturas e recibos | Número do livro do Momad, escrito à mão | Nunca automático |
| "A receber" | Só trabalhos confirmados | — |
| Fotos carregadas | As grandes ficam com no máximo 2000 px (JPEG); os logótipos dos clientes com no máximo 800 px (PNG) | Código: `src/db.ts` (`comprimirImagem`), `src/pages/Clientes.tsx` (`guardarLogo`) |

---

## 9. Limitações atuais e pontos em aberto

Coisas que convém saber no uso de todos os dias (confirmadas no código de outubro de 2026):
- **Os ficheiros não sincronizam.** Um logótipo carregado no Mac não aparece na cotação feita no iPhone, e uma fatura fotografada no iPhone não abre no Mac. (`src/nuvem.ts`: `TABELAS` não inclui `ficheiros`.)
- **O PDF da cotação** abre a janela de impressão, onde se escolhe "Guardar em PDF". O PDF da requisição já sai como ficheiro pronto a partilhar.
- **O estado da cotação** (Enviada, Recusada) muda-se à mão, no campo **Estado**, seguido de **Guardar**. **Cliente aceitou** e **Converter** marcam Aceite sozinhos.
- **Requisição** (`src/pages/RequisicaoForm.tsx`, `Circuito`, `guardarFatura`; `src/calc.ts`, `faseRequisicao`, `mapaCredito`):
  - O Passo 3 (pagar) só abre com pró-forma ou a crédito.
  - No Passo 4, o valor da fatura do fornecedor é o da pró-forma (ou o total da lista); não se pode escrever outro valor.
  - Registar a fatura não marca a lista como enviada (registar a pró-forma marca).
  - Uma requisição só com fatura, sem pró-forma nem pagamento, aparece como "Lista enviada" (ou "Rascunho") e não entra no Mapa de crédito.
- **O PDF da requisição soma sempre o IVA de 16%**, mesmo com **Fornecedor cobra IVA** desmarcado. (`src/requisicaoPdf.tsx`: `totaisLinhas` não lê `comIva`.)
- **O logótipo do fornecedor** carregado na ficha não sai no PDF da requisição. O PDF usa uma imagem fixa da Académica e, nos outros fornecedores, o nome. (`src/requisicaoPdf.tsx`, `logoFornecedor`.)
- **Custo do trabalho:** usa sempre o valor da lista (sem IVA), mesmo quando a fatura do fornecedor é diferente. (`src/calc.ts`, `resumoTrabalho`.)
- **Requisições sem trabalho** (ex.: "Várias") aparecem em Requisições e no Mapa de crédito, mas em nenhum trabalho.
- **Leitura automática:** só funciona com PDFs digitais da Académica (pró-forma, fatura, recibo). Scans e fotos guardam-se, mas os campos preenchem-se à mão. (`src/leitura.ts`.)
- **Pagamentos aos fornecedores** não guardam comprovativo (foto do talão).
- **"Guardar na lista de materiais"** (em **Outro material**, na cotação) ainda não guarda nada: o material escrito fica só nessa linha. (`src/pages/cotacaoFormulario.tsx`, `Materiais`.)

Pontos em aberto: o Momad levantou 5 pontos a 19 de outubro de 2026. Foram organizados num plano de 6 partes, ainda por fazer, à espera da aprovação dele:
1. Fatura da Académica sem pró-forma, pagamento com comprovativo, uma fase nova "Fatura por pagar" e atalhos a partir do trabalho.
2. Cartão "Percurso" no trabalho (cotação → requisição → faturas da produção → fatura ao cliente), com a linha do tempo completa.
3. Cotação com data de envio, um botão **Negociar** separado de **Editar** e as versões ligadas no trabalho.
4. Requisição como a cotação: faixa de estado, pré-visualização A4, marcação de "enviada" ao partilhar e **Guardar** só quando há alterações.
5. Partes do trabalho com estado próprio: marcar uma parte como "feita na empresa / sem custo" e ligá-la à requisição e à linha da cotação.
6. Pagamento do cliente por parte (ex.: "pagou só o logotipo").

Perguntas que o Momad ainda tem de responder para este plano:
- A cotação negociada leva número novo (com "substitui a COT-…" registado na app) ou mantém o número com "v2"?
- O PDF da cotação negociada diz ao cliente que substitui a anterior, ou isso fica só interno?
- Como se marca uma cotação como "enviada": a app pergunta depois de gerar o PDF, marca sozinha (com Desfazer), ou só por botão?
- Ao corrigir uma cotação já enviada, basta avisar, ou bloqueia-se e obriga-se a usar **Negociar**?
- Na requisição, chega melhorar a janela atual, ou passa a ter uma página inteira como a cotação?
- Quando a fatura do fornecedor difere da lista, o custo e o lucro do trabalho passam a usar a fatura (sem IVA)?
- Nas partes, chega um estado simples por parte, ou cada parte precisa das fases completas?
- Os trabalhos feitos por lotes (vários camiões do mesmo cliente) continuam como trabalhos separados por lote, ou passam a um trabalho com partes por lote?
- Num pagamento por parte, cada pagamento corresponde a uma só parte, ou um pagamento pode ser repartido por várias partes?
- As requisições "Várias" (uma lista para vários trabalhos) ficam só no Mapa de crédito, ou ligam-se a mais de um trabalho?
- Os ficheiros ficam só no aparelho por agora, ou a nuvem de ficheiros entra neste plano?
- Liga-se já a leitura de vários PDFs da Académica de uma vez, ou fica para depois? Só lê PDFs digitais. O código está em `src/pages/Importar.tsx`, mas não está ligado a nenhum ecrã.
