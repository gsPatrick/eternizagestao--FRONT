"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./GravePicker.module.css";

import Modal from "@/components/molecules/Modal/Modal";
import Input from "@/components/atoms/Input/Input";
import Button from "@/components/atoms/Button/Button";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import Pagination from "@/components/molecules/Pagination/Pagination";
import { useResource } from "@/lib/api/useResource";
import { listGraves, listCemeteries } from "@/lib/api/resources/graves";

const PER_PAGE = 10;

/**
 * "Pesquisa de sepulturas" — modal de escolha da sepultura no cadastro do
 * sepultado, espelhando a tela que o cliente já usa.
 *
 * Por que um modal e não um <select>: são milhares de sepulturas (4.798 no
 * cemitério dele). Uma lista suspensa é impraticável — o operador precisa
 * FILTRAR por cemitério/quadra/lote/tipo/utilização e escolher UMA na tabela.
 *
 * Devolve o objeto da sepultura escolhida via `onSelect`; a seleção é única.
 */
export default function GravePicker({ open, onClose, onSelect }) {
  const [f, setF] = useState({ cemetery: "", block: "", lot: "", tombType: "", utilizacao: "" });
  const [applied, setApplied] = useState(f);
  const [page, setPage] = useState(1);

  // limpa a busca a cada abertura — evita herdar o filtro do sepultado anterior
  useEffect(() => {
    if (!open) return;
    const empty = { cemetery: "", block: "", lot: "", tombType: "", utilizacao: "" };
    setF(empty);
    setApplied(empty);
    setPage(1);
  }, [open]);

  const { data: cemData } = useResource(
    ({ signal }) => (open ? listCemeteries({ signal }) : Promise.resolve({ data: [] })),
    [open]
  );
  const cemeteries = cemData?.data ?? [];
  // filtro de cemitério é por texto na tela dele; casamos o nome digitado no id
  const cemeteryId = useMemo(() => {
    if (!applied.cemetery.trim()) return undefined;
    const term = applied.cemetery.trim().toLowerCase();
    return cemeteries.find((c) => (c.name || "").toLowerCase().includes(term))?.id;
  }, [applied.cemetery, cemeteries]);

  const { data, loading } = useResource(
    ({ signal }) =>
      open
        ? listGraves(
            {
              page,
              perPage: PER_PAGE,
              cemeteryId,
              block: applied.block || undefined,
              lot: applied.lot || undefined,
              utilizacao: applied.utilizacao || undefined,
            },
            { signal }
          )
        : Promise.resolve({ data: [] }),
    [open, page, cemeteryId, applied.block, applied.lot, applied.utilizacao]
  );

  const rows = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const totalItems = data?.meta?.totalItems ?? rows.length;

  // "Tipo do túmulo" não é filtro da API (texto livre por sepultura) — aplicamos
  // sobre a página carregada, que é o mesmo alcance que o operador enxerga.
  const visible = applied.tombType
    ? rows.filter((g) => (g.tombType || "").toLowerCase().includes(applied.tombType.toLowerCase()))
    : rows;

  function search() {
    setApplied(f);
    setPage(1);
  }

  function set(key) {
    return (e) => setF((v) => ({ ...v, [key]: e.target.value }));
  }

  return (
    <Modal open={open} onClose={onClose} title="Pesquisa de sepulturas" width={860}>
      <form
        className={styles.filters}
        onSubmit={(e) => { e.preventDefault(); search(); }}
      >
        <Input placeholder="Cemitério" value={f.cemetery} onChange={set("cemetery")} />
        <Input placeholder="Quadra" value={f.block} onChange={set("block")} />
        <Input placeholder="Lote" value={f.lot} onChange={set("lot")} />
        <Input placeholder="Tipo do túmulo" value={f.tombType} onChange={set("tombType")} />
        <Input placeholder="Utilização" value={f.utilizacao} onChange={set("utilizacao")} />
        <Button type="submit">Pesquisar</Button>
      </form>

      {loading ? (
        <div className={styles.loading}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={40} />)}
        </div>
      ) : !visible.length ? (
        <EmptyState
          title="Nenhuma sepultura encontrada"
          message="Ajuste os filtros acima — ou cadastre a sepultura antes de registrar o sepultado."
        />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cemitério</th>
                  <th>Quadra</th>
                  <th>Lote</th>
                  <th>Tipo do túmulo</th>
                  <th>Utilização</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => (
                  <tr key={g.id}>
                    <td>{g.cemetery?.name || "—"}</td>
                    <td>{g.lot?.street?.block?.code || "—"}</td>
                    <td>{g.lot?.code || "—"}</td>
                    <td>{g.tombType || "—"}</td>
                    <td>{g.utilizacao || "—"}</td>
                    <td className={styles.pickCell}>
                      <button
                        type="button"
                        className={styles.pick}
                        title="Selecionar esta sepultura"
                        aria-label={`Selecionar sepultura ${g.code}`}
                        onClick={() => { onSelect(g); onClose(); }}
                      >
                        <svg viewBox="0 0 16 16" fill="none" width="15" height="15" aria-hidden="true">
                          <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.foot}>
            <span>{totalItems.toLocaleString("pt-BR")} sepulturas</span>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </Modal>
  );
}

/** Rótulo da sepultura escolhida, no formato que o cliente já lê. */
export function graveLabel(g) {
  if (!g) return "";
  const parts = [
    g.cemetery?.name,
    g.lot?.street?.block?.code ? `Quadra: ${g.lot.street.block.code}` : null,
    g.lot?.code ? `Lote: ${g.lot.code}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" - ") : g.code || "";
}
