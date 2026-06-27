import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { OperacionConfig } from '../../config/OperacionConfig';
import type { IReporteRepository } from '../../domain/repositories/IReporteRepository';
import type { ReporteEmergencia } from '../../domain/entities/Reporte';

type ListenerPendientes = (count: number) => void;

let sincronizando = false;
let reintentoMs = 5000;
const listenersPendientes = new Set<ListenerPendientes>();
let netUnsubscribe: (() => void) | null = null;
let appStateSubscription: { remove: () => void } | null = null;

function payloadParaHub(reportes: ReporteEmergencia[]): Record<string, unknown>[] {
  return reportes.map((r) => ({
    id: r.id,
    fuente_origen: r.fuente_origen,
    tipo_registro: r.tipo_registro,
    nombre_completo: r.nombre_completo,
    edad: r.edad,
    genero: r.genero,
    ubicacion_exacta: r.ubicacion_exacta,
    latitud: r.latitud,
    longitud: r.longitud,
    estado_actual: r.estado_actual,
    telefono_contacto: r.telefono_contacto,
    estado_estructura: r.estado_estructura,
    notas_paramedicos: r.notas_paramedicos,
    timestamp: r.timestamp,
    ciudad: r.ciudad,
    censo_personas: r.censo_personas,
    tiene_hogar_actual: r.tiene_hogar_actual,
    direccion_origen: r.direccion_origen,
    zona_afectada_tag: r.zona_afectada_tag,
    foto_estructura_b64: r.foto_estructura_b64 || undefined,
  }));
}

async function notificarPendientes(repository: IReporteRepository): Promise<void> {
  const pendientes = await repository.obtenerPendientesHubSync();
  listenersPendientes.forEach((cb) => cb(pendientes.length));
}

export const HubSyncService = {
  suscribirPendientes(callback: ListenerPendientes): () => void {
    listenersPendientes.add(callback);
    return () => listenersPendientes.delete(callback);
  },

  iniciarAutoSync(repository: IReporteRepository): () => void {
    const ejecutar = (): void => {
      void this.sincronizarPendientes(repository);
    };

    netUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        ejecutar();
      }
    });

    appStateSubscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') ejecutar();
    });

    void notificarPendientes(repository);

    return () => {
      netUnsubscribe?.();
      netUnsubscribe = null;
      appStateSubscription?.remove();
      appStateSubscription = null;
    };
  },

  async sincronizarPendientes(repository: IReporteRepository): Promise<{
    ok: boolean;
    subidos: number;
    error?: string;
  }> {
    if (sincronizando) return { ok: false, subidos: 0 };

    const net = await NetInfo.fetch();
    if (!net.isConnected || net.isInternetReachable === false) {
      return { ok: false, subidos: 0, error: 'Sin internet' };
    }

    const pendientes = await repository.obtenerPendientesHubSync();
    await notificarPendientes(repository);
    if (pendientes.length === 0) return { ok: true, subidos: 0 };

    sincronizando = true;
    try {
      const res = await fetch(`${OperacionConfig.HUB_BASE_URL}?action=registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportes: payloadParaHub(pendientes) }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Hub respondió ${res.status}`);
      }

      await repository.marcarSincronizadoHub(pendientes.map((p) => p.id));
      reintentoMs = 5000;
      await notificarPendientes(repository);
      return { ok: true, subidos: pendientes.length };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error de sincronización';
      setTimeout(() => {
        void this.sincronizarPendientes(repository);
      }, reintentoMs);
      reintentoMs = Math.min(reintentoMs * 2, 120000);
      return { ok: false, subidos: 0, error: mensaje };
    } finally {
      sincronizando = false;
    }
  },

  async trasGuardar(repository: IReporteRepository): Promise<void> {
    await notificarPendientes(repository);
    void this.sincronizarPendientes(repository);
  },
};
