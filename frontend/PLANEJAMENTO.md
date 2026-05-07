# Planejamento Frontend — Organizador Financeiro

Documento de planejamento da construção inicial do frontend React (CRA, React 19).
Escopo desta etapa: **apenas a carcaça visual da página de Login**, sem integração com o backend.

---

## 1. Objetivo desta etapa

Entregar uma página de login estática com:

- Campos: **email** e **senha**.
- Layout em **card central** na tela (centralizado vertical e horizontalmente).
- Estética **clara, moderna**, com **bordas arredondadas** em card, inputs e botão.
- **Hover suave** em botão e inputs (transições CSS).
- Sem chamadas à API, sem rotas protegidas, sem lógica de autenticação real.
- Submit do form apenas faz `console.log` dos valores (placeholder).

Fora de escopo (etapas futuras): roteamento, dashboard, integração `/auth/login`, persistência de token, validações avançadas, recuperação de senha.

---

## 2. Stack e decisões

- **React 19 + CRA** (já configurado em `package.json`).
- **CSS puro com CSS Modules** (`*.module.css`) — sem adicionar dependências (Tailwind, styled-components, MUI) nesta etapa, para manter a base enxuta.
- **Variáveis CSS** (`:root`) para a paleta, facilitando trocar tema depois.
- **Estrutura por feature/página**, escalável para próximas telas (dashboard, lançamentos etc.).
- Nenhuma alteração em arquivos fora de `frontend/`.

---

## 3. Arquitetura de pastas (alvo)

Estrutura simples e legível, preparada para crescer sem refatoração grande:

```
frontend/
├── src/
│   ├── index.js                  # entry point (já existe)
│   ├── index.css                 # reset + variáveis globais (paleta, raios, sombras)
│   ├── App.js                    # raiz; por enquanto renderiza <LoginPage/>
│   ├── App.css                   # (mantido, mas limpo do conteúdo do CRA template)
│   │
│   ├── pages/
│   │   └── Login/
│   │       ├── Login.jsx         # componente da página
│   │       └── Login.module.css  # estilos isolados da página
│   │
│   └── components/               # criado vazio nesta etapa, p/ futuros reuso
│       └── (futuros: Button, Input, Card...)
```

Notas:

- Renomear `pages/login.js` → `pages/Login/Login.jsx` (PascalCase para componentes/pastas de página).
- `components/` fica preparado para extrair `Button`, `Input`, `Card` quando houver reuso real (não criar agora — evitar abstração prematura).

---

## 4. Paleta e tokens visuais (proposta)

Definidos em `:root` no `index.css`:

| Token              | Valor sugerido    | Uso                          |
|--------------------|-------------------|------------------------------|
| `--color-bg`       | `#f5f7fb`         | Fundo da página              |
| `--color-surface`  | `#ffffff`         | Card                         |
| `--color-primary`  | `#4f7cff`         | Botão, foco                  |
| `--color-primary-hover` | `#3a64e0`    | Hover do botão               |
| `--color-text`     | `#1f2937`         | Texto principal              |
| `--color-text-muted` | `#6b7280`       | Labels, placeholders         |
| `--color-border`   | `#e5e7eb`         | Borda de inputs              |
| `--radius-md`      | `12px`            | Inputs e botão               |
| `--radius-lg`      | `20px`            | Card                         |
| `--shadow-card`    | `0 10px 30px rgba(31,41,55,.08)` | Sombra do card |
| `--transition`     | `all .2s ease`    | Hover suave                  |

---

## 5. Etapas de implementação (passo a passo)

Cada etapa é pequena e verificável visualmente com `npm start`.

### Etapa 1 — Reset e tokens globais
1. Em `src/index.css`: adicionar reset mínimo (`*, *::before, *::after { box-sizing: border-box }`, `html, body, #root { height: 100% }`).
2. Definir variáveis CSS (paleta, raios, sombra, transição) em `:root`.
3. Aplicar `background: var(--color-bg)` e `color: var(--color-text)` no `body`.

