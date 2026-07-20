"use client";

/**
 * Login por cidade é ÚNICO (admin + Portal da Família no MESMO formulário, em
 * /login). Esta rota antiga (/portal/login) apenas REDIRECIONA para /login,
 * preservando a querystring (?t=<cidade>) — mantém convites/links de e-mail e
 * bookmarks funcionando sem tela de login separada.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PortalLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    const qs = typeof window !== "undefined" ? window.location.search : "";
    router.replace(`/login${qs}`);
  }, [router]);
  return null;
}
