"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import styles from "./PanelShowcase.module.css";

import PanelShell from "@/components/organisms/PanelShell/PanelShell";
import { DashboardView } from "@/app/painel/DashboardView";
import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";
import { makeDashboardDemo } from "@/lib/mock/dashboard-demo";

/**
 * Quarta seção — carrossel white label. O MESMO painel real (PanelShell +
 * dashboard) re-skinado ao vivo: cada slide tem cor, marca e subdomínio
 * próprios, mostrando que são sistemas independentes.
 * O painel fica montado; só troca o TenantTheme (variáveis CSS) — sem remount.
 *
 * ATENÇÃO (regra de produção): o painel desta vitrine é 100% ILUSTRATIVO
 * (receita, inadimplência, devedores etc. são inventados). Por isso ele NUNCA
 * pode ser exibido com o nome/cor de um MUNICÍPIO REAL vindo de
 * `GET /public/tenants` — o visitante leria números fictícios como se fossem
 * daquela prefeitura. As marcas abaixo são propositalmente genéricas e a seção
 * traz um selo visível de "demonstração". Não reconectar à API pública aqui.
 */

const DESKTOP_BASE = { width: 1440, height: 880 };
const MOBILE_BASE = { width: 402, height: 800 };
const INTERVAL = 4200;

// Marcas ILUSTRATIVAS do carrossel — nomes genéricos, sem qualquer relação com
// cidades ou clientes reais. Servem só para demonstrar a troca de identidade
// visual (white label). Mesmo shape que `normalizeApiTenant` produz.
const SHOWCASE_BRANDS = [
  {
    id: "demo-1",
    name: "Sua Cidade",
    brandLead: "Sua Cidade",
    brandTail: "Cemitérios",
    subdomain: "suacidade.eternizagestao.com.br",
    accent: "#032e59",
    accentRgb: "3, 46, 89",
    accentBright: "#0a4a8c",
    accentDeep: "#02223f",
  },
  {
    id: "demo-2",
    name: "Município Exemplo",
    brandLead: "Exemplo",
    brandTail: "Memorial",
    subdomain: "exemplo.eternizagestao.com.br",
    accent: "#1a5c3a",
    accentRgb: "26, 92, 58",
    accentBright: "#288a58",
    accentDeep: "#123f28",
  },
  {
    id: "demo-3",
    name: "Cidade Modelo",
    brandLead: "Modelo",
    brandTail: "Cemitérios",
    subdomain: "modelo.eternizagestao.com.br",
    accent: "#5b3a8c",
    accentRgb: "91, 58, 140",
    accentBright: "#7a52b8",
    accentDeep: "#412963",
  },
  {
    id: "demo-4",
    name: "Prefeitura Demonstração",
    brandLead: "Demonstração",
    brandTail: "Memorial",
    subdomain: "demonstracao.eternizagestao.com.br",
    accent: "#0f6b6b",
    accentRgb: "15, 107, 107",
    accentBright: "#189494",
    accentDeep: "#0a4a4a",
  },
];

