"use client";

/* ============================================================================
 * LocationPicker — escolhe UM ponto (lat/lng) no mapa REAL (Leaflet + OSM).
 * Usado para a "entrada do cemitério" (origem das rotas GPS do visitante).
 *
 * CLIENT-ONLY: o Leaflet depende de `window`. Carregue via next/dynamic
 * { ssr:false }. Clicar no mapa posiciona/reposiciona o marcador e emite
 * [lat, lng] reais via onChange.
 * ==========================================================================*/

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import styles from "./LocationPicker.module.css";

const DEFAULT_CENTER = [-15.7801, -47.9292]; // Brasil (sem ponto ainda)
const DEFAULT_ZOOM = 4;
const POINT_ZOOM = 18;

export default function LocationPicker({ value = null, onChange, height = 380 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const LRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // init do mapa (uma vez)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default || leaflet;
      if (!mounted || !containerRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(containerRef.current, {
        center: value || DEFAULT_CENTER,
        zoom: value ? POINT_ZOOM : DEFAULT_ZOOM,
        maxZoom: 22,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxNativeZoom: 19,
        maxZoom: 22,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;

      const place = (latlng) => {
        if (markerRef.current) markerRef.current.setLatLng(latlng);
        else {
          markerRef.current = L.circleMarker(latlng, {
            radius: 9,
            color: "#0b6b45",
            weight: 3,
            fillColor: "#12a566",
            fillOpacity: 0.9,
          }).addTo(map);
        }
        onChangeRef.current?.([latlng.lat, latlng.lng]);
      };

      if (value) place(L.latLng(value[0], value[1]));
      map.on("click", (e) => place(e.latlng));

      // o mapa costuma montar dentro de um modal que anima → recalcula o tamanho
      setTimeout(() => map.invalidateSize(), 120);
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reflete "Limpar ponto" (value → null) removendo o marcador
  useEffect(() => {
    if (!mapRef.current) return;
    if (!value && markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [value]);

  return <div ref={containerRef} className={styles.map} style={{ height }} />;
}
