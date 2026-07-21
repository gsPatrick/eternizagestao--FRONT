"use client";

import Modal from "@/components/molecules/Modal/Modal";
import Button from "@/components/atoms/Button/Button";
import Alert from "@/components/molecules/Alert/Alert";
import styles from "./ConfirmDelete.module.css";

/**
 * Confirmação padrão de exclusão, em DUAS etapas.
 *
 * 1) Confirmação normal: nunca em 1 clique, sempre nomeando o registro.
 * 2) Quando a exclusão é BARRADA (sepultura ocupada, sepultado ainda enterrado),
 *    não paramos numa mensagem seca: mostramos o que está preso ao registro e
 *    oferecemos "Excluir mesmo assim" — que encerra os vínculos junto.
 *
 * O operador precisa ver o preço antes de pagar, e escolher pagá-lo.
 * Documentos já emitidos nunca são apagados — são registro civil.
 *
 *  - `impact`: objeto vindo de /delete-impact; quando `impact.blocked` é true,
 *    o modal entra no modo forçado.
 *  - `onConfirm(force)`: recebe `true` quando o operador escolheu forçar.
 */
export default function ConfirmDelete({
  open,
  onClose,
  onConfirm,
  loading = false,
  title = "Excluir registro",
  name,
  description,
  impact = null,
  error = "",
}) {
  const blocked = Boolean(impact?.blocked);
  const lines = blocked ? impactLines(impact) : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={blocked ? `${title} — há vínculos ativos` : title}
      width={blocked ? 540 : 460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {blocked ? "Sair sem excluir" : "Cancelar"}
          </Button>
          <Button variant="danger" loading={loading} onClick={() => onConfirm(blocked)}>
            {blocked ? "Excluir mesmo assim" : "Excluir"}
          </Button>
        </>
      }
    >
      {blocked ? (
        <>
          <p>
            <strong>{name}</strong> ainda tem vínculos ativos. Se você continuar,
            isto será feito junto:
          </p>
          <ul className={styles.list}>
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <Alert tone="warning">
            Os <strong>documentos já emitidos</strong> não são apagados — são registro
            civil e continuam em Documentos
            {impact.documents ? ` (${impact.documents} neste registro)` : ""}.
            O registro sai das listagens, mas fica arquivado e pode ser recuperado
            pelo suporte.
          </Alert>
        </>
      ) : (
        <>
          <p>
            Tem certeza que deseja excluir{name ? <> <strong>{name}</strong></> : " este registro"}?
          </p>
          <p className={styles.note}>
            {description
              || "O registro sai das listagens, mas fica arquivado no histórico — a recuperação só é possível pelo suporte."}
          </p>
        </>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
    </Modal>
  );
}

// Traduz o impacto em frases que o operador entende — sem jargão de banco.
function impactLines(impact) {
  const out = [];

  if (impact.activeBurials) {
    out.push(
      impact.activeBurials === 1
        ? "1 sepultamento ativo será encerrado"
        : `${impact.activeBurials} sepultamentos ativos serão encerrados`
    );
  }
  if (impact.occupants?.length) {
    out.push(`Sepultado(s) desvinculado(s) da sepultura: ${impact.occupants.join(", ")}`);
  }
  if (impact.graveCode) {
    out.push(`A sepultura ${impact.graveCode} ficará desocupada`);
  }
  if (impact.activeConcessions) {
    out.push(
      impact.activeConcessions === 1
        ? "1 concessão ativa será encerrada"
        : `${impact.activeConcessions} concessões ativas serão encerradas`
    );
  }
  if (impact.deposits) {
    out.push("O depósito no ossário será baixado");
  }
  return out;
}
