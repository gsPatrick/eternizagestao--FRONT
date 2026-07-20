"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

import PublicNav from "@/components/organisms/PublicNav/PublicNav";
import MapExplorer, { GRAVES, routeTo } from "@/components/organisms/MapExplorer/MapExplorer";
import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import { TENANTS } from "@/lib/tenants";
import { usePublicSearch, formatDate, yearOf } from "@/src/features/public-search";
import { usePublicGraveRoute } from "@/src/features/public-map";

/**
 * Portal público de consulta (PDF 11): busca por nome, CPF ou número do jazigo
 * — sem cadastro. Os resultados vêm da API pública (/public/search) e cada um
 * abre o mapa com a distância real da entrada até a sepultura (/public/graves/:id/route).
 */

// hash estável (UUID → índice) para posicionar a sepultura no mapa ilustrativo.
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i += 1) h = (h * 31 + String(str).charCodeAt(i)) % 100000;
  return h;
}

// monta "Quadra A › Rua 1 › Lote 01" com o que houver; senão, fallback digno.
function locationLabel(r) {
  const parts = [];
  if (r.block) parts.push(r.block);
  if (r.street) parts.push(r.street);
  if (r.lot) parts.push(r.lot);
  return parts.length ? parts.join(" › ") : "Localização não informada";
}

// situações da cova (espelham os status de sistema do cadastro) — o valor
// enviado casa por nome/slug na API (§3.6: "situação").
const SITUACOES = [
  "Livre",
  "Ocupada",
  "Reservada",
  "Em manutenção",
  "Interditada",
  "Em perpetuidade",
];

const EMPTY_FILTERS = { quadra: "", lote: "", jazigo: "", situacao: "" };

