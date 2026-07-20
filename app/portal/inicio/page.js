"use client";

import Link from "next/link";
import styles from "./page.module.css";

import PortalShell from "@/components/organisms/PortalShell/PortalShell";
import Badge from "@/components/atoms/Badge/Badge";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import { useTenant } from "@/components/providers/TenantTheme/TenantTheme";
import { useResource } from "@/lib/api/useResource";
import { getMe, getGraves, getBillings, billTotal, formatBRL } from "@/lib/api/resources/portal";

export default function PortalHomePage() {
  const tenant = useTenant();
  const sub = (tenant?.subdomain || "").split(".")[0];

  // Link p/ a consulta pública preservando a cidade: no subdomínio o cookie
  // resolve o `sub` (via TenantTheme) e o `?t=` é inofensivo; no modo path é o
  // que carrega o tenant. Evita o slug de demonstração ("demo").
  const consultaHref = sub && sub !== "demo" ? `/consulta-publica?t=${sub}` : "/consulta-publica";

  const me = useResource(({ signal }) => getMe({ signal, tenant: sub }), [sub]);
  const gravesRes = useResource(({ signal }) => getGraves({ signal, tenant: sub }), [sub]);
  const billingsRes = useResource(({ signal }) => getBillings({ signal, tenant: sub }), [sub]);

  const loading = me.loading || gravesRes.loading || billingsRes.loading;
  const error = me.error || gravesRes.error || billingsRes.error;

  function retry() {
    me.refetch();
    gravesRes.refetch();
    billingsRes.refetch();
  }

  if (loading) {
    return (
      <PortalShell active="inicio">
        <div className={styles.page}>
          <Skeleton variant="block" height={120} />
          <Skeleton variant="block" height={90} />
          <Skeleton variant="card" count={2} height={160} />
        </div>
      </PortalShell>
    );
  }

  if (error) {
    return (
      <PortalShell active="inicio">
        <div className={styles.page}>
          <ErrorState onRetry={retry} />
        </div>
      </PortalShell>
    );
  }

  const user = me.data;
  const graves = gravesRes.data ?? [];
  const billings = billingsRes.data ?? [];

  const pending = billings.filter((b) => b.status === "vencido" || b.status === "a_vencer");
  const overdue = billings.filter((b) => b.status === "vencido");
  const nextBill = pending.sort((a, b) => (a.status === "vencido" ? -1 : 1))[0];

  return (
    <PortalShell active="inicio">
      <div className={styles.page}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>{user?.cemetery}</span>
          <h1 className={styles.greet}>Olá, {user?.firstName}.</h1>
          <p className={styles.greetSub}>Aqui está o resumo dos seus jazigos e cobranças.</p>
        </header>

        {/* pendência em destaque */}
        {overdue.length > 0 && nextBill ? (
          <section className={`${styles.alertCard} ${styles.alertDanger}`}>
            <div className={styles.alertBody}>
              <span className={styles.alertLabel}>Cobrança vencida</span>
              <span className={styles.alertTitle}>
                {nextBill.description} — {nextBill.grave}
              </span>
              <span className={styles.alertMeta}>
                Venceu em {nextBill.due} · {formatBRL(billTotal(nextBill))} com multa e juros
              </span>
            </div>
            <Link href="/portal/cobrancas" className={styles.alertCta}>
              Emitir 2ª via
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </section>
        ) : (
          <section className={`${styles.alertCard} ${styles.alertOk}`}>
            <div className={styles.alertBody}>
              <span className={styles.alertLabel}>Tudo em dia</span>
              <span className={styles.alertTitle}>Você não tem cobranças vencidas.</span>
            </div>
          </section>
        )}

        {/* meus jazigos */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Meus jazigos</h2>
            <Link href="/portal/jazigos" className={styles.sectionLink}>Ver todos</Link>
          </div>
          {graves.length === 0 ? (
            <EmptyState
              title="Você ainda não tem jazigos vinculados"
              message="Assim que uma concessão estiver registrada em seu nome, ela aparecerá aqui."
            />
          ) : (
            <div className={styles.graveGrid}>
              {graves.map((grave) => (
                <Link key={grave.id} href={`/portal/jazigos/${grave.id}`} className={styles.graveCard}>
                  <div className={styles.graveTop}>
                    <span className={styles.graveIcon}>
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M7 20V9a5 5 0 0 1 10 0v11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        <path d="M4.5 20h15M10 11h4M12 8.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    {grave.status === "em_dia" ? (
                      <Badge tone="success" dot>Em dia</Badge>
                    ) : (
                      <Badge tone="warning" dot>Pendência</Badge>
                    )}
                  </div>
                  <span className={styles.graveLabel}>{grave.label}</span>
                  <span className={styles.graveTrail}>{grave.trail}</span>
                  <span className={styles.graveMeta}>
                    {grave.type} · {grave.deceased.length} sepultado(s)
                  </span>
                  <span className={styles.graveGo}>
                    Ver detalhes
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* atalhos */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Atalhos</h2>
          <div className={styles.shortcuts}>
            <Link href="/portal/cobrancas" className={styles.shortcut}>
              <span className={styles.shortcutIcon}>
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="6" width="18" height="12.5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <span className={styles.shortcutBody}>
                <strong>Cobranças e 2ª via</strong>
                {pending.length} em aberto
              </span>
            </Link>
            <Link href={consultaHref} className={styles.shortcut}>
              <span className={styles.shortcutIcon}>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <span className={styles.shortcutBody}>
                <strong>Localizar no mapa</strong>
                Rota até a sepultura
              </span>
            </Link>
            <Link href="/portal/perfil" className={styles.shortcut}>
              <span className={styles.shortcutIcon}>
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M5.5 20c1-3.2 3.4-4.8 6.5-4.8s5.5 1.6 6.5 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <span className={styles.shortcutBody}>
                <strong>Meus dados</strong>
                Atualizar contato
              </span>
            </Link>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
