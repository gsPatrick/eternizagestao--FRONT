"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Textarea from "@/components/atoms/Textarea/Textarea";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Pagination from "@/components/molecules/Pagination/Pagination";
import DataTable from "@/components/organisms/DataTable/DataTable";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";
import MapStudio from "@/components/organisms/MapStudio/MapStudio";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";

import { useResource } from "@/lib/api/useResource";
import {
  listGraves,
  getGraveStatusCounts,
  listCemeteries,
  listBlocks,
  adaptGraveRow,
  normalizeStatusSlug,
  frontStatusToApiSlug,
  labelToUnitType,
  TOMB_TYPE_OPTIONS,
  UTILIZACAO_OPTIONS,
} from "@/lib/api/resources/graves";

const STATUS_META = {
  livre: { label: "Livre", tone: "success" },
  ocupada: { label: "Ocupada", tone: "navy" },
  reservada: { label: "Reservada", tone: "warning" },
  manutencao: { label: "Em manutenção", tone: "neutral" },
  interditada: { label: "Interditada", tone: "danger" },
  perpetuidade: { label: "Em perpetuidade", tone: "inverse" },
};

// tolera status customizado do tenant sem quebrar o layout
const statusMeta = (key, fallbackName) =>
  STATUS_META[key] || { label: fallbackName || key, tone: "neutral" };

const PER_PAGE = 30;