export default function PanelShowcase() {
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [base, setBase] = useState(DESKTOP_BASE);
  const [ready, setReady] = useState(false); // réplica monta só no cliente (evita aviso de SSR)
  const [index, setIndex] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const [paused, setPaused] = useState(false);
  // Marcas fixas e ilustrativas — de propósito NÃO vêm de `GET /public/tenants`
  // (ver comentário no topo: os números do painel são fictícios).
  const showcase = SHOWCASE_BRANDS;

  // Painel da vitrine: 100% MOCKADO (sem API). Gerado no cliente pra manter a
  // agenda em "hoje" e a atividade recente com tempos relativos corretos.
  const demoData = useMemo(() => makeDashboardDemo(), []);

  useEffect(() => {
    setReady(true);
  }, []);

  // avança sozinho; troca com um crossfade rápido enquanto o tema muda
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => go((i) => (i + 1) % showcase.length), INTERVAL);
    return () => clearInterval(id);
  }, [paused, showcase.length]);

  function go(next) {
    setSwapping(true);
    setTimeout(() => setIndex((i) => (typeof next === "function" ? next(i) : next)), 240);
    setTimeout(() => setSwapping(false), 300);
  }

  const tenant = showcase[index % showcase.length];

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      // acompanha o breakpoint real do painel (900px): abaixo dele o shell
      // rende o layout mobile nativo (tab bar + FAB) — mostramos essa versão
      const nextBase = window.innerWidth <= 900 ? MOBILE_BASE : DESKTOP_BASE;
      setBase(nextBase);
      setScale(Math.min(el.clientWidth / nextBase.width, 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section className={styles.section} id="painel-demo">
      <div className={styles.inner}>
        <div className={styles.head}>
          <span className={styles.kicker}>Um sistema para cada cidade</span>
          <h2 className={styles.title}>O painel que a sua equipe abre todo dia.</h2>
          <p className={styles.sub}>
            Cada prefeitura no seu subdomínio, com a sua marca e as suas cores.
            É o mesmo sistema — vestido para cada cidade.
          </p>
          {/* Selo obrigatório: deixa explícito que marcas e números da vitrine
              são ilustrativos — nada aqui pertence a um município real. */}
          <p className={styles.demoNote}>
            Demonstração ilustrativa: as marcas e os números exibidos no painel
            abaixo são fictícios e não representam nenhum município ou cliente real.
          </p>
        </div>

        {/* nome da cidade GRANDE, na cor do tenant */}
        <div className={`${styles.cityLabel} ${swapping ? styles.citySwapping : ""}`}>
          <span className={styles.cityDot} style={{ background: tenant.accent }} aria-hidden="true" />
          <span className={styles.cityName} style={{ color: tenant.accent }}>{tenant.name}</span>
          <span className={styles.citySub}>{tenant.subdomain}</span>
        </div>

        {/* linha: carrossel (painel) à esquerda · setas à direita, fora */}
        <div
          className={styles.stageRow}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className={styles.stage}>
            <div className={styles.glow} style={{ background: `radial-gradient(52% 60% at 50% 42%, rgba(${tenant.accentRgb}, 0.2), transparent 70%)` }} aria-hidden="true" />
            <div className={styles.browser}>
              <span className={styles.accentBar} style={{ background: `linear-gradient(90deg, ${tenant.accentBright}, ${tenant.accent})` }} aria-hidden="true" />
              <div className={styles.browserBar}>
                <span className={styles.dots} aria-hidden="true">
                  <i /><i /><i />
                </span>
                <span className={`${styles.urlPill} ${swapping ? styles.urlSwapping : ""}`}>
                  <svg viewBox="0 0 16 16" fill="none">
                    <rect x="3.2" y="7" width="9.6" height="6.2" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                  {tenant.subdomain}/painel
                </span>
              </div>

              <div
                ref={frameRef}
                className={`${styles.viewport} ${swapping ? styles.swapping : ""}`}
                style={{ height: base.height * scale }}
              >
                <div
                  className={styles.replica}
                  style={{ width: base.width, height: base.height, transform: `scale(${scale})` }}
                  aria-hidden="true"
                >
                  {ready && (
                    <TenantTheme tenant={tenant} showSwitcher={false} previewOnly>
                      <PathnameContext.Provider value="/painel">
                        <PanelShell>
                          <DashboardView data={demoData} />
                        </PanelShell>
                      </PathnameContext.Provider>
                    </TenantTheme>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* setas — fora do painel, à direita */}
          <div className={styles.arrows}>
            <button
              className={styles.arrowBtn}
              onClick={() => go((i) => (i - 1 + showcase.length) % showcase.length)}
              aria-label="Cidade anterior"
              style={{ "--acc": tenant.accent }}
            >
              <svg viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className={styles.arrowCount}>
              {String(index + 1).padStart(2, "0")}<em>/ {String(showcase.length).padStart(2, "0")}</em>
            </span>
            <button
              className={styles.arrowBtn}
              onClick={() => go((i) => (i + 1) % showcase.length)}
              aria-label="Próxima cidade"
              style={{ "--acc": tenant.accent }}
            >
              <svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>

        <div className={styles.actions}>
          <a
            href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Quero%20conhecer%20o%20Eterniza%20Gest%C3%A3o%20para%20a%20minha%20cidade."
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaPrimary}
          >
            <svg viewBox="0 0 24 24" fill="none" className={styles.waIcon}>
              <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M8.8 8.4c.7 2.9 3 5.2 5.9 5.9l.9-1.5 2.2 1c0 1.5-1.2 2.2-2.5 2-3.5-.6-7-4.1-7.6-7.6-.2-1.3.5-2.5 2-2.5l1 2.2-1.8.5Z" fill="currentColor" stroke="none" />
            </svg>
            Entrar em contato
          </a>
        </div>
      </div>
    </section>
  );
}
