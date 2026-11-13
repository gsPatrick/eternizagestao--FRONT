"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

import PortalShell from "@/components/organisms/PortalShell/PortalShell";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import PortalDocumentList from "../_components/PortalDocumentList/PortalDocumentList";
import { useTenantSubdomain } from "@/components/providers/TenantTheme/TenantTheme";
import { useResource } from "@/lib/api/useResource";
import { listPortalDocuments } from "@/lib/api/resources/portal";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "certidao_perpetuidade", label: "Certidões" },
  { key: "autorizacao_sepultamento", label: "Autorizações" },
];

export default function PortalDocumentosPage() {
  // Cidade do usuário logado (cookie/`?t=`, síncrono). Só busca com ela
  // resolvida — o fallback "demo" derrubava a sessão (401 na API).
  const { sub, ready } = useTenantSubdomain();

  const res = useResource(
    ({ signal }) => (sub ? listPortalDocuments({ signal, tenant: sub }) : Promise.resolve(null)),
    [sub, ready]
  );
  const { data, error, refetch } = res;
  const loading = !ready || res.loading;
  const documents = data ?? [];

  const [filter, setFilter] = useState("todos");

  const counts = useMemo(() => {
    const out = { todos: documents.length };
    for (const f of FILTERS) {
      if (f.key !== "todos") out[f.key] = documents.filter((d) => d.type === f.key).length;
    }
    return out;
  }, [documents]);

  const filtered = useMemo(
    () => (filter === "todos" ? documents : documents.filter((d) => d.type === filter)),
    [documents, filter]
  );

  return (
    <PortalShell active="documentos">
      <div className={styles.page}>
        <header className={styles.hero}>
          <h1 className={styles.title}>Documentos</h1>
          <p className={styles.subtitle}>
            Certidões de perpetuidade e autorizações de sepultamento dos seus jazigos.
          </p>
        </header>

        {loading ? (
          <Skeleton variant="card" count={3} height={88} />
        ) : error ? (
          <ErrorState onRetry={refetch} />
        ) : documents.length === 0 ? (
          <EmptyState
            title="Nenhum documento disponível"
            message="Quando a administração emitir uma certidão ou autorização para os seus jazigos, ela aparecerá aqui para download."
          />
        ) : (
          <>
            {/* filtros por tipo */}
            <div className={styles.chips} role="tablist" aria-label="Filtrar documentos">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  className={`${styles.chip} ${filter === f.key ? styles.chipActive : ""}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  <span className={styles.chipCount}>{counts[f.key] || 0}</span>
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <p className={styles.emptyText}>Nenhum documento neste filtro.</p>
            ) : (
              <PortalDocumentList documents={filtered} tenant={sub} />
            )}

            <p className={styles.hint}>
              O PDF é gerado na hora com os dados atuais do cadastro e mantém o
              número oficial do documento.
            </p>
          </>
        )}
      </div>
    </PortalShell>
  );
}
