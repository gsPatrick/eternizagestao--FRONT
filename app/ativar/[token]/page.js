"use client";

/**
 * ATIVAÇÃO DO PORTAL DA FAMÍLIA — destino do link "Ative seu acesso".
 *
 * O e-mail enviado pela API aponta para `https://<cidade>.<dominio>/ativar/<token>`
 * (ver API `utils/tenant-url.js` → portalActivationUrl). Esta é a tela que
 * recebe esse link: o titular confirma o e-mail que recebeu o convite, define a
 * senha e entra no portal.
 *
 * CIDADE (tenant): o endpoint `POST /portal/activate` EXIGE o cliente resolvido.
 * A precedência é a mesma do resto do sistema (getClientSubdomain):
 *   cookie `eterniza_tenant` (setado pelo middleware a partir do subdomínio)
 *   → `?t=<subdominio>` (modo path, usado no desenvolvimento)
 * O valor viaja no header `X-Tenant-Subdomain` (lib/api/client.js).
 *
 * O token é de USO ÚNICO e a API responde de forma genérica (INVALID_ACTIVATION)
 * para token inválido, expirado, já usado ou e-mail divergente — por isso a
 * mensagem de erro cobre as quatro possibilidades e sempre oferece uma saída.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./page.module.css";
import TenantTheme, { useTenant } from "@/components/providers/TenantTheme/TenantTheme";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import FormField from "@/components/molecules/FormField/FormField";
import Alert from "@/components/molecules/Alert/Alert";
import AuthVisual from "@/components/organisms/AuthVisual/AuthVisual";
import { normalizeEmail } from "@/lib/masks";
import { ApiError } from "@/lib/api/client";
import { activatePortalAccess } from "@/lib/api/resources/portal";
import { getClientSubdomain } from "@/lib/tenant-subdomain";

// Mínimo exigido pela API (family-portal.service.activate).
const MIN_PASSWORD = 8;

// Força da senha 0..4 — mesma régua da tela /trocar-senha.
const STRENGTH = [
  { label: "", color: "transparent" },
  { label: "Muito fraca", color: "#b03535" },
  { label: "Fraca", color: "#c9721f" },
  { label: "Boa", color: "#b8961f" },
  { label: "Forte", color: "#1a7f5c" },
];

function scorePassword(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6) s += 1;
  if (pw.length >= 10) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s += 1;
  return Math.min(4, s);
}

function StrengthMeter({ value }) {
  const score = scorePassword(value);
  const meta = STRENGTH[score];
  return (
    <div className={styles.strength}>
      <div className={styles.strengthBars}>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={styles.strengthBar}
            style={i <= score ? { background: meta.color } : undefined}
          />
        ))}
      </div>
      {value && (
        <span className={styles.strengthLabel} style={{ color: meta.color }}>
          Senha {meta.label.toLowerCase()}
        </span>
      )}
    </div>
  );
}

/**
 * Traduz o erro da API numa mensagem honesta em português. A API não distingue
 * os motivos de propósito (anti-enumeração), então o texto lista o que pode ter
 * acontecido em vez de inventar uma causa única.
 */
function mapActivationError(err) {
  if (!(err instanceof ApiError)) {
    return {
      tone: "danger",
      title: "Falha de conexão",
      text: "Não foi possível falar com o servidor. Verifique sua internet e tente novamente.",
    };
  }
  if (err.code === "TENANT_NOT_RESOLVED") {
    return {
      tone: "danger",
      title: "Cidade não identificada",
      text: "Abra o link exatamente como ele chegou no e-mail, pelo endereço da sua cidade. Se você copiou só uma parte do endereço, volte ao e-mail e clique no botão “Ativar meu acesso”.",
    };
  }
  if (err.status === 429) {
    return {
      tone: "warning",
      title: "Muitas tentativas",
      text: err.message || "Aguarde alguns minutos antes de tentar novamente.",
    };
  }
  if (err.code === "WEAK_PASSWORD") {
    return { tone: "danger", title: "Senha muito curta", text: err.message };
  }
  if (err.code === "INVALID_ACTIVATION" || err.status === 401) {
    return {
      tone: "danger",
      title: "Não foi possível ativar",
      text: "Este link de ativação não confere. Ele pode ter expirado (vale 24 horas), já ter sido usado para criar a senha, ou o e-mail digitado pode ser diferente do e-mail que recebeu o convite.",
    };
  }
  return {
    tone: "danger",
    title: "Não foi possível ativar",
    text: err.message || "Tente novamente em alguns instantes.",
  };
}

