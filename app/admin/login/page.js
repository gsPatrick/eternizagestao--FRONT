"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * O login do super_admin agora é o login administrativo único em `/login`.
 * Esta rota é mantida viva por compatibilidade e apenas redireciona pra lá.
 */
export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}