function SearchContent() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [submitted, setSubmitted] = useState(params.get("q") || "");
  // filtros avançados (PDF §3.6): quadra, lote, número do jazigo, situação
  const initialFilters = {
    quadra: params.get("quadra") || "",
    lote: params.get("lote") || "",
    jazigo: params.get("jazigo") || "",
    situacao: params.get("situacao") || "",
  };
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const hasAdvanced = Object.values(initialFilters).some(Boolean);
  const [showFilters, setShowFilters] = useState(hasAdvanced);
  const [selected, setSelected] = useState(null);
  const mapRef = useRef(null);

  // tenant vindo da URL (?t=guarulhos) — no dev faz as vezes do subdomínio.
  const tenant = TENANTS.find((t) => t.id === params.get("t") && t.id !== "eterniza") || null;
  const tenantSlug = tenant ? tenant.id : params.get("t");
  const home = tenant ? `/${tenant.id}` : "/";
  const portalHref = tenant ? `/login?t=${tenant.id}` : "/login";
  const navLinks = [];

  const { results, loading, error, refetch, status } = usePublicSearch(
    { q: submitted, ...appliedFilters },
    { tenant: tenantSlug }
  );
  const grave = usePublicGraveRoute(selected, { tenant: tenantSlug });

  const activeFilters = Object.entries(appliedFilters).filter(([, v]) => v);
  // resumo textual da busca (termo + filtros) para o contador de resultados
  const summary =
    [submitted && `“${submitted}”`, ...activeFilters.map(([k, v]) => `${k}: ${v}`)]
      .filter(Boolean)
      .join(" · ") || "sua busca";

  // mapa ilustrativo: a geometria do SVG é sintética (o cemitério real é
  // renderizado por ortofoto/polígonos no app do visitante). Aqui posicionamos
  // a sepultura de forma estável para manter a experiência visual da rota.
  const svgGrave = selected ? GRAVES[hashCode(selected.id) % GRAVES.length] : null;
  const svgRoute = svgGrave ? routeTo(svgGrave) : null;

  function submit(event) {
    event.preventDefault();
    setSubmitted(query);
    setAppliedFilters(filters);
    setSelected(null);
  }

  function pickExample(value) {
    setQuery(value);
    setSubmitted(value);
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSelected(null);
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSelected(null);
  }

  function openMap(result) {
    setSelected(result);
    setTimeout(() => mapRef.current?.reset(), 50);
  }

  const content = (
    <>
      <PublicNav solid home={home} links={navLinks} cta={{ label: "Portal da Família", href: portalHref }} />

      <main className={styles.page}>
        {/* ---------- cabeçalho de busca ---------- */}
        <section className={styles.searchHero}>
          <div className={styles.inner}>
            <span className={styles.kicker}>Consulta pública · {tenant ? tenant.name : "Cemitério Municipal"}</span>
            <h1 className={styles.title}>Encontre quem você procura.</h1>
            <p className={styles.subtitle}>
              Busque pelo nome do sepultado ou do responsável, número do jazigo,
              quadra, lote, situação ou CPF. Sem cadastro — e com a localização
              exata no mapa.
            </p>

            <form className={styles.searchForm} onSubmit={submit} role="search">
              <div className={styles.searchBox}>
                <svg viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m13.5 13.5-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  placeholder="Ex.: Helena Duarte, JAZ-676026, 123.456.789-00…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar por nome, responsável, jazigo, quadra, lote, situação ou CPF"
                />
              </div>
              <button className={styles.searchBtn} type="submit">Buscar</button>
            </form>

            {/* ---------- filtros avançados (recolhível) ---------- */}
            <div className={styles.filtersBar}>
              <button
                type="button"
                className={styles.filtersToggle}
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
              >
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 4h12M4.5 8h7M6.5 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Filtros avançados
                {activeFilters.length > 0 && (
                  <span className={styles.filtersCount}>{activeFilters.length}</span>
                )}
              </button>
            </div>

            {showFilters && (
              <form className={styles.filtersPanel} onSubmit={submit}>
                <label className={styles.filterField}>
                  <span>Quadra</span>
                  <input
                    value={filters.quadra}
                    onChange={(e) => setFilter("quadra", e.target.value)}
                    placeholder="Ex.: A"
                  />
                </label>
                <label className={styles.filterField}>
                  <span>Lote</span>
                  <input
                    value={filters.lote}
                    onChange={(e) => setFilter("lote", e.target.value)}
                    placeholder="Ex.: A-R1-L1"
                  />
                </label>
                <label className={styles.filterField}>
                  <span>Nº do jazigo</span>
                  <input
                    value={filters.jazigo}
                    onChange={(e) => setFilter("jazigo", e.target.value)}
                    placeholder="Ex.: JAZ-001"
                  />
                </label>
                <label className={styles.filterField}>
                  <span>Situação</span>
                  <select
                    value={filters.situacao}
                    onChange={(e) => setFilter("situacao", e.target.value)}
                  >
                    <option value="">Todas</option>
                    {SITUACOES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <div className={styles.filterActions}>
                  <button type="submit" className={styles.filterApply}>Aplicar filtros</button>
                  {activeFilters.length > 0 && (
                    <button type="button" className={styles.filterClear} onClick={clearFilters}>
                      Limpar
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </section>

        {/* ---------- resultados ---------- */}
        <section className={styles.resultsArea}>
          <div className={styles.inner}>
            {status === "idle" && (
              <div className={styles.emptyState}>
                <p>
                  Busque por nome, responsável, CPF, jazigo, quadra, lote ou situação —
                  ou use os filtros avançados. Exemplos:
                  {" "}
                  {["Maria", "Antônio", "JAZ-001"].map((s) => (
                    <button key={s} className={styles.exampleChip} onClick={() => pickExample(s)}>
                      {s}
                    </button>
                  ))}
                </p>
              </div>
            )}

            {status === "too-short" && (
              <div className={styles.emptyState}>
                <p>Digite ao menos 2 caracteres — ou use os filtros avançados.</p>
              </div>
            )}

            {status === "ready" && loading && (
              <div className={styles.resultGrid} aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <article key={i} className={styles.resultCard}>
                    <Skeleton variant="line" width="65%" />
                    <Skeleton variant="line" width="40%" />
                    <Skeleton variant="block" height={44} />
                    <Skeleton variant="line" width="55%" />
                  </article>
                ))}
              </div>
            )}

            {status === "ready" && !loading && error && (
              <ErrorState onRetry={refetch} />
            )}

            {status === "ready" && !loading && !error && results.length === 0 && (
              <EmptyState
                title="Nenhum registro encontrado para esta busca"
                message="Confira a grafia do nome ou procure pelo número do jazigo. Em caso de dúvida, fale com a administração do cemitério."
              />
            )}

            {status === "ready" && !loading && !error && results.length > 0 && (
              <>
                <p className={styles.resultCount}>
                  {results.length} resultado(s) para <strong>{summary}</strong>
                </p>
                <div className={styles.resultGrid}>
                  {results.map((r) => (
                    <article key={r.id} className={styles.resultCard}>
                      <header className={styles.resultHead}>
                        {r.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className={styles.resultPhoto} src={r.photoUrl} alt="" loading="lazy" />
                        )}
                        <div className={styles.resultHeadMain}>
                          <h2 className={styles.resultName}>{r.name}</h2>
                          {(r.birthDate || r.deathDate) && (
                            <span className={styles.resultDates}>
                              {r.birthDate ? yearOf(r.birthDate) : "—"}
                              {r.deathDate ? ` — falecimento em ${formatDate(r.deathDate)}` : ""}
                            </span>
                          )}
                          {r.status && (
                            <span
                              className={styles.resultStatus}
                              style={r.statusColor ? { "--status-color": r.statusColor } : undefined}
                            >
                              {r.status}
                            </span>
                          )}
                        </div>
                        {r.code && <span className={styles.resultCode}>{r.code}</span>}
                      </header>
                      <dl className={styles.resultInfo}>
                        <div>
                          <dt>Cemitério</dt>
                          <dd>{r.cemetery || "Não informado"}</dd>
                        </div>
                        <div>
                          <dt>Localização</dt>
                          <dd>{locationLabel(r)}</dd>
                        </div>
                        {r.holder && (
                          <div className={styles.resultInfoWide}>
                            <dt>Responsável / concessão</dt>
                            <dd>{r.holder}</dd>
                          </div>
                        )}
                      </dl>
                      {(r.graveId || (r.cemeteryId && r.latitude != null)) && (
                        <footer className={styles.resultFoot}>
                          <button className={styles.mapBtn} onClick={() => openMap(r)}>
                            <svg viewBox="0 0 16 16" fill="none">
                              <path d="M8 14.5s4.8-4.4 4.8-8A4.8 4.8 0 0 0 3.2 6.5c0 3.6 4.8 8 4.8 8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                              <circle cx="8" cy="6.5" r="1.7" stroke="currentColor" strokeWidth="1.4" />
                            </svg>
                            Ver no mapa e traçar rota
                          </button>
                        </footer>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}

            {/* ---------- mapa com rota ---------- */}
            {selected && (
              <div className={styles.mapPanel}>
                <header className={styles.mapPanelHead}>
                  <div>
                    <h3 className={styles.mapPanelTitle}>
                      {selected.name} · {selected.code || "sepultura"}
                    </h3>
                    <p className={styles.mapPanelMeta}>
                      {grave.loading && "🧭 Calculando a rota da entrada…"}
                      {!grave.loading && grave.mapped && (
                        <>🧭 Rota da entrada: <strong>{grave.meters} m · ~{grave.minutes} min a pé</strong></>
                      )}
                      {!grave.loading && !grave.mapped && !grave.error && (
                        <>📍 Localização GPS ainda não disponível para esta sepultura.</>
                      )}
                      {!grave.loading && grave.error && (
                        <>Não foi possível calcular a rota agora.</>
                      )}
                    </p>
                  </div>
                  <button className={styles.mapPanelClose} onClick={() => setSelected(null)} aria-label="Fechar mapa">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </header>
                <MapExplorer
                  ref={mapRef}
                  layers={{ quadras: true, ruas: true, lotes: true, sepulturas: true, caminhos: true }}
                  selectedId={svgGrave?.id}
                  route={svgRoute}
                  height={460}
                />
                <p className={styles.mapPanelHint}>
                  No local, use o app do visitante para seguir a rota guiada por GPS a partir do portão principal.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.inner}>
          <span>© 2026 Eterniza Gestão · consulta pública gratuita</span>
          <Link href={home}>Voltar ao início</Link>
        </div>
      </footer>
    </>
  );

  // quando há tenant, aplica a cor/marca dele; senão, navy institucional.
  return tenant ? (
    <TenantTheme forcedTenantId={tenant.id} showSwitcher={false}>
      {content}
    </TenantTheme>
  ) : (
    content
  );
}

export default function PublicSearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
