/** Configuración operativa — editar número antes del despliegue en La Guaira */
export const OperacionConfig = {
  /** Central Bomberos / Protección Civil — formato sin espacios: 0414XXXXXXX */
  COMANDO_CENTRAL_SMS: '04140000000',
  NOMBRE_COMANDO: 'Comando Central La Guaira',
  BRIGADA_ID: 'Brigada-Rescate-LG',
  VERSION_DATOS: 'MNv1',
  RED_CIUDADANA_URL: 'https://herovenezuela.com',
  CIUDADES_LA_GUAIRA: [
    'La Guaira',
    'Maiquetía',
    'Macuto',
    'Catia La Mar',
    'Caraballeda',
    'Naiguatá',
  ] as const,
} as const;
