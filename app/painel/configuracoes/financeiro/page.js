"use client";

/**
 * Tópico FINANCEIRO — integração Asaas por cidade (getIntegrations/saveFinanceiro).
 * API Key (campo secreto: mostra "•••• configurado" quando já houver) + seletor
 * de ambiente (Sandbox/Produção). O GET nunca devolve a key em claro — só o
 * status mascarado. "Testar conexão" fica desabilitado (Fase 2). RBAC: só admin.
 */
import { useEffect, useMemo, useState } from "react";
import Input from "@/components/atoms/Input/Input";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import Alert from "@/components/molecules/Alert/Alert";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import FormField from "@/components/molecules/FormField/FormField";

import { useResource, useMutation } from "@/lib/api/useResource";
import { getUser } from "@/lib/api/session";
import { getIntegrations, saveFinanceiro, testFinanceiro } from "@/lib/api/resources/tenant";

import { EDIT_ROLES } from "../_lib/helpers";
import { TopicHeader, SectionCard, SaveBar, Button, StatusPill } from "../_lib/ui";
import ui from "../_lib/ui.module.css";

const ENVIRONMENTS = [
  { value: "sandbox", label: "Sandbox" },
  { value: "producao", label: "Produção" },
];

export default function FinanceiroPage() {
  const { data, loading, error, refetch } = useResource(getIntegrations, []);
  const { mutate: save, loading: saving } = useMutation(saveFinanceiro);
  const { mutate: runTest, loading: testing } = useMutation(testFinanceiro);

  const canEdit = useMemo(() => EDIT_ROLES.has(getUser()?.role), []);
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState("sandbox");
  const [feedback, setFeedback] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const fin = data?.financeiro;

  useEffect(() => {
    if (fin?.environment) setEnvironment(fin.environment);
  }, [fin?.environment]);

  async function handleSave() {
    setFeedback(null);
    try {
      const body = { environment };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      await save(body);
      setApiKey("");
      setFeedback({
        tone: "success",
        title: "Integração salva",
        msg: "As credenciais do Asaas foram gravadas. A cobrança automática usará esta conta.",
      });
      refetch();
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const forbidden = err?.status === 403;
      setFeedback({
        tone: "danger",
        title: forbidden ? "Sem permissão" : "Não foi possível salvar",
        msg: forbidden
          ? "Apenas administradores da cidade podem alterar a integração financeira."
          : err?.message || "Ocorreu um erro ao salvar. Tente novamente.",
      });
    }
  }

  async function handleTest() {
    setTestResult(null);
    try {
      const res = await runTest();
      if (res?.ok) {
        const acc = res.account || {};
        const who = acc.name || acc.email || acc.cpfCnpj;
        setTestResult({
          tone: "success",
          title: "Conexão bem-sucedida",
          msg: who
            ? `Conta Asaas conectada${who ? `: ${who}` : ""}${acc.environment ? ` (${acc.environment})` : ""}.`
            : "As credenciais do Asaas foram validadas com sucesso.",
        });
      } else {
        setTestResult({
          tone: "warning",
          title: "Não foi possível conectar",
          msg: res?.message || "Verifique a chave de API e o ambiente selecionado.",
        });
      }
    } catch (err) {
      const forbidden = err?.status === 403;
      setTestResult({
        tone: "danger",
        title: forbidden ? "Sem permissão" : "Falha no teste",
        msg: forbidden
          ? "Apenas administradores da cidade podem testar a integração."
          : err?.message || "Ocorreu um erro ao testar a conexão. Tente novamente.",
      });
    }
  }

  if (loading) return <TopicSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;

  const configured = Boolean(fin?.configured);

  return (
    <div className={ui.topic}>
      <TopicHeader
        title="Financeiro"
        desc="Conecte a conta Asaas da sua cidade para emitir cobranças (boleto, Pix e cartão). Cada cidade usa a própria conta — nada é compartilhado."
        aside={
          <StatusPill tone={configured ? "success" : "neutral"}>
            {configured ? "Conectado" : "Não configurado"}
          </StatusPill>
        }
      />

      {!canEdit && (
        <Alert tone="info" title="Somente leitura">
          Seu perfil pode visualizar a integração, mas não alterá-la. Peça a um
          administrador da cidade para editar estes dados.
        </Alert>
      )}
      {feedback && (
        <Alert tone={feedback.tone} title={feedback.title}>
          {feedback.msg}
        </Alert>
      )}

      <SectionCard
        title="Credenciais Asaas"
        desc="A chave de API é armazenada com segurança e nunca é exibida novamente. Deixe em branco para manter a atual."
      >
        <FormField
          label="Ambiente"
          hint="Sandbox para testes; Produção para cobranças reais."
        >
          <div className={ui.segmented} role="group" aria-label="Ambiente Asaas">
            {ENVIRONMENTS.map((env) => (
              <button
                key={env.value}
                type="button"
                className={`${ui.segment} ${environment === env.value ? ui.segmentActive : ""}`}
                aria-pressed={environment === env.value}
                onClick={() => canEdit && setEnvironment(env.value)}
                disabled={!canEdit}
              >
                {env.label}
              </button>
            ))}
          </div>
        </FormField>

        <FormField
          label="Chave de API (API Key)"
          htmlFor="asaasApiKey"
          hint={
            configured
              ? "Uma chave já está configurada. Digite uma nova só para substituí-la."
              : "Cole a chave de API da sua conta Asaas."
          }
        >
          <Input
            id="asaasApiKey"
            type="password"
            autoComplete="off"
            placeholder={configured ? "•••• configurado — digite para trocar" : "$aact_…"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={!canEdit}
          />
          {configured && (
            <div className={ui.secretState} style={{ marginTop: 8 }}>
              <span className={ui.secretMask}>{fin?.apiKeyMask || "••••"}</span>
              configurado
            </div>
          )}
        </FormField>
      </SectionCard>

      <SectionCard
        title="Conexão"
        desc="Valida a chave salva direto no Asaas (não envia cobrança). Salve a chave antes de testar."
      >
        {testResult && (
          <Alert tone={testResult.tone} title={testResult.title}>
            {testResult.msg}
          </Alert>
        )}
        <div className={ui.saveButtons}>
          <Button
            variant="secondary"
            loading={testing}
            disabled={!configured || testing}
            title={configured ? "Testar a conexão com o Asaas" : "Salve a chave de API antes de testar"}
            onClick={handleTest}
          >
            Testar conexão
          </Button>
          {!configured && (
            <span className={ui.secretState}>Configure e salve a chave para habilitar o teste.</span>
          )}
        </div>
      </SectionCard>

      {canEdit && (
        <SaveBar hint="As credenciais são gravadas com segurança; a chave nunca é reexibida.">
          <Button loading={saving} onClick={handleSave}>
            Salvar integração
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
