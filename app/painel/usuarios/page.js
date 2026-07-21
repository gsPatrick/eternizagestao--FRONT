"use client";

import { useMemo, useState } from "react";
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
import Tabs from "@/components/molecules/Tabs/Tabs";
import StatCard from "@/components/molecules/StatCard/StatCard";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import DataTable from "@/components/organisms/DataTable/DataTable";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";
import { maskPhone } from "@/lib/masks";

import { useResource, useMutation } from "@/lib/api/useResource";
import IntegrationRequired, { useIntegrationGuard } from "@/components/molecules/IntegrationRequired/IntegrationRequired";
import { getUser } from "@/lib/api/session";
import {
  listUsers,
  adaptUsers,
  inviteUser,
  updateUser,
  activateUser,
  deactivateUser,
  resetUserPassword,
  resendUserInvite,
} from "@/lib/api/resources/users";

const ROLE_META = {
  admin: {
    label: "Administrador",
    tone: "navy",
    desc: "Administrador: acesso total ao cemitério — inclusive usuários, auditoria e importações de legado.",
  },
  operador: {
    label: "Operador",
    tone: "info",
    desc: "Operador: opera o dia a dia (cadastros, sepultamentos, financeiro e documentos), sem acesso a usuários, auditoria e importações.",
  },
  consulta: {
    label: "Consulta",
    tone: "neutral",
    desc: "Consulta: somente leitura em cadastros, mapa e relatórios — não cria nem altera registros.",
  },
};

const STATUS_META = {
  ativo: { label: "Ativo", tone: "success", dot: true },
  pendente: { label: "Convite pendente", tone: "warning", dot: true },
  inativo: { label: "Inativo", tone: "neutral", dot: false },
};

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "admin", label: "Administradores" },
  { key: "operador", label: "Operadores" },
  { key: "consulta", label: "Consulta" },
  { key: "pendentes", label: "Convites pendentes" },
  { key: "inativos", label: "Inativos" },
];

// matriz de permissões por AÇÃO — fiel ao que a API realmente aplica:
// leitura (GET) liberada a todos os perfis; escrita = admin+operador;
// exclusões e ações sensíveis = só admin (authorize no backend).
const PERMISSIONS = [
  {
    resource: "Cadastros", desc: "Sepulturas, pessoas, concessões e sepultados",
    actions: [
      { label: "Visualizar", a: true, o: true, c: true },
      { label: "Criar", a: true, o: true, c: false },
      { label: "Editar", a: true, o: true, c: false },
      { label: "Excluir", a: true, o: false, c: false },
      { label: "Bloquear jazigo", a: true, o: false, c: false },
    ],
  },
  {
    resource: "Sepultados & exumações", desc: "Registros, agendamentos e autorizações",
    actions: [
      { label: "Visualizar", a: true, o: true, c: true },
      { label: "Registrar / agendar", a: true, o: true, c: false },
      { label: "Autorizar exumação", a: true, o: true, c: false },
    ],
  },
  {
    resource: "Financeiro", desc: "Cobranças, baixas e 2ª via",
    actions: [
      { label: "Visualizar", a: true, o: true, c: true },
      { label: "Gerar cobrança", a: true, o: true, c: false },
      { label: "Registrar pagamento", a: true, o: true, c: false },
      { label: "Cancelar / estornar", a: true, o: true, c: false },
    ],
  },
  {
    resource: "Documentos", desc: "Certidões, autorizações e recibos",
    actions: [
      { label: "Visualizar", a: true, o: true, c: true },
      { label: "Emitir / 2ª via", a: true, o: true, c: false },
      { label: "Cancelar", a: true, o: true, c: false },
    ],
  },
  {
    resource: "Mapa", desc: "Ortofoto, camadas e demarcação",
    actions: [
      { label: "Visualizar", a: true, o: true, c: true },
      { label: "Demarcar / importar ortofoto", a: true, o: true, c: false },
    ],
  },
  {
    resource: "Relatórios & exportações", desc: "Indicadores e exportação de dados",
    actions: [
      { label: "Visualizar relatórios", a: true, o: true, c: true },
      { label: "Exportar dados", a: true, o: true, c: false },
    ],
  },
  {
    resource: "Importação de legado", desc: "Planilhas e migração histórica",
    actions: [
      { label: "Enviar / validar lote", a: true, o: true, c: false },
      { label: "Confirmar em produção", a: true, o: false, c: false },
    ],
  },
  {
    resource: "Auditoria", desc: "Trilha imutável de ações",
    actions: [{ label: "Consultar trilha", a: true, o: false, c: false }],
  },
  {
    resource: "Usuários & configurações", desc: "Perfis, convites e parâmetros",
    actions: [{ label: "Gerenciar tudo", a: true, o: false, c: false }],
  },
];