export default function GravesListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [newType, setNewType] = useState("jazigo");
  const [saving, setSaving] = useState(false);
  // Campos oficiais dos modelos de documento (certidão/autorização).
  const [tombType, setTombType] = useState(TOMB_TYPE_OPTIONS[0]);
  const [tombTypeFree, setTombTypeFree] = useState("");

  // ---- dados da API ----
  const listParams = useMemo(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search.trim() || undefined,
      unitType: typeFilter ? labelToUnitType(typeFilter) : undefined,
      blockId: blockFilter || undefined,
      statusSlug: statusFilter ? frontStatusToApiSlug(statusFilter) : undefined,
    }),
    [page, search, typeFilter, blockFilter, statusFilter]
  );

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listGraves(listParams, { signal }),
    [listParams]
  );
  const rows = useMemo(() => (data?.data ?? []).map(adaptGraveRow), [data]);
  const meta = data?.meta;

  // chips com contagem por status (respeita busca/tipo/quadra, ignora o status)
  const { data: countsData } = useResource(
    ({ signal }) =>
      getGraveStatusCounts(
        {
          search: search.trim() || undefined,
          unitType: typeFilter ? labelToUnitType(typeFilter) : undefined,
          blockId: blockFilter || undefined,
        },
        { signal }
      ),
    [search, typeFilter, blockFilter]
  );
  const statusCounts = useMemo(() => {
    const acc = {};
    (countsData?.byStatus ?? []).forEach((s) => {
      acc[normalizeStatusSlug(s.slug)] = s.count;
    });
    return acc;
  }, [countsData]);
  const totalCount = countsData?.total ?? meta?.totalItems ?? 0;

  // cemitério + quadras reais para o filtro
  const { data: cemsData } = useResource(({ signal }) => listCemeteries({ signal }), []);
  const cemetery = cemsData?.data?.[0];
  const { data: blocksData } = useResource(
    ({ signal }) => (cemetery ? listBlocks(cemetery.id, { signal }) : Promise.resolve([])),
    [cemetery?.id]
  );
  const blocks = blocksData ?? [];

  function openModal() {
    setModalOpen(true);
  }

  function goToMap() {
    setModalOpen(false);
    setStudioOpen(true);
  }

  function fakeCreate() {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setModalOpen(false);
      setStudioOpen(false);
    }, 1000);
  }

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Sepulturas</h1>
          <p className={styles.subtitle}>
            {totalCount.toLocaleString("pt-BR")} unidades
            {cemetery ? ` · ${cemetery.name}` : ""}
          </p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setExportOpen(true)}>Exportar</Button>
          <Button
            onClick={openModal}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Nova sepultura
          </Button>
        </div>
      </header>

      <div className={styles.statusChips}>
        <button
          className={`${styles.chip} ${statusFilter === "" ? styles.chipActive : ""}`}
          onClick={() => { setStatusFilter(""); setPage(1); }}
        >
          Todas <span className={styles.chipCount}>{totalCount}</span>
        </button>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <button
            key={key}
            className={`${styles.chip} ${statusFilter === key ? styles.chipActive : ""}`}
            onClick={() => { setStatusFilter(statusFilter === key ? "" : key); setPage(1); }}
          >
            <span className={`${styles.chipDot} ${styles[`dot_${key}`]}`} />
            {meta.label}
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
          <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">Todos os tipos</option>
            <option value="Cova">Cova</option>
            <option value="Jazigo">Jazigo</option>
            <option value="Gaveta">Gaveta</option>
            <option value="Túmulo">Túmulo</option>
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
          title="Nenhuma sepultura encontrada"
          message="Ajuste os filtros ou cadastre a primeira sepultura deste cemitério — você também pode importar em lote."
          action={<Button onClick={openModal}>Cadastrar sepultura</Button>}
        />
      ) : (
        <>
          <div className={styles.desktopTable}>
            <DataTable
              columns={[
                {
                  key: "code",
                  label: "Código",
                  render: (row) => (
                    <span className={styles.codeCell}>
                      <code className={styles.code}>{row.code}</code>
                      {!row.mapped && (
                        <span className={styles.unmapped} title="Sem demarcação no mapa">
                          <svg viewBox="0 0 14 14" fill="none">
                            <path d="M7 12s3.6-3.3 3.6-6A3.6 3.6 0 003.4 6c0 2.7 3.6 6 3.6 6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                            <path d="M2.5 2.5l9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </span>
                      )}
                    </span>
                  ),
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
                { key: "type", label: "Tipo" },
                {
                  key: "owner",
                  label: "Concessionário",
                  render: (row) =>
                    row.owner === "—" ? (
                      <span className={styles.noOwner}>Sem concessão</span>
                    ) : (
                      <span className={styles.ownerCell}>
                        <Avatar name={row.owner} size="sm" />
                        {row.owner}
                      </span>
                    ),
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
                { key: "occupancy", label: "Ocupação", align: "right" },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  render: (row) => (
                    <Link href={`/painel/sepulturas/${row.id}`} className={styles.detailLink}>
                      Detalhes
                    </Link>
                  ),
                },
              ]}
              rows={rows}
              footer={
                <>
                  <span>{rows.length} de {totalCount} sepulturas</span>
                  <Pagination page={page} totalPages={totalPages} onChange={setPage} />
                </>
              }
            />
          </div>

          {/* mobile: lista de cards tocáveis (UX de app) */}
          <div className={styles.mobileList}>
            {rows.map((grave) => (
              <Link key={grave.id} href={`/painel/sepulturas/${grave.id}`} className={styles.mobileCard}>
                <div className={styles.mobileCardTop}>
                  <code className={styles.code}>{grave.code}</code>
                  <Badge tone={statusMeta(grave.status, grave.statusName).tone} dot>
                    {statusMeta(grave.status, grave.statusName).label}
                  </Badge>
                </div>
                <div className={styles.mobileCardBody}>
                  <span className={styles.mobileCardLocation}>
                    Quadra {grave.block} · {grave.street} · {grave.lot} — {grave.type}
                  </span>
                  <span className={styles.mobileCardOwner}>
                    {grave.owner === "—" ? "Sem concessão" : grave.owner}
                  </span>
                </div>
                <div className={styles.mobileCardMeta}>
                  <span className={styles.mobileCardOccupancy}>{grave.occupancy}</span>
                  <svg viewBox="0 0 16 16" fill="none" className={styles.mobileCardChevron}>
                    <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </Link>
            ))}
            <p className={styles.mobileCount}>{rows.length} de {totalCount} sepulturas</p>
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova sepultura"
        subtitle="Passo 1 de 2 · Dados e vínculo à estrutura do cemitério"
        width={620}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={goToMap}>Continuar para o mapa</Button>
          </>
        }
      >
        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <div className={styles.formGrid}>
            <FormField label="Cemitério" required>
              <Select defaultValue="municipal">
                <option value="municipal">Cemitério Municipal</option>
                <option value="jardim">Cemitério Jardim da Paz</option>
              </Select>
            </FormField>
            <FormField label="Quadra" required>
              <Select defaultValue="">
                <option value="" disabled>Selecione…</option>
                {["A", "B", "C", "D", "E", "F"].map((b) => (
                  <option key={b} value={b}>Quadra {b}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Rua" required>
              <Select defaultValue="">
                <option value="" disabled>Selecione…</option>
                <option value="r1">Rua 1</option>
                <option value="r2">Rua 2</option>
                <option value="r3">Rua 3</option>
              </Select>
            </FormField>
            <FormField label="Lote" required>
              <Select defaultValue="">
                <option value="" disabled>Selecione…</option>
                <option value="l1">Lote 01</option>
                <option value="l2">Lote 02</option>
                <option value="l3">Lote 03</option>
              </Select>
            </FormField>
            <FormField label="Código da unidade" required hint="Único por cemitério">
              <Input placeholder="Ex.: A-R1-L2-004" />
            </FormField>
            <FormField label="Tipo" required>
              <Select value={newType} onChange={(e) => setNewType(e.target.value)}>
                <option value="cova">Cova</option>
                <option value="jazigo">Jazigo</option>
                <option value="gaveta">Gaveta</option>
                <option value="tumulo">Túmulo</option>
              </Select>
            </FormField>
            {newType === "gaveta" && (
              <FormField label="Jazigo pai" required>
                <Select defaultValue="">
                  <option value="" disabled>Selecione o jazigo…</option>
                  <option value="1">A-R1-L1-001</option>
                  <option value="6">B-R2-L4-011</option>
                </Select>
              </FormField>
            )}
            <FormField label="Capacidade" hint="Nº de gavetas/vagas">
              <Input type="number" min="1" defaultValue={newType === "jazigo" ? 4 : 1} />
            </FormField>
            <FormField label="Situação inicial">
              <Select defaultValue="livre">
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </Select>
            </FormField>
            {/* Campos oficiais exigidos pelos modelos de documento do cliente */}
            <FormField label="Tipo do túmulo" hint="usado na certidão/autorização">
              <Select value={tombType} onChange={(e) => setTombType(e.target.value)}>
                {TOMB_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="__free">Outro (digitar)…</option>
              </Select>
            </FormField>
            {tombType === "__free" && (
              <FormField label="Tipo do túmulo (livre)" required>
                <Input
                  placeholder="Descreva o tipo do túmulo"
                  value={tombTypeFree}
                  onChange={(e) => setTombTypeFree(e.target.value)}
                />
              </FormField>
            )}
            <FormField label="Utilização">
              <Select defaultValue={UTILIZACAO_OPTIONS[0]}>
                {UTILIZACAO_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Permissão de carneira">
              <Select defaultValue="">
                <option value="">Não informado</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </Select>
            </FormField>
            <FormField label="Observação" className={styles.spanTwo}>
              <Textarea rows={2} placeholder="Observações da sepultura (opcional)" />
            </FormField>
          </div>
          <Alert tone="info" title="Vínculo ao mapa">
            No próximo passo o mapa abre em tela cheia: aproxime até o lote e
            demarque o quadradinho da unidade ligando os pontos na imagem.
          </Alert>
        </form>
      </Modal>

      <MapStudio
        open={studioOpen}
        onClose={() => {
          setStudioOpen(false);
          setModalOpen(true);
        }}
        title="Nova sepultura · Demarcação"
        subtitle="Passo 2 de 2 · aproxime até o lote e ligue os pontos da unidade"
        onSave={fakeCreate}
        saveLabel="Criar com demarcação"
        onSkip={fakeCreate}
        skipLabel="Criar sem demarcar"
        saving={saving}
      />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity={"sepulturas"}
        totalCount={totalCount}
        filteredCount={rows.length}
      />
    </div>
  );
}
