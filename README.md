# Eterniza Gestão — Frontend

Interface do Sistema de Gestão de Cemitérios (multi-tenant / white label).

## Stack
- Next.js 14 (App Router) · JavaScript · CSS Modules · Atomic Design
- Sem TypeScript, sem Tailwind, sem bibliotecas de UI externas

## Identidade visual
- Acento institucional: `#032e59` (navy)
- Fundo: branco/cinza (`#f4f6f9` canvas · `#ffffff` superfícies)
- Display: Fraunces · Corpo: Inter
- Tokens completos em `app/globals.css`

## Rodar

```bash
npm install
npm run dev
# http://localhost:3000/design-system
```

## Estrutura

```
app/
  layout.js · globals.css (tokens)
  design-system/          ← página de aprovação do sistema visual
components/
  atoms/       Button, Input, Select, Textarea, Checkbox, Switch, Badge, Avatar, Spinner
  molecules/   FormField, Modal, Tabs, Alert, StatCard, Pagination
  organisms/   DataTable
```

Regras: cada componente isolado com seu `.module.css`; nenhum estilo inline; novas
páginas em `app/<rota>/page.js` + `page.module.css`, compostas pelos componentes acima.
