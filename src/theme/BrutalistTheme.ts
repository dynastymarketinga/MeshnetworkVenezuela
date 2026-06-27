/** Paleta editorial brutalista — off-white, tinta, sombras papel */
export const BrutalistTheme = {
  bg: '#F5F0E8',
  paper: '#EDE8DF',
  paperElevated: '#FAF7F2',
  ink: '#1C1C1C',
  inkMuted: '#6B6560',
  inkLight: '#9A948C',
  meshBlue: '#4A8FC7',
  meshBlueDark: '#2E6A9E',
  border: '#1C1C1C',
  borderLight: '#C4BDB4',
  critico: '#B91C1C',
  alerta: '#B45309',
  ok: '#166534',
  shadow: '#1C1C1C',
} as const;

export const paperShadow = {
  shadowColor: BrutalistTheme.shadow,
  shadowOffset: { width: 5, height: 5 },
  shadowOpacity: 0.12,
  shadowRadius: 0,
  elevation: 6,
} as const;
