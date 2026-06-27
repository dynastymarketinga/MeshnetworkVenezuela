import { EstadoReporte, ReporteEmergencia } from '../../domain/entities/Reporte';
import { MemoryReporteRepository } from '../repositories/MemoryReporteRepository';

const NOMBRES_SIM = ['María González', 'Carlos Ruiz', 'Ana Pérez', 'Anónimo'];
const SECTORES_SIM = [
  'Maiquetía - Edificio Los Corales',
  'Catia La Mar - Av. Principal',
  'La Guaira - Mercado central',
  'Macuto - Escuela San José',
];
const NOTAS_SIM = [
  'Se escuchan golpes bajo losa oeste',
  'Familia reporta personas atrapadas',
  'Acceso bloqueado por escombros',
  'Requiere cortadora y palanca',
];

export class MeshSimulationService {
  private esEscaneando = false;
  private intervaloId: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly repository: MemoryReporteRepository) {}

  public iniciarEscaneoMalla(
    onReporteRecibido: (reporte: ReporteEmergencia) => void
  ): void {
    if (this.esEscaneando) return;
    this.esEscaneando = true;

    this.intervaloId = setInterval(() => {
      if (!this.esEscaneando) return;

      const estados: EstadoReporte[] = ['CRITICO', 'POR LOCALIZAR', 'LOCALIZADO'];
      const reporte: ReporteEmergencia = {
        id: this.repository.crearIdMalla(),
        nombre_completo: NOMBRES_SIM[Math.floor(Math.random() * NOMBRES_SIM.length)],
        edad: String(Math.floor(Math.random() * 70) + 5),
        genero: Math.random() > 0.5 ? 'M' : 'F',
        ubicacion_exacta: SECTORES_SIM[Math.floor(Math.random() * SECTORES_SIM.length)],
        estado_actual: estados[Math.floor(Math.random() * estados.length)],
        notas_paramedicos: NOTAS_SIM[Math.floor(Math.random() * NOTAS_SIM.length)],
        timestamp: Date.now(),
      };

      const esNuevo = this.repository.fusionar(reporte);
      if (esNuevo) {
        onReporteRecibido(reporte);
      }
    }, 8000);
  }

  public detenerEscaneoMalla(): void {
    this.esEscaneando = false;
    if (this.intervaloId) {
      clearInterval(this.intervaloId);
      this.intervaloId = null;
    }
  }
}
