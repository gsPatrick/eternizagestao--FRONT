import { api } from "@/lib/api/client";

/* ------------------------------------------------------------------ *
 * Endpoints (funções finas — uma por rota real de imports.routes.js) *
 *   GET    /imports                → lista paginada de lotes          *
 *   GET    /imports/:id            → lote + recordCounts              *
 *   GET    /imports/:id/records    → linhas do lote (paginado)        *
 *   POST   /imports                → cria lote (createBatch)          *
 *   POST   /imports/:id/validate   → validação linha a linha          *
 *   POST   /imports/:id/commit     → efetivação (via fila)            *
 *   PATCH  /imports/:id/cancel     → cancela o lote                   *
 * ------------------------------------------------------------------ */

export const listBatches = (params, opts) =>
  api.get("/imports", { params, meta: true, ...opts });

export const getBatch = (id, opts) => api.get(`/imports/${id}`, opts);

export const listBatchRecords = (id, params, opts) =>
  api.get(`/imports/${id}/records`, { params, meta: true, ...opts });

export const createBatch = (body) => api.post("/imports", body);
export const validateBatch = (id) => api.post(`/imports/${id}/validate`, {});
export const commitBatch = (id) => api.post(`/imports/${id}/commit`, {});
export const cancelBatch = (id) => api.patch(`/imports/${id}/cancel`, {});

/* ------------------------------------------------------------------ *
 * Campos de destino por escopo — nomes REAIS aceitos pelo importer   *
 * da API (imports.service.js). `aliases` alimentam o de-para         *
 * automático com os cabeçalhos do sistema antigo.                    *
 * O front usa a chave `pessoas`; a API faz o alias → `proprietarios`.*
 * ------------------------------------------------------------------ */

export const ENTITY_FIELDS = {
  sepulturas: [
    { value: "code", label: "Código da sepultura", required: true, aliases: ["codigo", "codjazigo", "jazigo", "sepultura"] },
    { value: "lotId", label: "Lote (ID)", required: true, aliases: ["lote", "loteid", "quadra"] },
    { value: "unitType", label: "Tipo", aliases: ["tipo", "tipounidade"] },
    { value: "status", label: "Status", aliases: ["situacao", "statussepultura"] },
    { value: "capacity", label: "Capacidade", aliases: ["capacidade", "gavetas"] },
    { value: "notes", label: "Observações", aliases: ["obs", "observacoes"] },
  ],
  sepultados: [
    { value: "fullName", label: "Nome completo", required: true, aliases: ["nome", "nomefalecido", "falecido", "nomecompleto"] },
    { value: "cpf", label: "CPF", aliases: ["cpf", "cpffalecido", "documento"] },
    { value: "birthDate", label: "Data de nascimento", aliases: ["nascimento", "dtnasc", "datanascimento"] },
    { value: "deathDate", label: "Data de óbito", aliases: ["obito", "dtobito", "dataobito", "falecimento"] },
    { value: "gender", label: "Sexo", aliases: ["sexo", "genero"] },
    { value: "motherName", label: "Nome da mãe", aliases: ["mae", "nomemae"] },
    { value: "fatherName", label: "Nome do pai", aliases: ["pai", "nomepai"] },
    { value: "causeOfDeath", label: "Causa do óbito", aliases: ["causa", "causamorte", "causaobito"] },
    { value: "deathCertificateNumber", label: "Nº da certidão de óbito", aliases: ["certidao", "certidaoobito"] },
    { value: "graveCode", label: "Código da sepultura (vínculo)", aliases: ["jazigo", "codjazigo", "sepultura"] },
    { value: "notes", label: "Observações", aliases: ["obs", "observacoes"] },
  ],
  pessoas: [
    { value: "fullName", label: "Nome completo", required: true, aliases: ["nome", "responsavel", "concessionario", "nomecompleto"] },
    { value: "cpf", label: "CPF", aliases: ["cpf", "documento"] },
    { value: "rg", label: "RG", aliases: ["rg", "identidade"] },
    { value: "birthDate", label: "Data de nascimento", aliases: ["nascimento", "dtnasc"] },
    { value: "gender", label: "Sexo", aliases: ["sexo", "genero"] },
    { value: "email", label: "E-mail", aliases: ["email", "correio"] },
    { value: "phonePrimary", label: "Telefone", aliases: ["telefone", "fone", "tel"] },
    { value: "whatsapp", label: "WhatsApp", aliases: ["whatsapp", "celular", "zap"] },
    { value: "addressStreet", label: "Logradouro", aliases: ["endereco", "logradouro", "rua"] },
    { value: "addressCity", label: "Cidade", aliases: ["cidade", "municipio"] },
    { value: "addressState", label: "UF", aliases: ["uf", "estado"] },
    { value: "addressZipcode", label: "CEP", aliases: ["cep", "codigopostal"] },
    { value: "notes", label: "Observações", aliases: ["obs", "observacoes"] },
  ],
  concessoes: [
    { value: "cpf", label: "CPF do concessionário", required: true, aliases: ["cpf", "cpfconcessionario", "documento"] },
    { value: "graveCode", label: "Código da sepultura", required: true, aliases: ["jazigo", "codjazigo", "sepultura", "codigo"] },
    { value: "concessionType", label: "Tipo (perpetua/temporaria)", required: true, aliases: ["tipo", "tipoconcessao"] },
    { value: "contractNumber", label: "Nº do contrato", aliases: ["contrato", "numcontrato", "ncontrato"] },
    { value: "startDate", label: "Início (YYYY-MM-DD)", required: true, aliases: ["inicio", "datainicio", "dtinicio"] },
    { value: "endDate", label: "Término", aliases: ["termino", "fim", "datafim", "vencimento"] },
    { value: "value", label: "Valor", aliases: ["valor", "preco"] },
    { value: "notes", label: "Observações", aliases: ["obs", "observacoes"] },
  ],
  cobrancas: [
    { value: "cpf", label: "CPF do pagador", required: true, aliases: ["cpf", "cpfpagador", "documento"] },
    { value: "graveCode", label: "Código da sepultura", aliases: ["jazigo", "codjazigo", "sepultura"] },
    { value: "amount", label: "Valor", required: true, aliases: ["valor", "montante", "debito"] },
    { value: "dueDate", label: "Vencimento (YYYY-MM-DD)", required: true, aliases: ["vencimento", "datavencimento", "dtvenc"] },
    { value: "status", label: "Situação (pago/em_aberto/em_atraso)", required: true, aliases: ["situacao", "status"] },
    { value: "description", label: "Descrição", aliases: ["descricao", "historico"] },
    { value: "referencePeriod", label: "Competência", aliases: ["competencia", "referencia", "periodo"] },
    { value: "paymentDate", label: "Data de pagamento", aliases: ["pagamento", "datapagamento", "dtpgto"] },
  ],
};

