"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
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
import { maskCpf } from "@/lib/masks";
import { useResource, useMutation } from "@/lib/api/useResource";
import { listDeceased, getLocationCounts, createDeceased, uploadDeathCertificate } from "@/lib/api/resources/deceased";

const LOCATION_META = {
  sepultado: { label: "Sepultado", tone: "navy" },
  ossario: { label: "No ossário", tone: "warning" },
  transladado: { label: "Transladado", tone: "neutral" },
  cremado: { label: "Cremado", tone: "inverse" },
};
const locationMeta = (key) => LOCATION_META[key] || { label: "Desconhecido", tone: "neutral" };

const GENDER_LABEL = { f: "Feminino", m: "Masculino", o: "Outro" };

const PER_PAGE = 30;
const EMPTY_FORM = {
  fullName: "", cpf: "", rg: "", gender: "", birthplace: "", motherName: "",
  fatherName: "", birthDate: "", deathDate: "", deathTime: "", causeOfDeath: "",
  attendingPhysician: "",
  deathCertificateNumber: "", deathCertificateRegistry: "",
};

// "YYYY-MM-DD" (DATEONLY da API) → "DD/MM/YYYY"
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
}

// "Localização exata" a partir do jazigo atual (JAZIGO · GAVETA quando houver pai).
function placeLabel(row) {
  const g = row.currentGrave;
  if (!g) return "—";
  return g.parentGrave ? `${g.parentGrave.code} · ${g.code}` : g.code;
}
function blockCode(row) {
  return row.currentGrave?.lot?.street?.block?.code || "—";
}

