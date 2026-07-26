"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/molecules/Modal/Modal";
import Button from "@/components/atoms/Button/Button";

/**
 * Modal global de AÇÃO BLOQUEADA pelo perfil.
 *
 * Quando o backend nega uma ação por RBAC (403 INSUFFICIENT_PERMISSION), o
 * cliente HTTP dispara o evento "rbac-denied" e este provider mostra um modal
 * explicando — em vez de a ação falhar com um erro seco, ou de o botão
 * simplesmente sumir (o operador precisa entender que a ação EXISTE, mas o
 * perfil dele não a permite).
 *
 * Fica montado uma vez no layout do painel; cobre todas as telas sem que cada
 * uma precise tratar o caso.
 */
export default function PermissionGuard({ children }) {
  const [denied, setDenied] = useState(null); // { message }

  useEffect(() => {
    function onDenied(e) {
      setDenied({ message: e.detail?.message || null });
    }
    window.addEventListener("rbac-denied", onDenied);
    return () => window.removeEventListener("rbac-denied", onDenied);
  }, []);

  return (
    <>
      {children}
      <Modal
        open={Boolean(denied)}
        onClose={() => setDenied(null)}
        title="Ação não permitida pelo seu perfil"
        width={440}
        footer={<Button onClick={() => setDenied(null)}>Entendi</Button>}
      >
        <p>
          {denied?.message
            || "Seu perfil de acesso não permite esta ação."}
        </p>
        <p style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
          Se você precisa desta permissão, peça a um administrador da cidade para
          ajustar o seu perfil em Configurações › Perfis de acesso.
        </p>
      </Modal>
    </>
  );
}
