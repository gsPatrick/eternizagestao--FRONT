"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Select from "@/components/atoms/Select/Select";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import StatCard from "@/components/molecules/StatCard/StatCard";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";

import { useResource } from "@/lib/api/useResource";
import { listAuditLogs, normalizeAuditLog, ACTION_GROUPS } from "@/lib/api/resources/audit";

const PER_PAGE = 100; // teto do maxPerPage da API; "Carregar mais" acumula páginas

// Data de hoje / ontem em pt-BR (dd/mm/aaaa) — para rótulos da timeline e stats.
function fmtDate(dt) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

export default function AuditPage() {
  const [group, setGroup] = useState("todas");
  const [userFilter, setUserFilter] = useState("todos");
  const [entityFilter, setEntityFilter] = useState("todas");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);

  // Lista real (paginada, trilha imutável DESC por data). "Carregar mais"
  // incrementa a página e acumula — filtros/contadores/estatísticas rodam no
  // client sobre o que já foi carregado (mesmo padrão do resto do painel).
  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listAuditLogs({ page, perPage: PER_PAGE }, { signal }),
    [page]
  );
  const meta = data?.meta;

  useEffect(() => {
    if (!data?.data) return;
    const fetchedPage = data.meta?.page ?? 1;
    const mapped = data.data.map(normalizeAuditLog).filter(Boolean);
    setRows((prev) => {
      if (fetchedPage <= 1) return mapped;
      const seen = new Set(prev.map((r) => r.id));
      return [...prev, ...mapped.filter((r) => !seen.has(r.id))];
    });
  }, [data]);

  const initialLoading = loading && page === 1;
  const loadingMore = loading && page > 1;
  const totalItems = meta?.totalItems ?? rows.length;
  const hasMore = meta ? page < meta.totalPages : false;

  const now = new Date();
  const todayStr = fmtDate(now);
  const yesterdayStr = fmtDate(new Date(now.getTime() - 86400000));
  const monthCaption = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  function inThisMonth(iso) {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  // Opções de filtro derivadas do que já veio da API (sem listas fixas).
  const userOptions = useMemo(
    () => Array.from(new Set(rows.map((e) => e.user))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );
  const entityOptions = useMemo(
    () => Array.from(new Set(rows.map((e) => e.entity).filter((x) => x && x !== "—"))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const detail = rows.find((e) => e.id === detailId);

  const counts = useMemo(() => {
    const map = {};
    ACTION_GROUPS.forEach((g) => {
      map[g.key] = g.actions
        ? rows.filter((e) => g.actions.includes(e.action)).length
        : rows.length;
    });
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const activeGroup = ACTION_GROUPS.find((g) => g.key === group);
    const q = query.trim().toLowerCase();
    return rows.filter((e) => {
      if (activeGroup?.actions && !activeGroup.actions.includes(e.action)) return false;
      if (userFilter !== "todos" && e.user !== userFilter) return false;
      if (entityFilter !== "todas" && e.entity !== entityFilter) return false;
      if (
        q &&
        !e.phrase.toLowerCase().includes(q) &&
        !e.user.toLowerCase().includes(q) &&
        !e.entity.toLowerCase().includes(q) &&
        !e.ip.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, group, userFilter, entityFilter, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    });
    const label = (date) =>
      date === todayStr ? `Hoje — ${date}` : date === yesterdayStr ? `Ontem — ${date}` : date;
    return Array.from(map, ([date, events]) => ({ date, label: label(date), events }));
  }, [filtered, todayStr, yesterdayStr]);

  const eventsToday = rows.filter((e) => e.date === todayStr);
  const activeUsersToday = new Set(eventsToday.map((e) => e.user)).size;
  const deletionsMonth = rows.filter((e) => e.action === "exclusao" && inThisMonth(e.createdAt)).length;
  const exportsMonth = rows.filter((e) => e.action === "exportacao" && inThisMonth(e.createdAt)).length;

  function loadMore() {
    if (hasMore && !loading) setPage((p) => p + 1);
  }

  // ---- estados: carregando (inicial) → erro → vazio → conteúdo ----
  let body;
  if (initialLoading) {
    body = (
      <div className={styles.timeline}>
        <Skeleton variant="row" count={8} />
      </div>
    );
  } else if (error && !rows.length) {
    body = <ErrorState onRetry={refetch} />;
  } else if (!rows.length) {
    body = (
      <EmptyState
        title="Nenhum registro de auditoria no período"
        message="Assim que uma ação for realizada no sistema — cadastro, edição, acesso, pagamento ou emissão de documento — ela aparece aqui, na trilha imutável."
      />
    );
  } else if (grouped.length === 0) {
    body = <div className={styles.emptyTimeline}>Nenhum evento encontrado com os filtros atuais.</div>;
  } else {
    body = (
      <div className={styles.timeline}>
        {grouped.map((day) => (
          <section key={day.date} className={styles.dayGroup}>
            <h2 className={styles.dayHeader}>
              {day.label}
              <span className={styles.dayCount}>{day.events.length} evento(s)</span>
            </h2>
            <div className={styles.eventList}>
              {day.events.map((e) => (
                <button key={e.id} className={styles.eventRow} onClick={() => setDetailId(e.id)}>
                  <span className={styles.eventTime}>{e.time}</span>
                  <span className={styles.eventRail}>
                    <span className={`${styles.eventDot} ${styles[`dot_${e.action}`] || ""}`} />
                  </span>
                  <Avatar name={e.user} size="sm" />
                  <span className={styles.eventMain}>
                    <span className={styles.eventPhrase}>{e.phrase}</span>
                    <span className={styles.eventEntity}>{e.entity}</span>
                  </span>
                  <span className={styles.eventBadge}>
                    <Badge tone={e.actionTone}>{e.actionLabel}</Badge>
                  </span>
                  <span className={styles.eventIp}>{e.ip}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const showFoot = !initialLoading && !(error && !rows.length) && rows.length > 0;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Auditoria</h1>
          <p className={styles.subtitle}>Trilha imutável de tudo que acontece no sistema</p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setExportOpen(true)}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            Exportar
          </Button>
        </div>
      </header>

      <div className={styles.stats}>
        <StatCard label="Eventos hoje" value={String(eventsToday.length)} caption={`registrados em ${todayStr}`} />
        <StatCard label="Usuários ativos hoje" value={String(activeUsersToday)} caption="com ações na trilha" />
        <StatCard label="Exclusões no mês" value={String(deletionsMonth)} caption={monthCaption} />
        <StatCard label="Exportações no mês" value={String(exportsMonth)} caption={monthCaption} />
      </div>

      <Alert tone="info">
        Registros de auditoria não podem ser editados nem excluídos — exigência de conformidade.
      </Alert>

      <div className={styles.statusChips}>
        {ACTION_GROUPS.map((g) => (
          <button
            key={g.key}
            className={`${styles.chip} ${group === g.key ? styles.chipActive : ""}`}
            onClick={() => setGroup(g.key)}
          >
            {g.label}
            <span className={styles.chipCount}>{counts[g.key]}</span>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <svg viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
            <path d="m13.5 13.5-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            placeholder="Buscar por usuário, entidade ou IP…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className={styles.filters}>
          <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="todos">Todos os usuários</option>
            {userOptions.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
          <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
            <option value="todas">Todas as entidades</option>
            {entityOptions.map((ent) => <option key={ent} value={ent}>{ent}</option>)}
          </Select>
        </div>
      </div>

      {body}

      {showFoot && (
        <div className={styles.timelineFoot}>
          <span className={styles.timelineFootText}>
            Mostrando {filtered.length} de {totalItems} eventos
          </span>
          {hasMore && (
            <Button variant="secondary" size="sm" loading={loadingMore} onClick={loadMore}>
              Carregar mais
            </Button>
          )}
        </div>
      )}

      {/* ---------- detalhe do evento ---------- */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail ? detail.actionLabel : ""}
        subtitle={detail ? `${detail.date} às ${detail.time}` : ""}
        width={640}
        footer={
          <Button variant="ghost" onClick={() => setDetailId(null)}>Fechar</Button>
        }
      >
        {detail && (
          <div className={styles.detailBody}>
            <div className={styles.docHero}>
              <Avatar name={detail.user} size="lg" />
              <div className={styles.docHeroInfo}>
                <Badge tone={detail.actionTone}>{detail.actionLabel}</Badge>
                <span className={styles.docHeroMeta}>
                  {detail.user} · {detail.date} às {detail.time}
                </span>
                <span className={styles.docHeroMeta}>
                  IP {detail.ip} · {detail.device}
                </span>
              </div>
            </div>

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Evento</span>
              <p className={styles.refText}>{detail.phrase}</p>
            </section>

            {detail.changes && (
              <section className={styles.detailSection}>
                <span className={styles.sectionLabel}>Alterações campo a campo</span>
                <div className={styles.diffWrap}>
                  <table className={styles.diffTable}>
                    <thead>
                      <tr>
                        <th>Campo</th>
                        <th>Valor anterior</th>
                        <th>Valor novo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.changes.map((c) => (
                        <tr key={c.field}>
                          <td className={styles.diffField}>{c.field}</td>
                          <td><span className={styles.diffOldValue}>{c.from}</span></td>
                          <td><span className={styles.diffNewValue}>{c.to}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {detail.snapshot && (
              <section className={styles.detailSection}>
                <span className={styles.sectionLabel}>{detail.snapshotLabel}</span>
                <div className={styles.sigBox}>
                  {detail.snapshot.map((f) => (
                    <div key={f.field} className={styles.sigRow}>
                      <span className={styles.sigLabel}>{f.field}</span>
                      <span className={styles.sigValue}>{f.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Metadados</span>
              <div className={styles.sigBox}>
                <div className={styles.sigRow}>
                  <span className={styles.sigLabel}>Entidade afetada</span>
                  <span className={styles.sigValue}>{detail.entity}</span>
                </div>
                <div className={styles.sigRow}>
                  <span className={styles.sigLabel}>Dispositivo</span>
                  <span className={styles.sigValue}>{detail.device}</span>
                </div>
                <div className={styles.sigRow}>
                  <span className={styles.sigLabel}>Endereço IP</span>
                  <span className={styles.sigHash}>{detail.ip}</span>
                </div>
                {detail.meta.map((m) => (
                  <div key={m.label} className={styles.sigRow}>
                    <span className={styles.sigLabel}>{m.label}</span>
                    <span className={styles.sigHash}>{m.value}</span>
                  </div>
                ))}
                <div className={styles.sigRow}>
                  <span className={styles.sigLabel}>ID do registro</span>
                  <span className={styles.sigHash}>{detail.id}</span>
                </div>
              </div>
            </section>

            <p className={styles.immutableNote}>
              Registro imutável — não pode ser editado nem excluído (exigência de conformidade).
            </p>
          </div>
        )}
      </Modal>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity="auditoria"
        totalCount={totalItems}
        filteredCount={filtered.length}
      />
    </div>
  );
}
