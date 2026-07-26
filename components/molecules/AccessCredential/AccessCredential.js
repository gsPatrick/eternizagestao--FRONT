"use client";

import { useState } from "react";
import Input from "@/components/atoms/Input/Input";
import Button from "@/components/atoms/Button/Button";
import FormField from "@/components/molecules/FormField/FormField";
import Alert from "@/components/molecules/Alert/Alert";

/**
 * Escolha de COMO a pessoa recebe o acesso, reutilizada em todo lugar que cria
 * conta (usuários do painel, admin da cidade, etc.):
 *
 *   - "email"  → envia convite por e-mail e a PESSOA cadastra a própria senha;
 *   - "senha"  → QUEM CRIA define a senha agora e depois COPIA as credenciais
 *                para repassar (WhatsApp, pessoalmente, etc.).
 *
 * Este componente cuida só da UI do formulário (a escolha + o campo de senha).
 * O envio em si fica com a tela, que chama o endpoint certo conforme o modo.
 */

// Senha legível e forte o suficiente (sem caracteres ambíguos), para o modo
// "definir agora" — o operador pode gerar em vez de inventar.
export function generateReadablePassword(len = 10) {
  const abc = "abcdefghijkmnpqrstuvwxyz";
  const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const num = "23456789";
  const all = abc + ABC + num;
  // sem Math.random no build de workflow, mas aqui é runtime do browser → ok
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let out = pick(abc) + pick(ABC) + pick(num);
  for (let i = out.length; i < len; i += 1) out += pick(all);
  return out;
}

export function AccessModeFields({
  mode,
  onModeChange,
  password,
  onPasswordChange,
  emailConfigured = true,
}) {
  const btn = (value, label, hint) => (
    <button
      type="button"
      onClick={() => onModeChange(value)}
      style={{
        flex: 1,
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1.5px solid ${mode === value ? "var(--color-navy, #032e59)" : "var(--color-mist, #dde3eb)"}`,
        background: mode === value ? "var(--color-navy-soft, #e8eef6)" : "transparent",
        cursor: "pointer",
      }}
    >
      <strong style={{ display: "block", fontSize: 14 }}>{label}</strong>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{hint}</span>
    </button>
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Como enviar o acesso</span>
      <div style={{ display: "flex", gap: 8 }}>
        {btn("email", "Enviar por e-mail", "A pessoa cria a própria senha")}
        {btn("senha", "Definir a senha agora", "Você define e copia para enviar")}
      </div>

      {mode === "email" && !emailConfigured && (
        <Alert tone="warning">
          O envio de e-mail ainda não está configurado — o convite não sairá.
          Use "Definir a senha agora" ou configure o e-mail em Configurações.
        </Alert>
      )}

      {mode === "senha" && (
        <FormField label="Senha de acesso" required hint="Mínimo de 8 caracteres.">
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              type="text"
              autoComplete="off"
              placeholder="Defina a senha"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => onPasswordChange(generateReadablePassword())}>
              Gerar
            </Button>
          </div>
        </FormField>
      )}
    </div>
  );
}

/**
 * Bloco de credenciais criadas + botão COPIAR, mostrado depois de criar a conta
 * no modo "senha". Copia um texto pronto para colar no WhatsApp/e-mail.
 */
export function CredentialResult({ name, email, password, loginUrl, title = "Acesso criado" }) {
  const [copied, setCopied] = useState(false);

  const url = loginUrl
    ? (loginUrl.startsWith("http") ? loginUrl : `https://${loginUrl}`)
    : (typeof window !== "undefined" ? window.location.origin : "");

  const text = [
    `Acesso ao sistema Eterniza Gestão${name ? ` — ${name}` : ""}`,
    url ? `Endereço: ${url}` : null,
    `E-mail: ${email}`,
    `Senha: ${password}`,
  ].filter(Boolean).join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback: seleção manual via textarea temporária
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* noop */ }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Alert tone="success" title={title}>
      <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 13 }}>
          Copie e envie estas credenciais para a pessoa (WhatsApp, e-mail, etc.).
          Peça para trocar a senha no primeiro acesso.
        </span>
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 13,
            background: "var(--color-surface, #fff)",
            border: "1px solid var(--color-mist, #dde3eb)",
            borderRadius: 8,
            padding: "10px 12px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {text}
        </div>
        <div>
          <Button type="button" size="sm" onClick={copy}>
            {copied ? "Copiado!" : "Copiar credenciais"}
          </Button>
        </div>
      </div>
    </Alert>
  );
}
