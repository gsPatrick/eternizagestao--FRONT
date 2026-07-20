"use client";

/**
 * Onboarding de PRIMEIRO ACESSO do admin da cidade (tenant `pendente`).
 * Rota full-screen (fora do /painel, sem sidebar): lateral navy reaproveitada
 * do login (AuthVisual) + wizard em passos à direita. Depois de concluído, o
 * lugar de ALTERAR é /painel/configuracoes.
 *
 * Reaproveita a fundação (useResource/useMutation) e o resource do tenant
 * (getOnboarding, saveOnboarding, toFormState, toPatchPayload) — mesma lógica,
 * máscaras e previews de Configurações, aqui num fluxo guiado.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";
import AuthVisual from "@/components/organisms/AuthVisual/AuthVisual";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Textarea from "@/components/atoms/Textarea/Textarea";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import FormField from "@/components/molecules/FormField/FormField";
import LogoUpload from "@/components/molecules/LogoUpload/LogoUpload";
import Alert from "@/components/molecules/Alert/Alert";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";

import { useResource, useMutation } from "@/lib/api/useResource";
import { getUser, isAuthed } from "@/lib/api/session";
import { maskPhone, maskCep, isValidEmail } from "@/lib/masks";
import {
  getOnboarding,
  saveOnboarding,
  toFormState,
  toPatchPayload,
} from "@/lib/api/resources/tenant";

// Papéis que podem configurar a cidade (a API também garante: 403 caso contrário).
const EDIT_ROLES = new Set(["admin", "super_admin"]);
// Flag de "deixei pra depois" — evita que o guard do painel devolva o admin
// pendente pro onboarding em loop (ver app/painel/OnboardingGuard.js).
const SKIP_KEY = "eterniza:onboarding-skip";

// CNPJ 00.000.000/0000-00 (não há maskCnpj na fundação → mesmo helper de Config).
function maskCnpj(value = "") {
  const d = String(value).replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// Telefone/WhatsApp BR: descarta o DDI (+55) antes de formatar — senão maskPhone
// (11 díg.) formataria errado um número com código de país.
function maskPhoneBr(value = "") {
  let d = String(value).replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return maskPhone(d);
}

function isHex(v) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v || ""));
}
function safeColor(v, fallback) {
  return isHex(v) ? v : fallback;
}

// ---- derivação de tons a partir da cor escolhida (para tingir a lateral) ----
function hexToRgbParts(hex) {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbStr(hex, fallback) {
  const p = hexToRgbParts(hex) || hexToRgbParts(fallback) || [3, 46, 89];
  return p.join(", ");
}
function darken(hex, amount, fallback) {
  const p = hexToRgbParts(hex) || hexToRgbParts(fallback) || [3, 46, 89];
  const d = p.map((c) => Math.max(0, Math.round(c * (1 - amount))));
  return `#${d.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// Tokens navy derivados das cores do formulário → tingem a lateral (AuthVisual)
// ao vivo conforme o admin escolhe as cores no passo Identidade.
// Sempre retorna um tema (default navy quando o form ainda não carregou) — assim
// a tela NUNCA mostra a cor de fallback do tenant (evita o flash verde→azul):
// parte do navy e transiciona para a cor escolhida quando os dados chegam.
function brandTheme(form) {
  const primary = safeColor(form?.primaryColor, "#032e59");
  const secondary = safeColor(form?.secondaryColor, "#0a4a8c");
  return {
    "--color-navy": primary,
    "--color-navy-bright": secondary,
    "--color-navy-deep": darken(primary, 0.42, "#032e59"),
    "--color-navy-rgb": rgbStr(primary, "#032e59"),
    transition: "background-color 0.35s var(--ease-out)",
  };
}

// Passos do wizard (0 = boas-vindas). O stepper mostra os 4.
const STEPS = [
  { key: "welcome", label: "Boas-vindas" },
  { key: "brand", label: "Identidade" },
  { key: "org", label: "Órgão gestor" },
  { key: "contact", label: "Contato" },
];

export default function OnboardingPage() {
  return (
    <TenantTheme showSwitcher={false}>
      <OnboardingWizard />
    </TenantTheme>
  );
}

function OnboardingWizard() {
  const router = useRouter();
  const { data, loading, error, refetch } = useResource(getOnboarding, []);
  const { mutate: save, loading: saving } = useMutation(saveOnboarding);

  const [form, setForm] = useState(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tone, title?, msg }

  const user = useMemo(() => getUser(), []);
  const adminName = (user?.name || "").trim().split(/\s+/)[0] || "";

  // ---- Guard de sessão/papel (client-side; a API também protege) ----------
  useEffect(() => {
    if (!isAuthed()) {
      router.replace("/login");
      return;
    }
    if (user && !EDIT_ROLES.has(user.role)) {
      router.replace("/painel");
    }
  }, [router, user]);

  // ---- Se já concluiu, não reabre o fluxo → painel -------------------------
  useEffect(() => {
    if (!data) return;
    if (data.onboardingStatus === "concluido") {
      router.replace("/painel");
      return;
    }
    setForm(toFormState(data));
  }, [data, router]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // atualiza vários campos de uma vez (ViaCEP preenche logradouro/bairro/cidade/UF).
  function patch(obj) {
    setForm((f) => ({ ...f, ...obj }));
  }

  // Validação amigável por passo — retorna mensagem (Alert) ou null.
  function validate(stepIndex) {
    if (!form) return null;
    if (stepIndex === 1) {
      if (form.primaryColor && !isHex(form.primaryColor))
        return "A cor primária precisa ser um hexadecimal válido (ex.: #032e59).";
      if (form.secondaryColor && !isHex(form.secondaryColor))
        return "A cor secundária precisa ser um hexadecimal válido (ex.: #0a4a8c).";
    }
    if (stepIndex === 2) {
      if (form.orgaoEmail && !isValidEmail(form.orgaoEmail))
        return "Informe um e-mail válido para o órgão gestor.";
    }
    if (stepIndex === 3) {
      if (form.email && !isValidEmail(form.email))
        return "Informe um e-mail de contato válido.";
    }
    return null;
  }

  function goNext() {
    const err = validate(step);
    if (err) {
      setFeedback({ tone: "danger", title: "Revise este passo", msg: err });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setFeedback(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setFeedback(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  // Salvar rascunho e sair (concluir:false) → vai pro painel SEM concluir.
  async function saveForLater() {
    setFeedback(null);
    try {
      await save(toPatchPayload(form, { concluir: false }));
      if (typeof window !== "undefined") sessionStorage.setItem(SKIP_KEY, "1");
      router.push("/painel");
    } catch (err) {
      setFeedback({
        tone: "danger",
        title: "Não foi possível salvar",
        msg: err?.message || "Ocorreu um erro ao salvar. Tente novamente.",
      });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Concluir (concluir:true) → tela de sucesso → painel.
  async function finish() {
    const err = validate(3);
    if (err) {
      setFeedback({ tone: "danger", title: "Revise este passo", msg: err });
      return;
    }
    setFeedback(null);
    try {
      await save(toPatchPayload(form, { concluir: true }));
      if (typeof window !== "undefined") sessionStorage.removeItem(SKIP_KEY);
      setDone(true);
      const t = setTimeout(() => router.push("/painel"), 2400);
      return () => clearTimeout(t);
    } catch (err2) {
      const forbidden = err2?.status === 403;
      setFeedback({
        tone: "danger",
        title: forbidden ? "Sem permissão" : "Não foi possível concluir",
        msg: forbidden
          ? "Apenas administradores da cidade podem concluir esta configuração."
          : err2?.message || "Ocorreu um erro ao concluir. Tente novamente.",
      });
    }
  }

  const cityName = data?.name || "sua cidade";

  return (
    <main className={styles.screen} style={brandTheme(form)}>
      <section className={styles.visual}>
        <AuthVisual
          eyebrow="Primeiro acesso"
          title="Vamos deixar tudo pronto."
          subtitle="Em poucos minutos, sua cidade fica com marca, órgão gestor e contato configurados — no painel, no portal da família e nos documentos oficiais."
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelInner}>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState onRetry={refetch} />
          ) : done ? (
            <DoneState cityName={cityName} onGo={() => router.push("/painel")} />
          ) : (
            form && (
              <>
                <Stepper step={step} />

                {feedback && (
                  <Alert tone={feedback.tone} title={feedback.title}>
                    {feedback.msg}
                  </Alert>
                )}

                {step === 0 && (
                  <WelcomeStep adminName={adminName} cityName={cityName} />
                )}
                {step === 1 && (
                  <BrandStep form={form} set={set} cityName={cityName} />
                )}
                {step === 2 && <OrgStep form={form} set={set} cityName={cityName} />}
                {step === 3 && <ContactStep form={form} set={set} patch={patch} />}

                <div className={styles.nav}>
                  {step === 0 ? (
                    <span />
                  ) : (
                    <Button variant="ghost" onClick={goBack} disabled={saving}>
                      Voltar
                    </Button>
                  )}

                  <div className={styles.navMain}>
                    {step > 0 && (
                      <button
                        type="button"
                        className={styles.skip}
                        onClick={saveForLater}
                        disabled={saving}
                      >
                        Salvar e continuar depois
                      </button>
                    )}
                    {step < 3 ? (
                      <Button onClick={goNext} disabled={saving}>
                        {step === 0 ? "Começar" : "Avançar"}
                      </Button>
                    ) : (
                      <Button onClick={finish} loading={saving}>
                        Concluir configuração
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )
          )}
        </div>
      </section>
    </main>
  );
}

/* ------------------------------- stepper --------------------------------- */

