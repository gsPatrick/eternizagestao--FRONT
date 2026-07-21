/**
 * Datas em YYYY-MM-DD no fuso LOCAL do usuário.
 *
 * Por que existe: `new Date().toISOString().slice(0,10)` devolve a data em UTC.
 * Às 22h no Brasil (UTC-3) isso já aponta o DIA SEGUINTE — formulários abriam
 * com a data errada (ex.: data do sepultamento) e filtros de "hoje" pulavam um
 * dia. Aqui usamos os getters locais, que respeitam o fuso de quem está usando.
 */
export function toLocalISODate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Data de HOJE (fuso local) em YYYY-MM-DD. */
export const todayISO = () => toLocalISODate();
