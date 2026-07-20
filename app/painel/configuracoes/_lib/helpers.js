"use client";

/**
 * Helpers puros compartilhados pelos tópicos do hub de Configurações.
 * (Pasta _lib → privada no App Router: não vira rota.)
 */
import { maskPhone } from "@/lib/masks";

// Papéis que podem EDITAR (a API também garante: 403 caso contrário).
export const EDIT_ROLES = new Set(["admin", "super_admin"]);

// CNPJ 00.000.000/0000-00 (não há maskCnpj na fundação → helper local).
export function maskCnpj(value = "") {
  const d = String(value).replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// Telefone/WhatsApp BR: descarta o DDI (+55) antes de formatar.
export function maskPhoneBr(value = "") {
  let d = String(value).replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return maskPhone(d);
}

// hex #RGB/#RRGGBB válido?
export function isHex(v) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v || ""));
}

export function safeColor(v, fallback) {
  return isHex(v) ? v : fallback;
}

// Escurece um hex por um fator (0..1) — usado p/ derivar o tom "deep" do navy
// no preview ao vivo da sidebar de Configurações.
export function darken(hex, factor = 0.7) {
  const h = String(hex || "").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full || "000000", 16);
  const clamp = (x) => Math.max(0, Math.min(255, Math.round(x)));
  const r = clamp(((n >> 16) & 255) * factor);
  const g = clamp(((n >> 8) & 255) * factor);
  const b = clamp((n & 255) * factor);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
