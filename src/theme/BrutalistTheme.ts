/** Paleta premium dark/gold/cyan — alineada con index.html web */
export const BrutalistTheme = {
  /* Principal */
  bg: '#000000',
  ink: '#FFFFFF',
  inkMuted: '#D4AF37',
  inkLight: '#A1813D',
  /* Secundario */
  paper: '#141414',
  paperElevated: '#1A1A1A',
  meshBlue: '#00FFFF',
  meshBlueDark: '#00CCCC',
  /* Bloque inferior / nav */
  navBg: '#F8F8F8',
  navInk: '#000000',
  navMuted: '#8B6D36',
  /* Bordes */
  border: '#D4AF37',
  borderLight: '#8B6D36',
  /* Estados semánticos */
  critico: '#FF4444',
  alerta: '#FFB020',
  ok: '#4ADE80',
  shadow: '#D4AF37',
} as const;

export const paperShadow = {
  shadowColor: BrutalistTheme.shadow,
  shadowOffset: { width: 5, height: 5 },
  shadowOpacity: 0.12,
  shadowRadius: 0,
  elevation: 6,
} as const;
