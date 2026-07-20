"use client";

/**
 * Tópico CONTATO & ENDEREÇO — canais + endereço público (getOnboarding/
 * saveOnboarding). CEP com autopreenchimento via ViaCEP e máscaras BR, igual ao
 * onboarding. Hook compartilhado → salva o payload completo (concluir:false).
 */
import { useState } from "react";
import Input from "@/components/atoms/Input/Input";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import Alert from "@/components/molecules/Alert/Alert";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import FormField from "@/components/molecules/FormField/FormField";
import { maskCep } from "@/lib/masks";

import { useOnboardingForm } from "../_lib/useOnboardingForm";
import { maskPhoneBr } from "../_lib/helpers";
import { TopicHeader, SectionCard, SaveBar, Button } from "../_lib/ui";
import ui from "../_lib/ui.module.css";

export default function ContatoPage() {
  const { form, set, patch, loading, error, refetch, canEdit, saving, feedback, handleSave } =
    useOnboardingForm();

  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState(false);

  // Digitou o CEP (8 díg.) → busca no ViaCEP e preenche logradouro/bairro/cidade/UF.
  async function onCep(raw) {
    const masked = maskCep(raw);
    set("addressZipcode", masked);
    setCepError(false);
    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const j = await res.json();
      if (j && !j.erro) {
        patch({
          addressStreet: j.logradouro || form.addressStreet || "",
          addressDistrict: j.bairro || form.addressDistrict || "",
          addressCity: j.localidade || form.addressCity || "",
          addressState: (j.uf || form.addressState || "").toUpperCase(),
        });
      } else {
        setCepError(true);
      }
    } catch {
      setCepError(true); // ViaCEP indisponível → segue no preenchimento manual
    } finally {
      setCepLoading(false);
    }
  }

  if (loading) return <TopicSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!form) return null;

  return (
    <div className={ui.topic}>
      <TopicHeader
        title="Contato & endereço"
        desc="Canais e endereço público da cidade — exibidos no portal da família e nas telas públicas."
      />

      {!canEdit && (
        <Alert tone="info" title="Somente leitura">
          Seu perfil pode visualizar as configurações, mas não alterá-las. Peça a
          um administrador da cidade para editar estes dados.
        </Alert>
      )}
      {feedback && (
        <Alert tone={feedback.tone} title={feedback.title}>
          {feedback.msg}
        </Alert>
      )}

      <SectionCard title="Canais de atendimento" desc="Como as famílias entram em contato com a cidade.">
        <div className={ui.grid3}>
          <FormField label="E-mail de contato" htmlFor="email">
            <Input
              id="email"
              type="email"
              placeholder="contato@cidade.gov.br"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="Telefone" htmlFor="phone">
            <Input
              id="phone"
              inputMode="tel"
              placeholder="(11) 0000-0000"
              value={maskPhoneBr(form.phone)}
              onChange={(e) => set("phone", maskPhoneBr(e.target.value))}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="WhatsApp" htmlFor="whatsapp">
            <Input
              id="whatsapp"
              inputMode="tel"
              placeholder="(11) 90000-0000"
              value={maskPhoneBr(form.whatsapp)}
              onChange={(e) => set("whatsapp", maskPhoneBr(e.target.value))}
              disabled={!canEdit}
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Endereço" desc="Digite o CEP para preencher o endereço automaticamente.">
        <div className={ui.addressGrid}>
          <FormField
            label="CEP"
            htmlFor="addressZipcode"
            className={ui.colCep}
            hint={
              cepLoading
                ? "Buscando endereço…"
                : cepError
                  ? "CEP não encontrado — preencha manualmente."
                  : "Digite o CEP para preencher o endereço."
            }
          >
            <Input
              id="addressZipcode"
              inputMode="numeric"
              placeholder="00000-000"
              value={form.addressZipcode}
              onChange={(e) => onCep(e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="Logradouro" htmlFor="addressStreet" className={ui.colStreet}>
            <Input
              id="addressStreet"
              placeholder="Av. / Rua…"
              value={form.addressStreet}
              onChange={(e) => set("addressStreet", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="Número" htmlFor="addressNumber" className={ui.colNumber}>
            <Input
              id="addressNumber"
              value={form.addressNumber}
              onChange={(e) => set("addressNumber", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="Complemento" htmlFor="addressComplement" className={ui.colComplement}>
            <Input
              id="addressComplement"
              value={form.addressComplement}
              onChange={(e) => set("addressComplement", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="Bairro" htmlFor="addressDistrict" className={ui.colDistrict}>
            <Input
              id="addressDistrict"
              value={form.addressDistrict}
              onChange={(e) => set("addressDistrict", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="Cidade" htmlFor="addressCity" className={ui.colCity}>
            <Input
              id="addressCity"
              value={form.addressCity}
              onChange={(e) => set("addressCity", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="UF" htmlFor="addressState" className={ui.colUf}>
            <Input
              id="addressState"
              maxLength={2}
              placeholder="SP"
              value={form.addressState}
              onChange={(e) =>
                set("addressState", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
              }
              disabled={!canEdit}
            />
          </FormField>
        </div>
      </SectionCard>

      {canEdit && (
        <SaveBar hint="O endereço e os canais aparecem no portal da família ao salvar.">
          <Button loading={saving} onClick={() => handleSave()}>
            Salvar contato
          </Button>
        </SaveBar>
      )}
    </div>
  );
}

function TopicSkeleton() {
  return (
    <div className={ui.topic}>
      <Skeleton variant="line" width="30%" height={22} />
      <div className={ui.card}>
        <Skeleton variant="line" width="40%" height={16} />
        <div style={{ height: 16 }} />
        <Skeleton variant="block" height={160} />
      </div>
    </div>
  );
}