function PermMark({ ok }) {
  return ok ? (
    <span className={styles.permYes} aria-label="Permitido">
      <svg viewBox="0 0 16 16" fill="none">
        <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  ) : (
    <span className={styles.permNo} aria-label="Sem acesso" />
  );
}

export default function UsersPage() {
  const currentUser = useMemo(() => getUser(), []);
  const currentUserId = currentUser?.id ?? null;
  const canManage = ["admin", "super_admin"].includes(currentUser?.role);

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listUsers(undefined, { signal }),
    []
  );
  const users = useMemo(
    () => adaptUsers(data?.data ?? [], currentUserId),
    [data, currentUserId]
  );

  const [filter, setFilter] = useState("todos");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [roleDraft, setRoleDraft] = useState("operador");
  const [invite, setInvite] = useState(null); // { name, email, phone, role }
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState(null); // { tone, message }

  // mutations (uma por endpoint) — o `saving` do modal deriva de todas.
  const inviteM = useMutation((body) => inviteUser(body));
  const roleM = useMutation(({ id, role }) => updateUser(id, { role }));
  const activateM = useMutation((id) => activateUser(id));
  const deactivateM = useMutation((id) => deactivateUser(id));
  const resetM = useMutation((id) => resetUserPassword(id));
  const resendM = useMutation((id) => resendUserInvite(id));
  const saving =
    inviteM.loading || roleM.loading || activateM.loading ||
    deactivateM.loading || resetM.loading || resendM.loading;

  const detail = users.find((u) => u.id === detailId);

  const counts = useMemo(() => ({
    todos: users.length,
    admin: users.filter((u) => u.role === "admin").length,
    operador: users.filter((u) => u.role === "operador").length,
    consulta: users.filter((u) => u.role === "consulta").length,
    pendentes: users.filter((u) => u.status === "pendente").length,
    inativos: users.filter((u) => u.status === "inativo").length,
  }), [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (["admin", "operador", "consulta"].includes(filter) && u.role !== filter) return false;
      if (filter === "pendentes" && u.status !== "pendente") return false;
      if (filter === "inativos" && u.status !== "inativo") return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, filter, query]);

  function flash(message, tone = "success") {
    setNotice({ tone, message });
    setTimeout(() => setNotice(null), 4500);
  }

  // Traduz falhas da API em avisos amigáveis (403 → "sem acesso").
  // Convidar/reenviar convite depende do e-mail: sem provedor configurado a API
  // recusa, e o operador precisa saber que ninguém recebeu nada.
  const guard = useIntegrationGuard();

  function fail(err) {
    if (guard.capture(err)) return;
    if (err?.code === "INSUFFICIENT_ROLE") {
      flash("Sem acesso: apenas administradores podem gerenciar usuários.", "danger");
      return;
    }
    flash(err?.message || "Não foi possível concluir a ação. Tente novamente.", "danger");
  }

  function openDetail(user) {
    setDetailId(user.id);
    setRoleDraft(user.role);
  }

  async function sendInvite() {
    try {
      await inviteM.mutate({ name: invite.name, email: invite.email, phone: invite.phone, role: invite.role });
      const email = invite.email;
      setInvite(null);
      await refetch();
      flash(`Convite enviado para o e-mail ${email}.`);
    } catch (e) {
      fail(e);
    }
  }

  async function saveRole() {
    try {
      await roleM.mutate({ id: detailId, role: roleDraft });
      await refetch();
      flash(`Perfil de ${detail.name} atualizado para ${ROLE_META[roleDraft].label}.`);
    } catch (e) {
      fail(e);
    }
  }

  async function resetPassword() {
    try {
      await resetM.mutate(detailId);
      flash(`Link de redefinição de senha enviado para ${detail.email}.`);
    } catch (e) {
      fail(e);
    }
  }

  async function resendInvite() {
    try {
      await resendM.mutate(detailId);
      flash(`Convite reenviado para ${detail.email}.`);
    } catch (e) {
      fail(e);
    }
  }

  async function toggleActive() {
    const activating = detail.status === "inativo";
    try {
      await (activating ? activateM.mutate(detailId) : deactivateM.mutate(detailId));
      await refetch();
      flash(
        activating
          ? `${detail.name} foi reativado(a) — o acesso está liberado.`
          : `${detail.name} foi desativado(a) — o acesso foi bloqueado.`
      );
    } catch (e) {
      fail(e);
    }
  }

  function renderLastAccess(u) {
    if (u.you) {
      return (
        <div className={styles.dates}>
          <span>agora</span>
          <span className={styles.datesSub}>sessão atual</span>
        </div>
      );
    }
    if (u.status === "pendente") {
      return (
        <div className={styles.dates}>
          <span className={styles.noSig}>—</span>
          <span className={styles.datesSub}>convite enviado em {u.invitedAt}</span>
        </div>
      );
    }
    if (!u.lastAccess) {
      return (
        <div className={styles.dates}>
          <span className={styles.noSig}>—</span>
          <span className={styles.datesSub}>sem acesso registrado</span>
        </div>
      );
    }
    return (
      <div className={styles.dates}>
        <span>{u.lastAccess.date}</span>
        <span className={styles.datesSub}>às {u.lastAccess.time}</span>
      </div>
    );
  }

  const columns = [
    {
      key: "user", label: "Usuário",
      render: (u) => (
        <div className={styles.personCell}>
          <Avatar name={u.name} size="sm" />
          <div className={styles.personInfo}>
            <span className={styles.nameRow}>
              <span className={styles.personName}>{u.name}</span>
              {u.you && <span className={styles.youTag}>você</span>}
            </span>
            <span className={styles.personEmail}>{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "role", label: "Perfil",
      render: (u) => <Badge tone={ROLE_META[u.role].tone}>{ROLE_META[u.role].label}</Badge>,
    },
    { key: "access", label: "Último acesso", render: renderLastAccess },
    {
      key: "status", label: "Situação",
      render: (u) => (
        <Badge tone={STATUS_META[u.status].tone} dot={STATUS_META[u.status].dot}>
          {STATUS_META[u.status].label}
        </Badge>
      ),
    },
    {
      key: "action", label: "",
      render: (u) => <button className={styles.detailLink} onClick={() => openDetail(u)}>Detalhes</button>,
    },
  ];

  const usersTab = (
    <div className={styles.tabContent}>
      {loading ? (
        <Skeleton variant="row" count={6} />
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : users.length === 0 ? (
        <EmptyState
          title="Nenhum usuário cadastrado"
          message="Convide o primeiro usuário para dar acesso ao painel deste cemitério."
          action={
            canManage ? (
              <Button onClick={() => setInvite({ name: "", email: "", phone: "", role: "operador" })}>
                Convidar usuário
              </Button>
            ) : null
          }
        />
      ) : (
        <>
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

          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <svg viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
                <path d="m13.5 13.5-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                placeholder="Buscar por nome ou e-mail…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.desktopTable}>
            <DataTable columns={columns} rows={filtered} rowKey={(u) => u.id} emptyMessage="Nenhum usuário encontrado." />
          </div>

          <div className={styles.mobileList}>
            <span className={styles.mobileCount}>{filtered.length} usuário(s)</span>
            {filtered.map((u) => (
              <button key={u.id} className={styles.mobileCard} onClick={() => openDetail(u)}>
                <div className={styles.mobileCardTop}>
                  <div className={styles.personCell}>
                    <Avatar name={u.name} size="sm" />
                    <div className={styles.personInfo}>
                      <span className={styles.nameRow}>
                        <span className={styles.personName}>{u.name}</span>
                        {u.you && <span className={styles.youTag}>você</span>}
                      </span>
                      <span className={styles.personEmail}>{u.email}</span>
                    </div>
                  </div>
                  <Badge tone={STATUS_META[u.status].tone} dot={STATUS_META[u.status].dot}>
                    {STATUS_META[u.status].label}
                  </Badge>
                </div>
                <div className={styles.mobileCardBody}>
                  <span className={styles.mobileCardName}>{ROLE_META[u.role].label}</span>
                  <span className={styles.mobileCardMeta}>
                    {u.you
                      ? "Último acesso: agora (sessão atual)"
                      : u.status === "pendente"
                        ? `Convite enviado em ${u.invitedAt}`
                        : u.lastAccess
                          ? `Último acesso: ${u.lastAccess.date} às ${u.lastAccess.time}`
                          : "Sem acesso registrado"}
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
    </div>
  );

  const permissionsTab = (
    <div className={styles.tabContent}>
      <p className={styles.typesHint}>
        O que cada perfil pode fazer no sistema. Os perfis são fixos —
        <strong> Administrador</strong>, <strong>Operador</strong> e <strong>Consulta</strong> —
        e valem para todos os módulos do cemitério.
      </p>
      <div className={styles.matrixWrap}>
        <div className={styles.matrix}>
          {/* cabeçalho de colunas */}
          <div className={`${styles.matrixRow} ${styles.matrixColHead}`}>
            <span className={styles.matrixColLabel}>Recurso / ação</span>
            <span className={styles.matrixRole}>
              <span className={`${styles.matrixRoleChip} ${styles.roleAdmin}`}>Administrador</span>
            </span>
            <span className={styles.matrixRole}>
              <span className={`${styles.matrixRoleChip} ${styles.roleOperador}`}>Operador</span>
            </span>
            <span className={styles.matrixRole}>
              <span className={`${styles.matrixRoleChip} ${styles.roleConsulta}`}>Consulta</span>
            </span>
          </div>

          {PERMISSIONS.map((p) => (
            <div key={p.resource} className={styles.matrixGroup}>
              {/* divisor do recurso */}
              <div className={styles.matrixResourceRow}>
                <span className={styles.matrixResourceName}>{p.resource}</span>
                <span className={styles.matrixResourceDesc}>{p.desc}</span>
              </div>
              {/* ações do recurso */}
              {p.actions.map((act) => (
                <div key={act.label} className={styles.matrixRow}>
                  <span className={styles.matrixActionLabel}>{act.label}</span>
                  <span className={styles.matrixCell}><PermMark ok={act.a} /></span>
                  <span className={styles.matrixCell}><PermMark ok={act.o} /></span>
                  <span className={styles.matrixCell}><PermMark ok={act.c} /></span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className={styles.matrixFoot}>
        Estas regras são aplicadas <strong>no servidor</strong>: uma ação sem
        permissão é bloqueada pela API (403) mesmo que a chamada seja forçada.
        Na interface, os botões correspondentes ficam ocultos ou desabilitados.
      </p>
    </div>
  );

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Usuários</h1>
          <p className={styles.subtitle}>Controle de acesso por perfil</p>
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
          {canManage && (
            <Button onClick={() => setInvite({ name: "", email: "", phone: "", role: "operador" })}
              iconLeft={
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              }
            >
              Convidar usuário
            </Button>
          )}
        </div>
      </header>

      <div className={styles.stats}>
        <StatCard label="Usuários ativos" value={String(users.filter((u) => u.status === "ativo").length)} caption="com acesso ao painel" />
        <StatCard label="Administradores" value={String(counts.admin)} caption="acesso total" />
        <StatCard label="Operadores" value={String(counts.operador)} caption="operação do dia a dia" />
        <StatCard label="Convites pendentes" value={String(counts.pendentes)} caption="aguardando primeiro acesso" />
      </div>

      {!canManage && !loading && !error && (
        <Alert tone="info">
          Você tem acesso somente de leitura a esta área — apenas administradores
          podem convidar, editar perfis ou desativar usuários.
        </Alert>
      )}

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      <Tabs
        items={[
          { label: "Usuários", count: users.length, content: usersTab },
          { label: "Permissões por perfil", count: 3, content: permissionsTab },
        ]}
      />

      {/* ---------- detalhe do usuário ---------- */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail?.name || ""}
        subtitle={detail?.email || ""}
        width={640}
        footer={
          detail && (
            <>
              {canManage && (detail.status === "pendente" ? (
                <Button variant="secondary" loading={saving} onClick={resendInvite}>Reenviar convite</Button>
              ) : (
                <Button variant="secondary" loading={saving} onClick={resetPassword}>Redefinir senha</Button>
              ))}
              {canManage && detail.status === "ativo" && (
                detail.you ? (
                  <span className={styles.selfHint} title="Você não pode desativar a própria conta">
                    <Button variant="danger" disabled>Desativar</Button>
                  </span>
                ) : (
                  <Button variant="danger" loading={saving} onClick={toggleActive}>Desativar</Button>
                )
              )}
              {canManage && detail.status === "inativo" && (
                <Button variant="secondary" loading={saving} onClick={toggleActive}>Reativar</Button>
              )}
              <Button variant="ghost" onClick={() => setDetailId(null)}>Fechar</Button>
            </>
          )
        }
      >
        {detail && (
          <div className={styles.detailBody}>
            <div className={styles.profileRow}>
              <Avatar name={detail.name} size="lg" />
              <div className={styles.profileInfo}>
                <div className={styles.badgeRow}>
                  <Badge tone={ROLE_META[detail.role].tone}>{ROLE_META[detail.role].label}</Badge>
                  <Badge tone={STATUS_META[detail.status].tone} dot={STATUS_META[detail.status].dot}>
                    {STATUS_META[detail.status].label}
                  </Badge>
                  {detail.you && <span className={styles.youTag}>você</span>}
                </div>
                <span className={styles.profileMeta}>
                  {detail.phone ? `${detail.email} · ${detail.phone}` : detail.email}
                </span>
              </div>
            </div>

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Perfil de acesso</span>
              <div className={styles.roleEditRow}>
                <Select value={roleDraft} onChange={(e) => setRoleDraft(e.target.value)} disabled={!canManage}>
                  {Object.entries(ROLE_META).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </Select>
                {canManage && (
                  <Button size="sm" loading={saving} disabled={roleDraft === detail.role} onClick={saveRole}>
                    Salvar perfil
                  </Button>
                )}
              </div>
              <p className={styles.roleHint}>{ROLE_META[roleDraft].desc}</p>
              {detail.you && (
                <p className={styles.statusNote}>
                  Você não pode desativar a própria conta — peça a outro administrador.
                </p>
              )}
            </section>

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Últimos acessos</span>
              {detail.accesses.length ? (
                <ul className={styles.accessList}>
                  {detail.accesses.map((a, i) => (
                    <li key={i} className={styles.accessRow}>
                      <span className={styles.accessWhen}>{a.when}</span>
                      <span className={styles.accessMeta}>{a.meta}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyNote}>
                  Nenhum acesso registrado — convite enviado em {detail.invitedAt}.
                </p>
              )}
            </section>
          </div>
        )}
      </Modal>

      {/* ---------- convidar usuário ---------- */}
      <Modal
        open={Boolean(invite)}
        onClose={() => setInvite(null)}
        title="Convidar usuário"
        subtitle="O convidado recebe um link por e-mail para criar a senha"
        width={600}
        footer={
          <>
            <Button variant="ghost" onClick={() => setInvite(null)}>Cancelar</Button>
            <Button loading={saving} disabled={!invite?.name || !invite?.email} onClick={sendInvite}>
              Enviar convite
            </Button>
          </>
        }
      >
        {invite && (
          <div className={styles.form}>
            <div className={styles.formGrid}>
              <FormField label="Nome completo" required className={styles.spanTwo}>
                <Input
                  placeholder="Nome e sobrenome"
                  value={invite.name}
                  onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                />
              </FormField>
              <FormField label="E-mail" required>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={invite.email}
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                />
              </FormField>
              <FormField label="Telefone">
                <Input
                  placeholder="(00) 00000-0000"
                  value={invite.phone}
                  onChange={(e) => setInvite({ ...invite, phone: maskPhone(e.target.value) })}
                />
              </FormField>
              <FormField label="Perfil de acesso" required className={styles.spanTwo}>
                <Select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                  {Object.entries(ROLE_META).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </Select>
              </FormField>
            </div>
            <p className={styles.roleHint}>{ROLE_META[invite.role].desc}</p>
          </div>
        )}
      </Modal>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity="usuários"
        totalCount={users.length}
        filteredCount={filtered.length}
      />

      <IntegrationRequired integration={guard.integration} onClose={guard.close} />
    </div>
  );
}