function ActivationFlow() {
  const router = useRouter();
  const params = useParams();
  const tenant = useTenant();

  // Token cru da URL (o único lugar onde ele existe — a API guarda só o hash).
  const token = decodeURIComponent(String(params?.token || ""));

  // Cidade só resolve no cliente (cookie/querystring) — evita divergência de
  // hidratação e mantém a precedência única do projeto.
  const [sub, setSub] = useState(null);
  useEffect(() => {
    setSub(getClientSubdomain());
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Nome da cidade para a identidade da tela (white label do TenantTheme).
  // Só nomeamos a cidade quando ela foi REALMENTE resolvida — o tenant padrão
  // ("Eterniza") é fallback da plataforma, não a cidade do convite.
  const tenantSub = (tenant?.subdomain || "").split(".")[0];
  const cityName = tenantSub && tenantSub !== "demo" ? tenant.brandLead || tenant.name : "";
  // Link de saída preservando a cidade no modo path (dev / link sem subdomínio).
  const loginHref = useMemo(() => (sub ? `/login?t=${sub}` : "/login"), [sub]);

  async function submit(event) {
    event.preventDefault();
    setApiError(null);

    if (!token) {
      setApiError({
        tone: "danger",
        title: "Link incompleto",
        text: "O endereço não traz o código de ativação. Abra novamente o botão “Ativar meu acesso” do e-mail que você recebeu.",
      });
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setPasswordError(`A senha deve ter no mínimo ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    setPasswordError("");
    setLoading(true);

    try {
      await activatePortalAccess({
        email,
        activationToken: token,
        password,
        tenant: sub || undefined,
      });

      // Guarda a cidade no cookie (mesmo formato do middleware) para que o login
      // seguinte resolva o tenant — inclusive no dev, onde não há subdomínio.
      if (sub && typeof document !== "undefined") {
        document.cookie = `eterniza_tenant=${encodeURIComponent(sub)}; path=/; SameSite=Lax`;
      }

      // `POST /portal/activate` NÃO devolve token de sessão (só { accountId,
      // status }). Em vez de fazer um segundo login por baixo do pano, levamos o
      // titular ao login com uma mensagem clara — é o contrato que a API oferece
      // hoje. (Ver sugestão de contrato no relatório: devolver o accessToken na
      // ativação permitiria entrar direto.)
      setDone(true);
    } catch (err) {
      setApiError(mapActivationError(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={styles.formView}>
        <div className={`${styles.iconBadge} ${styles.iconSuccess}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 12.4l2.6 2.6 5.4-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className={styles.formHead}>
          <h1 className={styles.formTitle}>Acesso ativado</h1>
          <p className={styles.formSub}>
            Sua senha foi criada. Entre com o seu e-mail e a senha que você acabou
            de definir para acessar o Portal da Família.
          </p>
        </div>
        <Alert tone="success" title="Link de ativação encerrado">
          O link do e-mail é de uso único e já foi invalidado.
        </Alert>
        <Button size="lg" full onClick={() => router.push(loginHref)}>
          Ir para o login
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.formView}>
      <div className={styles.iconBadge} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="4" y="10.5" width="16" height="9.5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 10.5V8a4 4 0 118 0v2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>

      <div className={styles.formHead}>
        <h1 className={styles.formTitle}>Ative seu acesso</h1>
        <p className={styles.formSub}>
          Confirme o e-mail que recebeu o convite
          {cityName ? (
            <>
              {" "}do Portal da Família de{" "}
              <strong className={styles.cityHighlight}>{cityName}</strong>
            </>
          ) : (
            " do Portal da Família"
          )}{" "}
          e crie a sua senha de acesso.
        </p>
      </div>

      <form className={styles.form} onSubmit={submit} noValidate>
        <FormField label="E-mail do convite" htmlFor="ativar-email" required>
          <Input
            id="ativar-email"
            type="email"
            placeholder="voce@exemplo.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(normalizeEmail(e.target.value))}
            required
          />
        </FormField>

        <FormField
          label="Criar senha"
          htmlFor="ativar-senha"
          required
          hint={`Mínimo de ${MIN_PASSWORD} caracteres`}
        >
          <Input
            id="ativar-senha"
            type="password"
            placeholder="••••••••••"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError("");
            }}
            required
          />
          <StrengthMeter value={password} />
        </FormField>

        <FormField label="Confirmar senha" htmlFor="ativar-confirma" required error={passwordError}>
          <Input
            id="ativar-confirma"
            type="password"
            placeholder="Repita a senha"
            autoComplete="new-password"
            value={confirm}
            invalid={Boolean(passwordError)}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (passwordError) setPasswordError("");
            }}
            required
          />
        </FormField>

        <Button type="submit" size="lg" full loading={loading}>
          Ativar meu acesso
        </Button>
      </form>

      {apiError && (
        <Alert tone={apiError.tone} title={apiError.title}>
          {apiError.text}
        </Alert>
      )}

      {/* Saídas: quem já ativou vai direto ao login. Quem perdeu o prazo precisa
          de um NOVO convite — só a administração do cemitério pode reenviar,
          então não prometemos um botão que não existe. */}
      <p className={styles.exits}>
        Já ativou seu acesso?{" "}
        <button type="button" className={styles.link} onClick={() => router.push(loginHref)}>
          Entrar no portal
        </button>
        <br />
        Link expirado? Peça um novo convite à administração do cemitério.
      </p>
    </div>
  );
}

export default function AtivarPage() {
  return (
    <TenantTheme showSwitcher={false}>
      <main className={styles.screen}>
        <section className={styles.visual}>
          <AuthVisual
            title="Seu acesso ao Portal da Família."
            subtitle="Acompanhe jazigos, sepultamentos e cobranças da sua família — com segurança e a qualquer hora."
          />
        </section>
        <section className={styles.panel}>
          <div className={styles.panelInner}>
            <ActivationFlow />
          </div>
        </section>
      </main>
    </TenantTheme>
  );
}
