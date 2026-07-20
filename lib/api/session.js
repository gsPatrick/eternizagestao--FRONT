/**
 * Sessão do usuário — persistência local dos tokens/identidade.
 * SSR-safe: toda leitura/escrita checa `typeof window` antes de tocar em
 * localStorage, então estes helpers podem ser importados em qualquer módulo.
 *
 * Os nomes de campo espelham o retorno do login da API:
 *   - admin  (POST /sessions):        { user, accessToken, refreshToken }
 *   - família (POST /portal/sessions): { person (→ user), accessToken }
 * Guardamos o access token como `token`; `refreshToken` pode não existir
 * (o portal da família não emite refresh).
 */

const TOKEN_KEY = "eterniza.token";
const REFRESH_KEY = "eterniza.refresh";
const USER_KEY = "eterniza.user";

const hasWindow = () => typeof window !== "undefined";

/**
 * Grava a sessão. Aceita o resultado cru do login — normaliza `accessToken`
 * para `token` e `person` para `user`, então as páginas podem só fazer
 * `setSession(result)`.
 */
export function setSession(session = {}) {
  if (!hasWindow()) return;
  const token = session.token ?? session.accessToken ?? null;
  const refreshToken = session.refreshToken ?? null;
  const user = session.user ?? session.person ?? null;

  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);

  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  else localStorage.removeItem(REFRESH_KEY);

  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function getToken() {
  if (!hasWindow()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  if (!hasWindow()) return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getUser() {
  if (!hasWindow()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  if (!hasWindow()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthed() {
  return Boolean(getToken());
}
