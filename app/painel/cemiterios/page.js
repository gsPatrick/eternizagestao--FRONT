"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Badge from "@/components/atoms/Badge/Badge";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import StatCard from "@/components/molecules/StatCard/StatCard";
import EntrancePicker, { worldToGps } from "@/components/molecules/EntrancePicker/EntrancePicker";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";

import { useResource, useMutation } from "@/lib/api/useResource";
import {
  listCemeteries,
  createCemetery,
  adaptCemetery,
  cemeteryInitial,
} from "@/lib/api/resources/cemeteries";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "ativos", label: "Ativos" },
  { key: "com_ortofoto", label: "Com ortofoto" },
  { key: "sem_ortofoto", label: "Sem ortofoto" },
  { key: "inativos", label: "Inativos" },
];

// "São Paulo — SP" → { addressCity, addressState }
function parseCityUf(value = "") {
  const [city, uf] = value.split(/[—-]/).map((p) => p.trim());
  return { addressCity: city || undefined, addressState: (uf || "").slice(0, 2).toUpperCase() || undefined };
}

export default function CemeteriesPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [newCemOpen, setNewCemOpen] = useState(false);
  const [entrance, setEntrance] = useState(null);
  const [form, setForm] = useState({ name: "", code: "", city: "", address: "" });
  const [formError, setFormError] = useState(null);

  // busca todos os cemitérios do tenant (poucos por conta) — filtros e contadores
  // são calculados no cliente, preservando o layout de chips com contagem.
  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listCemeteries({ perPage: 100 }, { signal }),
    []
  );
  const { mutate: doCreate, loading: saving } = useMutation(createCemetery);

  const cemeteries = useMemo(
    () => (data?.data ?? []).map(adaptCemetery),
    [data]
  );

  const counts = useMemo(() => ({
    todos: cemeteries.length,
    ativos: cemeteries.filter((c) => c.active).length,
    com_ortofoto: cemeteries.filter((c) => c.ortofoto).length,
    sem_ortofoto: cemeteries.filter((c) => !c.ortofoto).length,
    inativos: cemeteries.filter((c) => !c.active).length,
  }), [cemeteries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cemeteries.filter((c) => {
      if (filter === "ativos" && !c.active) return false;
      if (filter === "inativos" && c.active) return false;
      if (filter === "com_ortofoto" && !c.ortofoto) return false;
      if (filter === "sem_ortofoto" && c.ortofoto) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.city.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cemeteries, query, filter]);

  const totalGraves = cemeteries.reduce((s, c) => s + c.stats.graves, 0);
  const avgOccupancy = cemeteries.length
    ? Math.round(cemeteries.reduce((s, c) => s + c.stats.occupancy, 0) / cemeteries.length)
    : 0;

  async function createNewCemetery() {
    setFormError(null);
    const gps = worldToGps(entrance);
    const { addressCity, addressState } = parseCityUf(form.city);
    const body = {
      name: form.name?.trim(),
      code: form.code?.trim() || undefined,
      addressStreet: form.address?.trim() || undefined,
      addressCity,
      addressState,
      entranceLatitude: gps ? gps[0] : undefined,
      entranceLongitude: gps ? gps[1] : undefined,
    };
    if (!body.name) {
      setFormError("Informe o nome do cemitério.");
      return;
    }
    try {
      await doCreate(body);
      setNewCemOpen(false);
      setForm({ name: "", code: "", city: "", address: "" });
      setEntrance(null);
      refetch();
    } catch (e) {
      setFormError(e?.message || "Não foi possível criar o cemitério.");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Cemitérios</h1>
          <p className={styles.subtitle}>Gestão de múltiplos cemitérios por cidade/município</p>
        </div>
        <div className={styles.actions}>
          <Button
            onClick={() => setNewCemOpen(true)}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Novo cemitério
          </Button>
        </div>
      </header>

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : loading ? (
        <>
          <div className={styles.stats}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="card" height={92} />
            ))}
          </div>
          <div className={styles.cemGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="card" height={168} />
            ))}
          </div>
        </>
      ) : !cemeteries.length ? (
        <EmptyState
          title="Nenhum cemitério cadastrado"
          message="Cadastre o primeiro cemitério para montar a estrutura de quadras, ruas e lotes."
          action={<Button onClick={() => setNewCemOpen(true)}>Novo cemitério</Button>}
        />
      ) : (
        <>
          <div className={styles.stats}>
            <StatCard label="Cemitérios" value={String(cemeteries.length)} caption={`${counts.ativos} ativos`} />
            <StatCard label="Sepulturas" value={totalGraves.toLocaleString("pt-BR")} caption="em toda a rede" />
            <StatCard label="Ocupação média" value={`${avgOccupancy}%`} caption="capacidade utilizada" />
            <StatCard label="Sem ortofoto" value={String(counts.sem_ortofoto)} caption="mapas pendentes" />
          </div>

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
                placeholder="Buscar por nome ou cidade…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <span className={styles.resultCount}>{filtered.length} cemitério(s)</span>
          </div>

          <div className={styles.cemGrid}>
            {filtered.map((cem) => (
              <Link key={cem.id} href={`/painel/cemiterios/${cem.id}`} className={styles.cemCard}>
                <span className={styles.cemBar} style={{ background: `linear-gradient(90deg, ${cem.color}, ${cem.color2})` }} />
                <header className={styles.cemHead}>
                  <span className={styles.cemLogo} style={{ background: cem.color }}>
                    {cemeteryInitial(cem.name)}
                  </span>
                  <div className={styles.cemInfo}>
                    <span className={styles.cemName}>{cem.name}</span>
                    <span className={styles.cemCity}>{cem.city}</span>
                  </div>
                  <span className={styles.cemChevron}>
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </header>
                <div className={styles.cemBadges}>
                  {cem.active ? <Badge tone="success" dot>Ativo</Badge> : <Badge tone="neutral">Inativo</Badge>}
                  {cem.ortofoto
                    ? <Badge tone="navy">Ortofoto OK</Badge>
                    : <Badge tone="warning">Sem ortofoto</Badge>}
                </div>
                <div className={styles.cemStats}>
                  <span><strong>{cem.stats.blocks}</strong> quadras</span>
                  <span><strong>{cem.stats.graves.toLocaleString("pt-BR")}</strong> sepulturas</span>
                  <span className={styles.cemOccupancy}><strong>{cem.stats.occupancy}%</strong> ocupação</span>
                </div>
                <div className={styles.occupancyTrack}>
                  <div
                    className={`${styles.occupancyFill} ${cem.stats.occupancy >= 90 ? styles.occupancyHigh : ""}`}
                    style={{ width: `${cem.stats.occupancy}%` }}
                  />
                </div>
              </Link>
            ))}
            {!filtered.length && (
              <p className={styles.emptyLevel}>Nenhum cemitério encontrado com esses filtros.</p>
            )}
          </div>
        </>
      )}

      {/* ---- novo cemitério (dados próprios) ---- */}
      <Modal
        open={newCemOpen}
        onClose={() => setNewCemOpen(false)}
        title="Novo cemitério"
        subtitle="Cadastro com dados próprios do município"
        width={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewCemOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={createNewCemetery}>Criar cemitério</Button>
          </>
        }
      >
        <div className={styles.modalBody}>
          <div className={styles.formGrid}>
            <FormField label="Nome" required className={styles.spanTwo}>
              <Input
                placeholder="Ex.: Cemitério Parque das Flores"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <FormField label="Código" hint="Identificador interno">
              <Input
                placeholder="CEM-07"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </FormField>
            <FormField label="Cidade / UF" required>
              <Input
                placeholder="São Paulo — SP"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </FormField>
            <FormField label="Endereço" className={styles.spanTwo}>
              <Input
                placeholder="Rua, número · bairro"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </FormField>
            <FormField label="Entrada do cemitério" hint="Origem das rotas GPS do visitante" className={styles.spanTwo}>
              <EntrancePicker value={entrance} onChange={setEntrance} />
            </FormField>
          </div>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Alert tone="info">
            Depois do cadastro: abra o cemitério para configurar <strong>logotipo, cores e
            órgão gestor</strong>, importar a <strong>ortofoto</strong> e montar a estrutura
            de quadras, ruas e lotes.
          </Alert>
        </div>
      </Modal>
    </div>
  );
}
