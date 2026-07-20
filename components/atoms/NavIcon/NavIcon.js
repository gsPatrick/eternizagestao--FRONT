export default function NavIcon({ name }) {
  return ICONS[name] || null;
}

const ICONS = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  graves: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M5.5 16.5V8a4.5 4.5 0 019 0v8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3.5 16.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 9.5h4M10 7.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  deceased: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 16.5c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  concessions: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M6 3.5h6.5L16 7v9.5a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.5 3.5V7H16" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.5 11h5M7.5 13.8h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  burials: (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3.5" y="5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 8.5h13M7 3v3.5M13 3v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.5 12.5l1.8 1.8 3.2-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  exhumations: (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3.5" y="7.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 10.5h13" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 13.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 7.5V3.5M10 3.5L8 5.4M10 3.5l2 1.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  schedule: (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3.5" y="5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 8.5h13M7 3v3.5M13 3v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 11v2.5l1.8 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  billings: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M5 3.5h10v13.5l-2-1.2-1.7 1.2-1.3-1.2-1.3 1.2L7 15.8l-2 1.2V3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.5 7h5M7.5 10h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  fees: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="6.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6.4v7.2M12.2 8.1c-.4-.8-1.2-1.3-2.2-1.3-1.3 0-2.3.8-2.3 1.9 0 2.6 4.8 1.2 4.8 3.7 0 1.1-1.1 1.9-2.5 1.9-1.1 0-2-.5-2.4-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  delinquency: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 3.2L17.6 16H2.4L10 3.2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 8v3.4M10 13.6v.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  cemeteries: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M4 16.5V7.8L10 4l6 3.8v8.7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2.8 16.5h14.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 16.5v-4a2 2 0 014 0v4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="7.5" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.8 16c.7-2.5 2.6-3.8 4.7-3.8s4 1.3 4.7 3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="13.8" cy="7.6" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14.6 12.3c1.5.4 2.5 1.5 2.9 3.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 17s5-4.6 5-8.4a5 5 0 10-10 0C5 12.4 10 17 10 17z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="8.4" r="1.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  documents: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M5.5 3h6l3 3v11H5.5V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.5 3v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.8 10h4.4M7.8 12.8h4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M4 16.5V12M8 16.5V8M12 16.5v-6.5M16 16.5V4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  notifications: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M16.5 3.5L3.5 8.8l5 1.7 1.7 5 6.3-12z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 10.5l8-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  imports: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 3.5v8M10 11.5l-3-3M10 11.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13v2.5a1 1 0 001 1h10a1 1 0 001-1V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 3l6 2.2v4.4c0 4-2.6 6.4-6 7.4-3.4-1-6-3.4-6-7.4V5.2L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.6 10l1.7 1.7 3.1-3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6.8" r="2.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 16.5c.7-2.7 2.9-4.2 5.5-4.2s4.8 1.5 5.5 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="15.4" cy="13.4" r="2.4" fill="var(--color-canvas)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M15.4 12.4v2M14.4 13.4h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
};
