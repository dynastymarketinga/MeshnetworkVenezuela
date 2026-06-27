/** Tema táctico OLED — misión crítica campo */
export const TacticalTheme = {
  bg: '#000000',
  surface: '#0A0A0A',
  surfaceElevated: '#111111',
  ink: '#FFFFFF',
  inkMuted: '#AAAAAA',
  inkDim: '#666666',
  accent: '#00AEEF',
  accentDark: '#0088BB',
  ok: '#00FF00',
  critico: '#FF3333',
  alerta: '#FFAA00',
  border: '#333333',
  borderAccent: '#00AEEF',
} as const;

export const tacticalGlow = {
  shadowColor: TacticalTheme.accent,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
  elevation: 4,
} as const;
