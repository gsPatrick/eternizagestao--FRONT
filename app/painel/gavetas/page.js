"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Badge from "@/components/atoms/Badge/Badge";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import StatCard from "@/components/molecules/StatCard/StatCard";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Pagination from "@/components/molecules/Pagination/Pagination";
import FormField from "@/components/molecules/FormField/FormField";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import DataTable from "@/components/organisms/DataTable/DataTable";

import { useResource, useMutation } from "@/lib/api/useResource";
import {
  listDrawers,
  getDrawerStatusCounts,
  getDrawerSummary,
  changeGraveStatus,
  listGraveStatuses,
  listCemeteries,
  listBlocks,
  adaptGraveRow,
  normalizeStatusSlug,
  frontStatusToApiSlug,
} from "@/lib/api/resources/gavetas";

// Mesma identidade visual das situações de Sepulturas (chips/badges).
const STATUS_META = {
  livre: { label: "Livre", tone: "success" },
  ocupada: { label: "Ocupada", tone: "navy" },
  reservada: { label: "Reservada", tone: "warning" },
  manutencao: { label: "Em manutenção", tone: "neutral" },
  interditada: { label: "Interditada", tone: "danger" },
  perpetuidade: { label: "Em perpetuidade", tone: "inverse" },
};

const statusMeta = (key, fallbackName) =>
  STATUS_META[key] || { label: fallbackName || key, tone: "neutral" };

const PER_PAGE = 30;

