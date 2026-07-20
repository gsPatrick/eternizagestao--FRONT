"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Textarea from "@/components/atoms/Textarea/Textarea";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import StatCard from "@/components/molecules/StatCard/StatCard";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import DataTable from "@/components/organisms/DataTable/DataTable";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";
import { maskCpf, maskPhone, maskCep } from "@/lib/masks";
import { useResource } from "@/lib/api/useResource";
import {
  listPeople,
  getPeopleSummary,
  getPerson,
  createPerson,
  updatePerson,
  uploadPersonPhoto,
  addRelationship as apiAddRelationship,
  invitePortal as apiInvitePortal,
  revokePortal as apiRevokePortal,
  toPersonRow,
  toPersonDetail,
  toPersonPayload,
} from "@/lib/api/resources/people";

const ROLE_META = {
  proprietario: { label: "Proprietário", tone: "navy" },
  responsavel: { label: "Responsável", tone: "info" },
  familiar: { label: "Familiar", tone: "neutral" },
};

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "proprietario", label: "Proprietários" },
  { key: "responsavel", label: "Responsáveis" },
  { key: "familiar", label: "Familiares" },
  { key: "portal", label: "Com portal" },
  { key: "inativos", label: "Inativos" },
];

const RELATION_TYPES = ["Cônjuge", "Pai", "Mãe", "Filho(a)", "Irmão(ã)", "Neto(a)", "Representante", "Outro"];

