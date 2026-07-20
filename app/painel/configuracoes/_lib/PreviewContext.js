"use client";

/**
 * Preview AO VIVO das Configurações. O layout (que renderiza o card da cidade
 * na sidebar) provê o contexto; os tópicos (identidade/órgão gestor/…) empurram
 * os valores do form EM TEMPO REAL — assim cor/logo/nome mudam na esquerda
 * enquanto o usuário edita, sem precisar salvar.
 */
import { createContext, useContext, useState, useCallback } from "react";

const PreviewCtx = createContext(null);

export function ConfigPreviewProvider({ children }) {
  const [preview, setPreviewState] = useState(null);
  const setPreview = useCallback((patch) => {
    setPreviewState((prev) => ({ ...(prev || {}), ...patch }));
  }, []);
  return (
    <PreviewCtx.Provider value={{ preview, setPreview }}>
      {children}
    </PreviewCtx.Provider>
  );
}

export function useConfigPreview() {
  return useContext(PreviewCtx) || { preview: null, setPreview: () => {} };
}
