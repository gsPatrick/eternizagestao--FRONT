# lib/api — Contrato de integração com a API

Fundação que **todas** as páginas do painel/portal reusam. Só `fetch` nativo,
SSR-safe, sem dependências novas (nada de SWR/axios).

## Arquivos

| Arquivo | O que expõe |
| --- | --- |
| `client.js` | `apiFetch`, `api` (`get/post/patch/put/del`), `ApiError` |
| `session.js` | `setSession`, `getToken`, `getRefreshToken`, `getUser`, `clearSession`, `isAuthed` |
| `useResource.js` | `useResource(fetcher, deps)`, `useMutation(mutateFn)` |

Base URL vem de `NEXT_PUBLIC_API_URL` (`.env.local`) → `http://localhost:3333/api/v1`.
Suba a API com `APP_PORT=3333` (o default 3000 conflita com o Next).

## `apiFetch(path, opts)` — assinatura e retorno

```js
apiFetch(path, {
  method = "GET",
  body,            // objeto → JSON.stringify
  params,          // querystring; ignora undefined/null/'' automaticamente
  tenant,          // header X-Tenant-Subdomain (rotas públicas/portal)
  auth = true,     // anexa Authorization: Bearer <getToken()> se houver token
  meta = false,    // ver "listas paginadas" abaixo
  signal,          // AbortSignal (o useResource passa sozinho)
})
```

**Retorno — padrão único:**

- Sucesso normal → retorna **`data`** já desembrulhado do envelope
  `{ success, data }`. Ou seja, você NÃO vê `success`/`data`, recebe o conteúdo.
- **Listas paginadas** → passe `{ meta: true }` e receba **`{ data, meta }`**
  (o `meta` traz paginação: `page`, `perPage`, `total`, etc.).
- Erro (`!res.ok` ou `success:false`) → **lança `ApiError`** com
  `{ message, code, status, details }`.
- `401` (fora de `/login`) → limpa a sessão e redireciona para `/login`
  automaticamente.

Atalhos: `api.get(path, opts)`, `api.post(path, body, opts)`,
`api.patch(path, body, opts)`, `api.put(path, body, opts)`, `api.del(path, opts)`.

No painel autenticado **não** passe `tenant`: a API resolve o tenant pelo token.
`tenant` só em rotas públicas/portal (`X-Tenant-Subdomain`).

## Como criar um resource — `lib/api/resources/<feature>.js`

Funções finas, uma por endpoint. Sem estado, sem React.

```js
// lib/api/resources/graves.js
import { api } from "@/lib/api/client";

// LISTA paginada → { meta: true } → devolve { data, meta }
export const listGraves = (params, opts) =>
  api.get("/graves", { params, meta: true, ...opts });

// item único → devolve o objeto direto
export const getGrave = (id, opts) => api.get(`/graves/${id}`, opts);

export const createGrave = (body) => api.post("/graves", body);
export const updateGrave = (id, body) => api.patch(`/graves/${id}`, body);
export const deleteGrave = (id) => api.del(`/graves/${id}`);
```

## Como usar numa página client

```jsx
"use client";
import { useResource, useMutation } from "@/lib/api/useResource";
import { listGraves, deleteGrave } from "@/lib/api/resources/graves";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import Button from "@/components/atoms/Button/Button";

export default function GravesPage() {
  const [page, setPage] = useState(1);

  // fetcher recebe { signal } e repassa pro client → cancelamento automático.
  // Como listGraves usa meta:true, o `data` resolvido é { data, meta }.
  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listGraves({ page }, { signal }),
    [page]
  );
  const rows = data?.data ?? [];
  const meta = data?.meta; // { page, perPage, total, ... } para a paginação

  // ---- PADRÃO OBRIGATÓRIO DE RENDER (regra de ouro) ----
  if (loading) return <Skeleton variant="row" count={6} />;      // no formato do layout
  if (error) return <ErrorState onRetry={refetch} />;
  if (!rows.length)
    return (
      <EmptyState
        title="Nenhuma sepultura cadastrada"
        message="Comece cadastrando a primeira sepultura deste cemitério."
        action={<Button onClick={/* abrir modal */}>Cadastrar sepultura</Button>}
      />
    );

  return (/* tabela/grid com rows + paginação via meta */);
}
```

`useMutation` para ações (criar/editar/excluir):

```jsx
const { mutate: remove, loading: removing } = useMutation(deleteGrave);
async function onDelete(id) {
  try {
    await remove(id);   // relança ApiError em falha
    refetch();
  } catch (e) {
    // e.message já é amigável (vem do envelope de erro da API)
  }
}
```

### Ordem de render — sempre nesta sequência

1. **`loading`** → `<Skeleton .../>` no **formato do layout** (linhas de tabela,
   cards, etc.) — nunca um spinner solto no meio da página.
2. **`error`** → `<ErrorState onRetry={refetch} />`.
3. **vazio** (`!data?.length`) → `<EmptyState .../>` com uma frase da identidade
   Eterniza (nunca um branco solto).
4. **conteúdo**.

## Regra de ouro: o FRONT manda

O front é a fonte da verdade do shape que a página consome. Se a API **não**
devolver os dados no formato que a página precisa, o agente daquela página
**ajusta a feature correspondente na API** para servir o shape certo —
**sem quebrar auditoria, notificações ou controle de concorrência**. Não
contorne no front com adaptações frágeis: corrija na origem.

## Sessão (login/logout)

```js
import { setSession, clearSession, getUser, isAuthed } from "@/lib/api/session";

// após o login, passe o resultado cru — setSession normaliza accessToken→token
// e person→user (o portal da família não emite refreshToken):
setSession(result);   // { user|person, accessToken, refreshToken? }

clearSession();       // logout
```

Chaves em localStorage: `eterniza.token`, `eterniza.refresh`, `eterniza.user`.
