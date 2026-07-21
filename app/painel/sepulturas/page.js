"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";

import { useResource, useMutation } from "@/lib/api/useResource";
import {
  listGraves,
  getGraveStatusCounts,
  listCemeteries,
  createGrave,
  removeGrave,
  getGraveDeleteImpact,
  uploadGravePhoto,
  adaptGraveRow,
  normalizeStatusSlug,
  frontStatusToApiSlug,
  TOMB_TYPE_OPTIONS,
  UTILIZACAO_OPTIONS,
  isPerpetualUse,
} from "@/lib/api/resources/graves";
import { listPeople } from "@/lib/api/resources/people";
import { getStructure } from "@/lib/api/resources/cemeteries";
import { getUser } from "@/lib/api/session";
import RowActions from "@/components/molecules/RowActions/RowActions";
import ConfirmDelete from "@/components/molecules/ConfirmDelete/ConfirmDelete";

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
  // Filtros espelhando a listagem do cliente: Cemitério · Quadra · Lote ·
  // Sepultado(s) · Utilização. Quadra e lote são TEXTO (são milhares — não
  // cabem numa lista) e a busca livre cobre o sepultado.
  const [utilFilter, setUtilFilter] = useState("");
  // filtros avançados (busca ampliada — pedido do cliente)
  const [advOpen, setAdvOpen] = useState(false);
  const [adv, setAdv] = useState({ code: "", owner: "", block: "", lot: "" });
  const [debouncedAdv, setDebouncedAdv] = useState({ code: "", owner: "", block: "", lot: "" });

  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState(null);
  // Campos oficiais dos modelos de documento (certidão/autorização).
  const [tombType, setTombType] = useState(TOMB_TYPE_OPTIONS[0]);
  const [gravePhoto, setGravePhoto] = useState(null); // File da "Fotografia"
  const router = useRouter();

  // formulário real de nova sepultura — cadastro RÁPIDO: quadra e lote são
  // DIGITADOS (a estrutura é criada/reaproveitada no backend); proprietário é
  // opcional. Sem selects em cascata (pedido do cliente p/ cadastro em massa).
  const emptyGrave = {
    cemeteryId: "",
    quadra: "",
    lote: "",
    quadraAnterior: "",
    loteAnterior: "",
    ownerPersonId: "",
    statusSlug: "livre",
    parentGraveId: "",
    utilizacao: UTILIZACAO_OPTIONS[0],
    carneiraPermission: "",
    dataPermissao: "",
    notes: "",
  };
  const [gForm, setGForm] = useState(emptyGrave);
  const setG = (k, v) => setGForm((f) => ({ ...f, [k]: v }));

  // debounce dos filtros avançados de texto
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedAdv({
        code: adv.code.trim(), owner: adv.owner.trim(),
        block: adv.block.trim(), lot: adv.lot.trim(),
      });
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [adv.code, adv.owner, adv.block, adv.lot]);

  // ---- dados da API ----
  const listParams = useMemo(
    () => ({
      page,
      perPage: PER_PAGE,
      search: search.trim() || undefined,
      utilizacao: utilFilter || undefined,
      block: debouncedAdv.block || undefined,
      lot: debouncedAdv.lot || undefined,
      statusSlug: statusFilter ? frontStatusToApiSlug(statusFilter) : undefined,
      code: debouncedAdv.code || undefined,
      owner: debouncedAdv.owner || undefined,
    }),
    [page, search, utilFilter, statusFilter, debouncedAdv]
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
          utilizacao: utilFilter || undefined,
          block: debouncedAdv.block || undefined,
          lot: debouncedAdv.lot || undefined,
        },
        { signal }
      ),
    [search, utilFilter, debouncedAdv]
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
  const cemeteries = cemsData?.data ?? [];
  // Cemitério do FORMULÁRIO: escolhido pelo operador (antes era fixo no 1º da
  // lista, mesmo com vários cadastrados). Cai no primeiro só como padrão.
  const formCemeteryId = gForm.cemeteryId || cemeteries[0]?.id || "";
  const cemetery = cemeteries.find((c) => c.id === formCemeteryId) || cemeteries[0];

  // Estrutura JÁ CADASTRADA do cemitério escolhido → sugestões de quadra/lote.
  // Continua sendo campo de texto (cadastro rápido), mas agora oferece o que
  // existe, evitando duplicar quadra/lote por digitação diferente.
  const { data: structData } = useResource(
    ({ signal }) => (formCemeteryId ? getStructure(formCemeteryId, { signal }) : Promise.resolve(null)),
    [formCemeteryId]
  );
  const structBlocks = structData?.blocks ?? [];
  const quadraOptions = useMemo(
    () => structBlocks.map((b) => b.code || b.name).filter(Boolean),
    [structBlocks]
  );
  const loteOptions = useMemo(() => {
    const q = gForm.quadra.trim().toLowerCase();
    const blocos = q
      ? structBlocks.filter((b) => String(b.code || b.name || "").toLowerCase() === q)
      : structBlocks;
    const set = new Set();
    blocos.forEach((b) => (b.streets || []).forEach((st) => (st.lots || []).forEach((l) => {
      const v = l.code || l.name;
      if (v) set.add(v);
    })));
    return [...set];
  }, [structBlocks, gForm.quadra]);

  // pessoas cadastradas → caixa de seleção de PROPRIETÁRIO (opcional) no create
  const { data: peopleData } = useResource(
    ({ signal }) => listPeople({ perPage: 1000 }, { signal }),
    []
  );
  const people = peopleData?.data ?? [];

  // ---- exclusão de sepultura (RBAC + confirmação) ----
  const currentUser = getUser();
  const canDelete = ["admin", "super_admin"].includes(currentUser?.role);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteImpact, setDeleteImpact] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Abre a confirmação já sabendo o que a exclusão arrasta junto: assim o modal
  // mostra o preço ANTES, em vez de barrar com uma mensagem seca depois.
  async function askDelete(row) {
    setDeleteError("");
    setDeleteImpact(null);
    setConfirmDelete(row);
    try {
      setDeleteImpact(await getGraveDeleteImpact(row.id));
    } catch (_) {
      /* sem o impacto o modal segue no modo simples */
    }
  }

  async function doDelete(force = false) {
    setDeleteError("");
    setDeleting(true);
    try {
      await removeGrave(confirmDelete.id, { force });
      setConfirmDelete(null);
      setDeleteImpact(null);
      refetch();
    } catch (e) {
      setDeleteError(e?.message || "Não foi possível excluir a sepultura.");
    } finally {
      setDeleting(false);
    }
  }

  function openModal() {
    setGForm(emptyGrave);
    setTombType(TOMB_TYPE_OPTIONS[0]);
    setGravePhoto(null);
    setCreateError(null);
    setModalOpen(true);
  }

  // Cria a sepultura de verdade. "demarcar" → abre o detalhe (mapa real) após criar.
  async function submitGrave({ demarcate = false } = {}) {
    if (!gForm.quadra.trim() || !gForm.lote.trim()) {
      setCreateError("Informe a quadra e o lote.");
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      const body = {
        cemeteryId: formCemeteryId,
        block: gForm.quadra.trim(),
        lot: gForm.lote.trim(),
        previousBlock: gForm.quadraAnterior.trim() || undefined,
        previousLot: gForm.loteAnterior.trim() || undefined,
        ownerPersonId: gForm.ownerPersonId || undefined,
        // sem `code`: a API deriva de quadra-lote (o cliente não digita código)
        unitType: "jazigo",
        tombType: tombType || undefined,
        utilizacao: gForm.utilizacao || undefined,
        carneiraPermission: gForm.carneiraPermission || undefined,
        carneiraPermissionDate: gForm.dataPermissao || undefined,
        notes: gForm.notes || undefined,
      };
      const created = await createGrave(body);
      const newGraveId = created?.id || created?.data?.id;
      // Fotografia é opcional e não pode derrubar o cadastro já gravado.
      if (gravePhoto && newGraveId) {
        try {
          await uploadGravePhoto(newGraveId, gravePhoto);
        } catch (_) {
          /* a foto pode ser reenviada pelo detalhe da sepultura */
        }
      }
      setModalOpen(false);
      setGravePhoto(null);
      setGForm(emptyGrave);
      refetch();
      if (demarcate && newGraveId) {
        router.push(`/painel/sepulturas/${newGraveId}`);
      }
    } catch (e) {
      setCreateError(e?.message || "Não foi possível cadastrar a sepultura.");
    } finally {
      setSaving(false);
    }
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
            placeholder="Buscar por sepultado, código ou proprietário…"
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
          <Input
            placeholder="Quadra"
            value={adv.block}
            onChange={(e) => setAdv((a) => ({ ...a, block: e.target.value }))}
          />
          <Input
            placeholder="Lote"
            value={adv.lot}
            onChange={(e) => setAdv((a) => ({ ...a, lot: e.target.value }))}
          />
          <Select value={utilFilter} onChange={(e) => { setUtilFilter(e.target.value); setPage(1); }}>
            <option value="">Toda utilização</option>
            {UTILIZACAO_OPTIONS.map((u) => (<option key={u} value={u}>{u}</option>))}
          </Select>
          <Button variant="ghost" onClick={() => setAdvOpen((v) => !v)}>
            {advOpen ? "Menos filtros" : "Mais filtros"}
          </Button>
        </div>
      </div>

      {advOpen && (
        <div className={styles.advFilters}>
          <FormField label="Código do jazigo / gaveta / matrícula">
            <Input
              placeholder="Ex.: A-R1-L2-004"
              value={adv.code}
              onChange={(e) => setAdv((a) => ({ ...a, code: e.target.value }))}
            />
          </FormField>
          <FormField label="Proprietário (nome ou CPF)">
            <Input
              placeholder="Nome ou CPF do concessionário"
              value={adv.owner}
              onChange={(e) => setAdv((a) => ({ ...a, owner: e.target.value }))}
            />
          </FormField>
          {(adv.code || adv.owner) && (
            <Button variant="ghost" onClick={() => setAdv({ code: "", owner: "" })}>
              Limpar
            </Button>
          )}
        </div>
      )}

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
                { key: "cemetery", label: "Cemitério", minWidth: 190 },
                {
                  key: "block",
                  label: "Quadra",
                  nowrap: true,
                  render: (row) => (
                    <span className={styles.codeCell}>
                      <code className={styles.code}>{row.block}</code>
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
                { key: "lot", label: "Lote", nowrap: true },
                {
                  key: "buried",
                  label: "Sepultado(s)",
                  render: (row) =>
                    row.buried.length === 0 ? (
                      <span className={styles.noOwner}>—</span>
                    ) : (
                      <span className={styles.ownerCell}>
                        <Avatar name={row.buried[0]} size="sm" />
                        {row.buriedLabel}
                      </span>
                    ),
                },
                {
                  key: "utilizacao",
                  label: "Utilização",
                  render: (row) => (
                    <Badge tone={isPerpetualUse(row.utilizacao) ? "inverse" : "neutral"}>
                      {row.utilizacao}
                    </Badge>
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
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  render: (row) => (
                    <RowActions
                      editHref={`/painel/sepulturas/${row.id}`}
                      canDelete={canDelete}
                      onDelete={() => askDelete(row)}
                    />
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
                  <code className={styles.code}>{grave.block} · {grave.lot}</code>
                  <Badge tone={statusMeta(grave.status, grave.statusName).tone} dot>
                    {statusMeta(grave.status, grave.statusName).label}
                  </Badge>
                </div>
                <div className={styles.mobileCardBody}>
                  <span className={styles.mobileCardLocation}>
                    {grave.cemetery} — {grave.utilizacao}
                  </span>
                  <span className={styles.mobileCardOwner}>
                    {grave.buried.length ? grave.buriedLabel : "Sem sepultado"}
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
        subtitle="Cemitério, quadra e lote identificam a sepultura"
        width={620}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              variant="secondary"
              loading={saving}
              disabled={!gForm.quadra.trim() || !gForm.lote.trim()}
              onClick={() => submitGrave({ demarcate: false })}
            >
              Cadastrar
            </Button>
            <Button
              loading={saving}
              disabled={!gForm.quadra.trim() || !gForm.lote.trim()}
              onClick={() => submitGrave({ demarcate: true })}
            >
              Cadastrar e demarcar
            </Button>
          </>
        }
      >
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); submitGrave({ demarcate: false }); }}>
          {/* Ordem e natureza dos campos espelham o formulário que o cliente já
              usa: cemitério/tipo do túmulo/utilização são listas; o resto é texto.
              Não há "código": ele é derivado de quadra-lote pela API. */}
          <div className={styles.formGrid}>
            <FormField label="Cemitério" required>
              <Select
                value={formCemeteryId}
                onChange={(e) => setGForm((f) => ({ ...f, cemeteryId: e.target.value, quadra: "", lote: "" }))}
              >
                {cemeteries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Lote"
              required
              hint={loteOptions.length ? "Escolha um existente ou digite um novo" : "Digite — ex.: 01"}
            >
              <Input
                list="lotes-existentes"
                placeholder="Ex.: 01"
                value={gForm.lote}
                onChange={(e) => setG("lote", e.target.value)}
              />
              <datalist id="lotes-existentes">
                {loteOptions.map((l) => (<option key={l} value={l} />))}
              </datalist>
            </FormField>
            <FormField label="Lote anterior" hint="Opcional — número no sistema antigo">
              <Input
                placeholder="Ex.: 01"
                value={gForm.loteAnterior}
                onChange={(e) => setG("loteAnterior", e.target.value)}
              />
            </FormField>

            <FormField
              label="Quadra"
              required
              hint={quadraOptions.length ? "Escolha uma existente ou digite uma nova" : "Digite — ex.: Q4P1C4"}
            >
              <Input
                list="quadras-existentes"
                placeholder="Ex.: Q4P1C4"
                value={gForm.quadra}
                onChange={(e) => setG("quadra", e.target.value)}
              />
              <datalist id="quadras-existentes">
                {quadraOptions.map((q) => (<option key={q} value={q} />))}
              </datalist>
            </FormField>
            <FormField label="Quadra anterior" hint="Opcional — nome no sistema antigo">
              <Input
                placeholder="Ex.: 04"
                value={gForm.quadraAnterior}
                onChange={(e) => setG("quadraAnterior", e.target.value)}
              />
            </FormField>

            <FormField label="Tipo do túmulo" required>
              <Select value={tombType} onChange={(e) => setTombType(e.target.value)}>
                {TOMB_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Utilização" required>
              <Select value={gForm.utilizacao} onChange={(e) => setG("utilizacao", e.target.value)}>
                {UTILIZACAO_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Permissão de carneira">
              <Input
                value={gForm.carneiraPermission}
                onChange={(e) => setG("carneiraPermission", e.target.value)}
              />
            </FormField>
            <FormField label="Data da permissão">
              <Input type="date" value={gForm.dataPermissao} onChange={(e) => setG("dataPermissao", e.target.value)} />
            </FormField>

            <FormField label="Proprietário(s)" hint="Opcional" className={styles.spanTwo}>
              <Select value={gForm.ownerPersonId} onChange={(e) => setG("ownerPersonId", e.target.value)}>
                <option value="">Sem proprietário (pode definir depois)</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName || p.name}
                    {p.cpf ? ` — ${p.cpf}` : ""}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Observação" className={styles.spanTwo}>
              <Textarea
                rows={2}
                value={gForm.notes}
                onChange={(e) => setG("notes", e.target.value)}
              />
            </FormField>

            <FormField label="Fotografia" className={styles.spanTwo}>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setGravePhoto(e.target.files?.[0] || null)}
              />
            </FormField>
          </div>
          {createError && <Alert tone="danger">{createError}</Alert>}
          <Alert tone="info" title="Demarcação no mapa">
            Após cadastrar, use <strong>Cadastrar e demarcar</strong> para abrir a
            sepultura e desenhar o contorno sobre a ortofoto real do cemitério.
          </Alert>
        </form>
      </Modal>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity={"sepulturas"}
        totalCount={totalCount}
        filteredCount={rows.length}
      />

      <ConfirmDelete
        open={Boolean(confirmDelete)}
        onClose={() => { setConfirmDelete(null); setDeleteImpact(null); }}
        onConfirm={doDelete}
        loading={deleting}
        title="Excluir sepultura"
        name={confirmDelete?.code || confirmDelete?.location}
        impact={deleteImpact}
        error={deleteError}
        description="A sepultura sai das listagens e do mapa. O registro fica arquivado no histórico."
      />
    </div>
  );
}