### Etapa 2 — Reorganização da página de Login
1. Criar pasta `src/pages/Login/`.
2. Criar `Login.jsx` (renomeando o atual `pages/login.js`) com o componente funcional.
3. Criar `Login.module.css` ao lado.
4. Remover o arquivo antigo `pages/login.js` após migrar o conteúdo.
5. Atualizar import em `App.js`: `import LoginPage from './pages/Login/Login';`.

### Etapa 3 — Layout do card central
1. Wrapper de tela (`.screen`) ocupando `min-height: 100vh`, com `display: flex`, `align-items: center`, `justify-content: center`, `padding: 24px`.
2. Card (`.card`):
   - `background: var(--color-surface)`
   - `border-radius: var(--radius-lg)`
   - `box-shadow: var(--shadow-card)`
   - `padding: 40px 32px`
   - `width: 100%`, `max-width: 400px`
3. Título "Entrar" + subtítulo curto (ex.: "Acesse sua conta").

### Etapa 4 — Campos de formulário
1. Estrutura: `<label>` + `<input>` empilhados, espaçamento consistente (gap 16px).
2. Inputs:
   - `border: 1px solid var(--color-border)`
   - `border-radius: var(--radius-md)`
   - `padding: 12px 14px`
   - `transition: var(--transition)`
   - `:focus` → `border-color: var(--color-primary)`, leve `box-shadow` de foco.
3. Tipos corretos: `type="email"`, `type="password"`, ambos `required`.

### Etapa 5 — Botão "Entrar"
1. Largura total do card (`width: 100%`).
2. `background: var(--color-primary)`, texto branco.
3. `border-radius: var(--radius-md)`, `padding: 12px`, `font-weight: 600`.
4. `transition: var(--transition)`.
5. `:hover` → `background: var(--color-primary-hover)` + leve `transform: translateY(-1px)`.
6. `:active` → desfaz o `translateY`.
7. `cursor: pointer`.

### Etapa 6 — Estado e submit (placeholder)
1. Manter `useState` para `email` e `password` (já existe).
2. `handleSubmit`: `e.preventDefault()` + `console.log({ email, password })`.
3. **Sem** integração com backend, **sem** validação extra além do `required` nativo.

### Etapa 7 — Polimento e responsividade
1. Verificar em larguras pequenas (mobile): card com `max-width: 400px` e `padding` lateral da `.screen` já garante respiro.
2. Testar foco por teclado (acessibilidade básica): `outline` visível no `:focus-visible`.
3. Limpar `App.css` de resquícios do template CRA (logo girando etc.).

### Etapa 8 — Verificação final
1. `npm start` em `frontend/`.
2. Conferir: card centralizado, hover suave no botão, foco azul nos inputs, layout limpo.
3. Confirmar console.log ao submeter.

---

## 6. Critérios de aceite

- [ ] Página abre em `http://localhost:3000` e mostra um card centralizado.
- [ ] Card, inputs e botão têm cantos arredondados.
- [ ] Hover do botão é visivelmente suave (transição, não “snap”).
- [ ] Inputs mostram destaque azul ao focar.
- [ ] Submeter o form imprime `{ email, password }` no console.
- [ ] Nenhum arquivo fora de `frontend/` foi alterado.

---

## 7. Próximos passos (fora desta etapa)

Apenas para registro, **não implementar agora**:

1. Adicionar `react-router-dom` e definir rotas `/login` e `/dashboard`.
2. Criar `services/api.js` (cliente HTTP) e integrar `POST /auth/login`.
3. Persistir token (provavelmente `localStorage`) e criar guarda de rota.
4. Extrair `Button`, `Input`, `Card` para `components/` quando houver 2º uso real.
5. Página de dashboard com listagem de lançamentos.

---

## 8. Restrições combinadas

- Trabalhar **somente** dentro de `frontend/`.
- Qualquer necessidade de tocar em arquivos fora dessa pasta exige **confirmação prévia** do usuário.
- Não adicionar dependências novas nesta etapa (sem Tailwind, MUI, styled-components, react-router etc.).
