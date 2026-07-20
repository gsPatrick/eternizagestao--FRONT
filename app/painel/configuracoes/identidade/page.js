"use client";

/**
 * Tópico IDENTIDADE VISUAL — cores + logo da cidade (getOnboarding/saveOnboarding).
 * Usa o hook compartilhado useOnboardingForm: hidrata o form COMPLETO e salva o
 * payload completo (concluir:false), então mexer só aqui nunca apaga as outras
 * seções. Estados loading→error→conteúdo; feedback via Alert; RBAC (só admin edita).
 */
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import Alert from "@/components/molecules/Alert/Alert";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import FormField from "@/components/molecules/FormField/FormField";
import LogoUpload from "@/components/molecules/LogoUpload/LogoUpload";

import { useOnboardingForm } from "../_lib/useOnboardingForm";
import { safeColor } from "../_lib/helpers";
import {
  TopicHeader,
  SectionCard,
  SaveBar,
  Button,
  ColorField,
  Swatch,
} from "../_lib/ui";
import ui from "../_lib/ui.module.css";

export default function IdentidadePage() {
  const { data, loading, error, refetch, form, set, canEdit, saving, feedback, handleSave } =
    useOnboardingForm();

  if (loading) return <TopicSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!form) return null;

  const primary = safeColor(form.primaryColor, "#032e59");
  const secondary = safeColor(form.secondaryColor, "#0a4a8c");
  const cityName = data?.name || "Sua cidade";

  return (
    <div className={ui.topic}>
      <TopicHeader
        title="Identidade visual"
        desc="Cores e logo da cidade aplicadas ao painel, ao portal da família e às telas públicas."
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
        title="Cores da marca"
        desc="Cor primária e secundária usadas em botões, destaques e navegação."
      >
        <div className={ui.grid2}>
          <ColorField
            label="Cor primária"
            hint="Cor principal (botões, destaques, navegação)."
            value={form.primaryColor}
            onChange={(v) => set("primaryColor", v)}
            disabled={!canEdit}
          />
          <ColorField
            label="Cor secundária"
            hint="Cor de apoio (realces e estados hover)."
            value={form.secondaryColor}
            onChange={(v) => set("secondaryColor", v)}
            disabled={!canEdit}
          />
        </div>

        <FormField
          label="Logo da cidade"
          hint="Envie uma imagem (PNG, JPEG ou SVG). Deixe em branco para usar só o nome."
        >
          <LogoUpload
            value={form.logoUrl}
            onChange={(url) => set("logoUrl", url)}
            disabled={!canEdit}
          />
        </FormField>

        {/* Pré-visualização ao vivo da marca */}
        <div
          className={ui.brandPreview}
          style={{ "--pv-primary": primary, "--pv-secondary": secondary }}
        >
          <span className={ui.previewTag}>Pré-visualização</span>
          <div className={ui.previewBar}>
            <span className={ui.previewLogo}>
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="Logo da cidade" />
              ) : (
                <span className={ui.previewMonogram}>
                  {cityName.trim().charAt(0).toUpperCase()}
                </span>
              )}
              <strong>{cityName}</strong>
            </span>
            <span className={ui.previewChip}>Portal da Família</span>
          </div>
          <div className={ui.previewButtons}>
            <span className={ui.previewBtnPrimary}>Ação principal</span>
            <span className={ui.previewBtnSecondary}>Ação secundária</span>
          </div>
          <div className={ui.previewSwatches}>
            <Swatch label="Primária" hex={primary} />
            <Swatch label="Secundária" hex={secondary} />
          </div>
        </div>
      </SectionCard>

      {canEdit && (
        <SaveBar hint="As alterações valem imediatamente no painel e no portal ao salvar.">
          <Button loading={saving} onClick={() => handleSave()}>
            Salvar identidade
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
        <Skeleton variant="block" height={200} />
      </div>
    </div>
  );
}
