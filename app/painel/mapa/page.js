"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Switch from "@/components/atoms/Switch/Switch";
import Badge from "@/components/atoms/Badge/Badge";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import MapExplorer, { GRAVES, STATUS_META, routeTo } from "@/components/organisms/MapExplorer/MapExplorer";

import { useResource, useMutation } from "@/lib/api/useResource";
import { listCemeteries, adaptCemetery } from "@/lib/api/resources/cemeteries";
import {
  listOrthophotos,
  uploadOrthophoto,
  listMapPaths,
  createMapPath,
  removeMapPath,
  adaptMapPath,
  adaptOrthophoto,
} from "@/lib/api/resources/map";

const LAYER_LABELS = {
  quadras: "Quadras",
  ruas: "Ruas",
  lotes: "Lotes",
  sepulturas: "Sepulturas",
  caminhos: "Caminhos GPS",
};

// "-23.5490, -46.6350" → [-23.549, -46.635] (ou null se inválido)
function parseLatLng(value = "") {
  const parts = String(value).split(",").map((p) => Number(p.trim()));
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null;
  return parts;
}

// File → base64 puro (sem o prefixo data:...;base64,)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export default function MapPage() {
  const mapRef = useRef(null);
  const [cemetery, setCemetery] = useState(null);
  const [layers, setLayers] = useState({ quadras: true, ruas: true, lotes: true, sepulturas: true, caminhos: false });
  const [statusFilter, setStatusFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [route, setRoute] = useState(null);
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [draftPath, setDraftPath] = useState([]);
  const [pathActionError, setPathActionError] = useState(null);

  // formulário da ortofoto
  const [orthoFile, setOrthoFile] = useState(null);
  const [orthoNW, setOrthoNW] = useState("");
  const [orthoSE, setOrthoSE] = useState("");
  const [orthoError, setOrthoError] = useState(null);

  // ---- dados reais (a FONTE; o componente de mapa segue intacto) ----
  const cemsState = useResource(({ signal }) => listCemeteries({ perPage: 100 }, { signal }), []);
  const cemeteries = useMemo(() => (cemsState.data?.data ?? []).map(adaptCemetery), [cemsState.data]);

  // seleciona o primeiro cemitério ativo assim que a lista chega
  useEffect(() => {
    if (!cemetery && cemeteries.length) {
      const first = cemeteries.find((c) => c.active) || cemeteries[0];
      setCemetery(first.id);
    }
  }, [cemeteries, cemetery]);

  const orthoState = useResource(
    ({ signal }) => (cemetery ? listOrthophotos(cemetery, { signal }) : Promise.resolve([])),
    [cemetery]
  );
  const orthophotos = useMemo(() => (orthoState.data ?? []).map(adaptOrthophoto), [orthoState.data]);
  const hasOrtho = orthophotos.some((o) => o.active);

  const pathsState = useResource(
    ({ signal }) => (cemetery ? listMapPaths(cemetery, { signal }) : Promise.resolve([])),
    [cemetery]
  );
  const paths = useMemo(() => (pathsState.data ?? []).map((p, i) => adaptMapPath(p, i)), [pathsState.data]);

  const { mutate: doUpload, loading: uploading } = useMutation(uploadOrthophoto);
  const { mutate: doCreatePath } = useMutation(createMapPath);
  const { mutate: doRemovePath } = useMutation(removeMapPath);

  const counts = useMemo(() => {
    const acc = {};
    GRAVES.forEach((g) => { acc[g.status] = (acc[g.status] || 0) + 1; });
    return acc;
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return GRAVES.filter(
      (g) => g.code.toLowerCase().includes(q) || (g.occupant && g.occupant.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [query]);

  function toggleLayer(key) {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function selectGrave(grave, { zoom = false } = {}) {
    setSelected(grave);
    setRoute(null);
    if (grave && zoom) mapRef.current?.zoomTo(grave.cx, grave.cy);
  }

  function pickResult(grave) {
    setQuery("");
    selectGrave(grave, { zoom: true });
  }

  function simulateRoute() {
    if (!selected) return;
    setRoute(routeTo(selected));
    mapRef.current?.reset();
  }

  async function importOrthophoto() {
    if (!cemetery) return;
    setOrthoError(null);
    try {
      const body = {
        name: orthoFile?.name?.replace(/\.[^.]+$/, "") || `Ortofoto ${cem?.name || ""}`.trim(),
      };
      const nw = parseLatLng(orthoNW);
      const se = parseLatLng(orthoSE);
      if (nw && se) body.bounds = { nw, se };
      if (orthoFile) {
        body.fileName = orthoFile.name;
        body.mimeType = orthoFile.type || "image/png";
        body.contentBase64 = await fileToBase64(orthoFile);
      }
      await doUpload(cemetery, body);
      setImportOpen(false);
      setOrthoFile(null);
      setOrthoNW("");
      setOrthoSE("");
      orthoState.refetch();
    } catch (e) {
      setOrthoError(e?.message || "Não foi possível enviar a ortofoto.");
    }
  }

  function startDrawing() {
    setSelected(null);
    setRoute(null);
    setPathActionError(null);
    setDraftPath([]);
    setDrawing(true);
  }

  async function finishDrawing() {
    const pts = draftPath;
    setDrawing(false);
    setDraftPath([]);
    if (pts.length < 2 || !cemetery) return;
    setPathActionError(null);
    try {
      await doCreatePath(cemetery, { name: `Caminho ${paths.length + 1}`, pathCoordinates: pts });
      setLayers((prev) => ({ ...prev, caminhos: true }));
      pathsState.refetch();
    } catch (e) {
      setPathActionError(e?.message || "Não foi possível salvar o caminho.");
    }
  }

  function cancelDrawing() {
    setDrawing(false);
    setDraftPath([]);
  }

  async function removePath(id) {
    setPathActionError(null);
    try {
      await doRemovePath(id);
      pathsState.refetch();
    } catch (e) {
      setPathActionError(e?.message || "Não foi possível remover o caminho.");
    }
  }

  const cem = cemeteries.find((c) => c.id === cemetery);

  // estado da fonte de cemitérios governa o workspace (o header permanece)
  const workspaceLoading = cemsState.loading || (cemeteries.length > 0 && !cem);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Mapa</h1>
          <p className={styles.subtitle}>Ortofoto, camadas e localização de sepulturas</p>
        </div>
        <div className={styles.actions}>
          <div className={styles.cemeterySelect}>
            <Select
              value={cemetery || ""}
              onChange={(e) => setCemetery(e.target.value)}
              aria-label="Cemitério"
              disabled={cemsState.loading || !cemeteries.length}
            >
              {cemsState.loading && <option value="">Carregando cemitérios…</option>}
              {!cemsState.loading && !cemeteries.length && <option value="">Nenhum cemitério</option>}
              {cemeteries.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <Button variant="secondary" onClick={() => setImportOpen(true)} disabled={!cem}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 10V2m0 0L5 5m3-3 3 3M3 12v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            Importar ortofoto
          </Button>
        </div>
      </header>

      {workspaceLoading ? (
        <div className={styles.workspace}>
          <aside className={styles.panel}>
            <Skeleton variant="block" height={44} />
            <Skeleton variant="row" count={5} />
            <Skeleton variant="row" count={4} />
          </aside>
          <div className={styles.mapArea}>
            <Skeleton variant="block" height="100%" />
          </div>
        </div>
      ) : cemsState.error ? (
        <ErrorState onRetry={cemsState.refetch} />
      ) : !cemeteries.length ? (
        <EmptyState
          title="Selecione um cemitério para ver o mapa"
          message="Cadastre um cemitério em Cemitérios para começar a demarcar sepulturas e traçar os caminhos do visitante."
          action={
            <Link href="/painel/cemiterios">
              <Button>Ir para Cemitérios</Button>
            </Link>
          }
        />
      ) : (
      <div className={styles.workspace}>
        {/* ---------- painel lateral ---------- */}
        <aside className={styles.panel}>
          <div className={styles.searchWrap}>
            <div className={styles.searchBox}>
              <svg viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
                <path d="m13.5 13.5-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                placeholder="Buscar sepultura ou sepultado…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {results.length > 0 && (
              <ul className={styles.results}>
                {results.map((g) => (
                  <li key={g.id}>
                    <button className={styles.resultRow} onClick={() => pickResult(g)}>
                      <span className={styles.resultDot} style={{ background: STATUS_META[g.status].color }} />
                      <span className={styles.resultInfo}>
                        <span className={styles.resultCode}>{g.code}</span>
                        <span className={styles.resultMeta}>
                          {g.occupant || STATUS_META[g.status].label} · Quadra {g.block}
                        </span>
                      </span>
                      <svg viewBox="0 0 16 16" fill="none" className={styles.resultChevron}>
                        <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <section className={styles.panelSection}>
            <span className={styles.panelLabel}>Camadas</span>
            <div className={styles.layerList}>
              {Object.keys(LAYER_LABELS).map((key) => (
                <div key={key} className={styles.layerRow}>
                  <span>{LAYER_LABELS[key]}</span>
                  <Switch checked={layers[key]} onChange={() => toggleLayer(key)} />
                </div>
              ))}
            </div>
          </section>

          <section className={styles.panelSection}>
            <span className={styles.panelLabel}>Situação dos jazigos</span>
            <div className={styles.legend}>
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <button
                  key={key}
                  className={`${styles.legendRow} ${statusFilter === key ? styles.legendActive : ""} ${statusFilter && statusFilter !== key ? styles.legendMuted : ""}`}
                  onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                >
                  <span className={styles.legendDot} style={{ background: meta.color }} />
                  <span className={styles.legendLabel}>{meta.label}</span>
                  <span className={styles.legendCount}>{counts[key] || 0}</span>
                </button>
              ))}
            </div>
            {statusFilter && (
              <button className={styles.clearFilter} onClick={() => setStatusFilter(null)}>
                Limpar filtro de situação
              </button>
            )}
          </section>

          <section className={styles.panelSection}>
            <span className={styles.panelLabel}>Caminhos GPS</span>
            <p className={styles.pathHint}>
              Trace os trajetos caminháveis — são eles que guiam a rota do visitante
              até a sepultura.
            </p>
            {pathActionError && (
              <Alert tone="danger">{pathActionError}</Alert>
            )}
            {pathsState.loading ? (
              <Skeleton variant="row" count={2} />
            ) : pathsState.error ? (
              <button className={styles.clearFilter} onClick={pathsState.refetch}>
                Não foi possível carregar os caminhos — tentar novamente
              </button>
            ) : paths.length > 0 ? (
              <ul className={styles.pathList}>
                {paths.map((path) => (
                  <li key={path.id} className={styles.pathRow}>
                    <span className={styles.pathDot} />
                    <span className={styles.pathName}>{path.name} · {path.points.length} pontos</span>
                    <button
                      className={styles.pathRemove}
                      onClick={() => removePath(path.id)}
                      aria-label={`Remover ${path.name}`}
                    >
                      <svg viewBox="0 0 16 16" fill="none">
                        <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button variant="secondary" size="sm" onClick={startDrawing} disabled={drawing}>
              + Traçar caminho
            </Button>
          </section>

          <section className={styles.panelSection}>
            <span className={styles.panelLabel}>Cemitério</span>
            <p className={styles.cemInfo}>
              <strong>{cem.name}</strong>
              {hasOrtho
                ? " · ortofoto georreferenciada ativa"
                : " · sem ortofoto — usando planta ilustrativa"}
            </p>
          </section>
        </aside>

        {/* ---------- mapa ---------- */}
        <div className={styles.mapArea}>
          <MapExplorer
            ref={mapRef}
            layers={layers}
            statusFilter={statusFilter}
            selectedId={selected?.id || null}
            onSelect={(g) => selectGrave(g)}
            route={route}
            height="100%"
            paths={paths}
            drawing={drawing}
            draftPath={draftPath}
            onDraftPoint={(point) => setDraftPath((prev) => [...prev, point])}
          />

          {/* banner do modo de traçado */}
          {drawing && (
            <div className={styles.drawBanner}>
              <span className={styles.drawBannerText}>
                <strong>Traçando caminho</strong> — toque no mapa para adicionar pontos
                <span className={styles.drawCount}>{draftPath.length}</span>
              </span>
              <div className={styles.drawBannerActions}>
                {draftPath.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setDraftPath((prev) => prev.slice(0, -1))}>
                    Desfazer
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={cancelDrawing}>Cancelar</Button>
                <Button size="sm" disabled={draftPath.length < 2} onClick={finishDrawing}>
                  Concluir caminho
                </Button>
              </div>
            </div>
          )}

          {/* card da sepultura selecionada */}
          {selected && (
            <div className={styles.graveCard}>
              <header className={styles.graveCardHead}>
                <div>
                  <span className={styles.graveCode}>{selected.code}</span>
                  <span className={styles.graveTrail}>
                    Quadra {selected.block} › {selected.street} › {selected.lot}
                  </span>
                </div>
                <button className={styles.closeCard} onClick={() => selectGrave(null)} aria-label="Fechar">
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </header>

              <div className={styles.graveCardBody}>
                <div className={styles.graveStatusRow}>
                  <Badge tone={selected.status === "livre" ? "success" : selected.status === "interditada" ? "danger" : selected.status === "reservada" || selected.status === "em_manutencao" ? "warning" : "navy"}>
                    {STATUS_META[selected.status].label}
                  </Badge>
                  {selected.blocked && <Badge tone="danger" dot>Bloqueada — inadimplência</Badge>}
                </div>
                {selected.occupant && (
                  <p className={styles.graveOccupant}>
                    <svg viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="5.5" r="2.6" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M3.2 13.5c.8-2.4 2.6-3.6 4.8-3.6s4 1.2 4.8 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    {selected.occupant}
                  </p>
                )}
                {route && (
                  <p className={styles.routeInfo}>
                    🧭 Rota da entrada: <strong>{route.meters} m · ~{route.minutes} min a pé</strong>
                  </p>
                )}
              </div>

              <footer className={styles.graveCardFoot}>
                <Link href="/painel/sepulturas/1" className={styles.graveCardLink}>
                  <Button variant="secondary" size="sm">Ver sepultura</Button>
                </Link>
                {route ? (
                  <Button variant="secondary" size="sm" onClick={() => setRoute(null)}>Limpar rota</Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={simulateRoute}>Rota do visitante</Button>
                )}
              </footer>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ---------- importar ortofoto ---------- */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar ortofoto"
        subtitle={cem?.name}
        width={560}
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button loading={uploading} onClick={importOrthophoto}>Enviar ortofoto</Button>
          </>
        }
      >
        <div className={styles.modalBody}>
          <div className={styles.guide}>
            <span className={styles.guideTitle}>Como obter o arquivo certo</span>
            <ol className={styles.guideList}>
              <li className={styles.guideStep}>
                <span className={styles.guideNum}>1</span>
                <span className={styles.guideText}>
                  <strong>Contrate um mapeamento aéreo por drone</strong> (aerofotogrametria) com uma
                  empresa da sua região. Peça o resultado em <strong>GeoTIFF georreferenciado</strong>,
                  com resolução de <strong>3 a 5 cm por pixel</strong> — é o padrão do mercado e o
                  ideal para demarcar covas.
                </span>
              </li>
              <li className={styles.guideStep}>
                <span className={styles.guideNum}>2</span>
                <span className={styles.guideText}>
                  <strong>Alternativa sem custo:</strong> o setor de geoprocessamento da prefeitura
                  (ou o órgão estadual de cartografia) muitas vezes já possui ortofotos do município
                  — solicite o recorte da área do cemitério.
                </span>
              </li>
              <li className={styles.guideStep}>
                <span className={styles.guideNum}>3</span>
                <span className={styles.guideText}>
                  <strong>GeoTIFF:</strong> as coordenadas são lidas automaticamente do arquivo.
                  <strong> JPG/PNG:</strong> informe abaixo os dois cantos da imagem — no Google Maps,
                  clique com o botão direito no ponto exato e copie o <em>"lat, lng"</em> que aparece.
                </span>
              </li>
            </ol>
          </div>

          <label className={styles.upload}>
            <input
              type="file"
              accept="image/*,.tif,.tiff"
              className={styles.uploadInput}
              onChange={(e) => setOrthoFile(e.target.files?.[0] || null)}
            />
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="9" cy="10.5" r="1.8" stroke="currentColor" strokeWidth="1.5" />
              <path d="m5 18 4.5-4 3.5 3 3-2.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={styles.uploadText}>
              {orthoFile ? orthoFile.name : "Clique ou arraste a ortofoto aqui"}
              <em className={styles.uploadFormats}>GeoTIFF (recomendado) · JPG · PNG — até 500 MB</em>
            </span>
          </label>

          <div className={styles.formGrid}>
            <FormField label="Canto noroeste (lat, lng)" hint="somente para JPG/PNG — canto superior esquerdo">
              <Input placeholder="-23.5490, -46.6350" value={orthoNW} onChange={(e) => setOrthoNW(e.target.value)} />
            </FormField>
            <FormField label="Canto sudeste (lat, lng)" hint="canto inferior direito da imagem">
              <Input placeholder="-23.5520, -46.6310" value={orthoSE} onChange={(e) => setOrthoSE(e.target.value)} />
            </FormField>
          </div>
          {orthoError && <Alert tone="danger">{orthoError}</Alert>}
          <Alert tone="info">
            Com a ortofoto georreferenciada, as demarcações feitas aqui viram
            <strong> coordenadas GPS reais</strong> — usadas nas rotas do app do visitante
            e no portal público.
          </Alert>
        </div>
      </Modal>
    </div>
  );
}