function Stepper({ step }) {
  return (
    <div className={styles.stepper}>
      <div className={styles.stepperMeta}>
        <span className={styles.stepperCount}>
          Passo {step + 1} de {STEPS.length}
        </span>
        <span className={styles.stepperCurrent}>{STEPS[step].label}</span>
      </div>
      <div className={styles.track}>
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={`${styles.tick} ${
              i < step ? styles.tickDone : i === step ? styles.tickActive : ""
            }`}
          />
        ))}
      </div>
      <div className={styles.steps}>
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={`${styles.stepChip} ${
              i === step ? styles.stepChipActive : i < step ? styles.stepChipDone : ""
            }`}
          >
            <span className={styles.stepDot}>{i < step ? <CheckIcon /> : i + 1}</span>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- passos -------------------------------- */

function WelcomeStep({ adminName, cityName }) {
  return (
    <div className={styles.welcome}>
      <div className={styles.stepHead}>
        <span className={styles.eyebrow}>Bem-vindo</span>
        <h1 className={styles.title}>
          {adminName ? `Olá, ${adminName}. ` : ""}Vamos configurar {cityName}.
        </h1>
        <p className={styles.subtitle}>
          Leva cerca de 2 minutos. Você define a marca da cidade, o órgão gestor
          e os dados de contato. Pode ajustar tudo depois em Configurações.
        </p>
      </div>

      <div className={styles.welcomeList}>
        <div className={styles.welcomeItem}>
          <span className={styles.welcomeIcon}><BrushIcon /></span>
          <div>
            <strong>Identidade visual</strong>
            <span>Cores e logo aplicadas ao painel, ao portal e às telas públicas.</span>
          </div>
        </div>
        <div className={styles.welcomeItem}>
          <span className={styles.welcomeIcon}><BuildingIcon /></span>
          <div>
            <strong>Órgão gestor</strong>
            <span>Prefeitura/secretaria responsável — imprime no cabeçalho dos documentos.</span>
          </div>
        </div>
        <div className={styles.welcomeItem}>
          <span className={styles.welcomeIcon}><PhoneIcon /></span>
          <div>
            <strong>Contato &amp; endereço</strong>
            <span>Canais e endereço público exibidos para as famílias.</span>
          </div>
        </div>
      </div>

      <p className={styles.welcomeNote}>
        Sem pressa: você pode salvar e continuar depois a qualquer momento.
      </p>
    </div>
  );
}

