"use client";

import Link from "next/link";
import styles from "./RowActions.module.css";

/**
 * Ações de uma linha de listagem: Editar e Excluir.
 *
 * Existe porque cada tela repetia (ou simplesmente NÃO tinha) esses botões — o
 * operador conseguia cadastrar mas não corrigir nem remover um registro errado.
 * Aqui o par fica idêntico em todo o painel: mesma ordem, mesmas cores, mesmo
 * alvo de toque.
 *
 *  - `editHref`: rota de detalhe/edição (a edição vive na tela de detalhe).
 *  - `onEdit`: alternativa quando a edição abre um modal na própria lista.
 *  - `onDelete`: abre a confirmação — a exclusão nunca acontece em 1 clique.
 *  - `canDelete` / `canEdit`: RBAC; quando falso o botão simplesmente não sai.
 *  - `extra`: ações específicas da tela (ex.: ícone de documentos), à esquerda.
 */
export default function RowActions({
  editHref,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  editLabel = "Editar",
  deleteLabel = "Excluir",
  extra = null,
}) {
  return (
    <span className={styles.actions}>
      {extra}

      {canEdit && editHref && (
        <Link href={editHref} className={styles.btn} title={editLabel}>
          <PencilIcon />
          <span className={styles.text}>{editLabel}</span>
        </Link>
      )}

      {canEdit && !editHref && onEdit && (
        <button type="button" className={styles.btn} onClick={onEdit} title={editLabel}>
          <PencilIcon />
          <span className={styles.text}>{editLabel}</span>
        </button>
      )}

      {canDelete && onDelete && (
        <button
          type="button"
          className={`${styles.btn} ${styles.danger}`}
          onClick={onDelete}
          title={deleteLabel}
        >
          <TrashIcon />
          <span className={styles.text}>{deleteLabel}</span>
        </button>
      )}
    </span>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="15" height="15" aria-hidden="true">
      <path d="M11.2 2.3 13.7 4.8 5.5 13H3v-2.5l8.2-8.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="15" height="15" aria-hidden="true">
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5 5 13.5h6l.5-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
