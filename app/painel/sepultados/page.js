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
import { createBurial, listFreeGraves, adaptFreeGrave } from "@/lib/api/resources/burials";
import { listCartorios } from "@/lib/api/resources/cartorios";
import { listFunerarias } from "@/lib/api/resources/funerarias";

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
  deathCertificateNumber: "", deathCertificateRegistry: "", funeralHome: "",
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
  // filtros avançados (busca ampliada — pedido do cliente)
  const [adv, setAdv] = useState({ cpf: "", motherName: "", graveCode: "" });
  const [debouncedAdv, setDebouncedAdv] = useState({ cpf: "", motherName: "", graveCode: "" });
  const [advOpen, setAdvOpen] = useState(false);
  const setAdvField = (k) => (e) => setAdv((a) => ({ ...a, [k]: e.target.value }));
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [certFile, setCertFile] = useState(null); // PDF da certidão de óbito
  const [formError, setFormError] = useState("");
  // sepultamento vinculado no MESMO cadastro (Leo: cadastrar sepultado já registra
  // o sepultamento). Opcional — sem jazigo/data, cria só o sepultado.
  const [linkBurial, setLinkBurial] = useState(false);
  const [burialForm, setBurialForm] = useState({ graveId: "", date: "", time: "" });
  const { data: freeGravesData } = useResource(
    ({ signal }) => (modalOpen ? listFreeGraves({ perPage: 500 }, { signal }) : Promise.resolve({ data: [] })),
    [modalOpen]
  );
  const freeGraves = useMemo(
    () => (freeGravesData?.data ?? []).map(adaptFreeGrave),
    [freeGravesData]
  );

  // Cartórios e Funerárias cadastrados (Básico) → dropdowns do sepultado.
  const { data: cartoriosData } = useResource(
    ({ signal }) => (modalOpen ? listCartorios({ perPage: 300 }, { signal }) : Promise.resolve({ data: [] })),
    [modalOpen]
  );
  const cartorios = cartoriosData?.data ?? [];
  const { data: funerariasData } = useResource(
    ({ signal }) => (modalOpen ? listFunerarias({ perPage: 300 }, { signal }) : Promise.resolve({ data: [] })),
    [modalOpen]
  );
  const funerarias = funerariasData?.data ?? [];

  // debounce da busca (evita disparar um fetch a cada tecla)
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // debounce dos filtros avançados de texto
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedAdv({
        cpf: adv.cpf.trim(),
        motherName: adv.motherName.trim(),
        graveCode: adv.graveCode.trim(),
      });
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [adv.cpf, adv.motherName, adv.graveCode]);

  const listParams = useMemo(
    () => ({
      page,
      perPage: PER_PAGE,
      search: debouncedSearch || undefined,
      currentLocationType: locationFilter || undefined,
      cpf: debouncedAdv.cpf || undefined,
      motherName: debouncedAdv.motherName || undefined,
      graveCode: debouncedAdv.graveCode || undefined,
      deathFrom: deathFrom || undefined,
      deathTo: deathTo || undefined,
    }),
    [page, debouncedSearch, locationFilter, debouncedAdv, deathFrom, deathTo]
  );

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listDeceased(listParams, { signal }),
    [listParams]
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
      funeralHome: form.funeralHome || undefined,
    };
    try {
      // validação do sepultamento vinculado (quando marcado)
      if (linkBurial && (!burialForm.graveId || !burialForm.date)) {
        setFormError("Para registrar o sepultamento junto, informe o jazigo e a data.");
        return;
      }
      const created = await submitCreate(body);
      // anexa a declaração/certidão de óbito (PDF) escolhida, se houver
      if (certFile && created?.id) {
        try {
          await uploadDeathCertificate(created.id, certFile);
        } catch (_) {
          /* não bloqueia o cadastro — o anexo pode ser reenviado no detalhe */
        }
      }
      // registra o SEPULTAMENTO no mesmo fluxo (dispara a auto-autorização)
      if (linkBurial && created?.id && burialForm.graveId && burialForm.date) {
        try {
          await createBurial({
            deceasedId: created.id,
            graveId: burialForm.graveId,
            burialDate: burialForm.date,
            burialTime: burialForm.time || undefined,
            funeralHome: form.funeralHome || undefined,
          });
        } catch (e) {
          // sepultado criado, mas o sepultamento falhou → avisa e não perde o cadastro
          setFormError(
            `Sepultado cadastrado, mas o sepultamento falhou: ${e.message || "tente registrar pelo menu Sepultamentos"}.`
          );
          setForm(EMPTY_FORM);
          setCertFile(null);
          setLinkBurial(false);
          setBurialForm({ graveId: "", date: "", time: "" });
          refetch();
          return;
        }
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setCertFile(null);
      setLinkBurial(false);
      setBurialForm({ graveId: "", date: "", time: "" });
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
          <Button variant="ghost" onClick={() => setAdvOpen((v) => !v)}>
            {advOpen ? "Menos filtros" : "Mais filtros"}
          </Button>
        </div>
      </div>

      {advOpen && (
        <div className={styles.advFilters}>
          <FormField label="CPF">
            <Input placeholder="000.000.000-00" value={adv.cpf} onChange={setAdvField("cpf")} />
          </FormField>
          <FormField label="Nome da mãe">
            <Input placeholder="Nome da mãe" value={adv.motherName} onChange={setAdvField("motherName")} />
          </FormField>
          <FormField label="Jazigo / Gaveta / Matrícula">
            <Input placeholder="Código do jazigo (ex.: M2/12B)" value={adv.graveCode} onChange={setAdvField("graveCode")} />
          </FormField>
          {(adv.cpf || adv.motherName || adv.graveCode) && (
            <Button
              variant="ghost"
              onClick={() => setAdv({ cpf: "", motherName: "", graveCode: "" })}
              className={styles.clearAdv}
            >
              Limpar
            </Button>
          )}
        </div>
      )}

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
            <FormField label="Cartório de registro" hint="Cadastrados em Básico › Cartórios">
              <Select value={form.deathCertificateRegistry} onChange={set("deathCertificateRegistry")}>
                <option value="">Selecione o cartório…</option>
                {cartorios.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                {/* preserva um valor legado que não esteja na lista */}
                {form.deathCertificateRegistry &&
                  !cartorios.some((c) => c.name === form.deathCertificateRegistry) && (
                    <option value={form.deathCertificateRegistry}>{form.deathCertificateRegistry}</option>
                  )}
              </Select>
            </FormField>
            <FormField label="Funerária" hint="Cadastradas em Básico › Funerárias">
              <Select value={form.funeralHome} onChange={set("funeralHome")}>
                <option value="">Selecione a funerária…</option>
                {funerarias.map((f) => (
                  <option key={f.id} value={f.name}>{f.name}</option>
                ))}
                {form.funeralHome &&
                  !funerarias.some((f) => f.name === form.funeralHome) && (
                    <option value={form.funeralHome}>{form.funeralHome}</option>
                  )}
              </Select>
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

          <div className={styles.linkBurialBox}>
            <label className={styles.linkBurialToggle}>
              <input
                type="checkbox"
                checked={linkBurial}
                onChange={(e) => setLinkBurial(e.target.checked)}
              />
              <span>
                <strong>Registrar sepultamento junto</strong> — vincula o sepultado a
                um jazigo e gera a Autorização de Sepultamento agora
              </span>
            </label>
            {linkBurial && (
              <div className={styles.formGrid}>
                <FormField label="Jazigo (livre)" required>
                  <Select
                    value={burialForm.graveId}
                    onChange={(e) => setBurialForm((b) => ({ ...b, graveId: e.target.value }))}
                  >
                    <option value="" disabled>Selecione a unidade…</option>
                    {freeGraves.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.code}{g.available != null ? ` · ${g.available} vaga(s)` : ""}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Data do sepultamento" required>
                  <Input type="date" value={burialForm.date} onChange={(e) => setBurialForm((b) => ({ ...b, date: e.target.value }))} />
                </FormField>
                <FormField label="Hora">
                  <Input type="time" value={burialForm.time} onChange={(e) => setBurialForm((b) => ({ ...b, time: e.target.value }))} />
                </FormField>
              </div>
            )}
          </div>

          {formError && <Alert tone="danger">{formError}</Alert>}
          {!linkBurial && (
            <Alert tone="info">
              O sepultado é registrado no <strong>cadastro civil</strong>. Marque acima
              para já registrar o <strong>sepultamento</strong> e emitir a Autorização.
            </Alert>
          )}
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
