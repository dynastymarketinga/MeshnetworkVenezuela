/** Configuración operativa — editar número antes del despliegue en La Guaira */
export const OperacionConfig = {
  /**
   * ⚠️ PLACEHOLDER — NO ES UN NÚMERO REAL. DEBE reemplazarse antes de desplegar.
   * Central Bomberos / Protección Civil — formato sin espacios: 0414XXXXXXX.
   * Si se despliega con este valor ('04140000000'), los SMS al comando NO llegarán.
   */
  COMANDO_CENTRAL_SMS: '04140000000',
  NOMBRE_COMANDO: 'Comando Central La Guaira',
  BRIGADA_ID: 'Brigada-Rescate-LG',
  VERSION_DATOS: 'MNv2.1',
  FUENTE_ORIGEN: 'MeshApp',
  HUB_BASE_URL: 'https://meshnetwork-venezuela.vercel.app/api/hub',
  CIUDADES_LA_GUAIRA: [
    'La Guaira',
    'Maiquetía',
    'Macuto',
    'Catia La Mar',
    'Caraballeda',
    'Naiguatá',
  ] as const,
  ZONAS_SUGERIDAS: [
    'Macuto-El Cojo',
    'Los Corales-Av. Principal',
    'Caribe-Playa Grande',
    'Caraballeda-Bahía del Mar',
    'Catia La Mar-Costa Azul',
    'Maiquetía-Residencias Orca',
  ] as const,
} as const;