// Corpo único da experiência "Pessoas". As páginas /painel/pessoas,
// /painel/proprietarios e /painel/responsaveis renderizam ESTE componente —
// zero duplicação de lógica de dados. `initialRole` + `roleLocked` escopam a
// listagem a um papel (proprietário/responsável) reusando o mesmo resource.
export default function PeopleView({
  initialRole = null,
  roleLocked = false,
  title = "Pessoas",
  subtitle = "Cadastro único de proprietários, responsáveis e familiares",
  emptyTitle = "Nenhuma pessoa cadastrada",
  emptyMessage = "Comece cadastrando a primeira pessoa deste cemitério.",
} = {}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(roleLocked && initialRole ? initialRole : "todos");
  const [detailId, setDetailId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [relForm, setRelForm] = useState(null); // { person: "", type: "Cônjuge" }
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tone, message }
  const [addr, setAddr] = useState({ zip: "", city: "", street: "" });
  const [cepStatus, setCepStatus] = useState("idle"); // idle | loading | done | error
  // foto da pessoa: url exibida no preview + arquivo pendente (modo criação, antes
  // de existir o id) + estado de envio. NUNCA guardamos link — só upload.
  const [photo, setPhoto] = useState({ url: null, pendingFile: null, uploading: false });
  const formRef = useRef(null);

  // ---- parâmetros de listagem derivados dos filtros/busca (server-side) ----
  const listParams = useMemo(() => {
    const params = { perPage: 100 };
    const q = query.trim();
    if (q) params.search = q;
    // views escopadas (proprietários/responsáveis): papel sempre fixado
    if (roleLocked && initialRole) {
      params.role = initialRole;
    } else {
      if (["proprietario", "responsavel", "familiar", "portal"].includes(filter)) params.role = filter;
      if (filter === "inativos") params.active = "false";
    }
    return params;
  }, [query, filter, roleLocked, initialRole]);

  const { data: summaryData, refetch: refetchSummary } = useResource(
    ({ signal }) => getPeopleSummary({ signal }),
    []
  );
  const { data: listData, loading, error, refetch } = useResource(
    ({ signal }) => listPeople(listParams, { signal }),
    [listParams]
  );
  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useResource(
    ({ signal }) => (detailId ? getPerson(detailId, { signal }) : Promise.resolve(null)),
    [detailId]
  );

  const rows = useMemo(() => (listData?.data ?? []).map(toPersonRow), [listData]);
  const detail = useMemo(() => toPersonDetail(detailData), [detailData]);
  const peopleIndex = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => map.set(r.name.trim().toLowerCase(), r.id));
    return map;
  }, [rows]);

  const counts = {
    todos: summaryData?.total ?? 0,
    proprietario: summaryData?.proprietario ?? 0,
    responsavel: summaryData?.responsavel ?? 0,
    familiar: summaryData?.familiar ?? 0,
    portal: summaryData?.portal ?? 0,
    inativos: summaryData?.inativos ?? 0,
  };

  const isFiltered = query.trim().length > 0 || (!roleLocked && filter !== "todos");

  function flash(message, tone = "success") {
    setFeedback({ tone, message });
    setTimeout(() => setFeedback(null), 4500);
  }

  // Executa uma ação assíncrona controlando o estado de "saving" e traduzindo o
  // ApiError (mensagem amigável vem do envelope de erro da API) para um Alert.
  async function run(fn, okMsg) {
    setSaving(true);
    try {
      await fn();
      if (okMsg) flash(okMsg, "success");
      return true;
    } catch (e) {
      flash(e?.message || "Não foi possível concluir a ação.", "danger");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function refreshList() {
    refetch();
    refetchSummary();
  }

  function openForm(person) {
    setEditing(person);
    setAddr({ zip: person?.zipcode || "", city: person?.city || "", street: person?.address || "" });
    setCepStatus("idle");
    setPhoto({ url: person?.photoUrl || null, pendingFile: null, uploading: false });
    setFormOpen(true);
  }

  // Upload da foto da pessoa. Em EDIÇÃO (id já existe) sobe na hora e atualiza o
  // preview/listas. Em CRIAÇÃO (sem id ainda) guarda o arquivo e mostra um preview
  // local; o envio acontece após o cadastro, quando já temos o id.
  async function handlePhoto(file) {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      flash("Envie um arquivo de imagem (PNG ou JPEG).", "danger");
      return;
    }
    const localPreview = URL.createObjectURL(file);
    const editingId = editing?.id;
    if (!editingId) {
      // criação: só guarda o arquivo + preview local; sobe depois do create
      setPhoto({ url: localPreview, pendingFile: file, uploading: false });
      return;
    }
    setPhoto((p) => ({ ...p, url: localPreview, uploading: true }));
    try {
      const { photoUrl } = await uploadPersonPhoto(editingId, file);
      setPhoto({ url: photoUrl, pendingFile: null, uploading: false });
      flash("Foto atualizada.", "success");
      refreshList();
      if (detailId) refetchDetail();
    } catch (e) {
      setPhoto((p) => ({ ...p, uploading: false }));
      flash(e?.message || "Não foi possível enviar a foto.", "danger");
    }
  }

  // Upload da foto DIRETO no modal de detalhe (sem abrir o form de edição).
  // Sobe na hora para o id em detalhe, atualiza o preview, a lista e o detalhe.
  const [detailPhotoUploading, setDetailPhotoUploading] = useState(false);
  async function handleDetailPhoto(file) {
    if (!file || !detailId) return;
    if (!file.type?.startsWith("image/")) {
      flash("Envie um arquivo de imagem (PNG ou JPEG).", "danger");
      return;
    }
    setDetailPhotoUploading(true);
    try {
      await uploadPersonPhoto(detailId, file);
      flash("Foto atualizada.", "success");
      refetchDetail();
      refreshList();
    } catch (e) {
      flash(e?.message || "Não foi possível enviar a foto.", "danger");
    } finally {
      setDetailPhotoUploading(false);
    }
  }

  // ViaCEP: com o CEP completo, preenche cidade/UF e logradouro automaticamente
  async function handleCep(raw) {
    const zip = maskCep(raw);
    setAddr((a) => ({ ...a, zip }));
    const digits = zip.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepStatus("idle");
      return;
    }
    setCepStatus("loading");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepStatus("error");
        return;
      }
      setAddr((a) => ({
        ...a,
        city: `${data.localidade} — ${data.uf}`,
        street: [data.logradouro, data.bairro].filter(Boolean).join(" · "),
      }));
      setCepStatus("done");
    } catch {
      setCepStatus("error");
    }
  }

  async function submitForm() {
    const fd = new FormData(formRef.current);
    const form = {
      fullName: fd.get("fullName"),
      cpf: fd.get("cpf"),
      rg: fd.get("rg"),
      birth: fd.get("birth"),
      gender: fd.get("gender"),
      whatsapp: fd.get("whatsapp"),
      phonePrimary: fd.get("phonePrimary"),
      email: fd.get("email"),
      zip: addr.zip,
      city: addr.city,
      street: addr.street,
      notes: fd.get("notes"),
    };
    if (!form.fullName || !String(form.fullName).trim()) {
      flash("Informe o nome completo.", "danger");
      return;
    }
    const payload = toPersonPayload(form);
    const editingId = editing?.id;
    const ok = await run(async () => {
      if (editingId) {
        await updatePerson(editingId, payload);
        return;
      }
      // cria a pessoa e, se uma foto foi escolhida antes de existir o id, sobe agora
      const created = await createPerson(payload);
      if (photo.pendingFile && created?.id) {
        await uploadPersonPhoto(created.id, photo.pendingFile);
      }
    }, editingId ? "Cadastro atualizado." : "Pessoa cadastrada com sucesso.");
    if (ok) {
      setFormOpen(false);
      refreshList();
      if (editingId && detailId) refetchDetail();
    }
  }

  async function invitePortal(person) {
    const body = person.email ? { email: person.email } : {};
    const ok = await run(
      () => apiInvitePortal(person.id, body),
      `Convite do Portal da Família enviado para ${person.name.split(" ")[0]}.`
    );
    if (ok) {
      refreshList();
      refetchDetail();
    }
  }

  async function revokePortal(person) {
    const ok = await run(
      () => apiRevokePortal(person.id),
      `Acesso ao portal de ${person.name.split(" ")[0]} foi revogado.`
    );
    if (ok) {
      refreshList();
      refetchDetail();
    }
  }

  // Resolve o nome digitado para um id real (índice da página → busca na API) e
  // cria o vínculo. Sem correspondência, informa o operador (a pessoa vinculada
  // precisa existir no cadastro para preservar a integridade do relacionamento).
  async function addRelationship() {
    if (!relForm?.person) return;
    const name = relForm.person.trim();
    const type = relForm.type;
    const ok = await run(async () => {
      let relatedId = peopleIndex.get(name.toLowerCase());
      if (!relatedId) {
        const res = await listPeople({ search: name, perPage: 5 });
        const list = res?.data ?? [];
        const match =
          list.find((p) => (p.fullName || "").trim().toLowerCase() === name.toLowerCase()) || list[0];
        relatedId = match?.id;
      }
      if (!relatedId) {
        throw new Error("Pessoa não encontrada no cadastro. Cadastre-a antes de criar o vínculo.");
      }
      await apiAddRelationship(detailId, { relatedPersonId: relatedId, relationshipType: type });
    }, "Vínculo familiar adicionado.");
    if (ok) {
      setRelForm(null);
      refetchDetail();
      refreshList();
    }
  }

  async function toggleActive(person) {
    const ok = await run(
      () => updatePerson(person.id, { active: !person.active }),
      person.active ? "Cadastro inativado." : "Cadastro reativado."
    );
    if (ok) {
      refreshList();
      refetchDetail();
    }
  }

  const columns = [
    {
      key: "person", label: "Pessoa",
      render: (p) => (
        <div className={styles.personCell}>
          <Avatar name={p.name} src={p.photoUrl} size="sm" />
          <div className={styles.personInfo}>
            <span className={styles.personName}>{p.name}</span>
            <span className={styles.personCpf}>{p.cpf}</span>
          </div>
        </div>
      ),
    },
    {
      key: "contact", label: "Contato",
      render: (p) => (
        <div className={styles.contactCell}>
          <span className={styles.contactPhone}>
            {p.whatsapp ? (
              <>
                <svg viewBox="0 0 16 16" fill="none" className={styles.waIcon}>
                  <path d="M8 1.8a6.2 6.2 0 0 0-5.3 9.4L1.8 14l2.9-.9A6.2 6.2 0 1 0 8 1.8Z" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M5.9 5.4c.5 1.9 2 3.4 3.9 3.9l.6-1 1.5.7c0 1-.8 1.4-1.6 1.3-2.3-.4-4.6-2.7-5-5-.1-.8.3-1.6 1.3-1.6l.7 1.5-1.4.2Z" fill="currentColor" stroke="none" />
                </svg>
                {p.whatsapp}
              </>
            ) : p.phone}
          </span>
          <span className={styles.contactEmail}>{p.email || "sem e-mail"}</span>
        </div>
      ),
    },
    { key: "city", label: "Cidade", render: (p) => <span className={styles.cityCell}>{p.city}</span> },
    {
      key: "roles", label: "Vínculos",
      render: (p) => (
        <div className={styles.rolesCell}>
          {p.roles.map((r) => (
            <Badge key={r} tone={ROLE_META[r].tone}>
              {ROLE_META[r].label}
              {r === "proprietario" && p.concessionsCount > 0 ? ` · ${p.concessionsCount}` : ""}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "portal", label: "Portal da Família",
      render: (p) => p.portal.active
        ? <Badge tone="success" dot>{p.portal.invited ? "Convite enviado" : "Com acesso"}</Badge>
        : <Badge tone="neutral">Sem acesso</Badge>,
    },
    {
      key: "status", label: "Situação",
      render: (p) => (p.active ? <Badge tone="success" dot>Ativo</Badge> : <Badge tone="neutral">Inativo</Badge>),
    },
    {
      key: "action", label: "",
      render: (p) => (
        <button className={styles.detailLink} onClick={() => setDetailId(p.id)}>Detalhes</button>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
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
          <Button onClick={() => openForm(null)}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Nova pessoa
          </Button>
        </div>
      </header>

      <div className={styles.stats}>
        <StatCard label="Pessoas cadastradas" value={String(counts.todos)} hint="registro único por CPF" />
        <StatCard label="Proprietários ativos" value={String(counts.proprietario)} hint="com concessão vinculada" />
        <StatCard label="Contas do portal" value={String(counts.portal)} hint="Portal da Família" />
        <StatCard label="Com WhatsApp" value={String(summaryData?.withWhatsapp ?? 0)} hint="canal de notificações" />
      </div>

      {feedback && (
        <Alert tone={feedback.tone}>{feedback.message}</Alert>
      )}

      {!roleLocked && (
        <div className={styles.statusChips}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`${styles.chip} ${filter === f.key ? styles.chipActive : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className={styles.chipCount}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <svg viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
            <path d="m13.5 13.5-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            placeholder="Buscar por nome ou CPF…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.desktopTable}>
          <Skeleton variant="row" count={6} />
        </div>
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : !rows.length ? (
        <EmptyState
          title={isFiltered ? "Nenhuma pessoa encontrada" : emptyTitle}
          message={
            isFiltered
              ? "Ajuste os filtros ou o termo de busca para encontrar quem procura."
              : emptyMessage
          }
          action={
            isFiltered ? undefined : <Button onClick={() => openForm(null)}>Nova pessoa</Button>
          }
        />
      ) : (
        <>
          <div className={styles.desktopTable}>
            <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} emptyMessage="Nenhuma pessoa encontrada." />
          </div>

          <div className={styles.mobileList}>
            <span className={styles.mobileCount}>{rows.length} pessoa(s)</span>
            {rows.map((p) => (
              <button key={p.id} className={styles.mobileCard} onClick={() => setDetailId(p.id)}>
                <div className={styles.mobileCardTop}>
                  <Avatar name={p.name} src={p.photoUrl} size="sm" />
                  <div className={styles.personInfo}>
                    <span className={styles.personName}>{p.name}</span>
                    <span className={styles.personCpf}>{p.cpf}</span>
                  </div>
                  {p.portal.active
                    ? <Badge tone="success" dot>Portal</Badge>
                    : p.active ? <Badge tone="neutral">Sem portal</Badge> : <Badge tone="neutral">Inativo</Badge>}
                </div>
                <div className={styles.mobileCardBody}>
                  <span>{p.whatsapp || p.phone}</span>
                  <span className={styles.rolesCell}>
                    {p.roles.map((r) => (
                      <Badge key={r} tone={ROLE_META[r].tone}>{ROLE_META[r].label}</Badge>
                    ))}
                  </span>
                </div>
                <span className={styles.mobileCardChevron}>
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ---------- detalhe da pessoa ---------- */}
      <Modal
        open={Boolean(detailId)}
        onClose={() => { setDetailId(null); setRelForm(null); }}
        title={detail?.name || "Carregando…"}
        subtitle={detail ? `CPF ${detail.cpf} · RG ${detail.rg}` : ""}
        width={720}
        footer={
          detail && (
            <>
              <Button variant="secondary" onClick={() => toggleActive(detail)} loading={saving}>
                {detail.active ? "Inativar cadastro" : "Reativar cadastro"}
              </Button>
              <Button variant="secondary" onClick={() => openForm(detail)}>
                Editar dados
              </Button>
              <Button variant="ghost" onClick={() => setDetailId(null)}>Fechar</Button>
            </>
          )
        }
      >
        {detailLoading && <Skeleton variant="row" count={5} />}
        {detailError && <ErrorState onRetry={refetchDetail} />}
        {!detailLoading && !detailError && detail && (
          <div className={styles.detailBody}>
            <div className={styles.profileRow}>
              <label className={styles.detailAvatar} title="Clique para enviar ou trocar a foto">
                <input
                  type="file"
                  accept="image/*"
                  className={styles.uploadInput}
                  disabled={detailPhotoUploading}
                  onChange={(e) => {
                    handleDetailPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Avatar name={detail.name} src={detail.photoUrl} size="lg" />
                <span className={styles.avatarEditBadge} aria-hidden="true">
                  {detailPhotoUploading ? (
                    <span className={styles.avatarSpinner} />
                  ) : (
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M4 12.5V10l6.2-6.2a1.4 1.4 0 0 1 2 2L6 12H4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </label>
              <div className={styles.profileInfo}>
                <div className={styles.rolesCell}>
                  {detail.roles.map((r) => (
                    <Badge key={r} tone={ROLE_META[r].tone}>{ROLE_META[r].label}</Badge>
                  ))}
                  {detail.active ? <Badge tone="success" dot>Ativo</Badge> : <Badge tone="neutral">Inativo</Badge>}
                </div>
                <span className={styles.profileMeta}>
                  Nascimento {detail.birth || "—"} · {detail.gender || "—"}
                </span>
              </div>
            </div>

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Contato & endereço</span>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>WhatsApp</span>
                  <span className={styles.infoValue}>{detail.whatsapp || "—"}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Telefone</span>
                  <span className={styles.infoValue}>{detail.phone || "—"}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>E-mail</span>
                  <span className={styles.infoValue}>{detail.email || "—"}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>CEP</span>
                  <span className={styles.infoValue}>{detail.zipcode || "—"}</span>
                </div>
                <div className={`${styles.infoItem} ${styles.infoWide}`}>
                  <span className={styles.infoLabel}>Endereço</span>
                  <span className={styles.infoValue}>{[detail.address, detail.city].filter(Boolean).join(" · ") || "—"}</span>
                </div>
              </div>
            </section>

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Concessões ({detail.concessions.length})</span>
              {detail.concessions.length ? (
                <ul className={styles.linkList}>
                  {detail.concessions.map((c) => (
                    <li key={c.id} className={styles.linkRow}>
                      <span className={styles.linkRowIcon}>
                        <svg viewBox="0 0 16 16" fill="none">
                          <path d="M3 13.5V5.8L8 2.5l5 3.3v7.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M1.8 13.5h12.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      </span>
                      <div className={styles.linkRowInfo}>
                        <span className={styles.linkRowTitle}>Jazigo {c.grave}</span>
                        <span className={styles.linkRowMeta}>Concessão {c.type.toLowerCase()} · {c.status}</span>
                      </div>
                      <Link href={`/painel/concessoes/${c.id}`} className={styles.linkRowAction}>Ver concessão →</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyNote}>Nenhuma concessão em nome desta pessoa.</p>
              )}
            </section>

            {detail.responsibleFor?.length > 0 && (
              <section className={styles.detailSection}>
                <span className={styles.sectionLabel}>
                  Responsável por ({detail.responsibleFor.length})
                </span>
                <ul className={styles.linkList}>
                  {detail.responsibleFor.map((c) => (
                    <li key={c.id} className={styles.linkRow}>
                      <span className={styles.linkRowIcon}>
                        <svg viewBox="0 0 16 16" fill="none">
                          <path d="M8 2.5 3 5.2v3.1c0 3 2.2 4.6 5 5.7 2.8-1.1 5-2.7 5-5.7V5.2L8 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <div className={styles.linkRowInfo}>
                        <span className={styles.linkRowTitle}>Jazigo {c.grave}</span>
                        <span className={styles.linkRowMeta}>
                          Proprietário: {c.owner} · concessão {c.type.toLowerCase()} · {c.status}
                        </span>
                      </div>
                      <Link href={`/painel/concessoes/${c.id}`} className={styles.linkRowAction}>
                        Ver concessão →
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={styles.detailSection}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>Vínculos familiares ({detail.relationships.length})</span>
                {!relForm && (
                  <button className={styles.sectionAction} onClick={() => setRelForm({ person: "", type: "Cônjuge" })}>
                    + Adicionar vínculo
                  </button>
                )}
              </div>
              {detail.relationships.length > 0 && (
                <ul className={styles.linkList}>
                  {detail.relationships.map((r) => (
                    <li key={r.id} className={styles.linkRow}>
                      <Avatar name={r.person} size="sm" />
                      <div className={styles.linkRowInfo}>
                        <span className={styles.linkRowTitle}>{r.person}</span>
                        <span className={styles.linkRowMeta}>{r.type}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {relForm && (
                <div className={styles.relForm}>
                  <div className={styles.relFormFields}>
                    <FormField label="Pessoa">
                      <Input
                        placeholder="Nome da pessoa vinculada"
                        value={relForm.person}
                        list="rel-people-options"
                        onChange={(e) => setRelForm({ ...relForm, person: e.target.value })}
                      />
                      <datalist id="rel-people-options">
                        {rows.map((r) => <option key={r.id} value={r.name} />)}
                      </datalist>
                    </FormField>
                    <FormField label="Tipo de vínculo">
                      <Select value={relForm.type} onChange={(e) => setRelForm({ ...relForm, type: e.target.value })}>
                        {RELATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </Select>
                    </FormField>
                  </div>
                  <div className={styles.relFormActions}>
                    <Button variant="ghost" size="sm" onClick={() => setRelForm(null)}>Cancelar</Button>
                    <Button size="sm" loading={saving} disabled={!relForm.person} onClick={addRelationship}>Salvar vínculo</Button>
                  </div>
                </div>
              )}
              {!detail.relationships.length && !relForm && (
                <p className={styles.emptyNote}>Nenhum vínculo familiar registrado.</p>
              )}
            </section>

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Portal da Família</span>
              {detail.portal.active ? (
                <div className={styles.portalBox}>
                  <div className={styles.portalInfo}>
                    <Badge tone="success" dot>{detail.portal.invited ? "Convite enviado" : "Acesso ativo"}</Badge>
                    <span className={styles.portalMeta}>
                      {detail.portal.email} · desde {detail.portal.since}
                    </span>
                  </div>
                  <Button variant="secondary" size="sm" loading={saving} onClick={() => revokePortal(detail)}>
                    Revogar acesso
                  </Button>
                </div>
              ) : (
                <div className={styles.portalBox}>
                  <div className={styles.portalInfo}>
                    <Badge tone="neutral">Sem acesso</Badge>
                    <span className={styles.portalMeta}>
                      Convite {detail.email ? `por e-mail (${detail.email})` : `por WhatsApp (${detail.whatsapp || detail.phone})`}
                    </span>
                  </div>
                  <Button size="sm" loading={saving} onClick={() => invitePortal(detail)}>
                    Enviar convite
                  </Button>
                </div>
              )}
            </section>

            {detail.notes && (
              <section className={styles.detailSection}>
                <span className={styles.sectionLabel}>Observações</span>
                <p className={styles.notes}>{detail.notes}</p>
              </section>
            )}
          </div>
        )}
      </Modal>

      {/* ---------- nova pessoa / editar ---------- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Editar · ${editing.name}` : "Nova pessoa"}
        subtitle="Registro único — usado em concessões, cobranças e notificações"
        width={680}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={submitForm}>
              {editing ? "Salvar alterações" : "Cadastrar pessoa"}
            </Button>
          </>
        }
      >
        <form ref={formRef} key={editing?.id || "new"} className={styles.form} onSubmit={(e) => { e.preventDefault(); submitForm(); }}>
          <section className={styles.formSection}>
            <span className={styles.sectionLabel}>Dados civis</span>
            <div className={styles.formGrid}>
              <FormField label="Nome completo" required className={styles.spanTwo}>
                <Input name="fullName" defaultValue={editing?.name} placeholder="Nome e sobrenome" />
              </FormField>
              <FormField label="CPF" required>
                <Input name="cpf" defaultValue={editing?.cpf} placeholder="000.000.000-00" onChange={(e) => (e.target.value = maskCpf(e.target.value))} />
              </FormField>
              <FormField label="RG">
                <Input name="rg" defaultValue={editing?.rg} placeholder="00.000.000-0" />
              </FormField>
              <FormField label="Data de nascimento">
                <Input name="birth" defaultValue={editing?.birth} placeholder="dd/mm/aaaa" />
              </FormField>
              <FormField label="Gênero">
                <Select name="gender" defaultValue={editing?.gender || ""}>
                  <option value="" disabled>Selecione…</option>
                  <option>Feminino</option>
                  <option>Masculino</option>
                  <option>Outro</option>
                  <option>Prefere não informar</option>
                </Select>
              </FormField>
            </div>
          </section>

          <section className={styles.formSection}>
            <span className={styles.sectionLabel}>Contato</span>
            <div className={styles.formGrid}>
              <FormField label="WhatsApp" hint="canal das notificações automáticas">
                <Input name="whatsapp" defaultValue={editing?.whatsapp} placeholder="(00) 00000-0000" onChange={(e) => (e.target.value = maskPhone(e.target.value))} />
              </FormField>
              <FormField label="Telefone secundário">
                <Input name="phonePrimary" defaultValue={editing?.phone} placeholder="(00) 0000-0000" onChange={(e) => (e.target.value = maskPhone(e.target.value))} />
              </FormField>
              <FormField label="E-mail" className={styles.spanTwo}>
                <Input name="email" defaultValue={editing?.email} placeholder="email@exemplo.com" type="email" />
              </FormField>
            </div>
          </section>

          <section className={styles.formSection}>
            <span className={styles.sectionLabel}>Endereço</span>
            <div className={styles.formGrid}>
              <FormField
                label="CEP"
                hint={
                  cepStatus === "loading" ? "buscando endereço…"
                    : cepStatus === "done" ? "endereço preenchido automaticamente ✓"
                    : cepStatus === "error" ? "CEP não encontrado — preencha manualmente"
                    : "preenche o endereço automaticamente"
                }
              >
                <div className={styles.cepField}>
                  <Input
                    value={addr.zip}
                    onChange={(e) => handleCep(e.target.value)}
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                  {cepStatus === "loading" && <span className={styles.cepSpinner} />}
                </div>
              </FormField>
              <FormField label="Cidade / UF">
                <Input
                  value={addr.city}
                  onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                  placeholder="São Paulo — SP"
                />
              </FormField>
              <FormField label="Logradouro e número" className={styles.spanTwo}>
                <Input
                  value={addr.street}
                  onChange={(e) => setAddr({ ...addr, street: e.target.value })}
                  placeholder="Rua, número · bairro"
                />
              </FormField>
            </div>
          </section>

          <section className={styles.formSection}>
            <span className={styles.sectionLabel}>Foto & observações</span>
            <label className={styles.upload}>
              <input
                type="file"
                accept="image/*"
                className={styles.uploadInput}
                disabled={photo.uploading}
                onChange={(e) => {
                  handlePhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {photo.url ? (
                <Avatar name={editing?.name || ""} src={photo.url} size="lg" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="9" cy="10.5" r="1.8" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m5 18 4.5-4 3.5 3 3-2.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span className={styles.uploadText}>
                {photo.uploading
                  ? "Enviando foto…"
                  : photo.url
                    ? "Clique para trocar a foto"
                    : "Clique ou arraste a foto da pessoa"}
              </span>
            </label>
            <FormField label="Observações">
              <Textarea name="notes" defaultValue={editing?.notes} rows={3} placeholder="Preferências de contato, restrições, contexto…" />
            </FormField>
          </section>
        </form>
      </Modal>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity="pessoas"
        totalCount={counts.todos}
        filteredCount={rows.length}
      />
    </div>
  );
}
