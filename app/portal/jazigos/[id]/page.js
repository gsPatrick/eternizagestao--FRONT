"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "./page.module.css";

import PortalShell from "@/components/organisms/PortalShell/PortalShell";
import Badge from "@/components/atoms/Badge/Badge";
import Button from "@/components/atoms/Button/Button";
import Modal from "@/components/molecules/Modal/Modal";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import FileViewer from "@/components/organisms/FileViewer/FileViewer";
import dynamic from "next/dynamic";
import { useTenant } from "@/components/providers/TenantTheme/TenantTheme";

// mapa real (Leaflet/OSM) — client-only
const PublicCemeteryMap = dynamic(
  () => import("@/components/organisms/PublicCemeteryMap/PublicCemeteryMap"),
  { ssr: false }
);
import { useResource } from "@/lib/api/useResource";
import { getGraves } from "@/lib/api/resources/portal";

const TIMELINE_META = {
  sepultamento: { tone: "navy", label: "Sepultamento" },
  manutencao: { tone: "warning", label: "Manutenção" },
  reforma: { tone: "warning", label: "Reforma" },
  concessao: { tone: "success", label: "Concessão" },
  cobranca: { tone: "warning", label: "Cobrança" },
  pagamento: { tone: "success", label: "Pagamento" },
};

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function PortalJazigoDetailPage() {
  const params = useParams();
  const tenant = useTenant();
  const sub = (tenant?.subdomain || "").split(".")[0];

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => getGraves({ signal, tenant: sub }),
    [sub]
  );

  const [mapOpen, setMapOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);

  const grave = (data ?? []).find((item) => item.id === params.id);

  if (loading) {
    return (
      <PortalShell active="jazigos">
        <div className={styles.page}>
          <Skeleton variant="block" height={180} />
          <Skeleton variant="card" count={2} height={120} />
        </div>
      </PortalShell>
    );
  }

  if (error) {
    return (
      <PortalShell active="jazigos">
        <div className={styles.page}>
          <ErrorState onRetry={refetch} />
        </div>
      </PortalShell>
    );
  }

  if (!grave) {
    return (
      <PortalShell active="jazigos">
        <div className={styles.page}>
          <Link href="/portal/jazigos" className={styles.back}>
            <svg viewBox="0 0 16 16" fill="none">
              <path d="m10 4-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Meus jazigos
          </Link>
          <EmptyState
            title="Jazigo não encontrado"
            message="Este jazigo não está vinculado à sua conta ou não existe mais."
          />
        </div>
      </PortalShell>
    );
  }

  const isPending = grave.status === "pendente";
  const hasMap = Boolean(
    grave.cemeteryId &&
      (grave.geoPolygon || (grave.latitude != null && grave.longitude != null))
  );

  return (
    <PortalShell active="jazigos">
      <div className={styles.page}>
        <Link href="/portal/jazigos" className={styles.back}>
          <svg viewBox="0 0 16 16" fill="none">
            <path d="m10 4-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Meus jazigos
        </Link>

        {/* ---------- hero ---------- */}
        <header className={styles.hero}>
          <div className={styles.heroHead}>
            <span className={styles.heroIcon}>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 20V9a5 5 0 0 1 10 0v11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M4.5 20h15M10 11h4M12 8.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            {isPending ? (
              <Badge tone="warning" dot>Pendência</Badge>
            ) : (
              <Badge tone="success" dot>Em dia</Badge>
            )}
          </div>

          <h1 className={styles.heroTitle}>{grave.label}</h1>
          <p className={styles.heroTrail}>{grave.trail}</p>

          <div className={styles.chips}>
            <span className={styles.chip}>
              <span className={styles.chipLabel}>Tipo</span>
              {grave.type}
            </span>
            <span className={styles.chip}>
              <span className={styles.chipLabel}>Desde</span>
              {grave.since}
            </span>
            <span className={styles.chip}>
              <span className={styles.chipLabel}>Contrato</span>
              {grave.contract}
            </span>
          </div>

          <div className={styles.heroActions}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setMapOpen(true)}
              iconLeft={
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              }
            >
              Ver no mapa
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setContractOpen(true)}
              iconLeft={
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M13 3v5h5M9 13h6M9 16.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              }
            >
              Ver contrato
            </Button>
          </div>
        </header>

        {/* ---------- pendência ---------- */}
        {isPending && (
          <section className={styles.pending}>
            <span className={styles.pendingIcon}>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 8v5M12 16.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <div className={styles.pendingBody}>
              <span className={styles.pendingTitle}>Este jazigo tem uma cobrança em aberto</span>
              <span className={styles.pendingText}>
                Regularize para manter a concessão em dia — leva poucos minutos.
              </span>
            </div>
            <Link href="/portal/cobrancas" className={styles.pendingCta}>
              Regularizar
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </section>
        )}

        {/* ---------- sepultados ---------- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sepultados neste jazigo</h2>
          {grave.deceased.length === 0 ? (
            <EmptyState
              title="Nenhum sepultado registrado"
              message="Ainda não há sepultamentos registrados neste jazigo."
            />
          ) : (
            <div className={styles.people}>
              {grave.deceased.map((person) => (
                <article key={person.name} className={styles.personCard}>
                  <span className={styles.avatar}>{initials(person.name)}</span>
                  <div className={styles.personBody}>
                    <span className={styles.personName}>{person.name}</span>
                    <span className={styles.personRole}>{person.role}</span>
                    <span className={styles.personDates}>
                      {person.birth} — {person.death}
                    </span>
                    <span className={styles.personBuried}>
                      Sepultado em {person.buried}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ---------- histórico ---------- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Histórico</h2>
          {grave.timeline.length === 0 ? (
            <EmptyState
              title="Sem histórico ainda"
              message="Os eventos deste jazigo aparecerão aqui conforme forem registrados."
            />
          ) : (
            <ol className={styles.timeline}>
              {grave.timeline.map((event, index) => {
                const meta = TIMELINE_META[event.type] || TIMELINE_META.sepultamento;
                return (
                  <li key={`${event.date}-${index}`} className={styles.event}>
                    <span className={`${styles.eventDot} ${styles[`dot_${event.type}`] || ""}`} aria-hidden="true" />
                    <div className={styles.eventBody}>
                      <div className={styles.eventHead}>
                        <span className={styles.eventDate}>{event.date}</span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <span className={styles.eventText}>{event.text}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* ---------- modal mapa ---------- */}
      <Modal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        title="Localização no cemitério"
        subtitle={grave.trail || grave.cemetery}
        width={620}
      >
        {hasMap ? (
          <>
            <PublicCemeteryMap
              cemeteryId={grave.cemeteryId}
              tenant={sub}
              focusGraveId={grave.id}
              grave={{
                graveId: grave.id,
                code: grave.code,
                block: grave.mapLocation?.block,
                street: grave.mapLocation?.street,
                lot: grave.mapLocation?.lot,
                geoPolygon: grave.geoPolygon,
                latitude: grave.latitude,
                longitude: grave.longitude,
              }}
              height={360}
            />
            <p className={styles.mapHint}>
              Rota a partir da entrada do cemitério até o jazigo. No local, siga a
              rota guiada pelo caminho destacado.
            </p>
          </>
        ) : (
          <EmptyState
            title="Localização ainda não disponível"
            message="Este jazigo ainda não foi demarcado no mapa do cemitério. Assim que a administração concluir a demarcação, a localização aparecerá aqui."
          />
        )}
      </Modal>

      {/* ---------- contrato (só quando houver o arquivo REAL) ---------- */}
      {grave.contractUrl && (
        <FileViewer
          open={contractOpen}
          onClose={() => setContractOpen(false)}
          file={{ name: `Contrato ${grave.contract}.pdf`, url: grave.contractUrl }}
        />
      )}
    </PortalShell>
  );
}
