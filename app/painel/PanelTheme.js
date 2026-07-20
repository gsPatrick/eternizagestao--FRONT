"use client";

import { useEffect, useState } from "react";
import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";
import { normalizeApiTenant } from "@/lib/tenants";
import { getMe } from "@/lib/api/resources/me";

/**
 * Tema do PAINEL — aplica a marca/cores da CIDADE do usuário logado.
 *
 * No painel não há `?t=` nem subdomínio no dev/host do EasyPanel, então o tema
 * é resolvido pela SESSÃO: `GET /sessions/me` devolve o tenant do usuário (com
 * primaryColor/secondaryColor/logo). Passamos esse tenant resolvido direto ao
 * TenantTheme (sem depender do seletor/cookie) e SEM o switcher de demonstração.
 */
export default function PanelTheme({ children }) {
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    let alive = true;
    getMe()
      .then((me) => {
        if (alive && me?.tenant) setTenant(normalizeApiTenant(me.tenant));
      })
      .catch(() => {}); // sem tenant/erro → mantém o navy padrão
    return () => {
      alive = false;
    };
  }, []);

  return (
    <TenantTheme tenant={tenant || undefined} showSwitcher={false}>
      {children}
    </TenantTheme>
  );
}
