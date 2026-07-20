"use client";

/**
 * Rede de segurança do onboarding para quem JÁ estava logado.
 *
 * O caminho principal de primeiro acesso é o redirect do /login (admin com
 * tenant `pendente` → /onboarding). Este guard cobre a sessão pré-existente:
 * ao entrar em qualquer tela do painel, se o admin ainda está `pendente`,
 * leva-o UMA vez ao /onboarding.
 *
 * Sem loop e sem "prender" o admin: se ele escolher "Salvar e continuar depois"
 * no wizard, marcamos SKIP_KEY (sessionStorage) e o guard não insiste mais
 * nesta sessão. Renderiza null — é só efeito.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, isAuthed } from "@/lib/api/session";
import { getOnboarding } from "@/lib/api/resources/tenant";

const EDIT_ROLES = new Set(["admin", "super_admin"]);
const SKIP_KEY = "eterniza:onboarding-skip";

export default function OnboardingGuard() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthed()) return; // não autenticado → o próprio painel/API cuida do 401
    const user = getUser();
    if (!user || !EDIT_ROLES.has(user.role)) return; // só admin da cidade
    if (sessionStorage.getItem(SKIP_KEY)) return; // já optou por "continuar depois"

    let alive = true;
    getOnboarding()
      .then((t) => {
        if (!alive) return;
        if (t?.onboardingStatus === "pendente") router.replace("/onboarding");
      })
      .catch(() => {}); // 403/erro → não incomoda; segue no painel
    return () => {
      alive = false;
    };
  }, [router]);

  return null;
}
