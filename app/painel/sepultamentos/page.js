"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Pagination from "@/components/molecules/Pagination/Pagination";
import StatCard from "@/components/molecules/StatCard/StatCard";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import DataTable from "@/components/organisms/DataTable/DataTable";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";
import GraveMap from "@/components/organisms/GraveMap/GraveMap";
import FileViewer from "@/components/organisms/FileViewer/FileViewer";
import { DEMO_CERTIDAO_PDF } from "@/lib/mock-files";

import { useResource, useMutation } from "@/lib/api/useResource";
import {
  listBurials,
  getBurialsStats,
  createBurial,
  getSchedulesTodayCount,
  reissueDocument,
  issueBurialAuthorization,
  listDeceasedForBurial,
  listFreeGraves,
  adaptBurialRow,
  adaptFreeGrave,
  adaptDeceasedOption,
  isAvailableForBurial,
  composeBurialNotes,
} from "@/lib/api/resources/burials";
import { listPeople } from "@/lib/api/resources/people";
import { todayISO, toLocalISODate } from "@/lib/date-local";

// Resolve o nome digitado (declarante) para o id de uma Pessoa real: tenta a
// lista já carregada (match exato, case-insensitive) e, se não achar, busca na
// API. Sem correspondência retorna null — o chamador cai no fallback de notes.
async function resolvePersonId(name, options = []) {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  const local = options.find((p) => p.name.trim().toLowerCase() === lower);
  if (local) return local.id;
  try {
    const res = await listPeople({ search: name, perPage: 5 });
    const list = res?.data ?? [];
    const match = list.find((p) => (p.fullName || "").trim().toLowerCase() === lower) || list[0];
    return match?.id || null;
  } catch {
    return null;
  }
}

const STATUS_META = {
  ativo: { label: "Ativo", tone: "navy" },
  exumado: { label: "Exumado", tone: "warning" },
  transladado: { label: "Transladado", tone: "neutral" },
};

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());
const TODAY_ISO = todayISO();

function authFile(row) {
  if (row.authUrl) {
    return {
      name: `autorizacao-sepultamento-${String(row.auth).replace("/", "-")}.html`,
      category: "Autorização de Sepultamento",
      url: row.authUrl,
    };
  }
  // fallback de pré-visualização quando o sepultamento ainda não tem documento
  return {
    name: `autorizacao-sepultamento-${String(row.auth).replace("/", "-")}.pdf`,
    category: "Autorização de Sepultamento",
    url: DEMO_CERTIDAO_PDF,
  };
}

