"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Badge from "@/components/atoms/Badge/Badge";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import EntrancePicker, { formatGps } from "@/components/molecules/EntrancePicker/EntrancePicker";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";

import { useResource, useMutation } from "@/lib/api/useResource";
import {
  getCemetery,
  getStructure,
  createBlock,
  createStreet,
  createLot,
  updateCemetery,
  adaptCemetery,
  adaptStructure,
  cemeteryInitial,
} from "@/lib/api/resources/cemeteries";

// "São Paulo — SP" → { addressCity, addressState }
function parseCityUf(value = "") {
  const [city, uf] = value.split(/[—-]/).map((p) => p.trim());
  return { addressCity: city || undefined, addressState: (uf || "").slice(0, 2).toUpperCase() || undefined };
}

export default function CemeteryDetailPage() {
  const params = useParams();
  const cemeteryId = params.id;

  const { data, loading, error, refetch } = useResource(
    ({ signal }) =>
      Promise.all([
        getCemetery(cemeteryId, { signal }),
        getStructure(cemeteryId, { signal }),
      ]),
    [cemeteryId]
  );

  const cemetery = useMemo(() => (data ? adaptCemetery(data[0]) : null), [data]);
  const structure = useMemo(() => (data ? adaptStructure(data[1]?.blocks) : []), [data]);

  const [entrance, setEntrance] = useState(null); // [lat, lng] real
  const [path, setPath] = useState({ block: null, street: null });
  const [configOpen, setConfigOpen] = useState(false);
  const [addLevel, setAddLevel] = useState(null); // 'block' | 'street' | 'lot'
  const [addForm, setAddForm] = useState({ name: "", code: "" });
  const [addError, setAddError] = useState(null);
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState(null);

  // posiciona o marcador de entrada a partir do GPS salvo (quando existir)
  useEffect(() => {
    if (!cemetery) return;
    const lat = cemetery.raw.entranceLatitude;
    const lng = cemetery.raw.entranceLongitude;
    if (lat != null && lng != null) setEntrance([Number(lat), Number(lng)]);
  }, [cemetery]);

  const { mutate: doCreateBlock, loading: creatingBlock } = useMutation(createBlock);
  const { mutate: doCreateStreet, loading: creatingStreet } = useMutation(createStreet);
  const { mutate: doCreateLot, loading: creatingLot } = useMutation(createLot);
  const { mutate: doUpdate, loading: savingConfig } = useMutation(updateCemetery);
  const creating = creatingBlock || creatingStreet || creatingLot;

  const block = path.block ? structure.find((b) => b.id === path.block) : null;
  const street = block && path.street ? block.streets.find((s) => s.id === path.street) : null;

  async function addItem() {
    setAddError(null);
    const code = addForm.code?.trim();
    if (!code) return;
    // todos os níveis exigem name+code na API; para lote usamos o próprio código.
    const name = addForm.name?.trim() || (addLevel === "lot" ? code : code);
    try {
      if (addLevel === "block") {
        await doCreateBlock(cemeteryId, { name, code });
      } else if (addLevel === "street") {
        await doCreateStreet(path.block, { name, code });
      } else if (addLevel === "lot") {
        await doCreateLot(path.street, { name, code });
      }
      setAddForm({ name: "", code: "" });
      setAddLevel(null);
      refetch();
    } catch (e) {
      setAddError(e?.message || "Não foi possível criar o registro.");
    }
  }

  function openConfig() {
    setConfigError(null);
    setConfig({
      name: cemetery.name,
      code: cemetery.raw.code || "",
      city: cemetery.city === "—" ? "" : cemetery.city,
      address: cemetery.address === "—" ? "" : cemetery.address,
      color: cemetery.color,
      color2: cemetery.color2,
      organ: cemetery.raw.managerName || "",
      cnpj: cemetery.raw.managerDocument || "",
      phone: cemetery.raw.managerPhone || "",
      email: cemetery.raw.managerEmail || "",
    });
    setConfigOpen(true);
  }

  async function saveConfig() {
    setConfigError(null);
    const { addressCity, addressState } = parseCityUf(config.city);
    const body = {
      name: config.name?.trim(),
      code: config.code?.trim() || null,
      addressStreet: config.address?.trim() || null,
      addressCity,
      addressState,
      brandPrimaryColor: config.color || null,
      brandSecondaryColor: config.color2 || null,
      managerName: config.organ?.trim() || null,
      managerDocument: config.cnpj?.trim() || null,
      managerPhone: config.phone?.trim() || null,
      managerEmail: config.email?.trim() || null,
      entranceLatitude: entrance ? entrance[0] : null,
      entranceLongitude: entrance ? entrance[1] : null,
    };
    try {
      await doUpdate(cemeteryId, body);
      setConfigOpen(false);
      refetch();
    } catch (e) {
      setConfigError(e?.message || "Não foi possível salvar as configurações.");
    }
  }

  const levelLabel = addLevel === "block" ? "Nova quadra" : addLevel === "street" ? "Nova rua" : "Novo lote/talhão";

  if (error) {
    return (
      <div className={styles.page}>
        <Link href="/painel/cemiterios" className={styles.back}>
          <svg viewBox="0 0 16 16" fill="none">
            <path d="m9.5 4-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Cemitérios
        </Link>
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  if (loading || !cemetery) {
    return (
      <div className={styles.page}>
        <Link href="/painel/cemiterios" className={styles.back}>
          <svg viewBox="0 0 16 16" fill="none">
            <path d="m9.5 4-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Cemitérios
        </Link>
        <Skeleton variant="card" height={200} />
        <div style={{ height: 24 }} />
        <Skeleton variant="card" height={280} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/painel/cemiterios" className={styles.back}>
        <svg viewBox="0 0 16 16" fill="none">
          <path d="m9.5 4-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Cemitérios
      </Link>

      {/* ---- cabeçalho do cemitério ---- */}
      <header className={styles.hero}>
        <span className={styles.heroBar} style={{ background: `linear-gradient(90deg, ${cemetery.color}, ${cemetery.color2})` }} />
        <div className={styles.heroMain}>
          <span className={styles.heroLogo} style={{ background: cemetery.color }}>
            {cemeteryInitial(cemetery.name)}
          </span>
          <div className={styles.heroInfo}>
            <div className={styles.heroTitleRow}>
              <h1 className={styles.title}>{cemetery.name}</h1>
              {cemetery.active ? <Badge tone="success" dot>Ativo</Badge> : <Badge tone="neutral">Inativo</Badge>}
              {cemetery.ortofoto ? <Badge tone="navy">Ortofoto OK</Badge> : <Badge tone="warning">Sem ortofoto</Badge>}
            </div>
            <p className={styles.heroMeta}>
              {cemetery.code} · {cemetery.address} · {cemetery.city}
            </p>
            <p className={styles.heroMetaSub}>
              {cemetery.organ} · Entrada GPS {formatGps(entrance) || cemetery.entrance}
            </p>
          </div>
          <div className={styles.heroActions}>
            <Button variant="secondary" onClick={openConfig}>Configurações</Button>
            <Link href="/painel/mapa">
              <Button variant="ghost">{cemetery.ortofoto ? "Ver mapa" : "Importar ortofoto"}</Button>
            </Link>
          </div>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{cemetery.stats.blocks}</span>
            <span className={styles.heroStatLabel}>Quadras</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{cemetery.stats.streets}</span>
            <span className={styles.heroStatLabel}>Ruas</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{cemetery.stats.lots}</span>
            <span className={styles.heroStatLabel}>Lotes</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{cemetery.stats.graves.toLocaleString("pt-BR")}</span>
            <span className={styles.heroStatLabel}>Sepulturas</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>{cemetery.stats.occupancy}%</span>
            <span className={styles.heroStatLabel}>Ocupação</span>
            <div className={styles.occupancyTrack}>
              <div className={styles.occupancyFill} style={{ width: `${cemetery.stats.occupancy}%` }} />
            </div>
          </div>
        </div>
      </header>

      {/* ---- explorador da hierarquia (cemitério → quadra → rua → lote → covas) ---- */}
      <section className={styles.explorer}>
        <header className={styles.explorerHead}>
          <div>
            <h2 className={styles.explorerTitle}>Estrutura</h2>
            <nav className={styles.breadcrumb}>
              <button className={`${styles.crumb} ${!path.block ? styles.crumbCurrent : ""}`} onClick={() => setPath({ block: null, street: null })}>
                Quadras
              </button>
              {block && (
                <>
                  <span className={styles.crumbSep}>›</span>
                  <button className={`${styles.crumb} ${!path.street ? styles.crumbCurrent : ""}`} onClick={() => setPath({ block: path.block, street: null })}>
                    {block.name}
                  </button>
                </>
              )}
              {street && (
                <>
                  <span className={styles.crumbSep}>›</span>
                  <span className={`${styles.crumb} ${styles.crumbCurrent}`}>{street.name}</span>
                </>
              )}
            </nav>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setAddError(null); setAddLevel(!path.block ? "block" : !path.street ? "street" : "lot"); }}
          >
            + {!path.block ? "Nova quadra" : !path.street ? "Nova rua" : "Novo lote"}
          </Button>
        </header>

        {/* nível: quadras */}
        {!path.block && (
          structure.length ? (
            <div className={styles.levelGrid}>
              {structure.map((b) => (
                <button key={b.id} className={styles.levelCard} onClick={() => setPath({ block: b.id, street: null })}>
                  <span className={styles.levelCode}>{b.code}</span>
                  <span className={styles.levelName}>{b.name}</span>
                  <span className={styles.levelMeta}>
                    {b.streets.length} rua(s) · {b.streets.reduce((s, r) => s + r.lots.reduce((x, l) => x + l.graves, 0), 0)} sepulturas
                  </span>
                  {b.geo ? <Badge tone="navy">Camada no mapa</Badge> : <Badge tone="warning">Sem demarcação</Badge>}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.emptyLevel}>Nenhuma quadra cadastrada — comece criando a primeira.</p>
          )
        )}

        {/* nível: ruas */}
        {block && !path.street && (
          block.streets.length ? (
            <div className={styles.levelGrid}>
              {block.streets.map((s) => (
                <button key={s.id} className={styles.levelCard} onClick={() => setPath({ block: path.block, street: s.id })}>
                  <span className={styles.levelCode}>{s.code}</span>
                  <span className={styles.levelName}>{s.name}</span>
                  <span className={styles.levelMeta}>
                    {s.lots.length} lote(s) · {s.lots.reduce((x, l) => x + l.graves, 0)} sepulturas
                  </span>
                  {s.geo ? <Badge tone="navy">Camada no mapa</Badge> : <Badge tone="warning">Sem demarcação</Badge>}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.emptyLevel}>Esta quadra ainda não tem ruas.</p>
          )
        )}

        {/* nível: lotes (covas ficam na página Sepulturas) */}
        {street && (
          street.lots.length ? (
            <div className={styles.levelGrid}>
              {street.lots.map((l) => {
                const occupancy = l.graves ? Math.round(((l.graves - l.free) / l.graves) * 100) : 0;
                return (
                  <div key={l.id} className={`${styles.levelCard} ${styles.lotCard}`}>
                    <span className={styles.levelCode}>{l.code}</span>
                    <span className={styles.levelMeta}>{l.graves} covas · {l.free} livre(s)</span>
                    <div className={styles.occupancyTrack}>
                      <div className={styles.occupancyFill} style={{ width: `${occupancy}%` }} />
                    </div>
                    <span className={styles.occupancyLabel}>{occupancy}% ocupado</span>
                    <Link href="/painel/sepulturas" className={styles.lotLink}>Ver covas →</Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyLevel}>Esta rua ainda não tem lotes.</p>
          )
        )}
      </section>

      {/* ---- configurações (logo, cores, órgão gestor) ---- */}
      <Modal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title={`Configurações · ${cemetery.name}`}
        subtitle="Identidade visual e dados do órgão gestor"
        width={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            <Button loading={savingConfig} onClick={saveConfig}>Salvar configurações</Button>
          </>
        }
      >
        {config && (
          <div className={styles.modalBody}>
            <span className={styles.sectionLabel}>Identidade visual</span>
            <div className={styles.identityRow}>
              <label className={styles.logoUpload}>
                <input type="file" accept="image/*" className={styles.hiddenInput} />
                <span className={styles.logoPreview} style={{ background: config.color }}>
                  {cemeteryInitial(config.name || cemetery.name)}
                </span>
                <span className={styles.logoHint}>Logotipo<br /><em>clique para enviar</em></span>
              </label>
              <div className={styles.colorFields}>
                <FormField label="Cor primária">
                  <div className={styles.colorRow}>
                    <input type="color" value={config.color} onChange={(e) => setConfig({ ...config, color: e.target.value })} className={styles.colorInput} />
                    <Input value={config.color} onChange={(e) => setConfig({ ...config, color: e.target.value })} />
                  </div>
                </FormField>
                <FormField label="Cor secundária">
                  <div className={styles.colorRow}>
                    <input type="color" value={config.color2} onChange={(e) => setConfig({ ...config, color2: e.target.value })} className={styles.colorInput} />
                    <Input value={config.color2} onChange={(e) => setConfig({ ...config, color2: e.target.value })} />
                  </div>
                </FormField>
              </div>
            </div>

            <span className={styles.sectionLabel}>Dados do cemitério</span>
            <div className={styles.formGrid}>
              <FormField label="Nome" className={styles.spanTwo}>
                <Input value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} />
              </FormField>
              <FormField label="Código">
                <Input value={config.code} onChange={(e) => setConfig({ ...config, code: e.target.value })} />
              </FormField>
              <FormField label="Cidade / UF">
                <Input value={config.city} onChange={(e) => setConfig({ ...config, city: e.target.value })} />
              </FormField>
              <FormField label="Endereço" className={styles.spanTwo}>
                <Input value={config.address} onChange={(e) => setConfig({ ...config, address: e.target.value })} />
              </FormField>
              <FormField label="Entrada do cemitério" hint="Origem das rotas GPS do visitante" className={styles.spanTwo}>
                <EntrancePicker value={entrance} onChange={setEntrance} cemeteryName={cemetery.name} />
              </FormField>
            </div>

            <span className={styles.sectionLabel}>Órgão gestor — cabeçalho dos documentos</span>
            <div className={styles.formGrid}>
              <FormField label="Nome do órgão" className={styles.spanTwo}>
                <Input value={config.organ} onChange={(e) => setConfig({ ...config, organ: e.target.value })} />
              </FormField>
              <FormField label="CNPJ">
                <Input placeholder="00.000.000/0001-00" value={config.cnpj} onChange={(e) => setConfig({ ...config, cnpj: e.target.value })} />
              </FormField>
              <FormField label="Telefone">
                <Input placeholder="(11) 3333-0000" value={config.phone} onChange={(e) => setConfig({ ...config, phone: e.target.value })} />
              </FormField>
              <FormField label="E-mail" className={styles.spanTwo}>
                <Input placeholder="contato@prefeitura.gov.br" value={config.email} onChange={(e) => setConfig({ ...config, email: e.target.value })} />
              </FormField>
            </div>
            {configError && <Alert tone="danger">{configError}</Alert>}
            <Alert tone="info">
              Logotipo, cores e dados do órgão aparecem nas <strong>certidões,
              autorizações e recibos</strong> emitidos por este cemitério.
            </Alert>
          </div>
        )}
      </Modal>

      {/* ---- nova quadra/rua/lote ---- */}
      <Modal
        open={Boolean(addLevel)}
        onClose={() => setAddLevel(null)}
        title={levelLabel}
        subtitle={
          addLevel === "block"
            ? cemetery.name
            : addLevel === "street"
              ? `${cemetery.name} › ${block?.name}`
              : `${cemetery.name} › ${block?.name} › ${street?.name}`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddLevel(null)}>Cancelar</Button>
            <Button loading={creating} disabled={!addForm.code} onClick={addItem}>Criar</Button>
          </>
        }
      >
        <div className={styles.modalBody}>
          <div className={styles.formGrid}>
            <FormField label="Código" required hint="Único dentro do nível pai">
              <Input value={addForm.code} onChange={(e) => setAddForm({ ...addForm, code: e.target.value })} placeholder={addLevel === "block" ? "G" : addLevel === "street" ? "R4" : "L-06"} />
            </FormField>
            {addLevel !== "lot" && (
              <FormField label="Nome">
                <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder={addLevel === "block" ? "Quadra G" : "Rua 4"} />
              </FormField>
            )}
          </div>
          {addError && <Alert tone="danger">{addError}</Alert>}
          <Alert tone="info">
            Depois de criar, demarque a camada no <strong>Mapa</strong> para a navegação
            por quadra/rua sobre a ortofoto.
          </Alert>
        </div>
      </Modal>
    </div>
  );
}