export default function DeceasedListPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [deathFrom, setDeathFrom] = useState("");
  const [deathTo, setDeathTo] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [certFile, setCertFile] = useState(null); // PDF da certidão de óbito
  const [formError, setFormError] = useState("");

  // debounce da busca (evita disparar um fetch a cada tecla)
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const listParams = useMemo(
    () => ({
      page,
      perPage: PER_PAGE,
      search: debouncedSearch || undefined,
      currentLocationType: locationFilter || undefined,
      deathFrom: deathFrom || undefined,
      deathTo: deathTo || undefined,
    }),
    [page, debouncedSearch, locationFilter, deathFrom, deathTo]
  );

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listDeceased(listParams, { signal }),
    [page, debouncedSearch, locationFilter, deathFrom, deathTo]
  );
  const rawRows = data?.data ?? [];
  const meta = data?.meta;

  // contadores por situação (independem do filtro de situação; seguem busca/datas)
  const { data: counts } = useResource(
    ({ signal }) =>
      getLocationCounts(
        { search: debouncedSearch || undefined, deathFrom: deathFrom || undefined, deathTo: deathTo || undefined },
        { signal }
      ),
    [debouncedSearch, deathFrom, deathTo]
  );
  const totalCount = counts?.total ?? meta?.totalItems ?? 0;

  // map API → shape que a tabela consome (layout inalterado)
  const mapped = useMemo(
    () =>
      rawRows.map((r) => ({
        id: r.id,
        name: r.fullName,
        cpf: r.cpf ? maskCpf(r.cpf) : "—",
        birth: fmtDate(r.birthDate),
        death: fmtDate(r.deathDate),
        burial: fmtDate(r.lastBurialDate),
        location: r.currentLocationType,
        place: placeLabel(r),
        block: blockCode(r),
        responsible: r.responsible?.name || "—",
      })),
    [rawRows]
  );

  // quadras disponíveis derivadas da página atual (filtro client-side, preserva a UI)
  const blockOptions = useMemo(
    () => [...new Set(mapped.map((r) => r.block).filter((b) => b && b !== "—"))].sort(),
    [mapped]
  );
  const filtered = useMemo(
    () => (blockFilter ? mapped.filter((r) => r.block === blockFilter) : mapped),
    [mapped, blockFilter]
  );

  const { mutate: submitCreate, loading: saving } = useMutation(createDeceased);

  async function handleCreate() {
    setFormError("");
    if (!form.fullName.trim()) { setFormError("Informe o nome completo do sepultado."); return; }
    const body = {
      fullName: form.fullName.trim(),
      cpf: form.cpf || undefined,
      rg: form.rg || undefined,
      gender: GENDER_LABEL[form.gender] || undefined,
      birthplace: form.birthplace || undefined,
      motherName: form.motherName || undefined,
      fatherName: form.fatherName || undefined,
      birthDate: form.birthDate || undefined,
      deathDate: form.deathDate || undefined,
      deathTime: form.deathTime || undefined,
      causeOfDeath: form.causeOfDeath || undefined,
      attendingPhysician: form.attendingPhysician || undefined,
      deathCertificateNumber: form.deathCertificateNumber || undefined,
      deathCertificateRegistry: form.deathCertificateRegistry || undefined,
    };
    try {
      const created = await submitCreate(body);
      // anexa a declaração/certidão de óbito (PDF) escolhida, se houver
      if (certFile && created?.id) {
        try {
          await uploadDeathCertificate(created.id, certFile);
        } catch (_) {
          /* não bloqueia o cadastro — o anexo pode ser reenviado no detalhe */
        }
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setCertFile(null);
      refetch();
    } catch (e) {
      setFormError(e.message || "Não foi possível registrar o sepultado.");
    }
  }

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  const columns = [
    {
      key: "name",
      label: "Sepultado",
      render: (row) => (
        <span className={styles.personCell}>
          <Avatar name={row.name} size="sm" />
          <span className={styles.personInfo}>
            <span className={styles.personName}>{row.name}</span>
            <span className={styles.personCpf}>{row.cpf}</span>
          </span>
        </span>
      ),
    },
    {
      key: "death",
      label: "Falecimento",
      render: (row) => (
        <span className={styles.dates}>
          <span>✝ {row.death}</span>
          <span className={styles.datesSub}>{row.birth} — {row.death}</span>
        </span>
      ),
    },
    { key: "burial", label: "Sepultamento" },
    {
      key: "place",
      label: "Localização exata",
      render: (row) => <code className={styles.code}>{row.place}</code>,
    },
    {
      key: "location",
      label: "Situação",
      render: (row) => <Badge tone={locationMeta(row.location).tone} dot>{locationMeta(row.location).label}</Badge>,
    },
    { key: "responsible", label: "Responsável" },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <Link
            href={`/painel/sepultados/${row.id}`}
            title="Documentos (autorização de sepultamento, certidão de óbito)"
            aria-label="Documentos"
            style={{ display: "inline-flex", color: "var(--color-navy, #032e59)" }}
          >
            <svg viewBox="0 0 16 16" fill="none" width="17" height="17" aria-hidden="true">
              <path d="M4 1.5h5L13 5.5V14a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M9 1.5V5h4M6.5 8.5h3M6.5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </Link>
          <Link href={`/painel/sepultados/${row.id}`} className={styles.detailLink}>Detalhes</Link>
        </span>
      ),
    },
  ];

  const newButton = (
    <Button
      onClick={() => setModalOpen(true)}
      iconLeft={
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      }
    >
      Novo sepultado
    </Button>
  );

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Sepultados</h1>
          <p className={styles.subtitle}>{totalCount.toLocaleString("pt-BR")} registros</p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setExportOpen(true)}>Exportar</Button>
          {newButton}
        </div>
      </header>

      <div className={styles.statusChips}>
        <button className={`${styles.chip} ${locationFilter === "" ? styles.chipActive : ""}`} onClick={() => { setLocationFilter(""); setPage(1); }}>
          Todos <span className={styles.chipCount}>{totalCount}</span>
        </button>
        {Object.entries(LOCATION_META).map(([key, m]) => (
          <button
            key={key}
            className={`${styles.chip} ${locationFilter === key ? styles.chipActive : ""}`}
            onClick={() => { setLocationFilter(locationFilter === key ? "" : key); setPage(1); }}
          >
            <span className={`${styles.chipDot} ${styles[`dot_${key}`]}`} />
            {m.label}
            <span className={styles.chipCount}>{counts?.byLocation?.[key] || 0}</span>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Input
            placeholder="Buscar por nome, CPF ou código do jazigo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          />
        </div>
        <div className={styles.filters}>
          <Select value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)}>
            <option value="">Todas as quadras</option>
            {blockOptions.map((b) => <option key={b} value={b}>Quadra {b}</option>)}
          </Select>
          <Input type="date" value={deathFrom} onChange={(e) => { setDeathFrom(e.target.value); setPage(1); }} title="Falecimento — de" />
          <Input type="date" value={deathTo} onChange={(e) => { setDeathTo(e.target.value); setPage(1); }} title="Falecimento — até" />
        </div>
      </div>

      {loading ? (
        <div className={styles.desktopTable}>
          <Skeleton variant="row" count={8} />
        </div>
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum sepultado registrado"
          message="Comece registrando o primeiro sepultado deste cemitério."
          action={newButton}
        />
      ) : (
        <>
          <div className={styles.desktopTable}>
            <DataTable
              columns={columns}
              rows={filtered}
              footer={
                <>
                  <span>{filtered.length} de {(meta?.totalItems ?? filtered.length).toLocaleString("pt-BR")} registros</span>
                  <Pagination page={page} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
                </>
              }
            />
          </div>

          <div className={styles.mobileList}>
            {filtered.map((person) => (
              <Link key={person.id} href={`/painel/sepultados/${person.id}`} className={styles.mobileCard}>
                <div className={styles.mobileCardTop}>
                  <span className={styles.personCell}>
                    <Avatar name={person.name} size="sm" />
                    <span className={styles.personName}>{person.name}</span>
                  </span>
                  <Badge tone={locationMeta(person.location).tone} dot>{locationMeta(person.location).label}</Badge>
                </div>
                <div className={styles.mobileCardBody}>
                  <span className={styles.mobileCardLocation}>✝ {person.death} · Sepultado em {person.burial}</span>
                  <span className={styles.mobileCardOwner}>{person.place}</span>
                </div>
                <svg viewBox="0 0 16 16" fill="none" className={styles.mobileCardChevron}>
                  <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
            <p className={styles.mobileCount}>{filtered.length} de {(meta?.totalItems ?? filtered.length).toLocaleString("pt-BR")} registros</p>
          </div>
        </>
      )}

      {/* ---- novo sepultado: cadastro civil completo (PDF 3.3) ---- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo sepultado"
        subtitle="Dados civis completos do sepultado"
        width={680}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={handleCreate}>Registrar sepultado</Button>
          </>
        }
      >
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
          <span className={styles.formSection}>Identificação</span>
          <div className={styles.formGrid}>
            <FormField label="Nome completo" required className={styles.spanTwo}>
              <Input placeholder="Nome do sepultado" value={form.fullName} onChange={set("fullName")} />
            </FormField>
            <FormField label="CPF">
              <Input placeholder="000.000.000-00" inputMode="numeric" value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: maskCpf(e.target.value) }))} />
            </FormField>
            <FormField label="RG">
              <Input placeholder="00.000.000-0" value={form.rg} onChange={set("rg")} />
            </FormField>
            <FormField label="Sexo">
              <Select value={form.gender} onChange={set("gender")}>
                <option value="">Não informado</option>
                <option value="f">Feminino</option>
                <option value="m">Masculino</option>
                <option value="o">Outro</option>
              </Select>
            </FormField>
            <FormField label="Naturalidade">
              <Input placeholder="Cidade — UF" value={form.birthplace} onChange={set("birthplace")} />
            </FormField>
            <FormField label="Nome da mãe">
              <Input placeholder="Filiação materna" value={form.motherName} onChange={set("motherName")} />
            </FormField>
            <FormField label="Nome do pai">
              <Input placeholder="Filiação paterna" value={form.fatherName} onChange={set("fatherName")} />
            </FormField>
          </div>

          <span className={styles.formSection}>Óbito</span>
          <div className={styles.formGrid}>
            <FormField label="Data de nascimento">
              <Input type="date" value={form.birthDate} onChange={set("birthDate")} />
            </FormField>
            <FormField label="Data do falecimento">
              <Input type="date" value={form.deathDate} onChange={set("deathDate")} />
            </FormField>
            <FormField label="Hora do falecimento">
              <Input type="time" value={form.deathTime} onChange={set("deathTime")} />
            </FormField>
            <FormField label="Causa do óbito">
              <Input placeholder="Conforme certidão" value={form.causeOfDeath} onChange={set("causeOfDeath")} />
            </FormField>
            <FormField label="Médico responsável" hint="Nome do médico do atestado de óbito">
              <Input placeholder="Dr(a). Nome do médico" value={form.attendingPhysician} onChange={set("attendingPhysician")} />
            </FormField>
            <FormField label="Nº da certidão de óbito">
              <Input placeholder="Livro, folha, termo" value={form.deathCertificateNumber} onChange={set("deathCertificateNumber")} />
            </FormField>
            <FormField label="Cartório de registro">
              <Input placeholder="Nome do cartório" value={form.deathCertificateRegistry} onChange={set("deathCertificateRegistry")} />
            </FormField>
            <FormField
              label="Declaração / Certidão de óbito (PDF)"
              className={styles.spanTwo}
              hint={certFile ? `Selecionado: ${certFile.name}` : "Anexe o PDF da declaração ou certidão de óbito (até 15 MB)"}
            >
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setCertFile(e.target.files?.[0] || null)}
              />
            </FormField>
          </div>

          {formError && <Alert tone="danger">{formError}</Alert>}
          <Alert tone="info">
            O sepultado é registrado no <strong>cadastro civil</strong>. O vínculo à
            sepultura e a <strong>Autorização de Sepultamento</strong> são emitidos no
            fluxo de sepultamento.
          </Alert>
        </form>
      </Modal>
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity={"sepultados"}
        totalCount={totalCount}
        filteredCount={filtered.length}
      />
    </div>
  );
}
