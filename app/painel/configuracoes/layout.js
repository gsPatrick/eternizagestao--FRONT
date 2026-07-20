"use client";

/**
 * HUB de Configurações — sidebar de tópicos à esquerda + área de conteúdo à
 * direita (rotas aninhadas com layout compartilhado → deep-link por tópico).
 * A sidebar mostra a cidade (navy premium) e a navegação por tópicos; cada
 * sub-rota (identidade, órgão gestor, contato, financeiro, notificações)
 * renderiza no slot {children}.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useResource } from "@/lib/api/useResource";
import { getOnboarding } from "@/lib/api/resources/tenant";
import Badge from "@/components/atoms/Badge/Badge";
import styles from "./layout.module.css";
import { ConfigPreviewProvider, useConfigPreview } from "./_lib/PreviewContext";
import { safeColor, darken } from "./_lib/helpers";

const BASE = "/painel/configuracoes";

const TOPICS = [
  {
    slug: "identidade",
    label: "Identidade visual",
    desc: "Cores e logo da cidade",
    icon: BrushIcon,
  },
  {
    slug: "orgao-gestor",
    label: "Órgão gestor",
    desc: "Prefeitura / secretaria responsável",
    icon: BuildingIcon,
  },
  {
    slug: "contato",
    label: "Contato & endereço",
    desc: "Canais e endereço público",
    icon: PhoneIcon,
  },
  {
    slug: "financeiro",
    label: "Financeiro",
    desc: "Integração Asaas (cobranças)",
    icon: CardIcon,
  },
  {
    slug: "notificacoes",
    label: "Notificações",
    desc: "E-mail (SMTP) e WhatsApp",
    icon: BellIcon,
  },
];

export default function ConfiguracoesLayout({ children }) {
  return (
    <ConfigPreviewProvider>
      <ConfigHub>{children}</ConfigHub>
    </ConfigPreviewProvider>
  );
}

function ConfigHub({ children }) {
  const pathname = usePathname();
  const { data } = useResource(getOnboarding, []);
  const { preview } = useConfigPreview();

  const isPending = data && data.onboardingStatus === "pendente";
  const cityName = data?.name || "Sua cidade";
  const monogram = cityName.trim().charAt(0).toUpperCase();

  // valores AO VIVO (preview do form) sobrepõem os salvos — cor/logo mudam
  // na esquerda enquanto o usuário edita, antes de salvar.
  const liveLogo = preview?.logoUrl !== undefined ? preview.logoUrl : data?.logoUrl;
  const livePrimary = safeColor(preview?.primaryColor, data?.primaryColor || "#032e59");
  const sidebarStyle = {
    "--color-navy": livePrimary,
    "--color-navy-deep": darken(livePrimary, 0.62),
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.eyebrow}>Plataforma da cidade</div>
        <h1 className={styles.title}>Configurações</h1>
        <p className={styles.subtitle}>
          Ajuste a identidade, o órgão gestor, o contato e as integrações da sua
          cidade. Escolha um tópico à esquerda — cada mudança vale imediatamente
          no painel, no portal da família e nos documentos.
        </p>
      </header>

      <div className={styles.hub}>
        <aside className={styles.sidebar} style={sidebarStyle}>
          {/* Cartão da cidade — navy premium (ao vivo) */}
          <div className={styles.cityCard}>
            <div className={styles.cityLogo}>
              {liveLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={liveLogo} alt="Logo da cidade" />
              ) : (
                <span className={styles.cityMonogram}>{monogram}</span>
              )}
            </div>
            <div className={styles.cityInfo}>
              <span className={styles.cityLabel}>Cidade</span>
              <strong className={styles.cityName}>{cityName}</strong>
              {data?.domain && <span className={styles.cityDomain}>{data.domain}</span>}
            </div>
          </div>

          {data && (
            <div className={styles.cityStatus}>
              <Badge tone={isPending ? "warning" : "success"} dot>
                {isPending ? "Configuração pendente" : "Configuração concluída"}
              </Badge>
            </div>
          )}

          <nav className={styles.nav} aria-label="Tópicos de configuração">
            {TOPICS.map((t) => {
              const href = `${BASE}/${t.slug}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const Icon = t.icon;
              return (
                <Link
                  key={t.slug}
                  href={href}
                  className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={styles.navIcon}>
                    <Icon />
                  </span>
                  <span className={styles.navText}>
                    <span className={styles.navLabel}>{t.label}</span>
                    <span className={styles.navDesc}>{t.desc}</span>
                  </span>
                  <span className={styles.navChevron} aria-hidden="true">
                    <ChevronIcon />
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

/* --------------------------------- ícones -------------------------------- */

function BrushIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3.6c-3.3 3.7-5.6 6.5-5.6 9.4a5.6 5.6 0 1 0 11.2 0c0-2.9-2.3-5.7-5.6-9.4Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 20.5V5.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1V20.5M12 20.5V9.5h6a1 1 0 0 1 1 1v10M3.5 20.5h17M8 8h1.6M8 11.5h1.6M8 15h1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M7 4.5h2.8l1.4 3.6-1.9 1.4a10.5 10.5 0 0 0 4.8 4.8l1.4-1.9 3.6 1.4v2.8a1.9 1.9 0 0 1-1.9 1.9A14.5 14.5 0 0 1 5.1 6.4 1.9 1.9 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5.5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9.5h18M6.5 14.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5ZM10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
