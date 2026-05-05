# Guia de Projeto — Organizador Financeiro

## 1. Visão geral

Este projeto tem como objetivo criar um sistema para organizar e distribuir despesas de cartão de crédito entre várias pessoas, reduzindo o trabalho manual de conferência no fim do mês.

A ideia central é transformar um processo que hoje é feito no caderno e conferido item por item no extrato em uma solução digital, com cadastro de participantes, registro de gastos, importação de CSV do banco e, no futuro, automações com WhatsApp, IA e orquestração de fluxos.

## 2. Problema que o projeto resolve

Hoje existe um cenário em que uma pessoa precisa olhar o extrato do cartão, identificar qual gasto pertence a quem e fazer os acertos manualmente. Isso gera:

- perda de tempo;
- risco de erro humano;
- dificuldade para consolidar totais por pessoa;
- dificuldade para acompanhar parcelas e compras recorrentes;
- falta de histórico organizado.

O sistema deve diminuir esse esforço, centralizar os registros e facilitar consultas como:

- quanto cada participante deve no mês;
- quais lançamentos foram atribuídos a cada pessoa;
- quais compras estão parceladas;
- quais lançamentos vieram do cartão e quais foram inseridos manualmente;
- quais registros ainda precisam de revisão.

## 3. Objetivo principal

Criar um organizador financeiro simples, útil e evolutivo, começando com uma API e um dashboard web, e avançando depois para integrações com WhatsApp, IA e automações.

O foco inicial não é criar um produto final complexo. O foco é construir uma base sólida para evoluir sem se perder no planejamento.

## 4. Escopo inicial

### O que entra agora

- autenticação com login e senha;
- autenticação com JWT;
- cadastro de usuários;
- cadastro de participantes vinculados ao usuário principal;
- registro manual de despesas;
- importação manual de CSV do Nubank;
- dashboard para visualizar e revisar lançamentos;
- separação entre registros do usuário e registros dos participantes;
- cálculo de totais por pessoa;
- estrutura preparada para parcelas.

### O que fica para depois

- integração com WhatsApp;
- uso de IA para interpretar mensagens em linguagem natural;
- orquestração com n8n;
- integração automática com e-mail;
- automação total de conciliação;
- respostas inteligentes por linguagem natural no fim do mês.

## 5. Ideia de funcionamento

A lógica do projeto pode ser pensada em camadas.

### 5.1 Fonte de verdade

A planilha CSV exportada do Nubank deve ser tratada como a principal referência dos gastos do cartão.

Isso significa que ela será usada para registrar os lançamentos reais do cartão, enquanto os demais registros servirão como apoio para classificar, distribuir ou complementar essas informações.

### 5.2 Registros auxiliares

Além da planilha do banco, existirão entradas criadas pelo usuário ou por outros canais, como:

- lançamentos manuais no dashboard;
- mensagens enviadas pelo WhatsApp;
- dados futuros vindos de automações.

Esses registros ajudam a identificar para quem cada gasto pertence e como ele deve ser distribuído.

### 5.3 Resultado esperado

No final, o sistema deve conseguir mostrar, de forma clara:

- total por participante;
- total do próprio usuário;
- lançamentos por período;
- compras parceladas;
- lançamentos sem classificação;
- histórico organizado para conferência.

## 6. MVP sugerido

O MVP deve ser pequeno o suficiente para sair do papel, mas útil de verdade.

### MVP 1

- autenticação;
- cadastro de participantes;
- importação manual de CSV;
- criação de registros manuais;
- associação de gasto a participante;
- cálculo de totais;
- dashboard simples.

### Por que começar por aqui

Porque isso já resolve uma parte importante da dor atual sem depender de IA, WhatsApp ou automações complexas. Primeiro você valida a estrutura principal. Depois adiciona inteligência e integrações.

## 7. Estrutura lógica do sistema

### 7.1 Usuário principal

É o dono da conta no sistema. Ele faz login, cria participantes e gerencia os lançamentos.

### 7.2 Participantes

São as pessoas que compartilham gastos com o usuário principal. Cada participante pertence a um usuário.

Exemplo:

- Monique;
- Patrícia;
- João.

### 7.3 Lançamentos

São os itens financeiros que precisam ser distribuídos ou acompanhados.

Cada lançamento pode conter:

- descrição;
- valor;
- data;
- origem;
- participante vinculado;
- status de revisão;
- número de parcelas, quando aplicável.

### 7.4 Importação do Nubank

O CSV importado do Nubank deve ser usado para alimentar a base principal dos lançamentos reais do cartão.

### 7.5 Registros manuais

Servem para complementar o que não vier automaticamente do banco, como:

- correções;
- observações;
- gastos adicionados manualmente;
- ajustes de divisão.

## 8. Regras de negócio que precisam ser pensadas

Essas regras ainda podem mudar, então aqui o ideal é registrar as decisões que precisam ser definidas com clareza durante o desenvolvimento.

### 8.1 Quem paga o quê

Um gasto pode pertencer:

- somente ao usuário;
- a um participante específico;
- a mais de uma pessoa, se houver divisão futura.

### 8.2 Parcelas

Alguns lançamentos podem se repetir ao longo dos meses por estarem parcelados.

Isso pede um conceito de:

- compra original;
- parcela atual;
- quantidade total de parcelas;
- mês de referência;
- status da parcela.

### 8.3 Classificação dos lançamentos

Nem todo gasto virá classificado automaticamente.

Então o sistema deve permitir:

- classificação manual;
- revisão posterior;
- marcação de pendência;
- confirmação de vínculo com participante.

### 8.4 Fonte e confiança dos dados

Nem todos os dados terão o mesmo nível de confiança.

Uma boa abordagem é separar:

- dado importado do banco;
- dado digitado manualmente;
- dado interpretado por IA;
- dado ajustado por automação.

## 9. Caminho de desenvolvimento recomendado

### Fase 1 — Base da API

Objetivo: consolidar o núcleo do sistema.

Entregas:

- autenticação;
- JWT;
- usuários;
- participantes;
- estrutura inicial de lançamentos;
- migrations bem organizadas;
- validações básicas.

O motivo dessa fase é simples: sem uma base consistente, tudo que vier depois vira remendo.

### Fase 2 — Dashboard em React

Objetivo: permitir uso prático sem depender de ferramentas externas.

Entregas:

- login;
- listagem de participantes;
- formulário de lançamento;
- importação de CSV;
- visão geral dos totais;
- tela de revisão de lançamentos.

O front deve ser pensado como ferramenta operacional, não apenas visual.

### Fase 3 — Modelagem de parcelas e recorrência

Objetivo: tratar compras parceladas e lançamentos que se repetem.

Entregas:

- campo de parcelas;
- vínculo entre parcela e compra original;
- controle de mês atual;
- exibição de parcelas futuras.

Essa fase é importante porque parcela mal modelada costuma virar dor de cabeça depois.

### Fase 4 — Integração com WhatsApp

Objetivo: permitir entrada rápida de informações em linguagem simples.

Exemplo de mensagem:

- `30, pizza, Monique`

A ideia é interpretar a mensagem e gerar um registro estruturado automaticamente.

### Fase 5 — IA e linguagem natural

Objetivo: entender mensagens mais livres e consultas mais humanas.

Exemplos:

- “quanto deu a Monique esse mês?”
- “adiciona 50 reais de mercado para a Patrícia”
- “me mostra os gastos pendentes”

Aqui entra uma camada de interpretação antes da ação.

### Fase 6 — Automação com n8n

Objetivo: orquestrar integrações externas.

Possíveis usos:

- receber e-mails com CSV;
- salvar anexos;
- disparar importações;
- conectar WhatsApp, planilhas e webhooks;
- automatizar alertas e rotinas.

## 10. Ordem prática de implementação

Uma sequência sensata para não se perder é esta:

1. fechar a modelagem mínima do banco;
2. garantir login e autenticação;
3. criar CRUD de participantes;
4. criar CRUD de lançamentos;
5. implementar importação manual de CSV;
6. construir dashboard básico;
7. adicionar relatórios e totais;
8. tratar parcelas;
9. integrar WhatsApp;
10. integrar IA;
11. automatizar com n8n;
12. integrar e-mail.

## 11. Decisões que ainda precisam ser fechadas

Algumas coisas ainda estão abertas e devem ser documentadas à medida que o projeto evolui:

- qual será o nome definitivo do sistema;
- como será definido o tipo de lançamento;
- como tratar lançamentos divididos entre várias pessoas;
- como reconciliar o CSV do banco com os registros manuais;
- como representar parcelas;
- se o sistema vai usar planilha como apoio ou apenas banco de dados;
- se a IA apenas sugere ou também executa ações;
- como lidar com lançamentos sem participante definido.

## 12. Princípios do projeto

### Simplicidade primeiro

O sistema deve resolver o problema real antes de tentar ser sofisticado.

### Evolução gradual

Cada nova camada só deve entrar quando a base estiver funcionando.

### Fonte única de dados

O projeto precisa evitar duplicidade e confusão entre banco, planilhas e registros manuais.

### Registro claro

Tudo que for decidido deve ser documentado para não depender da memória.

### Utilidade real

O projeto só faz sentido se economizar tempo e reduzir trabalho manual.

## 13. Sugestão de visão de longo prazo

No futuro, este sistema pode evoluir para ser mais do que um organizador de rateio de cartão.

Ele pode virar uma pequena plataforma pessoal de organização financeira, com:

- controle de gastos compartilhados;
- importação automática de extratos;
- resumo mensal por pessoa;
- notificações;
- entradas por voz ou mensagem;
- inteligência para ajudar na classificação;
- suporte a múltiplos tipos de lançamentos.

## 14. Rascunho de definição do projeto

Nome provisório: **Organizador Financeiro**

Descrição curta:

> Sistema pessoal para registrar, classificar e acompanhar gastos compartilhados, com foco em importação de extratos, divisão por participantes e automações futuras.

## 15. Próximo passo imediato

Antes de avançar para integrações mais sofisticadas, o ideal é fechar:

- entidades principais do banco;
- relacionamento entre usuário, participantes e lançamentos;
- campos mínimos do lançamento;
- fluxo de importação do CSV;
- telas mínimas do dashboard.

Esse é o núcleo que sustenta todo o resto.

---

## Anotações pessoais

Espaço livre para ir registrando decisões durante o projeto:

- 
- 
- 
- 
