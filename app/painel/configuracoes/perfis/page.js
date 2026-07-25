"use client";

/**
 * Tópico PERFIS DE ACESSO — o cliente CRIA um perfil (nome + baseRole) e MARCA
 * as permissões numa matriz de checkboxes (recurso × ação). O perfil salvo vira
 * automaticamente uma COLUNA na matriz "Permissões por perfil" da tela de
 * usuários. Os 3 perfis padrão (Administrador/Operador/Consulta) são somente
 * leitura — refletem os papéis fixos que o sistema já usa.
 *
 * Segurança: cada perfil herda o TETO de um baseRole. As permissões são
 * clampadas a esse teto (aqui na UI e, definitivamente, no backend). Checkbox
 * acima do teto fica desabilitado — não faria efeito, já que o authorize das
 * rotas barra pelo baseRole.
 */
import { useMemo, useState } from "react";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Badge from "@/components/atoms/Badge/Badge";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";

import { useResource, useMutation } from "@/lib/api/useResource";
import { getUser } from "@/lib/api/session";
import {
  listRoles,
  createRole,
  updateRole,
  removeRole,
  BASE_ROLE_META,
} from "@/lib/api/resources/roles";
import { PERMISSION_MODULES, hasPermission, countPermissions } from "@/lib/permissions-catalog";

import { TopicHeader, SectionCard, Button } from "../_lib/ui";
import ui from "../_lib/ui.module.css";
import styles from "./page.module.css";

const BASE_ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "operador", label: "Operador" },
  { value: "consulta", label: "Consulta" },
];

const EMPTY_DRAFT = { id: null, name: "", baseRole: "operador", description: "", permissions: {}, isSystem: false };

// Interseção de um mapa de permissões com o teto (ceiling) do baseRole.
function clampToCeiling(permissions, ceiling) {
  const out = {};
  for (const [mod, actions] of Object.entries(permissions || {})) {
    const allowed = new Set((ceiling && ceiling[mod]) || []);
    const kept = (actions || []).filter((a) => allowed.has(a));
    if (kept.length) out[mod] = kept;
  }
  return out;
}

