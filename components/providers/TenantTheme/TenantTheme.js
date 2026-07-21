"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_TENANT,
  normalizeApiTenant,
  resolveTenant,
  themeVarsFor,
} from "@/lib/tenants";
import { getPublicTenants } from "@/lib/api/resources/public";
import styles from "./TenantTheme.module.css";

/**
 * TenantTheme — camada white label. Injeta a cor de acento do cliente nas
 * variáveis CSS (--color-navy e derivadas) SOMENTE nas telas do sistema
 * (painel, portal, login, consulta). A landing institucional não é envolvida,
 * então mantém o navy padrão. As cores semânticas (sucesso/erro) não mudam.
 *
 * A FONTE ÚNICA das cidades é a API (`GET /public/tenants`), resolvida no
 * cliente por slug/subdomínio. Se a API falhar/estiver offline, a lista fica
 * VAZIA e o tema cai no navy institucional (DEFAULT_TENANT) — nunca em uma
 * lista de prefeituras estática, que exibiria municípios que não são clientes.
 * O seletor de demonstração some quando não há cidades para listar.
 */

const STORAGE_KEY = "eterniza:tenant";
// Cache das variáveis de cor por subdomínio — lido pelo script anti-flash no
// <head> (app/layout.js) para pintar a cor da cidade já na 1ª renderização.
const THEME_VARS_KEY = "eterniza:themeVars";
const TenantContext = createContext(DEFAULT_TENANT);

// Lê o subdomínio da cidade do cookie setado pelo middleware (produção).
// Em dev o cookie não existe (middleware no-op) → null e cai no seletor. SSR-safe.
function readTenantCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)eterniza_tenant=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Guarda as variáveis de cor da cidade para o script anti-flash da próxima carga.
// Chaveado por subdomínio (evita mostrar a cor de outra cidade). SSR-safe.
function persistThemeVars(vars, sub) {
  if (typeof window === "undefined" || !sub) return;
  try {
    localStorage.setItem(`${THEME_VARS_KEY}:${sub}`, JSON.stringify(vars));
  } catch {
    /* localStorage indisponível (modo privado/cheio) — ignora */
  }
}

export function useTenant() {
  return useContext(TenantContext);
}

