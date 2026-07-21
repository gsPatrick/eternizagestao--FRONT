"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/molecules/Modal/Modal";
import Button from "@/components/atoms/Button/Button";
import styles from "./IntegrationRequired.module.css";

/**
 * "Você precisa configurar X antes de continuar."
 *
 * A API passou a RECUSAR as ações que dependem de uma integração não
 * configurada, em vez de fingir sucesso (e-mail que não sai, boleto falso).
 * Recusar é o certo — mas um 503 seco não diz ao operador o que fazer.
 *
 * Este modal traduz o código do erro em: o que falta, por que a ação não pôde
 * ser concluída, e o LINK para a tela onde se resolve. Uma fonte só, para a
 * mensagem ser idêntica em todo o painel.
 */

// código do erro da API -> o que dizer e para onde mandar
const INTEGRATIONS = {
  EMAIL_NOT_CONFIGURED: {
    title: "Configure o e-mail para continuar",
    what: "e-mail",
    body:
      "Esta ação depende do envio de e-mail, e nenhum servidor de e-mail está "
      + "configurado para esta cidade. Nada foi enviado.",
    href: "/painel/configuracoes/notificacoes",
    cta: "Configurar e-mail",
  },
  WHATSAPP_NOT_CONFIGURED: {
    title: "Configure o WhatsApp para continuar",
    what: "WhatsApp",
    body:
      "Esta ação depende do envio por WhatsApp, e o servidor de mensagens não "
      + "está configurado para esta cidade. Nada foi enviado.",
    href: "/painel/configuracoes/notificacoes",
    cta: "Configurar WhatsApp",
  },
  PAYMENT_GATEWAY_NOT_CONFIGURED: {
    title: "Configure o método de pagamento para continuar",
    what: "meio de pagamento",
    body:
      "Para emitir cobranças é preciso conectar a conta Asaas desta cidade — é "
      + "ela que gera o boleto e o PIX. Nenhuma cobrança foi criada.",
    href: "/painel/configuracoes/financeiro",
    cta: "Configurar pagamento",
  },
  SIGNATURE_PROVIDER_NOT_CONFIGURED: {
    title: "Assinatura eletrônica indisponível",
    what: "assinatura eletrônica",
    // Sem tela de configuração de propósito: não há provedor contratado, então
    // não existe o que o operador possa preencher sozinho.
    body:
      "Nenhum provedor de assinatura eletrônica está contratado para esta "
      + "instalação. O documento NÃO foi enviado para assinatura — ele continua "
      + "disponível para download e assinatura manual.",
    href: null,
    cta: null,
  },
};

/**
 * Extrai a integração faltante a partir do erro da API.
 * Devolve null quando o erro é outro — aí a tela trata como erro normal.
 */
export function integrationFromError(error) {
  const code = error?.code;
  return code && INTEGRATIONS[code] ? { code, ...INTEGRATIONS[code] } : null;
}

/**
 * Cola entre o catch da tela e o modal.
 *
 * Uso no catch:  `if (guard.capture(e)) return;`  — devolve true quando o erro
 * era "integração não configurada" e o modal assumiu; false quando é um erro
 * comum, que a tela continua tratando do jeito dela.
 */
export function useIntegrationGuard() {
  const [integration, setIntegration] = useState(null);
  return {
    integration,
    capture(error) {
      const found = integrationFromError(error);
      if (found) setIntegration(found);
      return Boolean(found);
    },
    close: () => setIntegration(null),
  };
}

export default function IntegrationRequired({ integration, onClose }) {
  if (!integration) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={integration.title}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {integration.href && (
            <Link href={integration.href} className={styles.ctaLink}>
              <Button>{integration.cta}</Button>
            </Link>
          )}
        </>
      }
    >
      <p>{integration.body}</p>
      {integration.href && (
        <p className={styles.note}>
          Quem faz essa configuração é o administrador da cidade. Depois de
          salvar, refaça a ação — nada se perdeu.
        </p>
      )}
    </Modal>
  );
}
