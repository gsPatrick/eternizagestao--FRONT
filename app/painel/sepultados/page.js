"use client";

import { useEffect, useMemo, useState } from "react";
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
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import { maskCpf } from "@/lib/masks";
import { useResource, useMutation } from "@/lib/api/useResource";
import { listDeceased, getLocationCounts, createDeceased, uploadDeathCertificate, deleteDeceased, getDeceasedDeleteImpact } from "@/lib/api/resources/deceased";
import { getUser } from "@/lib/api/session";
import RowActions from "@/components/molecules/RowActions/RowActions";
import ConfirmDelete from "@/components/molecules/ConfirmDelete/ConfirmDelete";
import { createBurial } from "@/lib/api/resources/burials";
import { listCartorios } from "@/lib/api/resources/cartorios";
import { listFunerarias } from "@/lib/api/resources/funerarias";
import { listPeople } from "@/lib/api/resources/people";
import GravePicker, { graveLabel } from "@/components/organisms/GravePicker/GravePicker";
import { registerPerformedExhumation } from "@/lib/api/resources/exhumations";
import { listOssuaries, listNiches } from "@/lib/api/resources/ossuaries";
import { todayISO } from "@/lib/date-local";

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
  fullName: "", registrationNumber: "", cpf: "", rg: "", age: "", gender: "",
  birthplace: "", motherName: "",
  fatherName: "", birthDate: "", deathDate: "", deathTime: "", causeOfDeath: "",
  maritalStatus: "", skinColor: "", voterId: "", deathPlace: "",
  attendingPhysician: "",
  deathCertificateNumber: "", deathCertificateRegistry: "", registryNumber: "", funeralHome: "",
  responsiblePersonId: "", notes: "",
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
function lotCode(row) {
  return row.currentGrave?.lot?.code || "—";
}
function cemeteryName(row) {
  return row.currentGrave?.cemetery?.name || "—";
}
// "Gaveta": quando a unidade atual está dentro de um jazigo/túmulo, é o código
// da própria unidade; sepultura solta não tem gaveta.
function gavetaCode(row) {
  const g = row.currentGrave;
  return g?.parentGrave ? g.code : "—";
}

