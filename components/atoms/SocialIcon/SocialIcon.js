/**
 * Ícones das redes/canais da cidade — usados no rodapé público e na tela
 * Configurações → Contato. Traço em currentColor (herdam a cor do contexto).
 */

const ICONS = {
  whatsapp: (
    <>
      <path
        d="M3.6 20.4l1.25-4.2A8.4 8.4 0 1 1 8 19.3l-4.4 1.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 7.9c-.3 0-.8.1-1 .6-.3.6-.4 1.4 0 2.4.8 2 2.6 3.8 4.7 4.6.9.3 1.7.3 2.3 0 .5-.3.6-.8.6-1.1l-1.9-.9-.9.9a5.2 5.2 0 0 1-2.8-2.8l.9-.9-.9-1.9Z"
        fill="currentColor"
      />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.3" fill="currentColor" />
    </>
  ),
  facebook: (
    <path
      d="M14.2 21v-7.6h2.6l.4-3.1h-3V8.4c0-.9.3-1.5 1.5-1.5h1.6V4.1a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.3H8.5v3.1h2.6V21h3.1Z"
      fill="currentColor"
    />
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.2 9.3v5.4l4.6-2.7-4.6-2.7Z" fill="currentColor" />
    </>
  ),
  tiktok: (
    <>
      <path
        d="M14.5 3.5v11a3.6 3.6 0 1 1-3.6-3.6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M14.5 3.5c.4 2.6 2.2 4.4 5 4.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  x: (
    <>
      <path d="M4 4h4.6L20 20h-4.6L4 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M19.6 4 13.4 11M10.6 13 4.4 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  linkedin: (
    <path
      d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
      fill="currentColor"
    />
  ),
  site: (
    <>
      <circle cx="12" cy="12" r="8.8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.4 12h17.2M12 3.2c2.3 2.4 3.5 5.4 3.5 8.8s-1.2 6.4-3.5 8.8c-2.3-2.4-3.5-5.4-3.5-8.8S9.7 5.6 12 3.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </>
  ),
};

// Rótulo legível de cada canal (aria-label no site e label no painel).
export const SOCIAL_LABELS = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  site: "Site oficial",
};

export default function SocialIcon({ name, size = 14 }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {icon}
    </svg>
  );
}
