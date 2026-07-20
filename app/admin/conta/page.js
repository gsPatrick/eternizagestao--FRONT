"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * A antiga tela de Conta virou a área de Configurações (`/admin/configuracoes`).
 * Mantemos esta rota viva como redirecionamento para não quebrar links antigos.
 */
export default function AccountRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/configuracoes");
  }, [router]);

  return null;
}