/* ------------------------------------------------------------------ *
 * Adaptadores de shape (ImportBatch da API → view model da página)   *
 * ------------------------------------------------------------------ */

// A API chama o escopo `proprietarios`; a página usa `pessoas`.
const SCOPE_TO_ENTITY = { proprietarios: "pessoas" };
export const toEntityKey = (scope) => SCOPE_TO_ENTITY[scope] || scope;

function isoToBr(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

// Código humano do lote (a API não persiste numeração — derivado do id/data).
function batchCode(b) {
  const year = b.createdAt ? new Date(b.createdAt).getFullYear() : new Date().getFullYear();
  const short = String(b.id || "").replace(/-/g, "").slice(0, 4).toUpperCase() || "0000";
  return `IMP-${year}-${short}`;
}

// errorSummary vem como ["Linha 14: cpf inválido; ...", ...] → issues estruturadas.
export function parseIssues(summary) {
  return (summary || []).map((line, i) => {
    const m = /^Linha\s+(\d+):\s*(.*)$/.exec(String(line));
    return m
      ? { line: Number(m[1]), level: "erro", message: m[2] }
      : { line: i + 1, level: "erro", message: String(line) };
  });
}

// Linha inválida (GET /imports/:id/records?status=invalido) → issue.
export function recordToIssue(r) {
  return {
    line: r.rowNumber,
    level: "erro",
    message: (r.validationErrors || []).join("; ") || "Linha inválida",
  };
}

export function toBatchRow(b) {
  const imported = b.status === "importado";
  return {
    id: b.id,
    entityScope: b.entityScope,
    entity: toEntityKey(b.entityScope),
    code: batchCode(b),
    file: b.fileName || b.sourceName || "arquivo importado",
    total: b.totalRecords ?? 0,
    // A validação da API é binária (válido/inválido) — não há severidade "aviso".
    ok: imported ? (b.importedRecords ?? 0) : (b.validRecords ?? 0),
    warnings: 0,
    errors: b.invalidRecords ?? 0,
    imported: b.importedRecords ?? 0,
    valid: b.validRecords ?? 0,
    invalid: b.invalidRecords ?? 0,
    sentBy: b.createdBy?.name || "—",
    sentAt: isoToBr(b.createdAt),
    status: b.status,
    errorSummary: b.errorSummary || [],
    issues: parseIssues(b.errorSummary),
  };
}

/* ------------------------------------------------------------------ *
 * Leitura do arquivo (CSV nativo — sem dependências novas) e de-para *
 * ------------------------------------------------------------------ */

// Parser CSV tolerante: detecta delimitador (; , tab), respeita aspas.
export function parseCsv(text) {
  const clean = String(text || "")
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const nl = clean.indexOf("\n");
  const firstLine = nl === -1 ? clean : clean.slice(0, nl);
  const delim = [";", "\t", ","]
    .map((d) => [d, firstLine.split(d).length])
    .sort((a, b) => b[1] - a[1])[0][0];

  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i += 1) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
  const headers = (nonEmpty.shift() || []).map((h) => String(h).trim());
  return { headers, rows: nonEmpty };
}

const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

// De-para automático: casa cabeçalho do arquivo com um campo do sistema.
export function guessMapping(headers, fields) {
  return headers.map((source) => {
    const nh = norm(source);
    let target = "";
    if (nh) {
      for (const f of fields) {
        const cands = [f.value, f.label, ...(f.aliases || [])].map(norm).filter(Boolean);
        if (cands.some((c) => c === nh || nh.includes(c) || c.includes(nh))) {
          target = f.value;
          break;
        }
      }
    }
    return { source, target, auto: Boolean(target) };
  });
}

// Constrói o array `rows` do createBatch a partir do de-para confirmado.
export function buildRows(dataRows, mapping) {
  return dataRows.map((cells) => {
    const obj = {};
    mapping.forEach((m, i) => {
      if (!m.target) return;
      const v = cells[i];
      if (v !== undefined && String(v).trim() !== "") obj[m.target] = String(v).trim();
    });
    return obj;
  });
}
