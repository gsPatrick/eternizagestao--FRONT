"use client";

/**
 * Tópico ÓRGÃO GESTOR — prefeitura/secretaria responsável (getOnboarding/
 * saveOnboarding). Espelha em documentHeader (cabeçalho dos documentos oficiais)
 * e em legalName/cnpj. Hook compartilhado → salva o payload completo.
 */
import Input from "@/components/atoms/Input/Input";
import Textarea from "@/components/atoms/Textarea/Textarea";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import Alert from "@/components/molecules/Alert/Alert";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import FormField from "@/components/molecules/FormField/FormField";

import { useOnboardingForm } from "../_lib/useOnboardingForm";
import { maskCnpj, maskPhoneBr } from "../_lib/helpers";
import { TopicHeader, SectionCard, SaveBar, Button } from "../_lib/ui";
import ui from "../_lib/ui.module.css";

export default function OrgaoGestorPage() {
  const { data, loading, error, refetch, form, set, canEdit, saving, feedback, handleSave } =
    useOnboardingForm();

  if (loading) return <TopicSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!form) return null;

  return (
    <div className={ui.topic}>
      <TopicHeader
        title="Órgão gestor"
        desc="Identificação da prefeitura/secretaria responsável — imprime no cabeçalho dos documentos oficiais."
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

      <SectionCard
        title="Dados do órgão gestor"
        desc="Nome, CNPJ e canais oficiais da administração responsável pelo cemitério."
      >
        <div className={ui.grid2}>
          <FormField label="Nome do órgão gestor" htmlFor="orgaoNome">
            <Input
              id="orgaoNome"
              placeholder="Prefeitura Municipal de…"
              value={form.orgaoNome}
              onChange={(e) => set("orgaoNome", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="CNPJ" htmlFor="orgaoCnpj">
            <Input
              id="orgaoCnpj"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={form.orgaoCnpj}
              onChange={(e) => set("orgaoCnpj", maskCnpj(e.target.value))}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="Telefone" htmlFor="orgaoTelefone">
            <Input
              id="orgaoTelefone"
              inputMode="tel"
              placeholder="(11) 0000-0000"
              value={maskPhoneBr(form.orgaoTelefone)}
              onChange={(e) => set("orgaoTelefone", maskPhoneBr(e.target.value))}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="E-mail" htmlFor="orgaoEmail">
            <Input
              id="orgaoEmail"
              type="email"
              placeholder="gabinete@cidade.gov.br"
              value={form.orgaoEmail}
              onChange={(e) => set("orgaoEmail", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
        </div>

        <FormField
          label="Cabeçalho do documento"
          htmlFor="orgaoCabecalho"
          hint="Texto no topo de guias, 2ª via e certidões (ex.: nome do cemitério, secretaria, endereço)."
        >
          <Textarea
            id="orgaoCabecalho"
            rows={3}
            placeholder="Prefeitura de… — Secretaria de Serviços Funerários · CNPJ 00.000.000/0000-00"
            value={form.orgaoCabecalho}
            onChange={(e) => set("orgaoCabecalho", e.target.value)}
            disabled={!canEdit}
          />
        </FormField>

        {/* Pré-visualização do cabeçalho do documento */}
        <div className={ui.docPreview}>
          <span className={ui.previewTag}>Cabeçalho de documentos</span>
          <div className={ui.docHead}>
            <strong>{form.orgaoNome || data?.name || "Órgão gestor"}</strong>
            {form.orgaoCabecalho && <p>{form.orgaoCabecalho}</p>}
            <div className={ui.docMeta}>
              {form.orgaoCnpj && <span>CNPJ {form.orgaoCnpj}</span>}
              {form.orgaoTelefone && <span>{form.orgaoTelefone}</span>}
              {form.orgaoEmail && <span>{form.orgaoEmail}</span>}
            </div>
          </div>
        </div>
      </SectionCard>

      {canEdit && (
        <SaveBar hint="O cabeçalho é aplicado aos novos documentos gerados após salvar.">
          <Button loading={saving} onClick={() => handleSave()}>
            Salvar órgão gestor
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
        <Skeleton variant="block" height={220} />
      </div>
    </div>
  );
}