export default function TenantTheme({
  children,
  showSwitcher = true,
  forcedTenantId = null,
  tenant: tenantProp = null,
  // previewOnly: o tema vale SÓ para este subtree (ex.: preview do showcase na
  // landing da plataforma). NÃO escreve em :root nem no cache — assim o apex/
  // landing raiz permanece SEMPRE no navy, sem ser tingido pela demonstração.
  previewOnly = false,
}) {
  // tenantProp: chamador já resolveu o tenant (ex.: PanelShowcase) → não busca.
  // forcedTenantId: quando o tenant vem da URL (/guarulhos) e não do seletor.
  const [tenantId, setTenantId] = useState(forcedTenantId || DEFAULT_TENANT.id);
  const [list, setList] = useState([]); // só a API popula (sem lista inventada)
  const [open, setOpen] = useState(false);

  // Fonte da verdade: cidades da API. Se falhar, mantém o fallback (sem crash).
  useEffect(() => {
    if (tenantProp) return undefined; // já veio resolvido de fora
    let alive = true;
    getPublicTenants()
      .then((apiTenants) => {
        if (!alive || !Array.isArray(apiTenants) || apiTenants.length === 0) return;
        setList(apiTenants.map(normalizeApiTenant));
      })
      .catch(() => {}); // offline / erro → lista vazia (tema navy institucional)
    return () => {
      alive = false;
    };
  }, [tenantProp]);

  useEffect(() => {
    if (forcedTenantId || tenantProp) return; // URL/prop manda; ignora seletor
    // PRECEDÊNCIA do tenant: cookie eterniza_tenant (subdomínio, setado pelo
    // middleware) → `?t=` da URL (modo path, ex.: /login?t=lauro-de-freitas) →
    // localStorage (seletor de demo/dev) → default. Assim a marca da cidade
    // aparece nos DOIS modos (subdomínio e path).
    const fromCookie = readTenantCookie();
    const fromQuery =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("t")
        : null;
    const saved = fromCookie || fromQuery || localStorage.getItem(STORAGE_KEY);
    if (saved) setTenantId(saved);
  }, [forcedTenantId, tenantProp]);

  function pick(id) {
    setTenantId(id);
    localStorage.setItem(STORAGE_KEY, id);
    setOpen(false);
  }

  const activeId = forcedTenantId || tenantId;
  // resolve na lista viva da API; sem match (ou API fora) cai no navy institucional.
  const tenant = tenantProp || resolveTenant(list, activeId) || DEFAULT_TENANT;
  // Sem cidades carregadas não há o que trocar → esconde o seletor de demo.
  const canSwitch =
    showSwitcher && !forcedTenantId && !tenantProp && list.length > 0;

  const themeVars = themeVarsFor(tenant);

  // Aplica as variáveis da marca também no <html> (:root) — assim elas alcançam
  // os PORTAIS (modais/toasts renderizados em document.body, FORA do div do
  // tema). Sem isto, os botões dentro de modais caem no navy padrão do sistema.
  // Também GRAVA o cache por subdomínio para o script anti-flash da próxima carga
  // (só quando é uma cidade real — nunca sobrescreve com o navy padrão).
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    // previewOnly: NÃO propaga para :root nem grava cache — o tema fica contido
    // no <div> deste subtree (via scopeVars abaixo). Protege o apex/landing.
    if (previewOnly) return undefined;
    const root = document.documentElement;
    const entries = Object.entries(themeVars);
    entries.forEach(([k, v]) => root.style.setProperty(k, v));
    if (tenant.id !== DEFAULT_TENANT.id) {
      // chave = rótulo PURO do subdomínio (mesmo valor do cookie eterniza_tenant),
      // não o domínio de exibição. apiSubdomain vem do normalizeApiTenant.
      persistThemeVars(themeVars, tenant.apiSubdomain || readTenantCookie());
    }
    return () => entries.forEach(([k]) => root.style.removeProperty(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.accent, tenant.accentRgb, tenant.accentBright, tenant.accentDeep, tenant.id, previewOnly]);

  // Escopo por <div> (variáveis inline) quando o tenant é resolvido de forma
  // determinística e igual no SSR e no cliente: showcase (tenantProp), URL
  // (forcedTenantId) ou preview isolado. No caso normal (resolvido por cookie/API
  // só no cliente) as vars inline no SSR seriam navy e "sombreariam" o subtree →
  // flash; então deixamos herdar do :root, que o script anti-flash já pintou.
  const scopeVars = forcedTenantId || tenantProp || previewOnly;

  return (
    <TenantContext.Provider value={tenant}>
      <div className={styles.root} style={scopeVars ? themeVars : undefined}>
        {children}

        {/* seletor de demonstração — só existe para mostrar o white label */}
        {canSwitch && (
          <div className={styles.switcher}>
            {open && (
              <div className={styles.menu}>
                <span className={styles.menuLabel}>Ver como (demo white label)</span>
                {list.map((t) => (
                  <button
                    key={t.id}
                    className={`${styles.option} ${t.id === activeId ? styles.optionActive : ""}`}
                    onClick={() => pick(t.id)}
                  >
                    <span className={styles.swatch} style={{ background: t.accent }} />
                    <span className={styles.optionBody}>
                      <strong>{t.name}</strong>
                      {t.subdomain}
                    </span>
                    {t.id === activeId && (
                      <svg viewBox="0 0 16 16" fill="none" className={styles.check}>
                        <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button className={styles.trigger} onClick={() => setOpen((v) => !v)} aria-label="Trocar tenant (demo)">
              <span className={styles.triggerSwatch} style={{ background: tenant.accent }} />
              <span className={styles.triggerText}>{tenant.brandLead}</span>
              <svg viewBox="0 0 16 16" fill="none" className={styles.triggerChevron}>
                <path d="m4 10 4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </TenantContext.Provider>
  );
}