export default function PerfisPage() {
  const currentUser = useMemo(() => getUser(), []);
  const canManage = ["admin", "super_admin"].includes(currentUser?.role);

  const { data: rolesRaw, loading, error, refetch } = useResource(
    ({ signal }) => listRoles({ signal }),
    []
  );
  const roles = useMemo(() => rolesRaw ?? [], [rolesRaw]);

  // Teto (ceiling) de um baseRole = permissões do perfil de SISTEMA correspondente.
  const ceilingFor = (base) =>
    roles.find((r) => r.isSystem && r.baseRole === base)?.permissions || {};

  const [draft, setDraft] = useState(null); // null = modal fechado
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState(null);
  const [notice, setNotice] = useState(null);

  const createM = useMutation((body) => createRole(body));
  const updateM = useMutation(({ id, body }) => updateRole(id, body));
  const removeM = useMutation((id) => removeRole(id));
  const saving = createM.loading || updateM.loading;

  function flash(message, tone = "success") {
    setNotice({ tone, message });
    setTimeout(() => setNotice(null), 4500);
  }

  function openCreate() {
    setFormError(null);
    setDraft({ ...EMPTY_DRAFT });
  }

  function openEdit(role) {
    setFormError(null);
    setDraft({
      id: role.id,
      name: role.name,
      baseRole: role.baseRole,
      description: role.description || "",
      permissions: role.permissions || {},
      isSystem: Boolean(role.isSystem),
    });
  }

  // Troca o baseRole → reclampa as permissões ao novo teto (não some marcações
  // válidas, mas descarta as que passariam do teto novo).
  function changeBase(base) {
    setDraft((d) => ({ ...d, baseRole: base, permissions: clampToCeiling(d.permissions, ceilingFor(base)) }));
  }

  function toggle(modKey, actKey) {
    setDraft((d) => {
      const cur = new Set(d.permissions[modKey] || []);
      if (cur.has(actKey)) cur.delete(actKey);
      else cur.add(actKey);
      const next = { ...d.permissions };
      if (cur.size) next[modKey] = [...cur];
      else delete next[modKey];
      return { ...d, permissions: next };
    });
  }

  // Aplica o padrão do perfil-base (copia o teto inteiro) — atalho útil.
  function applyBaseDefault() {
    setDraft((d) => ({ ...d, permissions: JSON.parse(JSON.stringify(ceilingFor(d.baseRole))) }));
  }
  function clearAll() {
    setDraft((d) => ({ ...d, permissions: {} }));
  }

  async function save() {
    setFormError(null);
    if (!draft.name.trim()) {
      setFormError("Informe o nome do perfil.");
      return;
    }
    const body = {
      name: draft.name.trim(),
      baseRole: draft.baseRole,
      description: draft.description.trim() || null,
      permissions: draft.permissions,
    };
    try {
      if (draft.id) await updateM.mutate({ id: draft.id, body });
      else await createM.mutate(body);
      setDraft(null);
      await refetch();
      flash(draft.id ? "Perfil atualizado." : "Perfil criado.");
    } catch (err) {
      if (err?.code === "ROLE_NAME_IN_USE") setFormError("Já existe um perfil com este nome.");
      else setFormError(err?.message || "Não foi possível salvar o perfil.");
    }
  }

  async function confirmDelete() {
    try {
      await removeM.mutate(deleteTarget.id);
      setDeleteTarget(null);
      await refetch();
      flash("Perfil excluído.");
    } catch (err) {
      if (err?.code === "ROLE_IN_USE") {
        flash(err.message || "Perfil em uso — altere o perfil dos usuários antes de excluir.", "danger");
      } else {
        flash(err?.message || "Não foi possível excluir o perfil.", "danger");
      }
      setDeleteTarget(null);
    }
  }

  const ceiling = draft ? ceilingFor(draft.baseRole) : {};
  // Perfis de sistema são somente leitura no editor (a API rejeita alterá-los).
  const editable = canManage && !draft?.isSystem;

  return (
    <div className={ui.topic}>
      <TopicHeader
        title="Perfis de acesso"
        desc="Crie perfis com as permissões que a sua equipe precisa. Cada perfil vira uma coluna na matriz de permissões da tela de usuários."
        aside={canManage ? <Button onClick={openCreate}>Novo perfil</Button> : null}
      />

      {!canManage && (
        <Alert tone="info" title="Somente leitura">
          Seu perfil pode visualizar os perfis de acesso, mas não criá-los ou
          editá-los. Peça a um administrador da cidade.
        </Alert>
      )}
      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      <SectionCard
        title="Perfis da cidade"
        desc="Os três perfis padrão são fixos (somente leitura). Perfis personalizados podem ser editados e excluídos."
      >
        {loading ? (
          <Skeleton variant="row" count={4} />
        ) : error ? (
          <Alert tone="danger">Não foi possível carregar os perfis. <button className={styles.retry} onClick={refetch}>Tentar novamente</button></Alert>
        ) : (
          <ul className={styles.roleList}>
            {roles.map((r) => {
              const meta = BASE_ROLE_META[r.baseRole] || BASE_ROLE_META.consulta;
              return (
                <li key={r.id} className={styles.roleItem}>
                  <div className={styles.roleMain}>
                    <div className={styles.roleTop}>
                      <span className={styles.roleName}>{r.name}</span>
                      {r.isSystem ? (
                        <Badge tone="neutral">Padrão</Badge>
                      ) : (
                        <Badge tone={meta.tone}>Personalizado</Badge>
                      )}
                    </div>
                    <span className={styles.roleMeta}>
                      Herda de <strong>{meta.label}</strong> · {countPermissions(r.permissions)} permissões
                      {r.description ? ` · ${r.description}` : ""}
                    </span>
                  </div>
                  <div className={styles.roleActions}>
                    {r.isSystem ? (
                      <button className={styles.linkBtn} onClick={() => openEdit(r)} disabled={!editable}>
                        Ver permissões
                      </button>
                    ) : (
                      <>
                        <button className={styles.linkBtn} onClick={() => openEdit(r)} disabled={!editable}>
                          Editar
                        </button>
                        <button
                          className={`${styles.linkBtn} ${styles.linkDanger}`}
                          onClick={() => setDeleteTarget(r)}
                          disabled={!editable}
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* ---------- criar / editar perfil ---------- */}
      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? (draft?.name || "Editar perfil") : "Novo perfil"}
        subtitle={draft?.isSystem ? "Perfil padrão (somente leitura)" : "Nome + permissões (recurso × ação)"}
        width={760}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>{editable ? "Cancelar" : "Fechar"}</Button>
            {editable && (
              <Button loading={saving} disabled={!draft?.name?.trim()} onClick={save}>
                {draft?.id ? "Salvar perfil" : "Criar perfil"}
              </Button>
            )}
          </>
        }
      >
        {draft && (
          <div className={styles.form}>
            <div className={styles.formGrid}>
              <FormField label="Nome do perfil" required>
                <Input
                  placeholder="Ex.: Financeiro, Atendimento, Zeladoria…"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  disabled={!editable}
                />
              </FormField>
              <FormField label="Perfil-base (teto de acesso)" hint="Define o máximo que este perfil pode alcançar.">
                <Select value={draft.baseRole} onChange={(e) => changeBase(e.target.value)} disabled={!editable}>
                  {BASE_ROLES.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Descrição (opcional)" className={styles.spanTwo}>
                <Input
                  placeholder="Para que serve este perfil"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  disabled={!editable}
                />
              </FormField>
            </div>

            {editable && (
              <div className={styles.quickRow}>
                <button type="button" className={styles.quickBtn} onClick={applyBaseDefault}>
                  Marcar padrão do perfil-base
                </button>
                <button type="button" className={styles.quickBtn} onClick={clearAll}>
                  Limpar tudo
                </button>
                <span className={styles.quickHint}>
                  Ações fora do teto do perfil-base ficam bloqueadas.
                </span>
              </div>
            )}

            <div className={styles.matrix}>
              {PERMISSION_MODULES.map((mod) => (
                <div key={mod.key} className={styles.matrixGroup}>
                  <div className={styles.resourceRow}>
                    <span className={styles.resourceName}>{mod.label}</span>
                    <span className={styles.resourceDesc}>{mod.desc}</span>
                  </div>
                  <div className={styles.actionsWrap}>
                    {mod.actions.map((act) => {
                      const allowed = hasPermission(ceiling, mod.key, act.key); // dentro do teto?
                      const checked = hasPermission(draft.permissions, mod.key, act.key);
                      return (
                        <label
                          key={act.key}
                          className={`${styles.actionChip} ${checked ? styles.actionOn : ""} ${!allowed ? styles.actionDisabled : ""}`}
                          title={allowed ? "" : "Acima do teto do perfil-base"}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!allowed || !editable}
                            onChange={() => toggle(mod.key, act.key)}
                          />
                          <span>{act.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {formError && <Alert tone="danger">{formError}</Alert>}
          </div>
        )}
      </Modal>

      {/* ---------- excluir perfil ---------- */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Excluir perfil"
        subtitle={deleteTarget?.name || ""}
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" loading={removeM.loading} onClick={confirmDelete}>
              Excluir perfil
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <Alert tone="danger">
            O perfil <strong>{deleteTarget.name}</strong> será removido. Usuários com
            este perfil impedem a exclusão — troque o perfil deles antes.
          </Alert>
        )}
      </Modal>
    </div>
  );
}
