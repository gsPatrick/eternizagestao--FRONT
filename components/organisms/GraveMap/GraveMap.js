"use client";

/* ============================================================================
 * GraveMap — mapa REAL (Leaflet/OSM + ortofoto) de UMA sepultura.
 *
 * Wrapper fino sobre o CemeteryMap para as telas de cadastro (detalhe da
 * sepultura, sepultamentos, sepultados). Substitui o antigo MapCanvas/MapStudio
 * esquemático (que desenhava em PIXELS da imagem) — aqui a demarcação é sempre
 * geoPolygon em [lat,lng] REAIS, o MESMO formato do menu "Mapa" e do portal
 * público. Assim uma cova demarcada em qualquer tela aparece igual em todas.
 *
 * Busca sozinho a ortofoto ativa + o contexto (centro) do cemitério e, quando
 * `editable`, embute o botão "Demarcar/Editar" e o desenho do contorno.
 * ==========================================================================*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import Button from "@/components/atoms/Button/Button";
import Alert from "@/components/molecules/Alert/Alert";
import { useResource, useMutation } from "@/lib/api/useResource";
import {
  listOrthophotos,
  getMapContext,
  setGraveGeometry,
  adaptOrthophoto,
  adaptMapContext,
} from "@/lib/api/resources/map";
import styles from "./GraveMap.module.css";

// Leaflet depende de `window` → client-only (sem SSR).
const CemeteryMap = dynamic(
  () => import("@/components/organisms/CemeteryMap/CemeteryMap"),
  { ssr: false, loading: () => <div className={styles.loading} /> }
);

// cores por situação (mesmas do menu "Mapa" — design system)
const STATUS_COLORS = {
  livre: "#1a7f5c",
  ocupada: "#032e59",
  reservada: "#9a6b15",
  em_manutencao: "#5b8ac2",
  em_perpetuidade: "#0e1c2f",
  interditada: "#b03535",
};

function toPair(v) {
  if (Array.isArray(v) && v.length >= 2) {
    const a = Number(v[0]);
    const b = Number(v[1]);
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
  }
  return null;
}

// aceita SÓ array [[lat,lng],...] (formato real). Objetos {kind,points} do
// editor esquemático legado viram null (não são coordenadas geográficas).
function normalizePolygon(poly) {
  if (!Array.isArray(poly)) return null;
  const pts = poly.map(toPair).filter(Boolean);
  return pts.length >= 3 ? pts : null;
}

function centroid(points) {
  const s = points.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [s[0] / points.length, s[1] / points.length];
}

export default function GraveMap({
  cemeteryId,
  grave, // { id, code, status, occupant, geoPolygon, latitude, longitude }
  editable = false,
  height = 300,
  onSaved,
}) {
  const [drawing, setDrawing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const mapApiRef = useRef(null);
  const onMapApi = useCallback((api) => {
    mapApiRef.current = api;
  }, []);

  const orthoState = useResource(
    ({ signal }) =>
      cemeteryId ? listOrthophotos(cemeteryId, { signal }) : Promise.resolve([]),
    [cemeteryId]
  );
  const ctxState = useResource(
    ({ signal }) =>
      cemeteryId ? getMapContext(cemeteryId, { signal }) : Promise.resolve(null),
    [cemeteryId]
  );

  const orthophotos = useMemo(
    () => (Array.isArray(orthoState.data) ? orthoState.data : []).map(adaptOrthophoto),
    [orthoState.data]
  );
  const activeOrtho = useMemo(
    () => orthophotos.find((o) => o.active) || orthophotos[0] || null,
    [orthophotos]
  );
  const ctx = useMemo(
    () => (ctxState.data ? adaptMapContext(ctxState.data) : null),
    [ctxState.data]
  );

  const { mutate: doSetGeometry, loading: saving } = useMutation(setGraveGeometry);

  // sepultura normalizada para o mapa real
  const poly = useMemo(() => normalizePolygon(grave?.geoPolygon), [grave?.geoPolygon]);
  const lat = grave?.latitude != null ? Number(grave.latitude) : null;
  const lng = grave?.longitude != null ? Number(grave.longitude) : null;
  const mapped = Boolean(poly) || (lat != null && lng != null);

  const graves = useMemo(() => {
    if (!grave?.id) return [];
    return [
      {
        id: grave.id,
        code: grave.code || "—",
        status: grave.status || "livre",
        occupant: grave.occupant || null,
        geoPolygon: poly,
        latitude: lat,
        longitude: lng,
        mapped,
      },
    ];
  }, [grave, poly, lat, lng, mapped]);

  // centro: polígono → ponto → contexto do cemitério → cantos da ortofoto
  const center = useMemo(() => {
    if (poly) return centroid(poly);
    if (lat != null && lng != null) return [lat, lng];
    if (ctx?.center) return ctx.center;
    const c = activeOrtho?.corners;
    if (c) return centroid([c.tl, c.tr, c.br, c.bl]);
    return null;
  }, [poly, lat, lng, ctx, activeOrtho]);

  // ortofoto entregue ao mapa só quando POSICIONADA (tem cantos)
  const orthoForMap = useMemo(() => {
    if (!activeOrtho?.fileUrl || !activeOrtho.corners) return null;
    return {
      id: activeOrtho.id,
      fileUrl: activeOrtho.fileUrl,
      corners: activeOrtho.corners,
      opacity: activeOrtho.opacity,
      rev: 0,
    };
  }, [activeOrtho]);

  const focusGrave = useMemo(
    () => (mapped && grave?.id ? { id: grave.id, nonce: focusNonce } : null),
    [mapped, grave?.id, focusNonce]
  );

  // recentraliza quando a geometria/centro chega
  useEffect(() => {
    if (mapped) setFocusNonce((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapped, grave?.id, center && center[0]]);

  async function onGravePolygon({ geoPolygon, latitude, longitude }) {
    setDrawing(false);
    setMsg(null);
    if (!grave?.id) return;
    try {
      await doSetGeometry(grave.id, { geoPolygon, latitude, longitude });
      setMsg({ tone: "success", text: `Sepultura ${grave.code} demarcada.` });
      onSaved && onSaved();
    } catch (err) {
      setMsg({
        tone: "danger",
        text: err?.message || "Não foi possível salvar a demarcação.",
      });
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.mapArea} style={{ height }}>
        <CemeteryMap
          onApi={onMapApi}
          center={center}
          orthophoto={orthoForMap}
          orthoVisible
          orthoOpacity={activeOrtho?.opacity ?? 1}
          positioning={false}
          graves={graves}
          layers={ctx?.layers}
          drawing={drawing}
          focusGrave={focusGrave}
          statusColors={STATUS_COLORS}
          canEdit={editable}
          onGravePolygon={onGravePolygon}
          height="100%"
        />

        {drawing && (
          <div className={styles.banner}>
            <span className={styles.bannerText}>
              <strong>Demarcando {grave?.code}</strong> — clique para adicionar os
              vértices e finalize no primeiro ponto
            </span>
            <Button variant="ghost" size="sm" onClick={() => setDrawing(false)}>
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {editable && (
        <div className={styles.foot}>
          {!drawing ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setMsg(null);
                setDrawing(true);
              }}
              loading={saving}
            >
              {mapped ? "Editar demarcação" : "Demarcar no mapa"}
            </Button>
          ) : (
            <span className={styles.hint}>
              Desenhe o contorno da cova sobre a ortofoto.
            </span>
          )}
          {!activeOrtho?.corners && !drawing && (
            <span className={styles.hint}>
              Para usar a imagem aérea como base, posicione a ortofoto na página{" "}
              <strong>Mapa</strong>.
            </span>
          )}
        </div>
      )}

      {msg && (
        <div className={styles.msg}>
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}
    </div>
  );
}
