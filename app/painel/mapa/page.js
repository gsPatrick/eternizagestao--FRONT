"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geocodeCemetery } from "@/lib/geocode";
import Link from "next/link";
import dynamic from "next/dynamic";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Switch from "@/components/atoms/Switch/Switch";
import Badge from "@/components/atoms/Badge/Badge";
import Select from "@/components/atoms/Select/Select";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import Alert from "@/components/molecules/Alert/Alert";
import ConfirmDelete from "@/components/molecules/ConfirmDelete/ConfirmDelete";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";

import { useResource, useMutation } from "@/lib/api/useResource";
import { getUser } from "@/lib/api/session";
import {
  listCemeteries,
  updateCemetery,
  adaptCemetery,
  getStructure,
  setStructureGeometry,
  flattenStructure,
} from "@/lib/api/resources/cemeteries";
import {
  listOrthophotos,
  uploadOrthophoto,
  updateOrthophoto,
  deleteOrthophoto,
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

  // Volta a ortofoto a um retângulo alinhado ao norte, na proporção real do
  // arquivo, mantendo centro e tamanho. Serve para recuperar de uma distorção
  // acidental sem ter que apagar e reenviar a imagem.
  // ---- limpar ortofotos antigas (envio errado ou arquivo perdido) ----
  const [confirmOrtho, setConfirmOrtho] = useState(null);
  const [removingOrtho, setRemovingOrtho] = useState(false);

  async function removerOrtofoto() {
    setRemovingOrtho(true);
    try {
      await deleteOrthophoto(confirmOrtho.id, { tenant: mapTenant });
      // Se a excluída era a que estava em tela, solta a preferência para a
      // próxima render escolher outra em vez de insistir num id que sumiu.
      setPreferredOrthoId((id) => (id === confirmOrtho.id ? null : id));
      setConfirmOrtho(null);
      setOrthoMsg({ tone: "success", text: "Ortofoto removida." });
      await orthoState.refetch();
    } catch (e) {
      setOrthoMsg({ tone: "danger", text: e?.message || "Não foi possível remover a ortofoto." });
    } finally {
      setRemovingOrtho(false);
    }
  }

  const desentortar = useCallback(() => {
    const cantos = mapApiRef.current?.resetShape?.();
    setOrthoMsg(
      cantos
        ? { tone: "info", text: "Forma redefinida. Arraste para reposicionar e salve." }
        : { tone: "danger", text: "Não foi possível redefinir a forma da ortofoto." }
    );
  }, []);

  const [cemetery, setCemetery] = useState(null);
  const [query, setQuery] = useState("");

  // ortofoto
  const [preferredOrthoId, setPreferredOrthoId] = useState(null);
  const [positioning, setPositioning] = useState(false);
  const [orthoVisible, setOrthoVisible] = useState(true);
  const [basemapVisible, setBasemapVisible] = useState(true);
  const [orthoOpacity, setOrthoOpacity] = useState(1);
  const [draftCorners, setDraftCorners] = useState(null);
  const [orthoDirty, setOrthoDirty] = useState(false);
  const [orthoRev, setOrthoRev] = useState(0);
  const [orthoMsg, setOrthoMsg] = useState(null);

  // A imagem da ortofoto não carregou. O overlay é criado do mesmo jeito, então
  // sem isto a tela mostrava "posicionando ortofoto" sobre um mapa vazio e o
  // operador não tinha como saber o que houve — nem sabia abrir o console.
  const onOrthoError = useCallback((fileUrl) => {
    setOrthoMsg({
      tone: "danger",
      text: `A imagem da ortofoto não pôde ser carregada (${fileUrl ? new URL(fileUrl, window.location.origin).pathname : "URL vazia"}). `
        + "O arquivo pode ter sido removido do servidor ou o link de acesso expirou — reenvie a ortofoto.",
    });
  }, []);

  // demarcação
  const [demarcTarget, setDemarcTarget] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [demarcMsg, setDemarcMsg] = useState(null);
  // desenho: 'grave' (sepultura) | 'layer' (quadra/rua/lote)
  const [drawMode, setDrawMode] = useState(null);

  // camadas (quadra/rua/lote)
  const [layerTarget, setLayerTarget] = useState(null);
  const [layerMsg, setLayerMsg] = useState(null);

  // seleção / foco
  const [selectedGrave, setSelectedGrave] = useState(null);
  const [focusGrave, setFocusGrave] = useState(null);

  // RBAC. Lido após montar para não divergir do HTML do servidor (getUser
  // depende de localStorage → hidratação).
  const [user, setUser] = useState(null);
  // Cidade sob operação do super_admin (via ?t=<subdomínio>, vindo do console
  // da plataforma). Para o super_admin, todas as chamadas do mapa levam o
  // header X-Tenant-Subdomain; para o admin da cidade, o tenant vem do token.
  const [tenantSub, setTenantSub] = useState(null);
  useEffect(() => {
    setUser(getUser());
    const t = new URLSearchParams(window.location.search).get("t");
    if (t) setTenantSub(t);
  }, []);
  const isSuperAdmin = user?.role === "super_admin";
  // Demarcação de sepultura/camada: admin/operador (staff da cidade).
  const canEdit = ["admin", "super_admin", "operador"].includes(user?.role);
  // ORTOFOTO: enviar e POSICIONAR é do ADMIN da cidade — sem posicionar (definir
  // os 4 cantos) a imagem nunca aparece no mapa. Excluir segue só na plataforma.
  const canEditOrtho = ["admin", "super_admin"].includes(user?.role);
  // Tenant a enviar nas chamadas (só para super_admin operando uma cidade).
  const mapTenant = isSuperAdmin ? tenantSub || undefined : undefined;

  // ---- dados ----
  const cemsState = useResource(
    ({ signal }) => listCemeteries({ perPage: 100 }, { signal, tenant: mapTenant }),
    [mapTenant]
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
      cemetery ? getMapContext(cemetery, { signal, tenant: mapTenant }) : Promise.resolve(null),
    [cemetery, mapTenant]
  );
  const ctx = useMemo(
    () => (ctxState.data ? adaptMapContext(ctxState.data) : null),
    [ctxState.data]
  );

  const orthoState = useResource(
    ({ signal }) =>
      cemetery ? listOrthophotos(cemetery, { signal, tenant: mapTenant }) : Promise.resolve([]),
    [cemetery, mapTenant]
  );
  const orthophotos = useMemo(
    () => (Array.isArray(orthoState.data) ? orthoState.data : []).map(adaptOrthophoto),
    [orthoState.data]
  );

  const gravesState = useResource(
    ({ signal }) =>
      cemetery ? listMapGraves(cemetery, { signal, tenant: mapTenant }) : Promise.resolve({ data: [] }),
    [cemetery, mapTenant]
  );
  const graves = useMemo(() => {
    const raw = gravesState.data;
    const list = Array.isArray(raw) ? raw : raw?.data ?? [];
    return list.map(adaptMapGrave);
  }, [gravesState.data]);

  // estrutura (quadras/ruas/lotes) — para demarcar as camadas de navegação
  const structState = useResource(
    ({ signal }) =>
      cemetery ? getStructure(cemetery, { signal, tenant: mapTenant }) : Promise.resolve(null),
    [cemetery, mapTenant]
  );
  const structureFeatures = useMemo(
    () => flattenStructure(structState.data),
    [structState.data]
  );

  const { mutate: doUpload, loading: uploading } = useMutation(uploadOrthophoto);
  const { mutate: doSaveOrtho, loading: savingOrtho } = useMutation(updateOrthophoto);
  const { mutate: doSetGeometry, loading: savingGeometry } = useMutation(setGraveGeometry);
  const { mutate: doSetLayerGeometry, loading: savingLayer } = useMutation(setStructureGeometry);

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
    setDrawMode(null);
    setDemarcTarget(null);
    setLayerTarget(null);
    setLayerMsg(null);
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

  // ortofoto ainda sem posição → já entra no modo de alinhamento (só super_admin)
  useEffect(() => {
    if (activeOrtho && !activeOrtho.corners && canEditOrtho) {
      setPositioning(true);
      setOrthoDirty(true);
    }
  }, [activeOrtho?.id, activeOrtho?.corners, canEditOrtho]);

  // Enquadramento pelo ENDEREÇO quando ainda não há entrada marcada.
  //
  // A entrada é definida clicando no mapa, então exigir a entrada para o mapa se
  // localizar era um ciclo: sem entrada o mapa abria no centro do Brasil e a
  // ortofoto enviada ia parar lá. Agora a ordem correta funciona — envia a
  // ortofoto, posiciona, e só então marca a entrada.
  // É só VISÃO: nada aqui é gravado; a coordenada oficial continua vindo do
  // clique do operador.
  const [addressCenter, setAddressCenter] = useState(null);
  useEffect(() => {
    if (ctx?.center) return; // já tem entrada: não precisa adivinhar
    if (!cem?.raw) return;
    const ac = new AbortController();
    geocodeCemetery(cem.raw, { signal: ac.signal }).then((coord) => {
      if (coord) setAddressCenter(coord);
    });
    return () => ac.abort();
  }, [ctx?.center, cem?.raw]);

  // ---- ENTRADA do cemitério, marcada AQUI (sobre a ortofoto), não no cadastro
  const [markingEntrance, setMarkingEntrance] = useState(false);
  const [savingEntrance, setSavingEntrance] = useState(false);
  const entranceCoord = useMemo(() => {
    const lat = cem?.raw?.entranceLatitude;
    const lng = cem?.raw?.entranceLongitude;
    return lat != null && lng != null ? [Number(lat), Number(lng)] : null;
  }, [cem?.raw]);

  const onEntrancePick = useCallback(async (coord) => {
    if (!cem?.id) return;
    setSavingEntrance(true);
    try {
      await updateCemetery(cem.id, {
        entranceLatitude: coord[0],
        entranceLongitude: coord[1],
      });
      setMarkingEntrance(false);
      setOrthoMsg({ tone: "success", text: "Entrada do cemitério marcada. Ela é a origem das rotas do visitante." });
      await cemsState.refetch();
    } catch (e) {
      setOrthoMsg({ tone: "danger", text: e?.message || "Não foi possível salvar a entrada." });
    } finally {
      setSavingEntrance(false);
    }
  }, [cem?.id]);

  // Centro: a ORTOFOTO POSICIONADA é o mapa do cemitério — ela tem prioridade
  // sobre tudo. Só depois vem a entrada, o endereço e os fallbacks.
  const center = useMemo(() => {
    const c = activeOrtho?.corners;
    if (c && c.tl && c.br) {
      return [(c.tl[0] + c.br[0]) / 2, (c.tl[1] + c.br[1]) / 2];
    }
    if (ctx?.center) return ctx.center;
    if (addressCenter) return addressCenter;
    const lat = cem?.raw?.entranceLatitude;
    const lng = cem?.raw?.entranceLongitude;
    if (lat != null && lng != null) return [Number(lat), Number(lng)];
    const all = cemeteries
      .map((c) => [c.raw?.entranceLatitude, c.raw?.entranceLongitude])
      .filter(([a, b]) => a != null && b != null);
    return averageCenter(all);
  }, [ctx, cem, cemeteries, addressCenter, activeOrtho]);

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
      // envio BINÁRIO (o arquivo cru vai no corpo) — aguenta ortofotos grandes.
      const created = await doUpload(
        { cemeteryId: cemetery, file },
        { tenant: mapTenant }
      );
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
      await doSaveOrtho(
        activeOrtho.id,
        {
          corners: liveCorners,
          opacity: orthoOpacity,
          active: true,
        },
        { tenant: mapTenant }
      );
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
    setLayerTarget(null);
    setDemarcMsg(null);
    setDrawMode("grave");
    setDrawing(true);
  }

  function startLayerDemarcation() {
    if (!layerTarget) return;
    setPositioning(false);
    setDemarcTarget(null);
    setLayerMsg(null);
    setDrawMode("layer");
    setDrawing(true);
  }

  function cancelDrawing() {
    setDrawing(false);
    setDrawMode(null);
  }

  // callback único de polígono: decide entre sepultura e camada pelo drawMode
  async function onGravePolygon({ geoPolygon, latitude, longitude }) {
    setDrawing(false);
    const mode = drawMode;
    setDrawMode(null);

    if (mode === "layer") {
      if (!layerTarget) return;
      setLayerMsg(null);
      try {
        await doSetLayerGeometry(layerTarget.kind, layerTarget.id, geoPolygon);
        await Promise.all([structState.refetch(), ctxState.refetch()]);
        setLayerMsg({ tone: "success", text: `${layerTarget.label} demarcada no mapa.` });
        setLayerTarget(null);
      } catch (err) {
        setLayerMsg({ tone: "danger", text: err?.message || "Não foi possível salvar a camada." });
      }
      return;
    }

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
          {canEditOrtho && (
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
                  {canEditOrtho
                    ? "Carregue a ortofoto (imagem aérea) e posicione-a sobre o cemitério para georreferenciar o mapa."
                    : "Nenhuma ortofoto posicionada neste cemitério. O administrador da prefeitura pode carregar e posicionar a imagem aérea."}
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
                  {/* O mapa de ruas é a REFERÊNCIA para alinhar a ortofoto às
                      ruas reais. Depois de posicionada ele vira ruído — a foto
                      passa a ser o mapa do cemitério —, então dá para desligar.
                      Durante o posicionamento fica travado ligado: sem ele não
                      há como saber se a foto caiu no lugar certo. */}
                  <div className={styles.rowBetween}>
                    <span className={styles.rowLabel}>
                      Mapa de ruas
                      {positioning && <em className={styles.rowHint}> · necessário para alinhar</em>}
                    </span>
                    <Switch
                      checked={positioning ? true : basemapVisible}
                      disabled={positioning}
                      onChange={() => setBasemapVisible((v) => !v)}
                    />
                  </div>
                  {/* Lista das ortofotos do cemitério. Existe para o operador
                      trocar qual está em uso e REMOVER as antigas — envios
                      errados e imagens cujo arquivo se perdeu ficavam para
                      sempre, dando erro de carga a cada abertura do mapa. */}
                  {orthophotos.length > 1 && (
                    <div className={styles.orthoList}>
                      {orthophotos.map((o) => (
                        <div key={o.id} className={styles.orthoItem}>
                          <button
                            type="button"
                            className={styles.orthoName}
                            title="Usar esta ortofoto"
                            onClick={() => setPreferredOrthoId(o.id)}
                          >
                            {o.id === activeOrtho?.id ? "● " : "○ "}
                            {o.raw?.name || "ortofoto"}
                            {o.raw?.createdAt
                              ? ` · ${new Date(o.raw.createdAt).toLocaleDateString("pt-BR")}`
                              : ""}
                            {!o.corners && " · sem posição"}
                          </button>
                          {canEditOrtho && (
                            <button
                              type="button"
                              className={styles.orthoRemove}
                              title="Remover esta ortofoto"
                              onClick={() => setConfirmOrtho(o)}
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
                  {canEditOrtho &&
                    (positioning ? (
                      <div className={styles.btnRow}>
                        <Button
                          size="sm"
                          onClick={saveOrthoPosition}
                          loading={savingOrtho}
                        >
                          Salvar posição
                        </Button>
                        {/* Sem isto, uma foto empenada por engano só se
                            recuperava apagando e reenviando. */}
                        <Button variant="secondary" size="sm" onClick={desentortar}>
                          Desentortar
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

                  {/* ENTRADA: marcada aqui, sobre a ortofoto já posicionada — é o
                      único jeito de acertar o portão de verdade. Saiu do cadastro
                      do cemitério, onde era pedida antes de existir mapa. */}
                  {canEdit && !positioning && (
                    markingEntrance ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={savingEntrance}
                        onClick={() => setMarkingEntrance(false)}
                      >
                        Cancelar marcação
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setDrawing(false);
                          setMarkingEntrance(true);
                          setOrthoMsg({
                            tone: "info",
                            text: "Clique no mapa, sobre o portão do cemitério, para marcar a entrada.",
                          });
                        }}
                      >
                        {entranceCoord ? "Remarcar entrada" : "Marcar entrada"}
                      </Button>
                    )
                  )}
                </>
              )}
              {/* Sem entrada marcada: a entrada é definida CLICANDO no mapa, então
                  ela vem DEPOIS da ortofoto — o mapa se enquadra pelo endereço
                  cadastrado enquanto isso. Dizer a ordem evita o operador ficar
                  procurando uma etapa que não existe. */}
              {!ctx?.center && (
                <div className={styles.msg}>
                  <Alert tone="info" title="Entrada ainda não marcada">
                    {addressCenter
                      ? "O mapa foi enquadrado pelo endereço cadastrado do cemitério. Envie e posicione a ortofoto e, depois, marque a entrada clicando no mapa."
                      : "Sem a entrada e sem endereço com cidade, o mapa abre em vista ampla. Cadastre a cidade do cemitério ou navegue até o local, posicione a ortofoto e marque a entrada em seguida."}
                  </Alert>
                </div>
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
                  (drawing && drawMode === "grave" ? (
                    <Button variant="ghost" size="sm" onClick={cancelDrawing}>
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

            {/* camadas (quadra/rua/lote) */}
            {canEdit && (
              <section className={styles.panelSection}>
                <span className={styles.panelLabel}>Camadas (quadra/rua/lote)</span>
                <p className={styles.hint}>
                  Desenhe o contorno das quadras, ruas e lotes para as camadas de
                  navegação e organização do cemitério.
                </p>
                <div className={styles.cemeterySelect}>
                  <Select
                    value={layerTarget?.id || ""}
                    onChange={(e) => {
                      const f = structureFeatures.find((x) => x.id === e.target.value);
                      setLayerTarget(f || null);
                      setLayerMsg(null);
                    }}
                    aria-label="Quadra, rua ou lote"
                    disabled={structState.loading || !structureFeatures.length}
                  >
                    <option value="">
                      {structState.loading
                        ? "Carregando estrutura…"
                        : !structureFeatures.length
                        ? "Nenhuma quadra/rua/lote cadastrada"
                        : "Selecione quadra/rua/lote…"}
                    </option>
                    {structureFeatures.map((f) => (
                      <option key={`${f.kind}-${f.id}`} value={f.id}>
                        {f.label}
                        {f.hasGeo ? " · demarcada" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                {layerTarget &&
                  (drawing && drawMode === "layer" ? (
                    <Button variant="ghost" size="sm" onClick={cancelDrawing}>
                      Cancelar desenho
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={startLayerDemarcation}
                      loading={savingLayer}
                    >
                      {layerTarget.hasGeo ? "Redesenhar contorno" : "Desenhar contorno"}
                    </Button>
                  ))}
                {layerMsg && (
                  <div className={styles.msg}>
                    <Alert tone={layerMsg.tone}>{layerMsg.text}</Alert>
                  </div>
                )}
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
              onOrthoError={onOrthoError}
              basemapVisible={positioning ? true : basemapVisible}
              markingEntrance={markingEntrance}
              entrance={entranceCoord}
              onEntrancePick={onEntrancePick}
              height="100%"
            />

            {/* Reenquadra no cemitério/ortofoto — evita se perder ao navegar */}
            <button
              type="button"
              className={styles.locateBtn}
              onClick={() => mapApiRef.current?.locate()}
              title="Voltar para o cemitério / ortofoto"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M8 1.4v2.2M8 12.4v2.2M14.6 8h-2.2M3.6 8H1.4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Localizar
            </button>

            {positioning && (
              <div className={styles.banner}>
                <span className={styles.bannerText}>
                  <strong>Posicionando ortofoto</strong> — arraste para mover; use a barra
                  do overlay para escalar, girar ou distorcer
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
                  <strong>
                    {drawMode === "layer"
                      ? `Demarcando ${layerTarget?.label}`
                      : `Demarcando ${demarcTarget?.code}`}
                  </strong>{" "}
                  — clique para adicionar vértices e finalize no primeiro ponto
                </span>
                <div className={styles.bannerActions}>
                  <Button variant="ghost" size="sm" onClick={cancelDrawing}>
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
      <ConfirmDelete
        open={Boolean(confirmOrtho)}
        onClose={() => setConfirmOrtho(null)}
        onConfirm={removerOrtofoto}
        loading={removingOrtho}
        title="Excluir ortofoto"
        name={confirmOrtho?.raw?.name || "esta ortofoto"}
        description="A imagem sai do mapa e o arquivo é removido. As sepulturas já demarcadas continuam onde estão."
      />

    </div>
  );
}
