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
              // SÓ SEPULTURAS RAIZ: a gaveta herda quadra/lote do jazigo pai e
              // aparecia aqui como uma linha idêntica a ele — impossível saber
              // qual era qual. A gaveta passa a ser escolhida no 2º passo
              // ("Número da gaveta"), depois do jazigo.
              onlyRoot: true,
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
                  <th>Sepultura</th>
                  <th>Cemitério</th>
                  <th>Quadra</th>
                  <th>Lote</th>
                  <th>Gavetas</th>
                  <th>Tipo do túmulo</th>
                  <th>Utilização</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => (
                  <tr key={g.id}>
                    {/* o CÓDIGO identifica a sepultura (e é o nº da gaveta, nas filhas) */}
                    <td>{g.code || "—"}</td>
                    <td>{g.cemetery?.name || "—"}</td>
                    <td>{g.lot?.street?.block?.code || "—"}</td>
                    <td>{g.lot?.code || "—"}</td>
                    <td>{g.childCount ? `${g.childCount} gaveta(s)` : "—"}</td>
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

/**
 * Rótulo da sepultura escolhida, no formato que o cliente já lê.
 * Inclui o CÓDIGO: em bloco de gavetas, quadra/lote se repetem em todas as
 * unidades — sem o código o operador não distingue uma da outra. Quando o
 * registro é uma GAVETA, mostra "JAZIGO · GAVETA", como na coluna da listagem.
 */
export function graveLabel(g) {
  if (!g) return "";
  const parts = [
    g.parentGrave?.code ? `${g.parentGrave.code} · ${g.code}` : g.code,
    g.cemetery?.name,
    g.lot?.street?.block?.code ? `Quadra: ${g.lot.street.block.code}` : null,
    g.lot?.code ? `Lote: ${g.lot.code}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" - ") : g.code || "";
}

/**
 * "Número da gaveta" — 2º passo do vínculo com a sepultura.
 *
 * Bloco de gavetas: a unidade onde o corpo entra é a GAVETA (uma Grave filha do
 * jazigo, identificada pelo `code`). Sem este campo só dava para apontar o
 * jazigo, e o sepultamento ficava sem número de gaveta.
 *
 * Só aparece quando o jazigo escolhido TEM filhas; senão, `onReady(false)` e o
 * formulário segue com o graveId do próprio jazigo (comportamento de sempre).
 * As gavetas já ocupadas continuam na lista, marcadas — o operador precisa
 * enxergar por que aquele número não está disponível.
 */
export function GaveteSelect({ parentGraveId, value, onChange, onLoaded }) {
  const { data, loading } = useResource(
    ({ signal }) =>
      parentGraveId
        ? listGraves({ parentGraveId, perPage: 200 }, { signal })
        : Promise.resolve({ data: [] }),
    [parentGraveId]
  );
  const gavetas = data?.data ?? [];

  useEffect(() => {
    if (!loading) onLoaded?.(gavetas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  if (!parentGraveId || loading || !gavetas.length) return null;

  return (
    <select
      className={styles.gaveta}
      value={value || ""}
      onChange={(e) => onChange(gavetas.find((g) => g.id === e.target.value) || null)}
      aria-label="Número da gaveta"
    >
      <option value="">Selecione a gaveta</option>
      {gavetas.map((g) => {
        const ocupada = (g.activeBurials || 0) >= (g.capacity || 1);
        return (
          // `drawerNumber` é o código SEM o prefixo do bloco pai (o código é
          // <bloco>-G<n> para a gaveta N existir em todos os blocos sem colidir).
          <option key={g.id} value={g.id}>
            Gaveta {g.drawerNumber || g.code}
            {ocupada ? " — ocupada" : ""}
          </option>
        );
      })}
    </select>
  );
}
