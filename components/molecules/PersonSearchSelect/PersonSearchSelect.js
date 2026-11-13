"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./PersonSearchSelect.module.css";
import { listPeople, getPerson } from "@/lib/api/resources/people";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 250;

function personLabel(p) {
  if (!p) return "";
  const name = p.fullName || p.name || "";
  return p.cpf ? `${name} — ${p.cpf}` : name;
}

/**
 * Seletor de PESSOA com busca no servidor.
 *
 * Substitui os <select> que carregavam "todas" as pessoas de uma vez: a API
 * devolve no máximo 100 por página, então a lista parava por volta da letra N
 * e ninguém de O a Z podia ser escolhido como responsável/proprietário (o
 * cliente chegou a renomear "Vitória" para "AVitoria" para conseguir).
 *
 * Aqui a pessoa é PROCURADA (nome sem acento, qualquer palavra, ou CPF) e a
 * lista é paginada ("Carregar mais") — funciona com qualquer volume.
 *
 * Contrato igual ao de um <select> controlado:
 *   value      id da pessoa selecionada ("" = nenhuma)
 *   onChange   (id, person|null) => void
 *   emptyLabel rótulo da opção "nenhuma" (omitido = campo obrigatório, sem opção vazia)
 *   excludeIds ids que não podem ser escolhidos (ex.: o titular atual)
 *   selected   objeto da pessoa já conhecido (evita buscar o nome pelo id)
 */
export default function PersonSearchSelect({
  value,
  onChange,
  placeholder = "Buscar por nome ou CPF…",
  emptyLabel,
  excludeIds = [],
  selected = null,
  disabled = false,
  invalid = false,
  id,
}) {
  const autoId = useId();
  const listId = `${id || autoId}-list`;
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(-1);
  const [current, setCurrent] = useState(selected);

  // Nome da pessoa selecionada: usa o objeto conhecido ou busca pelo id
  // (edição de um cadastro que já tem responsável/proprietário).
  useEffect(() => {
    if (!value) { setCurrent(null); return; }
    if (current?.id === value) return;
    if (selected?.id === value) { setCurrent(selected); return; }
    let alive = true;
    getPerson(value)
      .then((p) => { if (alive) setCurrent(p); })
      .catch(() => { if (alive) setCurrent({ id: value, fullName: "Pessoa selecionada" }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selected?.id]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  // Busca (página 1) ao abrir e a cada termo novo.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    listPeople(
      { search: debounced || undefined, page: 1, perPage: PAGE_SIZE, active: "true" },
      { signal: controller.signal }
    )
      .then((res) => {
        setItems(res?.data ?? []);
        setPage(1);
        setTotalPages(res?.meta?.totalPages ?? 1);
        setTotalItems(res?.meta?.totalItems ?? (res?.data?.length || 0));
        setActive(-1);
      })
      .catch((err) => {
        if (err?.name === "AbortError" || controller.signal.aborted) return;
        setError("Não foi possível buscar as pessoas.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, debounced]);

  async function loadMore() {
    if (loading || page >= totalPages) return;
    setLoading(true);
    try {
      const next = page + 1;
      const res = await listPeople({
        search: debounced || undefined, page: next, perPage: PAGE_SIZE, active: "true",
      });
      setItems((prev) => [...prev, ...(res?.data ?? [])]);
      setPage(next);
      setTotalPages(res?.meta?.totalPages ?? next);
    } catch {
      setError("Não foi possível carregar mais pessoas.");
    } finally {
      setLoading(false);
    }
  }

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const visible = items.filter((p) => !excludeIds.includes(p.id));

  function choose(p) {
    setCurrent(p);
    onChange?.(p ? p.id : "", p);
    setOpen(false);
    setTerm("");
  }

  function openList() {
    if (disabled) return;
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(visible.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && visible[active]) choose(visible[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={styles.root}>
      {!open ? (
        <button
          type="button"
          className={`${styles.trigger} ${invalid ? styles.invalid : ""}`}
          onClick={openList}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded="false"
          id={id}
        >
          <span className={current ? styles.value : styles.placeholder}>
            {current ? personLabel(current) : emptyLabel || "Selecione a pessoa…"}
          </span>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <input
          ref={inputRef}
          className={styles.search}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
        />
      )}

      {open && (
        <div className={styles.panel}>
          <ul id={listId} role="listbox" className={styles.list}>
            {emptyLabel && !debounced && (
              <li
                role="option"
                aria-selected={!value}
                className={`${styles.option} ${styles.muted}`}
                onMouseDown={(e) => { e.preventDefault(); choose(null); }}
              >
                {emptyLabel}
              </li>
            )}
            {visible.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={p.id === value}
                className={`${styles.option} ${i === active ? styles.active : ""} ${p.id === value ? styles.selected : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(p); }}
              >
                <span className={styles.name}>{p.fullName || p.name}</span>
                {p.cpf && <span className={styles.cpf}>{p.cpf}</span>}
              </li>
            ))}
            {!loading && !visible.length && (
              <li className={styles.empty}>
                {debounced ? `Nenhuma pessoa encontrada para "${debounced}".` : "Nenhuma pessoa cadastrada."}
              </li>
            )}
          </ul>
          <div className={styles.foot}>
            <span>
              {loading
                ? "Buscando…"
                : error || `${visible.length} de ${totalItems.toLocaleString("pt-BR")}`}
            </span>
            {page < totalPages && !loading && (
              <button
                type="button"
                className={styles.more}
                onMouseDown={(e) => { e.preventDefault(); loadMore(); }}
              >
                Carregar mais
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
