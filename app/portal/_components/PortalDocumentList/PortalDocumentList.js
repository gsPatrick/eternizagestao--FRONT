"use client";

import { useState } from "react";
import styles from "./PortalDocumentList.module.css";

import Badge from "@/components/atoms/Badge/Badge";
import Button from "@/components/atoms/Button/Button";
import { downloadPortalDocument } from "@/lib/api/resources/portal";

/**
 * Lista de documentos oficiais do titular (Portal da Família) com o botão
 * "Baixar PDF". Usada na tela /portal/documentos e no detalhe do jazigo.
 * Pasta `_components`: privada do app router (não vira rota).
 *
 * @param {{ documents: object[], tenant: string, showGrave?: boolean }} props
 *   documents — itens já adaptados por listPortalDocuments
 *   tenant    — subdomínio do cliente (header obrigatório nas rotas do portal)
 *   showGrave — exibe o jazigo/gaveta do documento (desligado no detalhe do jazigo)
 */

const TYPE_TONE = {
  certidao_perpetuidade: "navy",
  autorizacao_sepultamento: "success",
};

const TYPE_SHORT = {
  certidao_perpetuidade: "Certidão",
  autorizacao_sepultamento: "Autorização",
};

export default function PortalDocumentList({ documents, tenant, showGrave = true }) {
  const [downloading, setDownloading] = useState(null);
  const [failed, setFailed] = useState(null);

  async function download(doc) {
    setDownloading(doc.id);
    setFailed(null);
    try {
      await downloadPortalDocument(doc, { tenant });
    } catch (e) {
      setFailed(doc.id);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <ul className={styles.list}>
      {documents.map((doc) => {
        const meta = [
          doc.deceased ? `Sepultado(a): ${doc.deceased}` : null,
          showGrave && doc.grave ? doc.grave : null,
        ].filter(Boolean);
        return (
          <li key={doc.id} className={styles.card}>
            <span className={styles.icon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M13 3v5h5M9 13h6M9 16.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>

            <div className={styles.body}>
              <div className={styles.head}>
                <strong className={styles.title}>{doc.title}</strong>
                <Badge tone={TYPE_TONE[doc.type] || "navy"}>
                  {TYPE_SHORT[doc.type] || "Documento"}
                </Badge>
              </div>
              <span className={styles.number}>
                Nº {doc.number}
                {doc.isReissue ? " · 2ª via" : ""}
                {doc.issuedAt ? ` · emitido em ${doc.issuedAt}` : ""}
              </span>
              {meta.length > 0 && <span className={styles.meta}>{meta.join(" · ")}</span>}
              {failed === doc.id && (
                <span className={styles.error} role="alert">
                  Não foi possível baixar agora. Tente novamente em instantes.
                </span>
              )}
            </div>

            <div className={styles.action}>
              <Button
                variant="secondary"
                size="sm"
                loading={downloading === doc.id}
                disabled={Boolean(downloading) && downloading !== doc.id}
                onClick={() => download(doc)}
                iconLeft={
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v8m0 0L5 7m3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 12.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                }
              >
                {downloading === doc.id ? "Gerando PDF…" : "Baixar PDF"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