export default function BurialsListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  // atalho do painel (Registrar sepultamento) → abre o modal via ?novo=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("novo") === "1") setModalOpen(true);
  }, []);
  const [exportOpen, setExportOpen] = useState(false);
  const [detail, setDetail] = useState(null); // sepultamento aberto
  const [reissued, setReissued] = useState({}); // id → true (2ª via)
  const [preview, setPreview] = useState(null);
  const [formError, setFormError] = useState("");

  // formulário de registro
  const [newGrave, setNewGrave] = useState("");
  const [newDeceased, setNewDeceased] = useState("");
  const [formDate, setFormDate] = useState(TODAY_ISO);
  const [formTime, setFormTime] = useState("10:00");
  const [formDeclarant, setFormDeclarant] = useState("");
  const [formFuneral, setFormFuneral] = useState("");

  // ---- dados da API --------------------------------------------------------
  const listParams = useMemo(
    () => ({
      page,
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      burialFrom: dateFrom || undefined,
      burialTo: dateTo || undefined,
    }),
    [page, search, statusFilter, dateFrom, dateTo]
  );

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listBurials(listParams, { signal }),
    [listParams]
  );
  const rows = useMemo(() => (data?.data ?? []).map(adaptBurialRow), [data]);
  const meta = data?.meta;

  const { data: stats, refetch: refetchStats } = useResource(
    ({ signal }) => getBurialsStats({}, { signal }),
    []
  );
  const byStatus = stats?.byStatus || {};

  const { data: today } = useResource(({ signal }) => getSchedulesTodayCount({ signal }), []);
  const scheduledToday = today?.byType?.sepultamento ?? 0;

  // pickers do modal (só busca quando o modal abre)
  const { data: deceasedData } = useResource(
    ({ signal }) =>
      modalOpen ? listDeceasedForBurial({ perPage: 100 }, { signal }) : Promise.resolve(null),
    [modalOpen]
  );
  const availableDeceased = useMemo(
    () => (deceasedData?.data ?? []).filter(isAvailableForBurial).map(adaptDeceasedOption),
    [deceasedData]
  );

  const { data: gravesData } = useResource(
    ({ signal }) => (modalOpen ? listFreeGraves({ perPage: 100 }, { signal }) : Promise.resolve(null)),
    [modalOpen]
  );
  const freeGraves = useMemo(
    () => (gravesData?.data ?? []).map(adaptFreeGrave),
    [gravesData]
  );
  const selectedGrave = freeGraves.find((g) => g.id === newGrave);

  // sugestões de pessoas para o campo Declarante (resolve FK real)
  const { data: peopleData } = useResource(
    ({ signal }) => (modalOpen ? listPeople({ perPage: 100 }, { signal }) : Promise.resolve(null)),
    [modalOpen]
  );
  const peopleOptions = useMemo(
    () => (peopleData?.data ?? []).map((p) => ({ id: p.id, name: p.fullName })),
    [peopleData]
  );

  // ---- ações ---------------------------------------------------------------
  const { mutate: doCreate, loading: creating } = useMutation(createBurial);
  const { mutate: doReissue, loading: reissuing } = useMutation(reissueDocument);
  const { mutate: doIssue, loading: issuing } = useMutation(issueBurialAuthorization);

  function resetForm() {
    setNewGrave("");
    setNewDeceased("");
    setFormDate(TODAY_ISO);
    setFormTime("10:00");
    setFormDeclarant("");
    setFormFuneral("");
    setFormError("");
  }

  async function submitCreate() {
    setFormError("");
    try {
      const declarant = formDeclarant.trim();
      // Declarante com match no cadastro → vínculo real (declarantPersonId).
      // Sem match → mantém o fallback atual (nome legível em notes), sem bloquear.
      const declarantPersonId = declarant ? await resolvePersonId(declarant, peopleOptions) : null;
      await doCreate({
        graveId: newGrave,
        deceasedId: newDeceased,
        burialDate: formDate,
        burialTime: formTime || undefined,
        funeralHome: formFuneral.trim() || undefined,
        ...(declarantPersonId
          ? { declarantPersonId }
          : { notes: composeBurialNotes({ declarant }) }),
      });
      setModalOpen(false);
      resetForm();
      refetch();
      refetchStats();
    } catch (e) {
      setFormError(e.message || "Não foi possível registrar o sepultamento.");
    }
  }

  async function reissueAuth(row) {
    try {
      if (row.authDocId) await doReissue(row.authDocId);
      else await doIssue(row.id);
      setReissued((map) => ({ ...map, [row.id]: true }));
      refetch();
    } catch (e) {
      setFormError(e.message || "Não foi possível emitir a 2ª via.");
    }
  }

  const savingAuth = reissuing || issuing;
  const hasFilters = Boolean(search.trim() || statusFilter || dateFrom || dateTo);
  const totalItems = meta?.totalItems ?? rows.length;
  const totalPages = meta?.totalPages ?? 1;

  const columns = [
    {
      key: "date",
      label: "Data",
      render: (row) => (
        <span className={styles.dates}>
          <span>{row.date}</span>
          <span className={styles.datesSub}>{row.time}</span>
        </span>
      ),
    },
    {
      key: "deceased",
      label: "Sepultado",
      render: (row) => (
        <span className={styles.personCell}>
          <Avatar name={row.deceased} size="sm" />
          <span className={styles.personName}>{row.deceased}</span>
        </span>
      ),
    },
    {
      key: "grave",
      label: "Jazigo",
      render: (row) => (
        <Link href={`/painel/sepulturas/${row.graveId}`} className={styles.graveLink}>
          {row.grave}{row.drawer !== "—" ? ` · ${row.drawer}` : ""}
        </Link>
      ),
    },
    {
      key: "auth",
      label: "Autorização",
      render: (row) => (
        <button
          className={styles.authLink}
          onClick={() => setPreview(authFile(row))}
          title="Ver documento"
        >
          nº {row.auth}
        </button>
      ),
    },
    { key: "declarant", label: "Declarante" },
    { key: "status", label: "Situação", render: (row) => <Badge tone={STATUS_META[row.status].tone} dot>{STATUS_META[row.status].label}</Badge> },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <button className={styles.detailLink} onClick={() => setDetail(row)}>Detalhes</button>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Sepultamentos</h1>
          <p className={styles.subtitle}>Registro de todos os sepultamentos realizados</p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setExportOpen(true)}>Exportar</Button>
          <Button
            onClick={() => { resetForm(); setModalOpen(true); }}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Registrar sepultamento
          </Button>
        </div>
      </header>

      <section className={styles.stats}>
        <StatCard label="Neste mês" value={stats ? String(stats.monthCount) : "—"} caption={MONTH_LABEL} />
        <StatCard label="No ano" value={stats ? String(stats.yearCount) : "—"} caption="acumulado do ano" />
        <StatCard label="Agendados hoje" value={String(scheduledToday)} caption="ver agenda" />
        <StatCard label="Exumados" value={stats ? String(stats.exhumedCount) : "—"} caption="histórico total" />
      </section>

      {scheduledToday > 0 && (
        <Alert tone="info" title={`${scheduledToday} sepultamentos agendados para hoje`}>
          Confira os horários e capelas na <Link href="/painel/agenda" className={styles.inlineLink}>Agenda</Link> —
          o registro é feito aqui após a realização.
        </Alert>
      )}

      <div className={styles.statusChips}>
        <button className={`${styles.chip} ${statusFilter === "" ? styles.chipActive : ""}`} onClick={() => { setStatusFilter(""); setPage(1); }}>
          Todos <span className={styles.chipCount}>{stats ? stats.total : "—"}</span>
        </button>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <button
            key={key}
            className={`${styles.chip} ${statusFilter === key ? styles.chipActive : ""}`}
            onClick={() => { setStatusFilter(statusFilter === key ? "" : key); setPage(1); }}
          >
            <span className={`${styles.chipDot} ${styles[`dot_${key}`]}`} />
            {meta.label}
            <span className={styles.chipCount}>{stats ? (byStatus[key] || 0) : "—"}</span>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Input
            placeholder="Buscar por sepultado, jazigo ou nº da autorização…"
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
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} title="Período — de" />
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} title="Período — até" />
        </div>
      </div>

      {loading ? (
        <div className={styles.desktopTable}>
          <Skeleton variant="row" count={8} />
        </div>
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhum sepultamento registrado"
          message={
            hasFilters
              ? "Nenhum sepultamento corresponde aos filtros aplicados. Ajuste a busca ou o período."
              : "Comece registrando o primeiro sepultamento deste cemitério."
          }
          action={
            !hasFilters && (
              <Button onClick={() => { resetForm(); setModalOpen(true); }}>Registrar sepultamento</Button>
            )
          }
        />
      ) : (
        <>
          <div className={styles.desktopTable}>
            <DataTable
              columns={columns}
              rows={rows}
              footer={
                <>
                  <span>{totalItems} registros</span>
                  <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
              }
            />
          </div>

          <div className={styles.mobileList}>
            {rows.map((row) => (
              <button key={row.id} className={styles.mobileCard} onClick={() => setDetail(row)}>
                <div className={styles.mobileCardTop}>
                  <span className={styles.personCell}>
                    <Avatar name={row.deceased} size="sm" />
                    <span className={styles.personName}>{row.deceased}</span>
                  </span>
                  <Badge tone={STATUS_META[row.status].tone} dot>{STATUS_META[row.status].label}</Badge>
                </div>
                <div className={styles.mobileCardBody}>
                  <span className={styles.mobileCardName}>{row.date} · {row.time}</span>
                  <span className={styles.mobileCardMeta}>{row.grave}{row.drawer !== "—" ? ` · ${row.drawer}` : ""} · Aut. nº {row.auth}</span>
                </div>
                <svg viewBox="0 0 16 16" fill="none" className={styles.mobileCardChevron}>
                  <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
            <p className={styles.mobileCount}>{totalItems} registros</p>
          </div>
        </>
      )}

      {/* ---- detalhe do sepultamento (com localização no mapa) ---- */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Sepultamento de ${detail.deceased}` : ""}
        subtitle={detail ? `${detail.date} às ${detail.time} · ${detail.grave}${detail.drawer !== "—" ? ` · gaveta ${detail.drawer}` : ""}` : ""}
        width={680}
        footer={
          detail && (
            <>
              <Button variant="ghost" onClick={() => setDetail(null)}>Fechar</Button>
              <Link href={`/painel/sepultados/${detail.deceasedId}`}>
                <Button variant="secondary">Ver sepultado</Button>
              </Link>
              <Link href={`/painel/sepulturas/${detail.graveId}`}>
                <Button>Abrir jazigo</Button>
              </Link>
            </>
          )
        }
      >
        {detail && (
          <div className={styles.detailBody}>
            <GraveMap
              cemeteryId={detail.cemeteryId}
              grave={{
                id: detail.graveId,
                code: detail.grave,
                status: detail.graveStatusSlug,
                geoPolygon: detail.geoPolygon,
                latitude: detail.latitude,
                longitude: detail.longitude,
              }}
              height={220}
            />
            <dl className={styles.detailGrid}>
              <div><dt>Sepultado</dt><dd>{detail.deceased}</dd></div>
              <div><dt>Data e hora</dt><dd>{detail.date} · {detail.time}</dd></div>
              <div><dt>Jazigo</dt><dd>{detail.grave}{detail.graveStatus ? ` · ${detail.graveStatus}` : ""}</dd></div>
              <div><dt>Declarante</dt><dd>{detail.declarant}</dd></div>
              <div><dt>Funerária</dt><dd>{detail.funeral}</dd></div>
              <div><dt>Situação</dt><dd><Badge tone={STATUS_META[detail.status].tone} dot>{STATUS_META[detail.status].label}</Badge></dd></div>
            </dl>
            <div className={styles.authBox}>
              <div className={styles.authInfo}>
                <span className={styles.authLabel}>Autorização de Sepultamento</span>
                <span className={styles.authNumber}>
                  nº {detail.auth}{reissued[detail.id] && " · 2ª via emitida"}
                </span>
              </div>
              <div className={styles.authActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreview(authFile(detail))}
                >
                  Ver
                </Button>
                <Button variant="ghost" size="sm" loading={savingAuth} onClick={() => reissueAuth(detail)}>
                  2ª via
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- registrar sepultamento (validações do PDF) ---- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Registrar sepultamento"
        subtitle="Vínculo automático do sepultado à sepultura"
        width={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button loading={creating} disabled={!newDeceased || !newGrave} onClick={submitCreate}>
              Confirmar sepultamento
            </Button>
          </>
        }
      >
        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <div className={styles.formGrid}>
            <FormField label="Sepultado" required>
              <Select value={newDeceased} onChange={(e) => setNewDeceased(e.target.value)}>
                <option value="" disabled>Selecione…</option>
                {availableDeceased.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{d.death !== "—" ? ` · ✝ ${d.death}` : ""}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Jazigo" required hint="Bloqueados e inadimplentes não aparecem">
              <Select value={newGrave} onChange={(e) => setNewGrave(e.target.value)}>
                <option value="" disabled>Selecione…</option>
                {freeGraves.map((g) => (
                  <option key={g.id} value={g.id} disabled={!g.available}>
                    {g.code} {g.available ? `· ${g.available} vaga(s)` : "· lotado"}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Gaveta">
              <Select defaultValue="">
                <option value="">Automática</option>
              </Select>
            </FormField>
            <FormField label="Data" required>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </FormField>
            <FormField label="Horário">
              <Input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} />
            </FormField>
            <FormField label="Declarante / responsável">
              <Input
                placeholder="Nome do responsável"
                value={formDeclarant}
                list="declarant-people-options"
                onChange={(e) => setFormDeclarant(e.target.value)}
              />
              <datalist id="declarant-people-options">
                {peopleOptions.map((p) => <option key={p.id} value={p.name} />)}
              </datalist>
            </FormField>
            <FormField label="Funerária">
              <Input placeholder="Nome da funerária" value={formFuneral} onChange={(e) => setFormFuneral(e.target.value)} />
            </FormField>
          </div>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Alert tone="info">
            A <strong>Autorização de Sepultamento</strong> será emitida
            automaticamente, o responsável notificado por WhatsApp, e a situação
            do jazigo atualizada.
          </Alert>
        </form>
      </Modal>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity="sepultamentos"
        totalCount={stats?.total ?? totalItems}
        filteredCount={totalItems}
      />

      <FileViewer open={Boolean(preview)} file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
