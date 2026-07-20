"use client";

/**
 * Tópico NOTIFICAÇÕES — e-mail (SMTP) + WhatsApp, por cidade.
 * E-mail: getIntegrations/saveEmail (senha secreta: só grava se digitada; o GET
 * devolve apenas hasPassword) + "Enviar e-mail de teste" real pelo SMTP salvo.
 * WhatsApp: conexão real da instância Evolution — Conectar → QR Code (base64) →
 * polling do status até `conectado` → Desconectar. Sem servidor Evolution, o
 * backend responde em modo demonstração (QR placeholder). RBAC: só admin edita.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Input from "@/components/atoms/Input/Input";
import Switch from "@/components/atoms/Switch/Switch";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import Alert from "@/components/molecules/Alert/Alert";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import FormField from "@/components/molecules/FormField/FormField";

import { useResource, useMutation } from "@/lib/api/useResource";
import { getUser } from "@/lib/api/session";
import { isValidEmail } from "@/lib/masks";
import {
  getIntegrations,
  saveEmail,
  testEmail,
  whatsappConnect,
  whatsappStatus,
  whatsappDisconnect,
} from "@/lib/api/resources/tenant";

import { EDIT_ROLES } from "../_lib/helpers";
import {
  TopicHeader,
  SectionCard,
  SaveBar,
  Button,
  StatusPill,
} from "../_lib/ui";
import ui from "../_lib/ui.module.css";

// Polling da conexão do WhatsApp: intervalo e teto de tentativas (≈2 min).
const WA_POLL_MS = 3000;
const WA_POLL_MAX = 40;

const WHATSAPP_LABELS = {
  desconectado: "Desconectado",
  conectando: "Conectando…",
  conectado: "Conectado",
};

const EMPTY_SMTP = {
  host: "",
  port: "587",
  secure: false,
  user: "",
  password: "",
  fromName: "",
  fromEmail: "",
};

export default function NotificacoesPage() {
  const { data, loading, error, refetch } = useResource(getIntegrations, []);
  const { mutate: save, loading: saving } = useMutation(saveEmail);
  const { mutate: sendTest, loading: testing } = useMutation(testEmail);
  const { mutate: doConnect, loading: connecting } = useMutation(whatsappConnect);
  const { mutate: doDisconnect, loading: disconnecting } = useMutation(whatsappDisconnect);

  const canEdit = useMemo(() => EDIT_ROLES.has(getUser()?.role), []);
  const [form, setForm] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Estado local do WhatsApp (hidratado do status + atualizado por connect/polling).
  const [wa, setWa] = useState(null);
  const [waFeedback, setWaFeedback] = useState(null);
  const [polling, setPolling] = useState(false);

  const email = data?.email;
  const whatsapp = data?.whatsapp;

  // Hidrata o estado do WhatsApp a partir do status carregado.
  useEffect(() => {
    if (!whatsapp) return;
    setWa((prev) => ({
      status: whatsapp.status || "desconectado",
      instanceName: whatsapp.instanceName || "",
      qrCode: prev?.qrCode || null,
      mock: prev?.mock || false,
    }));
  }, [whatsapp]);

  // Polling do status enquanto aguarda a leitura do QR (para quando conectar
  // ou após WA_POLL_MAX tentativas). Cancela ao desmontar / parar.
  const pollRef = useRef(0);
  useEffect(() => {
    if (!polling) return undefined;
    pollRef.current = 0;
    const id = setInterval(async () => {
      pollRef.current += 1;
      try {
        const s = await whatsappStatus();
        setWa((w) => ({ ...(w || {}), status: s.status, instanceName: s.instanceName }));
        if (s.status === "conectado") {
          setPolling(false);
          setWa((w) => ({ ...(w || {}), qrCode: null }));
          setWaFeedback({
            tone: "success",
            title: "WhatsApp conectado",
            msg: "O número da cidade foi pareado. As mensagens passarão a ser enviadas por ele.",
          });
        }
      } catch {
        // erro transitório de rede — segue tentando até o teto
      }
      if (pollRef.current >= WA_POLL_MAX) {
        setPolling(false);
        setWaFeedback({
          tone: "warning",
          title: "Tempo esgotado",
          msg: "Não detectamos a leitura do QR Code. Gere um novo QR e leia com o WhatsApp do celular.",
        });
      }
    }, WA_POLL_MS);
    return () => clearInterval(id);
  }, [polling]);

  // Hidrata o form do SMTP a partir do status (a senha nunca vem — só hasPassword).
  useEffect(() => {
    if (!email) return;
    setForm({
      host: email.host || "",
      port: email.port != null ? String(email.port) : "587",
      secure: Boolean(email.secure),
      user: email.user || "",
      password: "",
      fromName: email.fromName || "",
      fromEmail: email.fromEmail || "",
    });
  }, [email]);

  function set(field, value) {
    setForm((f) => ({ ...(f || EMPTY_SMTP), [field]: value }));
  }

  async function handleSave() {
    setFeedback(null);
    const portNum = Number(form.port);
    if (!form.host.trim()) {
      return fail("Revise os campos", "Informe o servidor SMTP (host).");
    }
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      return fail("Revise os campos", "Porta SMTP inválida (use um valor entre 1 e 65535).");
    }
    if (form.fromEmail && !isValidEmail(form.fromEmail.trim())) {
      return fail("Revise os campos", "E-mail do remetente inválido.");
    }
    try {
      const body = {
        host: form.host.trim(),
        port: portNum,
        secure: form.secure,
        user: form.user.trim(),
        fromName: form.fromName.trim(),
        fromEmail: form.fromEmail.trim(),
      };
      if (form.password) body.password = form.password;
      await save(body);
      setForm((f) => ({ ...f, password: "" }));
      setFeedback({
        tone: "success",
        title: "Servidor de e-mail salvo",
        msg: "As configurações de SMTP foram gravadas. Os e-mails da cidade usarão este remetente.",
      });
      refetch();
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const forbidden = err?.status === 403;
      fail(
        forbidden ? "Sem permissão" : "Não foi possível salvar",
        forbidden
          ? "Apenas administradores da cidade podem alterar as notificações."
          : err?.message || "Ocorreu um erro ao salvar. Tente novamente."
      );
    }
  }

  function fail(title, msg) {
    setFeedback({ tone: "danger", title, msg });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Envia um e-mail de teste pelo SMTP salvo. O backend nunca lança por
  // credencial/host ruim → { ok, message } amigável.
  async function handleTestEmail() {
    setFeedback(null);
    try {
      const res = await sendTest();
      setFeedback({
        tone: res?.ok ? "success" : "danger",
        title: res?.ok ? "E-mail de teste enviado" : "Não foi possível enviar",
        msg: res?.message || (res?.ok ? "Verifique a caixa de entrada." : "Tente novamente."),
      });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const forbidden = err?.status === 403;
      fail(
        forbidden ? "Sem permissão" : "Não foi possível testar",
        forbidden
          ? "Apenas administradores da cidade podem enviar e-mails de teste."
          : err?.message || "Ocorreu um erro ao enviar o e-mail de teste."
      );
    }
  }

  // WhatsApp — inicia a conexão: garante a instância + webhook e exibe o QR.
  async function handleConnect() {
    setWaFeedback(null);
    try {
      const res = await doConnect();
      if (!res?.ok) {
        setWaFeedback({
          tone: "danger",
          title: "Não foi possível conectar",
          msg: res?.message || "Falha ao iniciar a conexão do WhatsApp. Tente novamente.",
        });
        return;
      }
      setWa({
        status: res.status || "conectando",
        instanceName: res.instanceName || "",
        qrCode: res.qrCode || null,
        mock: Boolean(res.mock),
      });
      if (res.mock) {
        setWaFeedback({
          tone: "info",
          title: "Modo demonstração",
          msg:
            res.message ||
            "Servidor Evolution não configurado — o QR é apenas ilustrativo. Configure o Evolution para conectar de verdade.",
        });
      } else if (res.status === "conectado") {
        setWa((w) => ({ ...(w || {}), qrCode: null }));
        setWaFeedback({ tone: "success", title: "WhatsApp conectado", msg: "A instância já está conectada." });
      } else {
        // aguarda a leitura do QR — inicia o polling do status
        setPolling(true);
      }
    } catch (err) {
      const forbidden = err?.status === 403;
      setWaFeedback({
        tone: "danger",
        title: forbidden ? "Sem permissão" : "Não foi possível conectar",
        msg: forbidden
          ? "Apenas administradores da cidade podem conectar o WhatsApp."
          : err?.message || "Ocorreu um erro ao conectar o WhatsApp.",
      });
    }
  }

  // WhatsApp — desconecta/limpa a instância.
  async function handleDisconnect() {
    setWaFeedback(null);
    setPolling(false);
    try {
      await doDisconnect();
      setWa((w) => ({ ...(w || {}), status: "desconectado", qrCode: null }));
      setWaFeedback({
        tone: "success",
        title: "WhatsApp desconectado",
        msg: "A instância da cidade foi desconectada.",
      });
    } catch (err) {
      const forbidden = err?.status === 403;
      setWaFeedback({
        tone: "danger",
        title: forbidden ? "Sem permissão" : "Não foi possível desconectar",
        msg: forbidden
          ? "Apenas administradores da cidade podem desconectar o WhatsApp."
          : err?.message || "Ocorreu um erro ao desconectar o WhatsApp.",
      });
    }
  }

  if (loading) return <TopicSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!form) return null;

  const emailConfigured = Boolean(email?.configured);
  const waStatus = wa?.status || whatsapp?.status || "desconectado";
  const waConnected = waStatus === "conectado";
  const waPillTone = waConnected ? "success" : waStatus === "conectando" || polling ? "warning" : "neutral";

  return (
    <div className={ui.topic}>
      <TopicHeader
        title="Notificações"
        desc="Canais de comunicação da cidade: e-mail transacional (SMTP) e WhatsApp. Cada cidade usa a própria configuração."
      />

      {!canEdit && (
        <Alert tone="info" title="Somente leitura">
          Seu perfil pode visualizar as notificações, mas não alterá-las. Peça a
          um administrador da cidade para editar estes dados.
        </Alert>
      )}
      {feedback && (
        <Alert tone={feedback.tone} title={feedback.title}>
          {feedback.msg}
        </Alert>
      )}

      {/* ---------------------------- E-MAIL / SMTP ---------------------------- */}
      <SectionCard
        title="E-mail (SMTP)"
        desc="Servidor de envio de e-mails transacionais (convites, 2ª via, avisos). A senha é armazenada com segurança e nunca reexibida."
      >
        <div className={ui.grid2}>
          <FormField label="Servidor (host)" htmlFor="smtpHost">
            <Input
              id="smtpHost"
              placeholder="smtp.seuprovedor.com"
              value={form.host}
              onChange={(e) => set("host", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="Porta" htmlFor="smtpPort" hint="Ex.: 587 (STARTTLS) ou 465 (SSL).">
            <Input
              id="smtpPort"
              inputMode="numeric"
              placeholder="587"
              value={form.port}
              onChange={(e) => set("port", e.target.value.replace(/\D/g, "").slice(0, 5))}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="Usuário" htmlFor="smtpUser">
            <Input
              id="smtpUser"
              autoComplete="off"
              placeholder="usuario@seuprovedor.com"
              value={form.user}
              onChange={(e) => set("user", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField
            label="Senha"
            htmlFor="smtpPassword"
            hint={
              email?.hasPassword
                ? "Uma senha já está configurada. Digite uma nova só para substituí-la."
                : "Senha ou token do servidor SMTP."
            }
          >
            <Input
              id="smtpPassword"
              type="password"
              autoComplete="new-password"
              placeholder={email?.hasPassword ? "•••• configurada — digite para trocar" : "••••••••"}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="Nome do remetente" htmlFor="smtpFromName">
            <Input
              id="smtpFromName"
              placeholder="Prefeitura de…"
              value={form.fromName}
              onChange={(e) => set("fromName", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
          <FormField label="E-mail do remetente" htmlFor="smtpFromEmail">
            <Input
              id="smtpFromEmail"
              type="email"
              placeholder="nao-responder@cidade.gov.br"
              value={form.fromEmail}
              onChange={(e) => set("fromEmail", e.target.value)}
              disabled={!canEdit}
            />
          </FormField>
        </div>

        <FormField label="Conexão segura (SSL/TLS)" hint="Ative para porta 465 (SSL); desative para 587 (STARTTLS).">
          <Switch
            checked={form.secure}
            onChange={(e) => set("secure", e.target.checked)}
            disabled={!canEdit}
            label={form.secure ? "SSL/TLS ativado" : "STARTTLS"}
          />
        </FormField>

        <div
          style={{
            paddingTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <StatusPill tone={emailConfigured ? "success" : "neutral"}>
            {emailConfigured ? "E-mail configurado" : "E-mail não configurado"}
          </StatusPill>
          {canEdit && (
            <Button
              variant="secondary"
              size="sm"
              loading={testing}
              disabled={!emailConfigured}
              onClick={handleTestEmail}
            >
              Enviar e-mail de teste
            </Button>
          )}
          {canEdit && !emailConfigured && (
            <span style={{ fontSize: 12, color: "var(--color-slate)" }}>
              Salve o servidor SMTP antes de testar.
            </span>
          )}
        </div>
      </SectionCard>

      {canEdit && (
        <SaveBar hint="Os e-mails da cidade passam a usar este remetente ao salvar.">
          <Button loading={saving} onClick={handleSave}>
            Salvar e-mail
          </Button>
        </SaveBar>
      )}

      {/* ------------------------------ WHATSAPP ------------------------------ */}
      {waFeedback && (
        <Alert tone={waFeedback.tone} title={waFeedback.title}>
          {waFeedback.msg}
        </Alert>
      )}

      <SectionCard
        title="WhatsApp"
        desc="Conexão da instância de WhatsApp da cidade para envio de avisos e 2ª via. Clique em Conectar, leia o QR Code com o WhatsApp do celular e aguarde a confirmação."
      >
        <div className={ui.whatsBlock}>
          <div className={ui.qrSlot} style={{ overflow: "hidden", padding: 0 }}>
            {wa?.qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={wa.qrCode}
                alt="QR Code para parear o WhatsApp da cidade"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : waConnected ? (
              "Conectado"
            ) : (
              "O QR Code aparece aqui"
            )}
          </div>
          <div className={ui.whatsInfo}>
            <StatusPill tone={waPillTone}>
              {WHATSAPP_LABELS[waStatus] || "Desconectado"}
            </StatusPill>
            <strong>
              {waConnected ? "Instância conectada" : "Nenhuma instância conectada"}
            </strong>
            <p>
              {waConnected
                ? "O número da cidade está pareado. As notificações de WhatsApp usam esta instância."
                : polling
                ? "Aguardando a leitura do QR Code no aparelho… deixe esta tela aberta."
                : "Conecte para gerar o QR Code e parear o número de WhatsApp da cidade."}
            </p>

            {canEdit && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 4 }}>
                {waConnected ? (
                  <Button variant="danger" loading={disconnecting} onClick={handleDisconnect}>
                    Desconectar
                  </Button>
                ) : (
                  <Button loading={connecting || polling} onClick={handleConnect}>
                    {polling ? "Aguardando leitura…" : wa?.qrCode ? "Gerar novo QR Code" : "Conectar WhatsApp"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </SectionCard>
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
        <Skeleton variant="block" height={240} />
      </div>
    </div>
  );
}