export default function DrawersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cemeteryFilter, setCemeteryFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);

  // ---- filtros de estrutura (cemitério + quadra) ----
  const { data: cemsData } = useResource(({ signal }) => listCemeteries({ signal }), []);
  const cemeteries = cemsData?.data ?? [];
  // cemitério "efetivo" para carregar as quadras (o selecionado, ou o primeiro)
  const activeCemeteryId = cemeteryFilter || cemeteries[0]?.id;
  const { data: blocksData } = useResource(
    ({ signal }) => (activeCemeteryId ? listBlocks(activeCemeteryId, { signal }) : Promise.resolve([])),
    [activeCemeteryId]
  );
  const blocks = blocksData ?? [];

  // ---- listagem de gavetas (grave.unitType === 'gaveta') ----
  const listParams = useMemo(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search.trim() || undefined,
      cemeteryId: cemeteryFilter || undefined,
      blockId: blockFilter || undefined,
      statusSlug: statusFilter ? frontStatusToApiSlug(statusFilter) : undefined,
    }),
    [page, search, cemeteryFilter, blockFilter, statusFilter]
  );

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listDrawers(listParams, { signal }),
    [listParams]
  );
  const rows = useMemo(
    () =>
      (data?.data ?? []).map((g) => ({
        ...adaptGraveRow(g),
        capacity: g.capacity ?? 0,
        activeBurials: g.activeBurials ?? 0,
        available: g.available ?? 0,
      })),
    [data]
  );
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  // ---- contadores por situação (StatCards + chips) ----
  const { data: countsData } = useResource(
    ({ signal }) =>
      getDrawerStatusCounts(
        {
          search: search.trim() || undefined,
          cemeteryId: cemeteryFilter || undefined,
          blockId: blockFilter || undefined,
        },
        { signal }
      ),
    [search, cemeteryFilter, blockFilter]
  );
  const statusCounts = useMemo(() => {
    const acc = {};
    (countsData?.byStatus ?? []).forEach((s) => {
      acc[normalizeStatusSlug(s.slug)] = s.count;
    });
    return acc;
  }, [countsData]);
  const totalCount = countsData?.total ?? meta?.totalItems ?? 0;

  const columns = [
    {
      key: "code",
      label: "Código",
      render: (row) => <code className={styles.code}>{row.code}</code>,
    },
    {
      key: "location",
      label: "Localização",
      render: (row) => (
        <span className={styles.location}>
          Quadra {row.block} <em>›</em> {row.street} <em>›</em> {row.lot}
        </span>
      ),
    },
    { key: "capacity", label: "Capacidade", align: "right" },
    {
      key: "occupancy",
      label: "Ocupação",
      align: "right",
      render: (row) => <span className={styles.occupancy}>{row.occupancy}</span>,
    },
    {
      key: "status",
      label: "Situação",
      render: (row) => (
        <Badge tone={statusMeta(row.status, row.statusName).tone} dot>
          {statusMeta(row.status, row.statusName).label}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <button className={styles.detailLink} onClick={() => setDetailId(row.id)}>
          Detalhes
        </button>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Gavetas</h1>
          <p className={styles.subtitle}>
            Inventário de gavetas e nichos · {totalCount.toLocaleString("pt-BR")} unidades
          </p>
        </div>
      </header>

      <div className={styles.stats}>
        <StatCard label="Gavetas cadastradas" value={String(totalCount)} caption="unidades do tipo gaveta" />
        <StatCard label="Ocupadas" value={String(statusCounts.ocupada || 0)} caption="com sepultamento ativo" />
        <StatCard label="Livres" value={String(statusCounts.livre || 0)} caption="disponíveis para uso" />
        <StatCard label="Reservadas" value={String(statusCounts.reservada || 0)} caption="reserva vigente" />
      </div>

      <div className={styles.statusChips}>
        <button
          className={`${styles.chip} ${statusFilter === "" ? styles.chipActive : ""}`}
          onClick={() => { setStatusFilter(""); setPage(1); }}
        >
          Todas <span className={styles.chipCount}>{totalCount}</span>
        </button>
        {Object.entries(STATUS_META).map(([key, m]) => (
          <button
            key={key}
            className={`${styles.chip} ${statusFilter === key ? styles.chipActive : ""}`}
            onClick={() => { setStatusFilter(statusFilter === key ? "" : key); setPage(1); }}
          >
            <span className={`${styles.chipDot} ${styles[`dot_${key}`]}`} />
            {m.label}
            <span className={styles.chipCount}>{statusCounts[key] || 0}</span>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Input
            placeholder="Buscar por código ou concessionário…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          />
        </div>
        <div className={styles.filters}>
          <Select
            value={cemeteryFilter}
            onChange={(e) => { setCemeteryFilter(e.target.value); setBlockFilter(""); setPage(1); }}
          >
            <option value="">Todos os cemitérios</option>
            {cemeteries.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select value={blockFilter} onChange={(e) => { setBlockFilter(e.target.value); setPage(1); }}>
            <option value="">Todas as quadras</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>Quadra {b.name || b.code}</option>
            ))}
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : loading ? (
        <div className={styles.desktopTable}>
          <Skeleton variant="row" count={8} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhuma gaveta cadastrada"
          message="Gavetas são unidades vinculadas a jazigos ou túmulos. Cadastre-as no módulo de Sepulturas (tipo Gaveta) para vê-las aqui."
        />
      ) : (
        <>
          <div className={styles.desktopTable}>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              footer={
                <>
                  <span>{rows.length} de {totalCount} gavetas</span>
                  <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
              }
            />
          </div>

          {/* mobile: cards tocáveis (mesma UX de Sepulturas) */}
          <div className={styles.mobileList}>
            {rows.map((row) => (
              <button key={row.id} className={styles.mobileCard} onClick={() => setDetailId(row.id)}>
                <div className={styles.mobileCardTop}>
                  <code className={styles.code}>{row.code}</code>
                  <Badge tone={statusMeta(row.status, row.statusName).tone} dot>
                    {statusMeta(row.status, row.statusName).label}
                  </Badge>
                </div>
                <div className={styles.mobileCardBody}>
                  <span className={styles.mobileCardLocation}>
                    Quadra {row.block} · {row.street} · {row.lot}
                  </span>
                  <span className={styles.mobileCardOwner}>
                    {row.owner === "—" ? "Sem concessão" : row.owner}
                  </span>
                </div>
                <div className={styles.mobileCardMeta}>
                  <span className={styles.mobileCardOccupancy}>{row.occupancy}</span>
                  <svg viewBox="0 0 16 16" fill="none" className={styles.mobileCardChevron}>
                    <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
            ))}
            <p className={styles.mobileCount}>{rows.length} de {totalCount} gavetas</p>
          </div>
        </>
      )}

      <DrawerDetail id={detailId} onClose={() => setDetailId(null)} onChanged={refetch} />
    </div>
  );
}

// -------- detalhe da gaveta: ocupantes + mudar situação (reusa graves) --------
function DrawerDetail({ id, onClose, onChanged }) {
  const [feedback, setFeedback] = useState(null);
  const [nextStatusId, setNextStatusId] = useState("");

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => (id ? getDrawerSummary(id, { signal }) : Promise.resolve(null)),
    [id]
  );
  const { data: statusesData } = useResource(({ signal }) => listGraveStatuses({ signal }), []);
  const statuses = statusesData ?? [];
  const { mutate: applyStatus, loading: changing } = useMutation(
    ({ graveId, statusId }) => changeGraveStatus(graveId, { statusId })
  );

  const grave = data?.grave;
  const occupancy = data?.occupancy;
  const occupants = (grave?.burials ?? []).map((b) => ({
    id: b.id,
    name: b.deceased?.fullName || b.deceased?.name || "Ocupante",
  }));
  const statusKey = normalizeStatusSlug(grave?.status?.slug);

  async function onApply() {
    if (!nextStatusId || !grave) return;
    try {
      await applyStatus({ graveId: grave.id, statusId: nextStatusId });
      setFeedback({ tone: "success", message: "Situação da gaveta atualizada." });
      setNextStatusId("");
      refetch();
      onChanged?.();
    } catch (e) {
      setFeedback({ tone: "danger", message: e?.message || "Não foi possível atualizar a situação." });
    }
  }

  return (
    <Modal
      open={Boolean(id)}
      onClose={() => { setFeedback(null); setNextStatusId(""); onClose(); }}
      title={grave ? `Gaveta ${grave.code}` : "Carregando…"}
      subtitle={grave ? statusMeta(statusKey, grave.status?.name).label : ""}
      width={560}
    >
      {loading && <Skeleton variant="row" count={4} />}
      {error && <ErrorState onRetry={refetch} />}
      {!loading && !error && grave && (
        <div className={styles.detailBody}>
          {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}

          <section className={styles.detailSection}>
            <span className={styles.sectionLabel}>Ocupação</span>
            <p className={styles.occupancyBig}>
              {(occupancy?.activeBurials ?? 0)} / {(occupancy?.capacity ?? grave.capacity ?? 0)}
              <span className={styles.occupancyHint}>ocupadas · {occupancy?.available ?? 0} livre(s)</span>
            </p>
          </section>

          <section className={styles.detailSection}>
            <span className={styles.sectionLabel}>Ocupantes ({occupants.length})</span>
            {occupants.length ? (
              <ul className={styles.occupantList}>
                {occupants.map((o) => (
                  <li key={o.id} className={styles.occupantRow}>{o.name}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyNote}>Nenhum sepultamento ativo nesta gaveta.</p>
            )}
          </section>

          <section className={styles.detailSection}>
            <span className={styles.sectionLabel}>Alterar situação</span>
            <div className={styles.statusForm}>
              <FormField label="Nova situação">
                <Select value={nextStatusId} onChange={(e) => setNextStatusId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </FormField>
              <Button size="sm" loading={changing} disabled={!nextStatusId} onClick={onApply}>
                Aplicar
              </Button>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
