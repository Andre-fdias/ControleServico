# Livro de Registro de Atividades — Corpo de Bombeiros (PMESP)

Sistema Web oficial e seguro para digitalização, gestão, validação e impressão do **Livro de Registro de Atividades do Corpo de Bombeiros da Polícia Militar do Estado de São Paulo (PMESP)**, em conformidade com o **Anexo "D" à Dtz-003/932/11**.

Desenvolvido em **Google Apps Script (GAS V8)** com persistência centralizada no **Google Sheets**, adotando fielmente os padrões de design de alta performance e interface do repositório **SisFolgas**.

---

## 📌 1. Visão Geral e Arquitetura

O sistema substitui o preenchimento manual em papel por uma plataforma web operacional moderna, responsiva e segura, operando em ciclos contínuos de **24 horas** (das **07h30** às **07h30** do dia seguinte).

### Componentes de Tecnologia:
* **Backend:** Google Apps Script V8 (JavaScript moderno).
* **Banco de Dados:** Google Sheets (Planilha Oficial ID: `1JtIUA2hpvs2I9BVJ6yqHAi5Qzozo0sYkbRNS757EInQ`).
* **Frontend:** HTML5, CSS3 Vanilla com variáveis customizadas, e JavaScript moderno integrado via `HtmlService`.
* **Segurança e Concorrência:** PBKDF2/SHA-256 com salt individual por usuário, controle estrito de sessão, política de troca obrigatória de credenciais provisórias, e `LockService` contra gravações simultâneas.
* **Ambiente de Homologação Local:** Servidor `dev_server.js` embutido (Node.js nativo sem dependências externas) para testes e automação de interface.

---

## 🎨 2. Identidade Visual (SisFolgas)

A interface reproduz a paleta de cores, tipografia e componentes do sistema **SisFolgas**:
* **Cores Base:** Superfícies escuras com glassmorphism (`--bg-base: #0b0f19`, `--bg-surface: #111827`, `--bg-card: rgba(17, 24, 39, 0.85)`).
* **Cores Institucionais:** Vermelho Bombeiro (`--brand-red: #ef4444`, `--brand-red-dark: #b91c1c`), Âmbar (`#f59e0b`) e Ouro (`#fbbf24`).
* **Badges de Prontidão:**
  * 🟢 **Prontidão Verde:** `.badge-prontidao-verde` (`bg: rgba(16, 185, 129, 0.18)`, `color: #34d399`).
  * 🟡 **Prontidão Amarela:** `.badge-prontidao-amarela` (`bg: rgba(245, 158, 11, 0.18)`, `color: #fbbf24`).
  * 🔵 **Prontidão Azul:** `.badge-prontidao-azul` (`bg: rgba(59, 130, 246, 0.18)`, `color: #60a5fa`).
* **Tipografia:** `Outfit` (títulos e indicadores numéricos) e `Inter` (corpo e formulários).

---

## 🔐 3. Segurança e Política de Credenciais Iniciais

Conforme especificado, o sistema aceita credenciais iniciais provisórias, aplicando regras estritas de segurança:
1. **Credenciais Iniciais Provisórias:**
   * **Militar:** Usuário: seu número de **RE** | Senha inicial: seu próprio **RE**.
   * **Administrador Geral:** Usuário: `admin` | Senha inicial: `admin`.
2. **Troca Obrigatória:** No primeiro login, a aplicação exibe um modal intransponível exigindo a criação de uma nova senha pessoal (mínimo de 4 caracteres, diferente da provisória).
3. **Armazenamento Seguro:** As senhas **nunca** são salvas em texto puro na planilha. Cada usuário recebe um **salt aleatório individual** e o hash SHA-256 é armazenado na aba `USUARIOS`.
4. **Proteção Contra Força Bruta:** Bloqueio temporário de 15 minutos após 5 tentativas incorretas consecutivas.
5. **Prevenção de Injeção de Fórmulas:** Todos os campos de texto enviados para as células do Google Sheets passam por sanitização (`Utils.sanitizeCellValue`), prefixando apóstrofo caso comecem com `=`, `+`, `-`, `@`.

---

## 📊 4. Estrutura do Banco de Dados (Google Sheets)

O banco de dados é composto por 19 abas com esquema versionado e identificadores estáveis (UUID v4):

| Aba | Descrição |
|---|---|
| `CONFIGURACOES` | Parâmetros gerais, data base do ciclo e horário de início. |
| `USUARIOS` | Contas de acesso, perfis (`admin`/`operacional`), hashes e salts. |
| `MILITARES` | Efetivo cadastrado: RE com dígito, graduação, nome completo e guerra. |
| `GRUPAMENTOS` | Cadastro oficial do 1º ao 25º Grupamento de Bombeiros. |
| `POSTOS_BOMBEIROS`| Postos de Bombeiros (PBs) com vínculo ao SGB e Grupamento. |
| `REGISTROS_ATIVIDADES` | Cabeçalho e controle do ciclo diário de 24h. |
| `NOVIDADES_PESSOAL` | Seção 1: contagens de falta, baixas, visitantes, licença, estagiários e complemento. |
| `MATERIAIS_BELICOS` | Seção 2: armamentos, coletes balísticos, munições e outros itens bélicos. |
| `NOVIDADES_MATERIAIS`| Seção 3: defeitos e indisponibilidades de equipamentos e viaturas. |
| `VIATURAS_REGISTRO` | Seção 4: prefixos, condições operacionais e totais calculados. |
| `ORDENS_DIA` | Seção 5: teor da Ordem do Dia. |
| `ORDENS_RECEBIDAS` | Seção 6: ordens verbais (6.1) e escritas (6.2). |
| `ATIVIDADES_TREINAMENTO` | Seções 7, 8 e 9: Armar Geral, Instrução e Treinamento Físico. |
| `MANUTENCAO_QUARTEL` | Seção 10: limpeza, melhorias, hidrômetro e medidor de energia. |
| `COMENTARIOS_OCORRENCIAS` | Seção 11: resumo sucinto de ocorrências de vulto. |
| `RONDAS` | Seção 12: rondas com postos, horários e responsáveis. |
| `CONFERENCIAS` | Assinaturas das 3 autoridades (Cmt que sai, Cmt que entra e Cmt do PB). |
| `AUDITORIA` | Trilha de auditoria cronológica e imutável de eventos. |
| `SCHEMA_VERSOES` | Controle de migração e versionamento de esquema. |

