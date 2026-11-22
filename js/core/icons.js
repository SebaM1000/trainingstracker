const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONS = {
  heute: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  kraft: svg('<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>'),
  ausdauer: svg('<path d="M3 17c3 0 4-10 7-10s3 6 5 6 3-4 6-4"/><circle cx="18" cy="5" r="1.5"/>'),
  fortschritt: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  profil: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  wissen: svg('<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 21V5"/>'),
};