export default function DeceasedListPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [deathFrom, setDeathFrom] = useState("");
  const [deathTo, setDeathTo] = useState("");
  // filtros avançados (busca ampliada — pedido do cliente)
  const [adv, setAdv] = useState({ cpf: "", motherName: "", graveCode: "", block: "", lot: "", registrationNumber: "" });
  const [debouncedAdv, setDebouncedAdv] = useState({ cpf: "", motherName: "", graveCode: "", block: "", lot: "", registrationNumber: "" });
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
  // Cadastrar sepultado JÁ registra o sepultamento (é o que gera a AUTORIZAÇÃO
  // DE SEPULTAMENTO automaticamente). O operador pode desmarcar se não houver.
  const [burialForm, setBurialForm] = useState({ graveId: "", date: todayISO(), time: "" });
  // "Sepultamento" deixou de ser uma etapa/entidade visível: cadastrar o
  // sepultado JÁ o vincula à sepultura escolhida. Quem não tem jazigo (cremado,
  // transladado) simplesmente não escolhe a sepultura — daí este valor derivado.
  const linkBurial = Boolean(burialForm.graveId);
  // Sepultura escolhida no modal "Pesquisa de sepulturas" — guardamos o objeto
  // inteiro para exibir "Cemitério - Quadra: X - Lote: Y", como na tela dele.
  const [pickedGrave, setPickedGrave] = useState(null);
  const [gravePickerOpen, setGravePickerOpen] = useState(false);

  // Bloco "Exumação" do formulário: quando o operador marca que o sepultado JÁ
  // foi exumado, registramos a exumação como realizada (a API percorre o fluxo
  // oficial por dentro, então o registro é igual ao da tela de Exumações).
  const [exhum, setExhum] = useState({ done: false, nicheId: "", number: "", date: "" });

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
  // Pessoas cadastradas → dropdown de RESPONSÁVEL pela sepultura.
  // Nichos do ossário disponíveis no cemitério da sepultura escolhida →
  // opções de "Local do envio". Sem sepultura escolhida não há para onde enviar.
  const exhumCemeteryId = pickedGrave?.cemetery?.id || pickedGrave?.cemeteryId || null;
  const { data: ossuariesData } = useResource(
    ({ signal }) => (exhumCemeteryId ? listOssuaries(exhumCemeteryId, { signal }) : Promise.resolve({ data: [] })),
    [exhumCemeteryId]
  );
  const ossuaries = useMemo(() => ossuariesData?.data ?? ossuariesData ?? [], [ossuariesData]);
  const { data: nichesData } = useResource(
    async ({ signal }) => {
      if (!ossuaries.length) return [];
      const lists = await Promise.all(
        ossuaries.map((o) => listNiches(o.id, { status: "livre", perPage: 500 }, { signal })
          .then((r) => (r?.data ?? r ?? []).map((n) => ({ ...n, ossuaryName: o.name })))
          .catch(() => []))
      );
      return lists.flat();
    },
    [ossuaries]
  );
  const freeNiches = nichesData ?? [];

  const { data: peopleData } = useResource(
    ({ signal }) => (modalOpen ? listPeople({ perPage: 1000 }, { signal }) : Promise.resolve({ data: [] })),
    [modalOpen]
  );
  const people = peopleData?.data ?? [];

  // atalho "Novo sepultado" do Painel (/painel/sepultados?novo=1) já abre o
  // cadastro — herdado da tela de Sepultamentos, que foi removida.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") === "1") setModalOpen(true);
  }, []);

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
        block: adv.block.trim(),
        lot: adv.lot.trim(),
        registrationNumber: adv.registrationNumber.trim(),
      });
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [adv.cpf, adv.motherName, adv.graveCode, adv.block, adv.lot, adv.registrationNumber]);

  const listParams = useMemo(
    () => ({
      page,
      perPage: PER_PAGE,
      search: debouncedSearch || undefined,
      currentLocationType: locationFilter || undefined,
      cpf: debouncedAdv.cpf || undefined,
      motherName: debouncedAdv.motherName || undefined,
      graveCode: debouncedAdv.graveCode || undefined,
      block: debouncedAdv.block || undefined,
      lot: debouncedAdv.lot || undefined,
      registrationNumber: debouncedAdv.registrationNumber || undefined,
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
        cemetery: cemeteryName(r),
        block: blockCode(r),
        lot: lotCode(r),
        gaveta: gavetaCode(r),
        registration: r.registrationNumber || "—",
        gender: GENDER_LABEL[String(r.gender || "").toLowerCase()] || r.gender || "—",
        responsible: r.responsible?.name || "—",
      })),
    [rawRows]
  );

  // Quadra e lote agora são filtrados NA API (texto), não mais no cliente —
  // filtrar só a página corrente escondia resultados das páginas seguintes.
  const filtered = mapped;

  const { mutate: submitCreate, loading: saving } = useMutation(createDeceased);

  // ---- exclusão de sepultado (RBAC + confirmação) ----
  const currentUser = getUser();
  const canDelete = ["admin", "super_admin"].includes(currentUser?.role);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteImpact, setDeleteImpact] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Abre a confirmação já sabendo o que a exclusão arrasta junto.
  async function askDelete(row) {
    setDeleteError("");
    setDeleteImpact(null);
    setConfirmDelete(row);
    try {
      setDeleteImpact(await getDeceasedDeleteImpact(row.id));
    } catch (_) {
      /* sem o impacto o modal segue no modo simples */
    }
  }

  async function doDelete(force = false) {
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteDeceased(confirmDelete.id, { force });
      setConfirmDelete(null);
      setDeleteImpact(null);
      refetch();
    } catch (e) {
      setDeleteError(e?.message || "Não foi possível excluir o sepultado.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreate() {
    setFormError("");
    if (!form.fullName.trim()) { setFormError("Informe o nome completo do sepultado."); return; }
    // Exumar é dar baixa num sepultamento: sem sepultura escolhida não há o que exumar.
    if (exhum.done && !burialForm.graveId) {
      setFormError("Para registrar a exumação, escolha a sepultura de origem.");
      return;
    }
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
      maritalStatus: form.maritalStatus || undefined,
      skinColor: form.skinColor || undefined,
      voterId: form.voterId || undefined,
      deathPlace: form.deathPlace || undefined,
      attendingPhysician: form.attendingPhysician || undefined,
      deathCertificateNumber: form.deathCertificateNumber || undefined,
      deathCertificateRegistry: form.deathCertificateRegistry || undefined,
      registryNumber: form.registryNumber || undefined,
      funeralHome: form.funeralHome || undefined,
      responsiblePersonId: form.responsiblePersonId || undefined,
      registrationNumber: form.registrationNumber || undefined,
      age: form.age || undefined,
      notes: form.notes || undefined,
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
            declarantPersonId: form.responsiblePersonId || undefined,
          });
        } catch (e) {
          // sepultado criado, mas o sepultamento falhou → avisa e não perde o cadastro
          setFormError(
            `Sepultado cadastrado, mas o sepultamento falhou: ${e.message || "vincule a sepultura pela tela do sepultado"}.`
          );
          setForm(EMPTY_FORM);
          setCertFile(null);
          setBurialForm({ graveId: "", date: todayISO(), time: "" });
          refetch();
          return;
        }

        // EXUMAÇÃO já ocorrida: só faz sentido depois do sepultamento gravado —
        // é dele que a exumação dá baixa. Best-effort: o cadastro não se perde
        // se o registro da exumação falhar, e o operador vê o motivo.
        if (exhum.done && created?.id) {
          try {
            await registerPerformedExhumation({
              deceasedId: created.id,
              graveId: burialForm.graveId,
              destinationType: exhum.nicheId ? "ossario" : "outro",
              destinationOssuaryNicheId: exhum.nicheId || undefined,
              authorizationNumber: exhum.number || undefined,
              performedAt: exhum.date || undefined,
            });
          } catch (e) {
            setFormError(
              `Sepultado cadastrado, mas a exumação não foi registrada: ${e.message || "registre pelo menu Exumações"}.`
            );
          }
        }
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setCertFile(null);
      setPickedGrave(null);
      setExhum({ done: false, nicheId: "", number: "", date: "" });
      setBurialForm({ graveId: "", date: todayISO(), time: "" });
      refetch();
    } catch (e) {
      setFormError(e.message || "Não foi possível registrar o sepultado.");
    }
  }

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  // Colunas espelhando a listagem do cliente: Cemitério · Quadra · Lote ·
  // Gaveta · Matrícula · Nome · Sexo · Falecimento · Sepultamento.
  const columns = [
    { key: "cemetery", label: "Cemitério", minWidth: 190 },
    { key: "block", label: "Quadra", nowrap: true },
    { key: "lot", label: "Lote", nowrap: true },
    { key: "gaveta", label: "Gaveta", nowrap: true },
    { key: "registration", label: "Matrícula", nowrap: true },
    {
      key: "name",
      label: "Nome",
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
    { key: "gender", label: "Sexo", nowrap: true },
    { key: "death", label: "Data de falecimento", nowrap: true },
    { key: "burial", label: "Data de sepultamento", nowrap: true },
    {
      key: "location",
      label: "Situação",
      render: (row) => <Badge tone={locationMeta(row.location).tone} dot>{locationMeta(row.location).label}</Badge>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <RowActions
          editHref={`/painel/sepultados/${row.id}`}
          canDelete={canDelete}
          onDelete={() => askDelete(row)}
          extra={
            <Link
              href={`/painel/sepultados/${row.id}`}
              title="Documentos (autorização de sepultamento, certidão de óbito)"
              aria-label="Documentos"
              style={{ display: "inline-flex", color: "var(--color-navy, #032e59)", padding: "6px 4px" }}
            >
              <svg viewBox="0 0 16 16" fill="none" width="17" height="17" aria-hidden="true">
                <path d="M4 1.5h5L13 5.5V14a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M9 1.5V5h4M6.5 8.5h3M6.5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </Link>
          }
        />
      ),
    },
  ];

  const newButton = (
    <Button
      onClick={() => {
          setBurialForm({ graveId: "", date: todayISO(), time: "" });
        setModalOpen(true);
      }}
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
          <FormField label="Gaveta / Jazigo">
            <Input placeholder="Código da unidade (ex.: M2/12B)" value={adv.graveCode} onChange={setAdvField("graveCode")} />
          </FormField>
          <FormField label="Matrícula">
            <Input placeholder="Ex.: M2/12B" value={adv.registrationNumber} onChange={setAdvField("registrationNumber")} />
          </FormField>
          {(adv.cpf || adv.motherName || adv.graveCode || adv.registrationNumber) && (
            <Button
              variant="ghost"
              onClick={() => setAdv((a) => ({ ...a, cpf: "", motherName: "", graveCode: "", registrationNumber: "" }))}
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
        subtitle="Cadastro do sepultado e vínculo com a sepultura"
        width={680}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={handleCreate}>Registrar sepultado</Button>
          </>
        }
      >
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
          {/* Ordem, seções e natureza dos campos espelham o formulário que o
              cliente já usa. Listas: Sexo, Cor, Estado civil, Cartório,
              Funerária e Responsável. Todo o resto é texto. */}
          <div className={styles.formGrid}>
            <FormField
              label="Sepultura"
              required={false}
              className={styles.spanTwo}
              hint="Escolha na pesquisa de sepulturas. Deixe vazio se o corpo foi cremado ou transladado."
            >
              <div className={styles.pickerRow}>
                <Input
                  readOnly
                  value={pickedGrave ? graveLabel(pickedGrave) : ""}
                  placeholder="Nenhuma sepultura selecionada"
                  onClick={() => setGravePickerOpen(true)}
                />
                <Button type="button" variant="secondary" onClick={() => setGravePickerOpen(true)}>
                  {pickedGrave ? "Trocar" : "Selecionar"}
                </Button>
                {pickedGrave && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setPickedGrave(null); setBurialForm((b) => ({ ...b, graveId: "" })); }}
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </FormField>
            <FormField label="Matrícula">
              <Input placeholder="Ex.: M2/12B" value={form.registrationNumber} onChange={set("registrationNumber")} />
            </FormField>
            <FormField
              label="Responsável"
              className={styles.spanTwo}
              hint="Quem responde pela sepultura — distinto do proprietário"
            >
              <Select value={form.responsiblePersonId} onChange={set("responsiblePersonId")}>
                <option value="">Sem responsável definido</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName || p.name}
                    {p.cpf ? ` — ${p.cpf}` : ""}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <span className={styles.formSection}>Identificação</span>
          <div className={styles.formGrid}>
            <FormField label="Nome" required className={styles.spanTwo}>
              <Input placeholder="Nome do sepultado" value={form.fullName} onChange={set("fullName")} />
            </FormField>
            <FormField label="Sexo" required>
              <Select value={form.gender} onChange={set("gender")}>
                <option value="">Não informado</option>
                <option value="f">Feminino</option>
                <option value="m">Masculino</option>
                <option value="o">Outro</option>
              </Select>
            </FormField>
            <FormField label="Nome do pai">
              <Input placeholder="Filiação paterna" value={form.fatherName} onChange={set("fatherName")} />
            </FormField>
            <FormField label="Nome da mãe" required>
              <Input placeholder="Filiação materna" value={form.motherName} onChange={set("motherName")} />
            </FormField>
            <FormField label="Naturalidade" required>
              <Input placeholder="Cidade — UF" value={form.birthplace} onChange={set("birthplace")} />
            </FormField>
            <FormField label="Cor" required>
              <Select value={form.skinColor} onChange={set("skinColor")}>
                <option value="">Sem declaração</option>
                <option value="Branca">Branca</option>
                <option value="Preta">Preta</option>
                <option value="Parda">Parda</option>
                <option value="Amarela">Amarela</option>
                <option value="Indígena">Indígena</option>
              </Select>
            </FormField>
            <FormField label="Estado civil" required>
              <Select value={form.maritalStatus} onChange={set("maritalStatus")}>
                <option value="">Sem declaração</option>
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
                <option value="Separado(a)">Separado(a)</option>
                <option value="União estável">União estável</option>
              </Select>
            </FormField>
            <FormField label="Idade" required>
              <Input placeholder="Ex.: 75 anos" value={form.age} onChange={set("age")} />
            </FormField>
            <FormField label="Data de nascimento">
              <Input type="date" value={form.birthDate} onChange={set("birthDate")} />
            </FormField>
          </div>

          <span className={styles.formSection}>Documentação</span>
          <div className={styles.formGrid}>
            <FormField label="RG">
              <Input placeholder="00.000.000-0" value={form.rg} onChange={set("rg")} />
            </FormField>
            <FormField label="CPF">
              <Input placeholder="000.000.000-00" inputMode="numeric" value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: maskCpf(e.target.value) }))} />
            </FormField>
            <FormField label="Título de eleitor">
              <Input placeholder="Nº do título" value={form.voterId} onChange={set("voterId")} />
            </FormField>
          </div>

          <span className={styles.formSection}>Falecimento</span>
          <div className={styles.formGrid}>
            <FormField label="Data de falecimento" required>
              <Input type="date" value={form.deathDate} onChange={set("deathDate")} />
            </FormField>
            <FormField label="Data de sepultamento" required={linkBurial}>
              <Input type="date" value={burialForm.date} onChange={(e) => setBurialForm((b) => ({ ...b, date: e.target.value }))} />
            </FormField>
            <FormField label="Causa da morte" required>
              <Input placeholder="Conforme atestado" value={form.causeOfDeath} onChange={set("causeOfDeath")} />
            </FormField>
            <FormField label="Médico" required>
              <Input placeholder="Dr(a). Nome do médico" value={form.attendingPhysician} onChange={set("attendingPhysician")} />
            </FormField>
            <FormField label="Nº atestado de óbito" required>
              <Input placeholder="Número do atestado" value={form.deathCertificateNumber} onChange={set("deathCertificateNumber")} />
            </FormField>
            <FormField label="Local de falecimento" required>
              <Input placeholder="Ex.: Hospital Municipal, residência" value={form.deathPlace} onChange={set("deathPlace")} />
            </FormField>
            <FormField label="Hora do falecimento">
              <Input type="time" value={form.deathTime} onChange={set("deathTime")} />
            </FormField>
            <FormField label="Hora do sepultamento">
              <Input type="time" value={burialForm.time} onChange={(e) => setBurialForm((b) => ({ ...b, time: e.target.value }))} />
            </FormField>
            <FormField
              label="Atestado de óbito"
              className={styles.spanTwo}
              hint={certFile ? `Selecionado: ${certFile.name}` : "PDF ou imagem, até 15 MB"}
            >
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setCertFile(e.target.files?.[0] || null)}
              />
            </FormField>
          </div>

          <div className={styles.formGrid}>
            <FormField label="Observação" className={styles.spanTwo}>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={set("notes")}
              />
            </FormField>
            <FormField label="Cartório" required hint="Cadastrados em Básico › Cartórios">
              <Select value={form.deathCertificateRegistry} onChange={set("deathCertificateRegistry")}>
                <option value="">Selecione uma opção</option>
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
            <FormField label="Registro" required hint="Nº do registro no cartório">
              <Input value={form.registryNumber} onChange={set("registryNumber")} />
            </FormField>
            <FormField label="Funerária" required hint="Cadastradas em Básico › Funerárias">
              <Select value={form.funeralHome} onChange={set("funeralHome")}>
                <option value="">Selecione uma opção</option>
                {funerarias.map((f) => (
                  <option key={f.id} value={f.name}>{f.name}</option>
                ))}
                {form.funeralHome &&
                  !funerarias.some((f) => f.name === form.funeralHome) && (
                    <option value={form.funeralHome}>{form.funeralHome}</option>
                  )}
              </Select>
            </FormField>
          </div>

          <span className={styles.formSection}>Exumação</span>
          <div className={styles.formGrid}>
            <FormField label="Foi exumado?">
              <Select
                value={exhum.done ? "sim" : "nao"}
                onChange={(e) => setExhum((x) => ({ ...x, done: e.target.value === "sim" }))}
              >
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </Select>
            </FormField>
            {exhum.done && (
              <>
                <FormField
                  label="Local do envio"
                  hint={
                    pickedGrave
                      ? "Nichos livres do ossário deste cemitério"
                      : "Escolha a sepultura acima para listar os nichos"
                  }
                >
                  <Select value={exhum.nicheId} onChange={(e) => setExhum((x) => ({ ...x, nicheId: e.target.value }))}>
                    <option value="">Selecione uma opção</option>
                    {freeNiches.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.ossuaryName ? `${n.ossuaryName} · ` : ""}{n.code || n.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Número" hint="Nº da autorização de exumação">
                  <Input value={exhum.number} onChange={(e) => setExhum((x) => ({ ...x, number: e.target.value }))} />
                </FormField>
                <FormField label="Data de envio">
                  <Input type="date" value={exhum.date} onChange={(e) => setExhum((x) => ({ ...x, date: e.target.value }))} />
                </FormField>
              </>
            )}
          </div>

          {formError && <Alert tone="danger">{formError}</Alert>}
        </form>
      </Modal>
      <GravePicker
        open={gravePickerOpen}
        onClose={() => setGravePickerOpen(false)}
        onSelect={(g) => {
          setPickedGrave(g);
          setBurialForm((b) => ({ ...b, graveId: g.id }));
        }}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity={"sepultados"}
        totalCount={totalCount}
        filteredCount={filtered.length}
      />

      <ConfirmDelete
        open={Boolean(confirmDelete)}
        onClose={() => { setConfirmDelete(null); setDeleteImpact(null); }}
        onConfirm={doDelete}
        loading={deleting}
        title="Excluir sepultado"
        name={confirmDelete?.name}
        impact={deleteImpact}
        error={deleteError}
        description="O sepultado sai das listagens. O registro fica arquivado no histórico."
      />
    </div>
  );
}