function BrandStep({ form, set, cityName }) {
  return (
    <div className={styles.stepBody}>
      <div className={styles.stepHead}>
        <span className={styles.eyebrow}>Identidade visual</span>
        <h1 className={styles.title}>A marca de {cityName}</h1>
        <p className={styles.subtitle}>
          As cores e a logo aparecem no painel, no portal da família e nas telas
          públicas. Veja a pré-visualização ao vivo abaixo.
        </p>
      </div>

      <div className={styles.grid2}>
        <ColorField
          label="Cor primária"
          hint="Cor principal da marca (botões, destaques, navegação)."
          value={form.primaryColor}
          onChange={(v) => set("primaryColor", v)}
        />
        <ColorField
          label="Cor secundária"
          hint="Cor de apoio (realces e estados hover)."
          value={form.secondaryColor}
          onChange={(v) => set("secondaryColor", v)}
        />
      </div>

      <FormField
        label="Logo da cidade"
        hint="Envie uma imagem (PNG, JPEG ou SVG). Deixe em branco para usar só o nome."
      >
        <LogoUpload
          value={form.logoUrl}
          onChange={(url) => set("logoUrl", url)}
        />
      </FormField>

      <div
        className={styles.brandPreview}
        style={{
          "--pv-primary": safeColor(form.primaryColor, "#032e59"),
          "--pv-secondary": safeColor(form.secondaryColor, "#0a4a8c"),
        }}
      >
        <span className={styles.previewTag}>Pré-visualização</span>
        <div className={styles.previewBar}>
          <span className={styles.previewLogo}>
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="Logo da cidade" />
            ) : (
              <span className={styles.previewMonogram}>
                {String(cityName).trim().charAt(0).toUpperCase()}
              </span>
            )}
            <strong>{cityName}</strong>
          </span>
          <span className={styles.previewChip}>Portal da Família</span>
        </div>
        <div className={styles.previewButtons}>
          <span className={styles.previewBtnPrimary}>Ação principal</span>
          <span className={styles.previewBtnSecondary}>Ação secundária</span>
        </div>
        <div className={styles.previewSwatches}>
          <Swatch label="Primária" hex={safeColor(form.primaryColor, "#032e59")} />
          <Swatch label="Secundária" hex={safeColor(form.secondaryColor, "#0a4a8c")} />
        </div>
      </div>
    </div>
  );
}

