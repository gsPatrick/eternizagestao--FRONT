"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Switch from "@/components/atoms/Switch/Switch";
import Badge from "@/components/atoms/Badge/Badge";
import Select from "@/components/atoms/Select/Select";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import Alert from "@/components/molecules/Alert/Alert";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";

import { useResource, useMutation } from "@/lib/api/useResource";
import { getUser } from "@/lib/api/session";
import { listCemeteries, adaptCemetery } from "@/lib/api/resources/cemeteries";
import {
  listOrthophotos,
  uploadOrthophoto,
  updateOrthophoto,
  getMapContext,
  listMapGraves,
  setGraveGeometry,
  adaptOrthophoto,
  adaptMapContext,
  adaptMapGrave,
  averageCenter,
} from "@/lib/api/resources/map";

// O Leaflet depende de `window` → mapa é CLIENT-ONLY (sem SSR).
const CemeteryMap = dynamic(
  () => import("@/components/organisms/CemeteryMap/CemeteryMap"),
  {
    ssr: false,
    loading: () => <div className={styles.mapLoading} />,
  }
);

// Situação das sepulturas (fonte da verdade do front — cores do design system).
const STATUS_META = {
  livre: { label: "Livre", color: "#1a7f5c", tone: "success" },
  ocupada: { label: "Ocupada", color: "#032e59", tone: "navy" },
  reservada: { label: "Reservada", color: "#9a6b15", tone: "warning" },
  em_manutencao: { label: "Em manutenção", color: "#5b8ac2", tone: "navy" },
  em_perpetuidade: { label: "Perpetuidade", color: "#0e1c2f", tone: "navy" },
  interditada: { label: "Interditada", color: "#b03535", tone: "danger" },
};
const STATUS_COLORS = Object.fromEntries(
  Object.entries(STATUS_META).map(([k, v]) => [k, v.color])
);
const statusLabel = (s) => STATUS_META[s]?.label || s;

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
  const fileInputRef = useRef(null);
  const mapApiRef = useRef(null);
  const onMapApi = useCallback((api) => {
    mapApiRef.current = api;
  }, []);

  const [cemetery, setCemetery] = useState(null);
  const [query, setQuery] = useState("");

  // ortofoto
  const [preferredOrthoId, setPreferredOrthoId] = useState(null);
  const [positioning, setPositioning] = useState(false);
  const [orthoVisible, setOrthoVisible] = useState(true);
  const [orthoOpacity, setOrthoOpacity] = useState(1);
  const [draftCorners, setDraftCorners] = useState(null);
  const [orthoDirty, setOrthoDirty] = useState(false);
  const [orthoRev, setOrthoRev] = useState(0);
  const [orthoMsg, setOrthoMsg] = useState(null);

  // demarcação
  const [demarcTarget, setDemarcTarget] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [demarcMsg, setDemarcMsg] = useState(null);

  // seleção / foco
  const [selectedGrave, setSelectedGrave] = useState(null);
  const [focusGrave, setFocusGrave] = useState(null);

  // RBAC — posicionar/demarcar só admin/operador. Lido após montar para não
  // divergir do HTML do servidor (getUser depende de localStorage → hidratação).
  const [user, setUser] = useState(null);
  useEffect(() => {
    setUser(getUser());
  }, []);
  const canEdit = ["admin", "super_admin", "operador"].includes(user?.role);

  // ---- dados ----
  const cemsState = useResource(
    ({ signal }) => listCemeteries({ perPage: 100 }, { signal }),
    []
  );
  const cemeteries = useMemo(
    () => (cemsState.data?.data ?? []).map(adaptCemetery),
    [cemsState.data]
  );

  useEffect(() => {
    if (!cemetery && cemeteries.length) {
      const first = cemeteries.find((c) => c.active) || cemeteries[0];
      setCemetery(first.id);
    }
  }, [cemeteries, cemetery]);

  const ctxState = useResource(
    ({ signal }) =>
      cemetery ? getMapContext(cemetery, { signal }) : Promise.resolve(null),
    [cemetery]
  );
  const ctx = useMemo(
    () => (ctxState.data ? adaptMapContext(ctxState.data) : null),
    [ctxState.data]
  );

  const orthoState = useResource(
    ({ signal }) =>
      cemetery ? listOrthophotos(cemetery, { signal }) : Promise.resolve([]),
    [cemetery]
  );
  const orthophotos = useMemo(
    () => (Array.isArray(orthoState.data) ? orthoState.data : []).map(adaptOrthophoto),
    [orthoState.data]
  );

  const gravesState = useResource(
    ({ signal }) =>
      cemetery ? listMapGraves(cemetery, { signal }) : Promise.resolve({ data: [] }),
    [cemetery]
  );
  const graves = useMemo(() => {
    const raw = gravesState.data;
    const list = Array.isArray(raw) ? raw : raw?.data ?? [];
    return list.map(adaptMapGrave);
  }, [gravesState.data]);

  const { mutate: doUpload, loading: uploading } = useMutation(uploadOrthophoto);
  const { mutate: doSaveOrtho, loading: savingOrtho } = useMutation(updateOrthophoto);
  const { mutate: doSetGeometry, loading: savingGeometry } = useMutation(setGraveGeometry);

  const cem = cemeteries.find((c) => c.id === cemetery);

  // ortofoto ativa a exibir (recém-enviada tem prioridade)
  const activeOrtho = useMemo(() => {
    if (!orthophotos.length) return null;
    if (preferredOrthoId) {
      const m = orthophotos.find((o) => o.id === preferredOrthoId);
      if (m) return m;
    }
    return orthophotos.find((o) => o.active) || orthophotos[0];
  }, [orthophotos, preferredOrthoId]);

  // reset ao trocar de cemitério
  useEffect(() => {
    setPositioning(false);
    setDrawing(false);
    setDemarcTarget(null);
    setSelectedGrave(null);
    setFocusGrave(null);
    setDraftCorners(null);
    setOrthoDirty(false);
    setOrthoMsg(null);
    setDemarcMsg(null);
    setPreferredOrthoId(null);
    setOrthoVisible(true);
  }, [cemetery]);

  // sincroniza opacidade com a ortofoto ativa
  useEffect(() => {
    if (activeOrtho) setOrthoOpacity(activeOrtho.opacity ?? 1);
  }, [activeOrtho?.id]);

  // ortofoto ainda sem posição → já entra no modo de alinhamento
  useEffect(() => {
    if (activeOrtho && !activeOrtho.corners && canEdit) {
      setPositioning(true);
      setOrthoDirty(true);
    }
  }, [activeOrtho?.id, activeOrtho?.corners, canEdit]);

  // centro: contexto → entrada do cemitério → média entre cemitérios → default
  const center = useMemo(() => {
    if (ctx?.center) return ctx.center;
    const lat = cem?.raw?.entranceLatitude;
    const lng = cem?.raw?.entranceLongitude;
    if (lat != null && lng != null) return [Number(lat), Number(lng)];
    const all = cemeteries
      .map((c) => [c.raw?.entranceLatitude, c.raw?.entranceLongitude])
      .filter(([a, b]) => a != null && b != null);
    return averageCenter(all);
  }, [ctx, cem, cemeteries]);

  // objeto de ortofoto entregue ao mapa (rev força remontar na revert)
  const orthoForMap = useMemo(() => {
    if (!activeOrtho || !activeOrtho.fileUrl) return null;
    return {
      id: activeOrtho.id,
      fileUrl: activeOrtho.fileUrl,
      corners: activeOrtho.corners,
      opacity: activeOrtho.opacity,
      rev: orthoRev,
    };
  }, [activeOrtho, orthoRev]);

  // busca de sepulturas
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return graves
      .filter(
        (g) =>
          g.code.toLowerCase().includes(q) ||
          (g.occupant && g.occupant.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [query, graves]);

  const mappedCount = useMemo(() => graves.filter((g) => g.mapped).length, [graves]);

  // ---- ações ----
  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !cemetery) return;
    setOrthoMsg(null);
    try {
      const contentBase64 = await fileToBase64(file);
      const created = await doUpload({
        cemeteryId: cemetery,
        contentBase64,
        fileName: file.name,
        mimeType: file.type || "image/png",
      });
      if (created?.id) setPreferredOrthoId(created.id);
      await orthoState.refetch();
      setOrthoVisible(true);
      setPositioning(true); // já entra no modo de alinhamento
      setOrthoDirty(true);
      setOrthoMsg({
        tone: "info",
        text: "Ortofoto carregada. Arraste os cantos para alinhar sobre o cemitério e salve a posição.",
      });
    } catch (err) {
      setOrthoMsg({ tone: "danger", text: err?.message || "Falha ao enviar a ortofoto." });
    }
  }

  function onCornersChange(corners, meta) {
    setDraftCorners(corners);
    setOrthoDirty(true);
    if (meta?.isNew && !positioning) setPositioning(true);
  }

  async function saveOrthoPosition() {
    if (!activeOrtho) return;
    setOrthoMsg(null);
    // lê os cantos vigentes direto do overlay (robusto, independe de eventos)
    const liveCorners =
      mapApiRef.current?.getLiveCorners() || draftCorners || activeOrtho.corners;
    if (!liveCorners) {
      setOrthoMsg({ tone: "danger", text: "Nenhuma posição de ortofoto para salvar." });
      return;
    }
    try {
      await doSaveOrtho(activeOrtho.id, {
        corners: liveCorners,
        opacity: orthoOpacity,
        active: true,
      });
      await orthoState.refetch();
      setPositioning(false);
      setOrthoDirty(false);
      setDraftCorners(null);
      setOrthoMsg({ tone: "success", text: "Posição da ortofoto salva." });
    } catch (err) {
      setOrthoMsg({ tone: "danger", text: err?.message || "Não foi possível salvar a posição." });
    }
  }

  function cancelPositioning() {
    setPositioning(false);
    setOrthoDirty(false);
    setDraftCorners(null);
    setOrthoRev((r) => r + 1); // remonta o overlay nos cantos salvos
    setOrthoMsg(null);
  }

  function startDemarcation() {
    if (!demarcTarget) return;
    setPositioning(false);
    setDemarcMsg(null);
    setDrawing(true);
  }

  async function onGravePolygon({ geoPolygon, latitude, longitude }) {
    setDrawing(false);
    if (!demarcTarget) return;
    setDemarcMsg(null);
    try {
      await doSetGeometry(demarcTarget.id, { geoPolygon, latitude, longitude });
      await gravesState.refetch();
      setDemarcMsg({
        tone: "success",
        text: `Sepultura ${demarcTarget.code} demarcada.`,
      });
      setDemarcTarget(null);
    } catch (err) {
      setDemarcMsg({ tone: "danger", text: err?.message || "Não foi possível salvar a demarcação." });
    }
  }

  function pickGrave(g, { demarc = false } = {}) {
    setQuery("");
    if (demarc) {
      setDemarcTarget(g);
    } else {
      setSelectedGrave(g);
      setFocusGrave({ id: g.id, nonce: Date.now() });
    }
  }

  function onGraveClick(id) {
    const g = graves.find((x) => x.id === id);
    if (g) setSelectedGrave(g);
  }

  const workspaceLoading = cemsState.loading || (cemeteries.length > 0 && !cem);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Mapa</h1>
          <p className={styles.subtitle}>
            Base OpenStreetMap · ortofoto georreferenciada · demarcação de sepulturas
          </p>
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
              {!cemsState.loading && !cemeteries.length && (
                <option value="">Nenhum cemitério</option>
              )}
              {cemeteries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          {canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className={styles.hiddenFile}
                onChange={handleFile}
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={!cem || uploading}
                loading={uploading}
                iconLeft={
                  <svg viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 10V2m0 0L5 5m3-3 3 3M3 12v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              >
                Carregar ortofoto
              </Button>
            </>
          )}
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
          message="Cadastre um cemitério em Cemitérios para carregar a ortofoto e demarcar sepulturas sobre o mapa real."
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
            {/* busca */}
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
                      <div
                        className={styles.resultRow}
                        role="button"
                        tabIndex={0}
                        onClick={() => pickGrave(g)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") pickGrave(g);
                        }}
                      >
                        <span
                          className={styles.resultDot}
                          style={{ background: STATUS_COLORS[g.status] || "#032e59" }}
                        />
                        <span className={styles.resultInfo}>
                          <span className={styles.resultCode}>{g.code}</span>
                          <span className={styles.resultMeta}>
                            {g.occupant || statusLabel(g.status)}
                            {g.block ? ` · ${g.block}` : ""}
                            {g.mapped ? " · demarcada" : ""}
                          </span>
                        </span>
                        {canEdit && (
                          <button
                            className={styles.resultDemarc}
                            onClick={(e) => {
                              e.stopPropagation();
                              pickGrave(g, { demarc: true });
                            }}
                            title="Selecionar para demarcar"
                          >
                            Demarcar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ortofoto */}
            <section className={styles.panelSection}>
              <span className={styles.panelLabel}>Ortofoto</span>
              {!activeOrtho ? (
                <p className={styles.hint}>
                  {canEdit
                    ? "Carregue a ortofoto (imagem aérea) e posicione-a sobre o cemitério para georreferenciar o mapa."
                    : "Nenhuma ortofoto posicionada neste cemitério."}
                </p>
              ) : (
                <>
                  <div className={styles.rowBetween}>
                    <span className={styles.rowLabel}>Exibir ortofoto</span>
                    <Switch
                      checked={orthoVisible}
                      onChange={() => setOrthoVisible((v) => !v)}
                    />
                  </div>
                  <div className={styles.opacityRow}>
                    <span className={styles.rowLabel}>Opacidade</span>
                    <input
                      type="range"
                      min="0.2"
                      max="1"
                      step="0.05"
                      value={orthoOpacity}
                      onChange={(e) => {
                        setOrthoOpacity(Number(e.target.value));
                        if (positioning) setOrthoDirty(true);
                      }}
                      className={styles.range}
                      disabled={!orthoVisible}
                    />
                    <span className={styles.opacityVal}>
                      {Math.round(orthoOpacity * 100)}%
                    </span>
                  </div>
                  <p className={styles.statusLine}>
                    {activeOrtho.corners ? (
                      <Badge tone="success" dot>
                        Georreferenciada
                      </Badge>
                    ) : (
                      <Badge tone="warning" dot>
                        Aguardando posicionamento
                      </Badge>
                    )}
                  </p>
                  {canEdit &&
                    (positioning ? (
                      <div className={styles.btnRow}>
                        <Button
                          size="sm"
                          onClick={saveOrthoPosition}
                          loading={savingOrtho}
                        >
                          Salvar posição
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelPositioning}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setDrawing(false);
                          setPositioning(true);
                        }}
                      >
                        Posicionar ortofoto
                      </Button>
                    ))}
                </>
              )}
              {orthoMsg && (
                <div className={styles.msg}>
                  <Alert tone={orthoMsg.tone}>{orthoMsg.text}</Alert>
                </div>
              )}
            </section>

            {/* demarcação */}
            {canEdit && (
              <section className={styles.panelSection}>
                <span className={styles.panelLabel}>Demarcar sepultura</span>
                {demarcTarget ? (
                  <div className={styles.targetCard}>
                    <div>
                      <span className={styles.targetCode}>{demarcTarget.code}</span>
                      <span className={styles.targetMeta}>
                        {demarcTarget.occupant || statusLabel(demarcTarget.status)}
                      </span>
                    </div>
                    <button
                      className={styles.targetClear}
                      onClick={() => {
                        setDemarcTarget(null);
                        setDrawing(false);
                      }}
                      aria-label="Limpar seleção"
                    >
                      <svg viewBox="0 0 16 16" fill="none">
                        <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <p className={styles.hint}>
                    Selecione uma sepultura na busca (botão “Demarcar”) e desenhe o
                    contorno da cova sobre a ortofoto.
                  </p>
                )}
                {demarcTarget &&
                  (drawing ? (
                    <Button variant="ghost" size="sm" onClick={() => setDrawing(false)}>
                      Cancelar desenho
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={startDemarcation}
                      loading={savingGeometry}
                      disabled={!activeOrtho?.corners}
                    >
                      Desenhar contorno
                    </Button>
                  ))}
                {!activeOrtho?.corners && demarcTarget && (
                  <p className={styles.hintSm}>
                    Posicione a ortofoto antes de demarcar.
                  </p>
                )}
                {demarcMsg && (
                  <div className={styles.msg}>
                    <Alert tone={demarcMsg.tone}>{demarcMsg.text}</Alert>
                  </div>
                )}
                <p className={styles.mappedInfo}>
                  {mappedCount} de {graves.length} sepulturas demarcadas
                </p>
              </section>
            )}

            {/* legenda */}
            <section className={styles.panelSection}>
              <span className={styles.panelLabel}>Situação das sepulturas</span>
              <div className={styles.legend}>
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <div key={key} className={styles.legendRow}>
                    <span className={styles.legendDot} style={{ background: meta.color }} />
                    <span className={styles.legendLabel}>{meta.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          {/* ---------- mapa ---------- */}
          <div className={styles.mapArea}>
            <CemeteryMap
              onApi={onMapApi}
              center={center}
              orthophoto={orthoForMap}
              orthoVisible={orthoVisible}
              orthoOpacity={orthoOpacity}
              positioning={positioning}
              graves={graves}
              layers={ctx?.layers}
              drawing={drawing}
              focusGrave={focusGrave}
              statusColors={STATUS_COLORS}
              canEdit={canEdit}
              onCornersChange={onCornersChange}
              onGravePolygon={onGravePolygon}
              onGraveClick={onGraveClick}
              height="100%"
            />

            {positioning && (
              <div className={styles.banner}>
                <span className={styles.bannerText}>
                  <strong>Posicionando ortofoto</strong> — arraste, escale e rotacione os
                  cantos para alinhar sobre o cemitério
                </span>
                <div className={styles.bannerActions}>
                  <Button variant="ghost" size="sm" onClick={cancelPositioning}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={saveOrthoPosition} loading={savingOrtho}>
                    Salvar posição
                  </Button>
                </div>
              </div>
            )}

            {drawing && (
              <div className={styles.banner}>
                <span className={styles.bannerText}>
                  <strong>Demarcando {demarcTarget?.code}</strong> — clique para adicionar
                  vértices e finalize no primeiro ponto
                </span>
                <div className={styles.bannerActions}>
                  <Button variant="ghost" size="sm" onClick={() => setDrawing(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {orthoState.error && !activeOrtho && (
              <div className={styles.floatNote}>
                <Alert tone="warning">
                  Não foi possível carregar a ortofoto deste cemitério.
                </Alert>
              </div>
            )}

            {selectedGrave && (
              <div className={styles.graveCard}>
                <header className={styles.graveCardHead}>
                  <div>
                    <span className={styles.graveCode}>{selectedGrave.code}</span>
                    {selectedGrave.block && (
                      <span className={styles.graveTrail}>{selectedGrave.block}</span>
                    )}
                  </div>
                  <button
                    className={styles.closeCard}
                    onClick={() => setSelectedGrave(null)}
                    aria-label="Fechar"
                  >
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </header>
                <div className={styles.graveCardBody}>
                  <Badge tone={STATUS_META[selectedGrave.status]?.tone || "navy"}>
                    {statusLabel(selectedGrave.status)}
                  </Badge>
                  {selectedGrave.occupant && (
                    <p className={styles.graveOccupant}>{selectedGrave.occupant}</p>
                  )}
                  {!selectedGrave.mapped && (
                    <p className={styles.graveHint}>Sepultura ainda não demarcada.</p>
                  )}
                </div>
                <footer className={styles.graveCardFoot}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setFocusGrave({ id: selectedGrave.id, nonce: Date.now() })
                    }
                  >
                    Localizar no mapa
                  </Button>
                  {canEdit && (
                    <Button
                      size="sm"
                      onClick={() => pickGrave(selectedGrave, { demarc: true })}
                    >
                      Demarcar
                    </Button>
                  )}
                </footer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
