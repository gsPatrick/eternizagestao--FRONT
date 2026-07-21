"use client";

import Modal from "@/components/molecules/Modal/Modal";
import Button from "@/components/atoms/Button/Button";

/**
 * Confirmação padrão de exclusão.
 *
 * Exclusão em cemitério é sensível (registro civil), então: nunca em 1 clique,
 * sempre nomeando O QUE será excluído, e deixando claro que o dado não some do
 * banco — é arquivado (soft delete) e pode ser recuperado pelo suporte.
 */
export default function ConfirmDelete({
  open,
  onClose,
  onConfirm,
  loading = false,
  title = "Excluir registro",
  name,
  description,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>Excluir</Button>
        </>
      }
    >
      <p>
        Tem certeza que deseja excluir{name ? <> <strong>{name}</strong></> : " este registro"}?
      </p>
      <p style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
        {description
          || "O registro sai das listagens, mas fica arquivado no histórico — a recuperação só é possível pelo suporte."}
      </p>
    </Modal>
  );
}