function OrgStep({ form, set, cityName }) {
  return (
    <div className={styles.stepBody}>
      <div className={styles.stepHead}>
        <span className={styles.eyebrow}>Órgão gestor</span>
        <h1 className={styles.title}>Quem administra {cityName}</h1>
        <p className={styles.subtitle}>
          Identificação da prefeitura/secretaria responsável — imprime no
          cabeçalho dos documentos oficiais.
        </p>
      </div>

      <div className={styles.grid2}>
        <FormField label="Nome do órgão gestor" htmlFor="orgaoNome">
          <Input
            id="orgaoNome"
            placeholder="Prefeitura Municipal de…"
            value={form.orgaoNome}
            onChange={(e) => set("orgaoNome", e.target.value)}
          />
        </FormField>
        <FormField label="CNPJ" htmlFor="orgaoCnpj">
          <Input
            id="orgaoCnpj"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            value={form.orgaoCnpj}
            onChange={(e) => set("orgaoCnpj", maskCnpj(e.target.value))}
          />
        </FormField>
        <FormField label="Telefone" htmlFor="orgaoTelefone">
          <Input
            id="orgaoTelefone"
            inputMode="tel"
            placeholder="(11) 0000-0000"
            value={form.orgaoTelefone}
            onChange={(e) => set("orgaoTelefone", maskPhone(e.target.value))}
          />
        </FormField>
        <FormField label="E-mail" htmlFor="orgaoEmail">
          <Input
            id="orgaoEmail"
            type="email"
            placeholder="gabinete@cidade.gov.br"
            value={form.orgaoEmail}
            onChange={(e) => set("orgaoEmail", e.target.value)}
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
        />
      </FormField>

      <div className={styles.docPreview}>
        <span className={styles.previewTag}>Cabeçalho de documentos</span>
        <div className={styles.docHead}>
          <strong>{form.orgaoNome || cityName || "Órgão gestor"}</strong>
          {form.orgaoCabecalho && <p>{form.orgaoCabecalho}</p>}
          <div className={styles.docMeta}>
            {form.orgaoCnpj && <span>CNPJ {form.orgaoCnpj}</span>}
            {form.orgaoTelefone && <span>{form.orgaoTelefone}</span>}
            {form.orgaoEmail && <span>{form.orgaoEmail}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactStep({ form, set, patch }) {
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

  return (
    <div className={styles.stepBody}>
      <div className={styles.stepHead}>
        <span className={styles.eyebrow}>Contato &amp; endereço</span>
        <h1 className={styles.title}>Como as famílias encontram a cidade</h1>
        <p className={styles.subtitle}>
          Canais e endereço público — exibidos no portal da família e nas telas
          públicas.
        </p>
      </div>

      <div className={styles.grid3}>
        <FormField label="E-mail de contato" htmlFor="email">
          <Input
            id="email"
            type="email"
            placeholder="contato@cidade.gov.br"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </FormField>
        <FormField label="Telefone" htmlFor="phone">
          <Input
            id="phone"
            inputMode="tel"
            placeholder="(11) 0000-0000"
            value={maskPhoneBr(form.phone)}
            onChange={(e) => set("phone", maskPhoneBr(e.target.value))}
          />
        </FormField>
        <FormField label="WhatsApp" htmlFor="whatsapp">
          <Input
            id="whatsapp"
            inputMode="tel"
            placeholder="(11) 90000-0000"
            value={maskPhoneBr(form.whatsapp)}
            onChange={(e) => set("whatsapp", maskPhoneBr(e.target.value))}
          />
        </FormField>
      </div>

      <div className={styles.addressGrid}>
        <FormField
          label="CEP"
          htmlFor="addressZipcode"
          className={styles.colCep}
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
          />
        </FormField>
        <FormField label="Logradouro" htmlFor="addressStreet" className={styles.colStreet}>
          <Input
            id="addressStreet"
            placeholder="Av. / Rua…"
            value={form.addressStreet}
            onChange={(e) => set("addressStreet", e.target.value)}
          />
        </FormField>
        <FormField label="Número" htmlFor="addressNumber" className={styles.colNumber}>
          <Input
            id="addressNumber"
            value={form.addressNumber}
            onChange={(e) => set("addressNumber", e.target.value)}
          />
        </FormField>
        <FormField label="Bairro" htmlFor="addressDistrict" className={styles.colBairro}>
          <Input
            id="addressDistrict"
            value={form.addressDistrict}
            onChange={(e) => set("addressDistrict", e.target.value)}
          />
        </FormField>
        <FormField label="Cidade" htmlFor="addressCity" className={styles.colCidade}>
          <Input
            id="addressCity"
            value={form.addressCity}
            onChange={(e) => set("addressCity", e.target.value)}
          />
        </FormField>
        <FormField label="UF" htmlFor="addressState" className={styles.colUf}>
          <Input
            id="addressState"
            maxLength={2}
            placeholder="SP"
            value={form.addressState}
            onChange={(e) =>
              set("addressState", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
            }
          />
        </FormField>
        <FormField label="Complemento" htmlFor="addressComplement" className={styles.colComplemento}>
          <Input
            id="addressComplement"
            value={form.addressComplement}
            onChange={(e) => set("addressComplement", e.target.value)}
          />
        </FormField>
      </div>
    </div>
  );
}

/* -------------------------------- estados -------------------------------- */

function DoneState({ cityName, onGo }) {
  return (
    <div className={styles.done}>
      <span className={styles.doneMark}>
        <CheckIcon />
      </span>
      <h1 className={styles.doneTitle}>Tudo pronto!</h1>
      <p className={styles.doneText}>
        {cityName} está configurada. A marca e o órgão gestor já valem no sistema
        e nos documentos. Estamos levando você ao painel…
      </p>
      <Button size="lg" onClick={onGo}>
        Ir para o painel
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className={styles.loading}>
      <Skeleton variant="line" width="45%" height={16} />
      <Skeleton variant="block" height={10} />
      <div style={{ height: 8 }} />
      <Skeleton variant="line" width="60%" height={28} />
      <Skeleton variant="line" width="85%" height={16} />
      <Skeleton variant="block" height={180} />
      <Skeleton variant="block" height={120} />
    </div>
  );
}

/* ------------------------------- helpers UI ------------------------------ */

function ColorField({ label, hint, value, onChange }) {
  const hex = safeColor(value, "#032e59");
  return (
    <FormField label={label} hint={hint}>
      <div className={styles.colorRow}>
        <label className={styles.swatchInput} style={{ background: hex }}>
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${label} — seletor de cor`}
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          maxLength={7}
          invalid={Boolean(value) && !isHex(value)}
        />
      </div>
    </FormField>
  );
}

function Swatch({ label, hex }) {
  return (
    <span className={styles.swatchChip}>
      <span className={styles.swatchDot} style={{ background: hex }} />
      <span className={styles.swatchText}>
        <strong>{label}</strong>
        {hex.toUpperCase()}
      </span>
    </span>
  );
}

/* --------------------------------- ícones -------------------------------- */

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BrushIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3.6c-3.3 3.7-5.6 6.5-5.6 9.4a5.6 5.6 0 1 0 11.2 0c0-2.9-2.3-5.7-5.6-9.4Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 20.5V5.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1V20.5M12 20.5V9.5h6a1 1 0 0 1 1 1v10M3.5 20.5h17M8 8h1.6M8 11.5h1.6M8 15h1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M7 4.5h2.8l1.4 3.6-1.9 1.4a10.5 10.5 0 0 0 4.8 4.8l1.4-1.9 3.6 1.4v2.8a1.9 1.9 0 0 1-1.9 1.9A14.5 14.5 0 0 1 5.1 6.4 1.9 1.9 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
