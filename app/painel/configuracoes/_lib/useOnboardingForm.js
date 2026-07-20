"use client";

/**
 * Hook compartilhado pelos tópicos que editam o ONBOARDING/config da cidade
 * (identidade, órgão gestor, contato). Todos carregam a MESMA config (getOnboarding)
 * e salvam o payload COMPLETO (toPatchPayload) — assim editar só uma seção nunca
 * apaga as outras, pois o form é hidratado com todos os campos.
 *
 * `concluir:false` sempre → em Configurações a intenção é ALTERAR, nunca forçar
 * a conclusão do onboarding (isso é feito no fluxo de primeiro acesso).
 */
import { useEffect, useMemo, useState } from "react";
import { useResource, useMutation } from "@/lib/api/useResource";
import { getUser } from "@/lib/api/session";
import {
  getOnboarding,
  saveOnboarding,
  toFormState,
  toPatchPayload,
} from "@/lib/api/resources/tenant";
import { EDIT_ROLES } from "./helpers";

export function useOnboardingForm() {
  const { data, loading, error, refetch } = useResource(getOnboarding, []);
  const { mutate: save, loading: saving } = useMutation(saveOnboarding);

  const [form, setForm] = useState(null);
  const [feedback, setFeedback] = useState(null); // { tone, title?, msg }

  const canEdit = useMemo(() => EDIT_ROLES.has(getUser()?.role), []);

  useEffect(() => {
    if (data) setForm(toFormState(data));
  }, [data]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function patch(obj) {
    setForm((f) => ({ ...f, ...obj }));
  }

  // Salva o payload completo (preserva as outras seções). validate() opcional
  // retorna string de erro para exibir sem chamar a API.
  async function handleSave(validate) {
    setFeedback(null);
    if (typeof validate === "function") {
      const err = validate(form);
      if (err) {
        setFeedback({ tone: "danger", title: "Revise os campos", msg: err });
        scrollTop();
        return false;
      }
    }
    try {
      const updated = await save(toPatchPayload(form, { concluir: false }));
      setForm(toFormState(updated));
      setFeedback({
        tone: "success",
        title: "Alterações salvas",
        msg: "Suas alterações foram gravadas e já valem no sistema.",
      });
      refetch();
      scrollTop();
      return true;
    } catch (err) {
      const forbidden = err?.status === 403;
      setFeedback({
        tone: "danger",
        title: forbidden ? "Sem permissão" : "Não foi possível salvar",
        msg: forbidden
          ? "Apenas administradores da cidade podem alterar estas configurações."
          : err?.message || "Ocorreu um erro ao salvar. Tente novamente.",
      });
      return false;
    }
  }

  return {
    data,
    loading,
    error,
    refetch,
    form,
    set,
    patch,
    canEdit,
    saving,
    feedback,
    setFeedback,
    handleSave,
  };
}

function scrollTop() {
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
}