---

## ⏰ 5. Regras Operacionais Específicas

### 5.1. Escala de 24 Horas
* **Horário Padrão:** Início às **07h30**.
* **Cálculo Automático de Término:** O campo `Para` calcula com exatidão matemática o encerramento exatamente 24 horas depois (às 07h30 do dia seguinte), tratando viradas de mês, viradas de ano e anos bissextos.

### 5.2. Cálculo Cíclico da Prontidão
* Sequência: **Verde → Amarela → Azul → Verde**.
* Data Base de Referência: `24/10/2026` = **Verde**.
* O algoritmo calcula a diferença exata de dias corridos em relação à data base, permitindo prever a prontidão de qualquer data no passado ou futuro.

### 5.3. Prevenção de Duplicatas
* O sistema bloqueia a criação acidental de múltiplos registros ativos com a mesma combinação de:
  $$\text{Data de Início} + \text{SGB} + \text{PB} + \text{Prontidão}$$
* Caso já exista um registro em aberto, o sistema notifica o usuário e oferece a abertura do registro existente.

### 5.4. Conferência pelas Três Autoridades
O registro possui três blocos individualizados de conferência com carimbo de data/hora e assinatura eletrônica auditada:
1. **Comandante da Prontidão que Sai**
2. **Comandante da Prontidão que Entra**
3. **Comandante do Posto de Bombeiros (Conferência / Homologação)**

---

## 🖨️ 6. Impressão Oficial do Formulário (Anexo "D")

O sistema possui template de impressão dedicado (`ViewImpressao.html` e folha de estilo `@media print` em `Styles.html`):
* **FRENTE:** Reproduz o cabeçalho oficial da PMESP, dados da prontidão e as seções 1 a 7.
* **VERSO:** Reproduz as seções 8 a 12 e os 3 blocos de assinaturas e carimbos.
* Formatação ajustada para papel **A4 retrato**, sem cortes nem quebras indevidas de página.

---

## 🚀 7. Implantação e Deploy

### 7.1. Detalhes da Implantação Google Apps Script
* **Script ID:** `11oDSMY8t3B-1ZfTvxdTOx0NbrfpitQs-NKgea2pc6SzAVla1IyAgmisP`
* **Planilha Vinculada:** [Google Sheets 1JtIUA2hpvs2I9BVJ6yqHAi5Qzozo0sYkbRNS757EInQ](https://docs.google.com/spreadsheets/d/1JtIUA2hpvs2I9BVJ6yqHAi5Qzozo0sYkbRNS757EInQ/edit)
* **Deployment ID:** `AKfycbxfe4LMj7D2R2sXP6FddN993eOCtGWVsVWe2YOjBQkEc-aGWhKeL5tzjavPWPM6GHiH`
* **URL do Web App Publicado:**
  [https://script.google.com/macros/s/AKfycbxfe4LMj7D2R2sXP6FddN993eOCtGWVsVWe2YOjBQkEc-aGWhKeL5tzjavPWPM6GHiH/exec](https://script.google.com/macros/s/AKfycbxfe4LMj7D2R2sXP6FddN993eOCtGWVsVWe2YOjBQkEc-aGWhKeL5tzjavPWPM6GHiH/exec)

### 7.2. Execução de Testes Automatizados
```bash
# Executa a suíte de testes unitários e de integração
npm test
```

### 7.3. Execução do Servidor de Desenvolvimento Local
```bash
# Inicia o servidor local de simulação
npm start
# Acesse no navegador: http://localhost:3000
```

### 7.4. Atualização via Clasp
```bash
# Envia alterações para o Google Apps Script
npm run push

# Cria nova versão de deploy
npm run deploy
```

---

## 🧪 8. Relatório de Testes Executados

* **Testes de Unidade e Backend:** 8 suítes com 100% de aprovação (`node --test tests/backend.test.js`):
  1. Criação e verificação de integridade das 19 abas na planilha.
  2. População de dados semente (militares de exemplo, PBs e admin).
  3. Autenticação, política de troca de senha provisória e bloqueio após 5 tentativas.
  4. Cálculo de 24 horas e alternância cíclica das prontidões (incluindo viradas de mês e ano).
  5. Consulta de militares por RE formatado (`1º SGT PM — 108154-3 — André Fonseca Dias`).
  6. Prevenção de duplicatas de registro e cálculo de totais de viaturas.
  7. Validação formal das 3 autoridades e finalização de registro.
  8. Métricas de Dashboard e trilha de auditoria.
* **Teste Visual e Interativo no Navegador:** Validado via subagente de browser com gravação de sessão em vídeo WebP (`registro_atividades_demo`).