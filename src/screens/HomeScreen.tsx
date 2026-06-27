import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { CensoPersonasInput } from '../components/CensoPersonasInput';
import { FotoEviccionCapture } from '../components/FotoEviccionCapture';
import { TacticalSearchBar } from '../components/TacticalSearchBar';
import {
  ESTADOS_ESTRUCTURA,
  EstadoEstructura,
  EstadoReporte,
  ReporteEmergencia,
  TIPOS_REGISTRO,
  TipoRegistro,
} from '../domain/entities/Reporte';
import { OperacionConfig } from '../config/OperacionConfig';
import { TacticalTheme, tacticalGlow } from '../theme/TacticalTheme';
import { SQLiteReporteRepository } from '../infrastructure/repositories/SQLiteReporteRepository';
import { CameraCaptureService } from '../infrastructure/services/CameraCaptureService';
import { HubSyncService } from '../infrastructure/services/HubSyncService';
import { LocationService } from '../infrastructure/services/LocationService';
import { NavigationService } from '../infrastructure/services/NavigationService';
import { SmsDirectService } from '../infrastructure/services/SmsDirectService';

const ESTADOS: EstadoReporte[] = ['CRITICO', 'POR LOCALIZAR', 'LOCALIZADO'];
const GENEROS = ['M', 'F', 'Otro'];
const TIPOS: TipoRegistro[] = [...TIPOS_REGISTRO];
const ESTRUCTURAS: EstadoEstructura[] = [...ESTADOS_ESTRUCTURA];

const ETIQUETA_TIPO: Record<TipoRegistro, string> = {
  PERSONA_ATRAPADA: 'Persona atrapada',
  INFRAESTRUCTURA_DANADA: 'Infraestructura dañada',
  SIN_VIVIENDA: 'Familia sin vivienda',
};

const ALIADOS: { url: string; titulo: string; host: string }[] = [
  { url: 'https://busca.nexosignal.co', titulo: 'Búsqueda de niños (prioritario)', host: 'busca.nexosignal.co' },
  { url: 'https://desaparecidosterremotovenezuela.com', titulo: 'Personas desaparecidas', host: 'desaparecidosterremotovenezuela.com' },
  { url: 'https://sosvenezuela2026.com', titulo: 'Reportes y refugios', host: 'sosvenezuela2026.com' },
  { url: 'https://venezuelareporta.org', titulo: 'Red de apoyo ciudadana', host: 'venezuelareporta.org' },
];

type TabId = 'registro' | 'reportes' | 'red';

const TABS: { id: TabId; label: string }[] = [
  { id: 'registro', label: 'Registrar' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'red', label: 'Red' },
];

const BORDE_ESTADO: Record<EstadoReporte, string> = {
  CRITICO: TacticalTheme.critico,
  'POR LOCALIZAR': TacticalTheme.alerta,
  LOCALIZADO: TacticalTheme.ok,
};

interface HomeScreenProps {
  repository: SQLiteReporteRepository;
}

export default function HomeScreen({ repository }: HomeScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [reportes, setReportes] = useState<ReporteEmergencia[]>([]);
  const [reportesFiltrados, setReportesFiltrados] = useState<ReporteEmergencia[]>([]);
  const [busquedaTactica, setBusquedaTactica] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');
  const [ciudad, setCiudad] = useState('La Guaira');
  const [edad, setEdad] = useState('');
  const [genero, setGenero] = useState('M');
  const [ubicacion, setUbicacion] = useState('');
  const [latitud, setLatitud] = useState<number | undefined>();
  const [longitud, setLongitud] = useState<number | undefined>();
  const [estado, setEstado] = useState<EstadoReporte>('POR LOCALIZAR');
  const [tipoRegistro, setTipoRegistro] = useState<TipoRegistro>('PERSONA_ATRAPADA');
  const [estadoEstructura, setEstadoEstructura] = useState<EstadoEstructura>('SEGURO');
  const [notas, setNotas] = useState('');
  const [cadenaImport, setCadenaImport] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [obteniendoGps, setObteniendoGps] = useState(false);
  const [tabActiva, setTabActiva] = useState<TabId>('registro');
  const [censoPersonas, setCensoPersonas] = useState<string[]>([]);
  const [tieneHogarActual, setTieneHogarActual] = useState(true);
  const [direccionOrigen, setDireccionOrigen] = useState('');
  const [zonaAfectadaTag, setZonaAfectadaTag] = useState('');
  const [fotoEstructuraB64, setFotoEstructuraB64] = useState('');
  const [capturandoFoto, setCapturandoFoto] = useState(false);
  const [fotosCache, setFotosCache] = useState<Record<string, string>>({});
  const [pendientesHub, setPendientesHub] = useState(0);
  const [masDatosAbierto, setMasDatosAbierto] = useState(false);
  const [compartirAbierto, setCompartirAbierto] = useState(false);

  const [hubBuscarQuery, setHubBuscarQuery] = useState('');
  const [hubBuscarOut, setHubBuscarOut] = useState('Escriba un nombre y toque «Buscar en la red».');
  const [hubZonasOut, setHubZonasOut] = useState('Toque el botón para ver el resumen por sector.');
  const [hubListadoOut, setHubListadoOut] = useState('Toque «Ver listado completo» para consultar.');
  const [hubBuscando, setHubBuscando] = useState(false);
  const [hubZonasCargando, setHubZonasCargando] = useState(false);
  const [hubListadoCargando, setHubListadoCargando] = useState(false);

  const stats = useMemo(() => {
    const criticos = reportes.filter((r) => r.estado_actual === 'CRITICO').length;
    const localizados = reportes.filter((r) => r.estado_actual === 'LOCALIZADO').length;
    const ciudadesActivas = new Set(reportes.map((r) => r.ciudad)).size;
    return {
      total: reportes.length,
      criticos,
      localizados,
      ciudades: ciudadesActivas || OperacionConfig.CIUDADES_LA_GUAIRA.length,
    };
  }, [reportes]);

  const cadenaComprimida = useMemo(() => {
    if (reportes.length === 0) return '[]';
    try {
      return repository.comprimirParaSMS();
    } catch {
      return '[]';
    }
  }, [repository, reportes]);

  useEffect(() => {
    return repository.suscribir(setReportes);
  }, [repository]);

  useEffect(() => {
    const unsub = HubSyncService.suscribirPendientes(setPendientesHub);
    const stopAuto = HubSyncService.iniciarAutoSync(repository);
    void repository.obtenerPendientesHubSync().then((p) => setPendientesHub(p.length));
    return () => {
      unsub();
      stopAuto();
    };
  }, [repository]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = busquedaTactica.trim();
    if (!q) {
      setReportesFiltrados(reportes);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        const porPersona = await repository.buscarPorPersona(q);
        const porZona = await repository.obtenerPorZona(q);
        const ids = new Set<string>();
        const merged: ReporteEmergencia[] = [];
        for (const r of [...porPersona, ...porZona]) {
          if (!ids.has(r.id)) {
            ids.add(r.id);
            merged.push(r);
          }
        }
        setReportesFiltrados(merged.length > 0 ? merged : reportes);
      })();
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busquedaTactica, reportes, repository]);

  useEffect(() => {
    reportes.forEach((r) => {
      if (fotosCache[r.id]) return;
      void repository.obtenerFotoPorId(r.id).then((foto) => {
        if (foto) {
          setFotosCache((prev) => (prev[r.id] ? prev : { ...prev, [r.id]: foto }));
        }
      });
    });
  }, [reportes, repository]);

  const alertarErrorGps = useCallback((error: unknown) => {
    const mensaje = error instanceof Error ? error.message : 'No se pudo obtener GPS.';
    if (mensaje === 'PERMISO_GPS_DENEGADO') {
      Alert.alert('Ubicación necesaria', LocationService.mensajePermisoDenegado(), [
        { text: 'Abrir ajustes', onPress: () => LocationService.abrirAjustesUbicacion() },
        { text: 'Cancelar', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert('GPS requerido', mensaje);
  }, []);

  const limpiarFormulario = useCallback(() => {
    setNombreCompleto('');
    setTelefonoContacto('');
    setCiudad('La Guaira');
    setEdad('');
    setGenero('M');
    setUbicacion('');
    setLatitud(undefined);
    setLongitud(undefined);
    setEstado('POR LOCALIZAR');
    setTipoRegistro('PERSONA_ATRAPADA');
    setEstadoEstructura('SEGURO');
    setNotas('');
    setCensoPersonas([]);
    setTieneHogarActual(true);
    setDireccionOrigen('');
    setZonaAfectadaTag('');
    setFotoEstructuraB64('');
    setMasDatosAbierto(false);
  }, []);

  const capturarFotoEviccion = useCallback(async () => {
    setCapturandoFoto(true);
    try {
      const resultado = await CameraCaptureService.capturarFotoEviccion();
      if (!resultado) return;
      setFotoEstructuraB64(resultado.base64);
      if (resultado.advertencia) {
        Alert.alert('Foto guardada', resultado.advertencia);
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo capturar la foto.';
      Alert.alert('Cámara', mensaje);
    } finally {
      setCapturandoFoto(false);
    }
  }, []);

  const capturarGps = useCallback(async () => {
    setObteniendoGps(true);
    try {
      const coords = await LocationService.obtenerCoordenadasActuales();
      setLatitud(coords.latitud);
      setLongitud(coords.longitud);
      const texto = LocationService.formatearCoordenadas(coords.latitud, coords.longitud);
      Alert.alert(
        'GPS capturado',
        `${texto}${coords.precisionMetros ? `\nPrecisión: ±${Math.round(coords.precisionMetros)}m` : ''}`
      );
    } catch (error) {
      alertarErrorGps(error);
    } finally {
      setObteniendoGps(false);
    }
  }, [alertarErrorGps]);

  const registrarPunto = useCallback(async () => {
    if (!ubicacion.trim()) {
      Alert.alert('Ubicación requerida', 'Describa sector, calle o edificio en La Guaira.');
      return;
    }

    setGuardando(true);
    try {
      let lat = latitud;
      let lon = longitud;
      if (lat === undefined || lon === undefined) {
        const coords = await LocationService.obtenerCoordenadasActuales();
        lat = coords.latitud;
        lon = coords.longitud;
        setLatitud(lat);
        setLongitud(lon);
      }

      await repository.guardar({
        fuente_origen: OperacionConfig.FUENTE_ORIGEN,
        tipo_registro: tipoRegistro,
        nombre_completo: nombreCompleto.trim() || 'Anónimo',
        telefono_contacto: telefonoContacto.trim(),
        ciudad: ciudad.trim() || 'La Guaira',
        edad: edad.trim() || '0',
        genero,
        ubicacion_exacta: ubicacion.trim(),
        latitud: lat,
        longitud: lon,
        estado_actual: estado,
        estado_estructura: estadoEstructura,
        notas_paramedicos: notas.trim(),
        censo_personas: censoPersonas,
        tiene_hogar_actual: tieneHogarActual,
        direccion_origen: direccionOrigen.trim(),
        zona_afectada_tag: zonaAfectadaTag.trim() || `${ciudad.trim()}`,
        foto_estructura_b64: fotoEstructuraB64,
      });
      void HubSyncService.trasGuardar(repository);
      limpiarFormulario();
      setTabActiva('reportes');
    } catch (error) {
      if (error instanceof Error && error.message === 'PERMISO_GPS_DENEGADO') {
        alertarErrorGps(error);
      } else {
        Alert.alert('Error', 'No se pudo escribir en la base de datos. Reintente.');
      }
    } finally {
      setGuardando(false);
    }
  }, [
    repository,
    nombreCompleto,
    telefonoContacto,
    ciudad,
    edad,
    genero,
    ubicacion,
    latitud,
    longitud,
    estado,
    tipoRegistro,
    estadoEstructura,
    notas,
    censoPersonas,
    tieneHogarActual,
    direccionOrigen,
    zonaAfectadaTag,
    fotoEstructuraB64,
    limpiarFormulario,
    alertarErrorGps,
  ]);

  const comprimirParaSMS = useCallback(async () => {
    if (reportes.length === 0) {
      Alert.alert('Sin datos', 'No hay reportes para comprimir.');
      return;
    }
    const lotes = repository.comprimirParaSMSEnLotes();
    const textoCompleto = lotes.join('\n');
    await Clipboard.setStringAsync(textoCompleto);
    Alert.alert(
      'Reportes copiados',
      `${reportes.length} reporte(s) · ${lotes.length} mensaje(s)\nCopiado al portapapeles.`
    );
  }, [repository, reportes.length]);

  const navegarAlPunto = useCallback(async (item: ReporteEmergencia) => {
    if (item.latitud === 0 && item.longitud === 0) {
      Alert.alert('Sin GPS', 'Este reporte no tiene coordenadas para navegar.');
      return;
    }
    try {
      await NavigationService.navegarAlPunto(
        item.latitud,
        item.longitud,
        item.ubicacion_exacta || item.nombre_completo
      );
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo abrir mapas.';
      Alert.alert('Navegación', mensaje);
    }
  }, []);

  const mensajeParaPersona = useCallback((item: ReporteEmergencia): string => {
    const lugar =
      item.zona_afectada_tag || item.ubicacion_exacta || item.ciudad || 'su zona';
    return `Brigada de Rescate La Guaira (Mesh Network). Registramos su caso en ${lugar}. Responda a este mensaje o llame a este mismo numero para coordinar la ayuda.`;
  }, []);

  const contactarPersona = useCallback(
    async (item: ReporteEmergencia) => {
      const numero = SmsDirectService.normalizarVE(item.telefono_contacto);
      if (!numero) {
        Alert.alert('Sin teléfono', 'Este reporte no tiene un teléfono de contacto.');
        return;
      }
      try {
        await SmsDirectService.enviarMensaje(mensajeParaPersona(item), numero);
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : 'No se pudo abrir SMS.';
        Alert.alert('Mensaje', mensaje);
      }
    },
    [mensajeParaPersona]
  );

  const llamarPersona = useCallback(async (item: ReporteEmergencia) => {
    const numero = SmsDirectService.normalizarVE(item.telefono_contacto);
    if (!numero) {
      Alert.alert('Sin teléfono', 'Este reporte no tiene un teléfono de contacto.');
      return;
    }
    try {
      await Linking.openURL(`tel:${numero}`);
    } catch {
      Alert.alert('Llamada', 'No se pudo iniciar la llamada.');
    }
  }, []);

  const pegarYFusionar = useCallback(async () => {
    setImportando(true);
    try {
      let cadena = cadenaImport.trim();
      if (!cadena) {
        cadena = (await Clipboard.getStringAsync())?.trim() ?? '';
      }
      if (!cadena) {
        Alert.alert('Sin datos', 'Pegue el mensaje en el campo o cópielo al portapapeles.');
        return;
      }

      const resultado = await repository.importarYFusionarCadena(cadena);
      setCadenaImport('');
      Alert.alert(
        'Reportes agregados',
        `Nuevos: ${resultado.importados}\nActualizados: ${resultado.actualizados}\nIgnorados: ${resultado.ignorados}`
      );
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al importar datos.';
      Alert.alert('Error al importar', mensaje);
    } finally {
      setImportando(false);
    }
  }, [repository, cadenaImport]);

  const enviarTodosALaRed = useCallback(async () => {
    const res = await HubSyncService.sincronizarPendientes(repository);
    if (res.ok) {
      Alert.alert('Red central', res.subidos > 0 ? `${res.subidos} reporte(s) enviado(s).` : 'Todo al día, nada pendiente.');
    } else {
      Alert.alert('Red central', res.error ?? 'No se pudo enviar. Revise su internet.');
    }
  }, [repository]);

  const buscarEnRed = useCallback(async () => {
    const q = hubBuscarQuery.trim();
    if (!q) {
      setHubBuscarOut('Escriba un nombre o cédula.');
      return;
    }
    setHubBuscando(true);
    setHubBuscarOut('Buscando en la red…');
    try {
      const res = await fetch(`${OperacionConfig.HUB_BASE_URL}?action=buscar&query=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { error?: string; total?: number; coincidencias?: ReporteEmergencia[] };
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      const lineas = (data.coincidencias ?? []).map(
        (r) => `• ${r.nombre_completo} — ${r.estado_actual} (${r.ciudad ?? ''})`
      );
      setHubBuscarOut(`${data.total ?? 0} coincidencia(s):\n${lineas.join('\n') || 'Ninguna.'}`);
    } catch (error) {
      setHubBuscarOut(`No se pudo buscar: ${error instanceof Error ? error.message : 'error'}`);
    } finally {
      setHubBuscando(false);
    }
  }, [hubBuscarQuery]);

  const verZonas = useCallback(async () => {
    setHubZonasCargando(true);
    setHubZonasOut('Cargando zonas…');
    try {
      const res = await fetch(`${OperacionConfig.HUB_BASE_URL}?action=zonas`);
      const data = (await res.json()) as {
        error?: string;
        zonas?: { tag: string; total: number; sin_vivienda: number; criticos: number }[];
      };
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      const lineas = (data.zonas ?? []).map(
        (z) => `• ${z.tag}: ${z.total} total · ${z.sin_vivienda} sin vivienda · ${z.criticos} críticos`
      );
      setHubZonasOut(lineas.join('\n') || 'Sin zonas registradas.');
    } catch (error) {
      setHubZonasOut(`No se pudo cargar: ${error instanceof Error ? error.message : 'error'}`);
    } finally {
      setHubZonasCargando(false);
    }
  }, []);

  const verListado = useCallback(async () => {
    setHubListadoCargando(true);
    setHubListadoOut('Consultando la red…');
    try {
      const res = await fetch(`${OperacionConfig.HUB_BASE_URL}?action=consultar`);
      const data = (await res.json()) as { error?: string; total?: number; reportes?: ReporteEmergencia[] };
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      const lineas = (data.reportes ?? [])
        .slice(0, 25)
        .map((r) => `• ${r.nombre_completo} — ${r.estado_actual} (${r.zona_afectada_tag || r.ciudad || 's/zona'})`);
      setHubListadoOut(`${data.total ?? 0} reporte(s) en la red:\n${lineas.join('\n') || 'Sin reportes.'}`);
    } catch (error) {
      setHubListadoOut(`No se pudo consultar: ${error instanceof Error ? error.message : 'error'}`);
    } finally {
      setHubListadoCargando(false);
    }
  }, []);

  const abrirAliado = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Enlace', 'No se pudo abrir el enlace.');
    }
  }, []);

  const renderHeader = (titulo: string, kicker: string): React.JSX.Element => (
    <View style={styles.header}>
      <View style={styles.logoFrame}>
        <Image
          source={require('../../assets/logo.jpg')}
          style={styles.logo}
          accessibilityLabel="Mesh Network Venezuela"
        />
      </View>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.tituloEditorial}>{titulo}</Text>
      <View style={styles.divider} />
      <Text style={styles.badge}>Offline · GPS · SMS entre brigadas</Text>
    </View>
  );

  const renderSeccion = (kicker: string, titulo: string): React.JSX.Element => (
    <View style={styles.seccionHeader}>
      <Text style={styles.seccionKicker}>{kicker}</Text>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
    </View>
  );

  const renderItem = useCallback(({ item }: { item: ReporteEmergencia }) => {
    const borde = BORDE_ESTADO[item.estado_actual];
    const fotoUri = fotosCache[item.id]
      ? `data:image/jpeg;base64,${fotosCache[item.id]}`
      : null;

    return (
      <View style={[styles.card, { borderLeftColor: borde }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardEstado, { color: borde }]}>{item.estado_actual}</Text>
          <Text style={styles.cardId}>{item.id}</Text>
        </View>
        <Text style={styles.cardNombre}>
          {item.nombre_completo}
          {item.edad !== '0' ? ` · ${item.edad} años` : ''} · {item.genero}
        </Text>
        <Text style={styles.cardMeta}>
          {ETIQUETA_TIPO[item.tipo_registro]} · {item.fuente_origen}
          {item.tipo_registro !== 'PERSONA_ATRAPADA' ? ` · ${item.estado_estructura}` : ''}
        </Text>
        {item.zona_afectada_tag ? (
          <Text style={styles.cardZona}>Zona: {item.zona_afectada_tag}</Text>
        ) : null}
        <Text style={styles.cardHogar}>
          {item.tiene_hogar_actual ? 'Con vivienda' : 'SIN VIVIENDA — requiere refugio'}
        </Text>
        {item.censo_personas.length > 0 ? (
          <Text style={styles.cardCenso}>
            Censo ({item.censo_personas.length}): {item.censo_personas.join(', ')}
          </Text>
        ) : null}
        {item.direccion_origen ? (
          <Text style={styles.cardOrigen}>Origen: {item.direccion_origen}</Text>
        ) : null}
        {item.telefono_contacto ? (
          <Text style={styles.cardContacto}>{item.telefono_contacto}</Text>
        ) : null}
        {item.telefono_contacto ? (
          <View style={styles.cardAcciones}>
            <TouchableOpacity
              style={[styles.btnContacto, styles.btnMensaje]}
              onPress={() => contactarPersona(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnContactoText}>ENVIAR MENSAJE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnContacto, styles.btnLlamar]}
              onPress={() => llamarPersona(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnContactoText}>LLAMAR</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <Text style={styles.cardCiudad}>{item.ciudad}</Text>
        <Text style={styles.cardUbicacion}>{item.ubicacion_exacta}</Text>
        {item.latitud !== 0 || item.longitud !== 0 ? (
          <Text style={styles.cardGps}>
            {LocationService.formatearCoordenadas(item.latitud, item.longitud)}
          </Text>
        ) : null}
        {fotoUri ? (
          <Image source={{ uri: fotoUri }} style={styles.cardFoto} accessibilityLabel="Foto" />
        ) : null}
        {item.notas_paramedicos ? (
          <Text style={styles.cardNotas}>{item.notas_paramedicos}</Text>
        ) : null}
        {item.latitud !== 0 || item.longitud !== 0 ? (
          <TouchableOpacity
            style={styles.btnNavegar}
            onPress={() => navegarAlPunto(item)}
            activeOpacity={0.85}
          >
            <Text style={styles.btnNavegarText}>NAVEGAR AL PUNTO</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.cardTime}>
          {new Date(item.timestamp).toLocaleString('es-VE')}
        </Text>
      </View>
    );
  }, [navegarAlPunto, contactarPersona, llamarPersona, fotosCache]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={TacticalTheme.bg} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {tabActiva === 'registro' ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
            keyboardShouldPersistTaps="handled"
          >
            {renderHeader('Registrar', 'Brigada de rescate · La Guaira · funciona sin internet')}

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, tacticalGlow]}>
                <Text style={styles.statNumber}>{stats.total}</Text>
                <Text style={styles.statLabel}>Reportes</Text>
              </View>
              <View style={[styles.statCard, tacticalGlow]}>
                <Text style={[styles.statNumber, { color: TacticalTheme.critico }]}>{stats.criticos}</Text>
                <Text style={styles.statLabel}>Críticos</Text>
              </View>
              <View style={[styles.statCard, tacticalGlow]}>
                <Text style={[styles.statNumber, { color: TacticalTheme.ok }]}>{stats.localizados}</Text>
                <Text style={styles.statLabel}>Localizados</Text>
              </View>
              <View style={[styles.statCard, tacticalGlow]}>
                <Text style={styles.statNumber}>{stats.ciudades}</Text>
                <Text style={styles.statLabel}>Zonas</Text>
              </View>
            </View>

            <Text style={styles.heroDesc}>
              Registre puntos de rescate con GPS. Los datos se sincronizan entre brigadas por SMS.
            </Text>

            <View style={styles.panel}>
              {renderSeccion('1 — Tipo', '¿Qué está registrando?')}
              <View style={styles.tipoCol}>
                {TIPOS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tipoBtn, tipoRegistro === t && styles.tipoBtnActivo]}
                    onPress={() => setTipoRegistro(t)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.tipoBtnText, tipoRegistro === t && styles.tipoBtnTextActivo]}>
                      {ETIQUETA_TIPO[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              {renderSeccion('2 — Ubicación', 'Dónde es')}
              {latitud === undefined || longitud === undefined ? (
                <View style={styles.gpsAviso}>
                  <Text style={styles.gpsAvisoText}>
                    Sin GPS. Toque el botón azul y permita ubicación en su teléfono.
                  </Text>
                </View>
              ) : (
                <Text style={styles.gpsActivo}>
                  GPS activo: {LocationService.formatearCoordenadas(latitud, longitud)}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.btnGps, obteniendoGps && styles.btnDisabled]}
                onPress={capturarGps}
                disabled={obteniendoGps}
                activeOpacity={0.85}
              >
                <Text style={styles.btnGpsText}>
                  {obteniendoGps ? 'OBTENIENDO GPS…' : 'CAPTURAR COORDENADAS GPS'}
                </Text>
              </TouchableOpacity>
              <View style={styles.fieldInline}>
                <Text style={styles.label}>Ubicación exacta *</Text>
                <TextInput
                  style={styles.input}
                  value={ubicacion}
                  onChangeText={setUbicacion}
                  placeholder="Sector / calle / edificio"
                  placeholderTextColor={TacticalTheme.placeholder}
                />
              </View>
            </View>

            <View style={styles.panel}>
              {renderSeccion('3 — Triaje', 'Estado')}
              <View style={styles.estadoRow}>
                {ESTADOS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[
                      styles.estadoBtn,
                      estado === e && { backgroundColor: BORDE_ESTADO[e], borderColor: BORDE_ESTADO[e] },
                    ]}
                    onPress={() => setEstado(e)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.estadoText, estado === e && styles.estadoTextActivo]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              {renderSeccion('4 — Foto', 'Foto (opcional)')}
              <Text style={styles.fieldHint}>
                Ayuda a identificar a la persona o el daño. Se comprime y se guarda en el teléfono.
              </Text>
              <FotoEviccionCapture
                base64={fotoEstructuraB64}
                capturando={capturandoFoto}
                onCapturar={capturarFotoEviccion}
              />
            </View>

            <TouchableOpacity
              style={[styles.btnEmergencia, guardando && styles.btnDisabled]}
              onPress={registrarPunto}
              activeOpacity={0.85}
              disabled={guardando}
            >
              <Text style={styles.btnEmergenciaText}>
                {guardando ? 'GUARDANDO…' : 'GUARDAR PUNTO DE RESCATE'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.collapsible}
              onPress={() => setMasDatosAbierto((v) => !v)}
              activeOpacity={0.85}
            >
              <Text style={styles.collapsibleText}>
                Más datos (opcional): contacto, edad, censo, notas…
              </Text>
              <Text style={styles.collapsibleIcon}>{masDatosAbierto ? '−' : '+'}</Text>
            </TouchableOpacity>

            {masDatosAbierto ? (
              <View>
                <View style={styles.fieldBox}>
                  <Text style={styles.label}>Teléfono, WhatsApp o correo</Text>
                  <TextInput
                    style={styles.input}
                    value={telefonoContacto}
                    onChangeText={setTelefonoContacto}
                    placeholder="04121234567"
                    placeholderTextColor={TacticalTheme.placeholder}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.fieldBox}>
                  <Text style={styles.label}>Nombre completo</Text>
                  <TextInput
                    style={styles.input}
                    value={nombreCompleto}
                    onChangeText={setNombreCompleto}
                    placeholder="Ej: Juan Pérez (opcional)"
                    placeholderTextColor={TacticalTheme.placeholder}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.fieldBox}>
                  <Text style={styles.label}>Ciudad</Text>
                  <View style={styles.chips}>
                    {OperacionConfig.CIUDADES_LA_GUAIRA.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.chip, ciudad === c && styles.chipActivo]}
                        onPress={() => setCiudad(c)}
                      >
                        <Text style={[styles.chipText, ciudad === c && styles.chipTextActivo]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.fieldBox, styles.half]}>
                    <Text style={styles.label}>Edad</Text>
                    <TextInput
                      style={styles.input}
                      value={edad}
                      onChangeText={setEdad}
                      placeholder="34"
                      placeholderTextColor={TacticalTheme.placeholder}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>
                  <View style={[styles.fieldBox, styles.half]}>
                    <Text style={styles.label}>Género</Text>
                    <View style={styles.chips}>
                      {GENEROS.map((g) => (
                        <TouchableOpacity
                          key={g}
                          style={[styles.chip, genero === g && styles.chipActivo]}
                          onPress={() => setGenero(g)}
                        >
                          <Text style={[styles.chipText, genero === g && styles.chipTextActivo]}>{g}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {tipoRegistro !== 'PERSONA_ATRAPADA' ? (
                  <View style={styles.fieldBox}>
                    <Text style={styles.label}>Estado de estructura / vivienda</Text>
                    <View style={styles.chips}>
                      {ESTRUCTURAS.map((es) => (
                        <TouchableOpacity
                          key={es}
                          style={[styles.chip, estadoEstructura === es && styles.chipActivo]}
                          onPress={() => setEstadoEstructura(es)}
                        >
                          <Text style={[styles.chipText, estadoEstructura === es && styles.chipTextActivo]}>
                            {es.replace('_', ' ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={styles.fieldBox}>
                  <Text style={styles.label}>Zona afectada (sector)</Text>
                  <TextInput
                    style={styles.input}
                    value={zonaAfectadaTag}
                    onChangeText={setZonaAfectadaTag}
                    placeholder="Ej: Macuto-El Cojo"
                    placeholderTextColor={TacticalTheme.placeholder}
                  />
                  <View style={[styles.chips, { marginTop: 10 }]}>
                    {OperacionConfig.ZONAS_SUGERIDAS.map((z) => (
                      <TouchableOpacity
                        key={z}
                        style={[styles.chip, zonaAfectadaTag === z && styles.chipActivo]}
                        onPress={() => setZonaAfectadaTag(z)}
                      >
                        <Text style={[styles.chipText, zonaAfectadaTag === z && styles.chipTextActivo]}>{z}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.fieldBox}>
                  <Text style={styles.label}>Dirección de origen</Text>
                  <TextInput
                    style={styles.input}
                    value={direccionOrigen}
                    onChangeText={setDireccionOrigen}
                    placeholder="De dónde es la familia originalmente"
                    placeholderTextColor={TacticalTheme.placeholder}
                  />
                </View>

                <View style={styles.fieldBox}>
                  <Text style={styles.label}>Censo del grupo / refugio</Text>
                  <CensoPersonasInput personas={censoPersonas} onChange={setCensoPersonas} />
                </View>

                <View style={styles.fieldBox}>
                  <View style={styles.switchRow}>
                    <Text style={styles.labelSwitch}>Requiere vivienda de emergencia</Text>
                    <Switch
                      value={!tieneHogarActual}
                      onValueChange={(v) => setTieneHogarActual(!v)}
                      trackColor={{ false: TacticalTheme.border, true: TacticalTheme.critico }}
                      thumbColor={TacticalTheme.surfaceElevated}
                    />
                  </View>
                </View>

                <View style={styles.fieldBox}>
                  <Text style={styles.label}>Notas del paramédico</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={notas}
                    onChangeText={setNotas}
                    placeholder="Ej: Se escuchan ruidos bajo la losa oeste"
                    placeholderTextColor={TacticalTheme.placeholder}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {tabActiva === 'reportes' ? (
          <FlatList
            data={busquedaTactica.trim() ? reportesFiltrados : reportes}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={styles.lista}
            contentContainerStyle={[styles.listaContent, { paddingBottom: insets.bottom + 96 }]}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View>
                <View style={styles.listaHeader}>
                  <Text style={styles.listaTitulo}>Reportes en dispositivo</Text>
                  <Text style={styles.listaCount}>
                    {(busquedaTactica.trim() ? reportesFiltrados : reportes).length} activos
                  </Text>
                </View>
                <TacticalSearchBar value={busquedaTactica} onChangeText={setBusquedaTactica} />

                <TouchableOpacity
                  style={styles.collapsible}
                  onPress={() => setCompartirAbierto((v) => !v)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.collapsibleText}>
                    Compartir / recibir reportes por mensaje (entre brigadas)
                  </Text>
                  <Text style={styles.collapsibleIcon}>{compartirAbierto ? '−' : '+'}</Text>
                </TouchableOpacity>

                {compartirAbierto ? (
                  <View style={styles.panel}>
                    {pendientesHub > 0 ? (
                      <Text style={styles.smsPendiente}>
                        {pendientesHub} pendiente(s) de subir a la red (auto con internet)
                      </Text>
                    ) : null}
                    <Text style={styles.label}>Reportes para compartir</Text>
                    <ScrollView style={styles.smsBox} nestedScrollEnabled>
                      <Text style={styles.smsBoxText} selectable>
                        {cadenaComprimida}
                      </Text>
                    </ScrollView>
                    <TouchableOpacity style={styles.btnCopiar} onPress={comprimirParaSMS} activeOpacity={0.85}>
                      <Text style={styles.btnCopiarText}>COPIAR REPORTES PARA COMPARTIR</Text>
                    </TouchableOpacity>

                    <Text style={[styles.label, { marginTop: 14 }]}>Importar de otra brigada</Text>
                    <TextInput
                      style={styles.syncInput}
                      value={cadenaImport}
                      onChangeText={setCadenaImport}
                      placeholder="Pegue aquí el mensaje que recibió de otra brigada…"
                      placeholderTextColor={TacticalTheme.placeholder}
                      multiline
                      numberOfLines={4}
                    />
                    <TouchableOpacity
                      style={[styles.btnFusionar, importando && styles.btnDisabled]}
                      onPress={pegarYFusionar}
                      activeOpacity={0.85}
                      disabled={importando}
                    >
                      <Text style={styles.btnFusionarText}>
                        {importando ? 'AGREGANDO…' : 'AGREGAR REPORTES RECIBIDOS'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btnFusionar, { marginTop: 10 }]}
                      onPress={enviarTodosALaRed}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.btnFusionarText}>ENVIAR TODOS A LA RED</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                Sin registros. Registre un punto con ubicación y GPS.
              </Text>
            }
          />
        ) : null}

        {tabActiva === 'red' ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
            keyboardShouldPersistTaps="handled"
          >
            {renderHeader('Red', 'Red compartida · coordinación entre equipos')}

            <View style={styles.panel}>
              <Text style={styles.panelKicker}>Red compartida</Text>
              <Text style={styles.panelTitle}>Red de brigadas y plataformas</Text>
              <Text style={styles.panelDesc}>
                Esta app captura datos en campo y sin internet. Cuando hay señal, los reportes se comparten por
                SMS entre brigadas y se publican a la red para que otras plataformas los consulten sin duplicar.
              </Text>
              <Text style={[styles.panelDesc, { marginTop: 12 }]}>
                <Text style={styles.comandoStrong}>Brigada:</Text> {OperacionConfig.BRIGADA_ID}
              </Text>
              <Text style={styles.panelDesc}>
                <Text style={styles.comandoStrong}>SMS comando:</Text> {OperacionConfig.COMANDO_CENTRAL_SMS}
              </Text>
            </View>

            <View style={styles.panel}>
              {renderSeccion('Consulta', 'Buscar persona')}
              <TextInput
                style={styles.input}
                value={hubBuscarQuery}
                onChangeText={setHubBuscarQuery}
                placeholder="Ej: María López"
                placeholderTextColor={TacticalTheme.placeholder}
              />
              <TouchableOpacity
                style={[styles.btnCopiar, { marginTop: 12 }, hubBuscando && styles.btnDisabled]}
                onPress={buscarEnRed}
                disabled={hubBuscando}
                activeOpacity={0.85}
              >
                <Text style={styles.btnCopiarText}>{hubBuscando ? 'BUSCANDO…' : 'BUSCAR EN LA RED'}</Text>
              </TouchableOpacity>
              <View style={styles.hubBox}>
                <Text style={styles.hubBoxText} selectable>{hubBuscarOut}</Text>
              </View>
            </View>

            <View style={styles.panel}>
              {renderSeccion('Resumen', 'Zonas afectadas')}
              <TouchableOpacity
                style={[styles.btnFusionar, hubZonasCargando && styles.btnDisabled]}
                onPress={verZonas}
                disabled={hubZonasCargando}
                activeOpacity={0.85}
              >
                <Text style={styles.btnFusionarText}>{hubZonasCargando ? 'CARGANDO…' : 'VER ZONAS AFECTADAS'}</Text>
              </TouchableOpacity>
              <View style={styles.hubBox}>
                <Text style={styles.hubBoxText} selectable>{hubZonasOut}</Text>
              </View>
            </View>

            <View style={styles.panel}>
              {renderSeccion('Listado', 'Todos los reportes')}
              <TouchableOpacity
                style={[styles.btnCopiar, hubListadoCargando && styles.btnDisabled]}
                onPress={verListado}
                disabled={hubListadoCargando}
                activeOpacity={0.85}
              >
                <Text style={styles.btnCopiarText}>{hubListadoCargando ? 'CONSULTANDO…' : 'VER LISTADO COMPLETO'}</Text>
              </TouchableOpacity>
              <View style={styles.hubBox}>
                <Text style={styles.hubBoxText} selectable>{hubListadoOut}</Text>
              </View>
            </View>

            <View style={styles.panel}>
              {renderSeccion('Aliados', 'Plataformas aliadas')}
              <Text style={styles.fieldHint}>
                Esta app cubre el campo offline; estas webs cubren la parte online. Si un caso ya está aquí, no
                hace falta duplicarlo.
              </Text>
              {ALIADOS.map((a) => (
                <TouchableOpacity
                  key={a.url}
                  style={styles.aliado}
                  onPress={() => abrirAliado(a.url)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.aliadoTitulo}>{a.titulo}</Text>
                  <Text style={styles.aliadoHost}>{a.host}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : null}

        <View style={[styles.bottomNav, tacticalGlow, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          {TABS.map((tab) => {
            const activa = tabActiva === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.navItem, activa && styles.navItemActiva]}
                onPress={() => setTabActiva(tab.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.navLabel, activa && styles.navLabelActiva]}>{tab.label}</Text>
                {activa ? <View style={styles.navIndicator} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const T = TacticalTheme;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: T.bg },
  scrollContent: { paddingHorizontal: 18, paddingTop: 12 },
  header: { marginBottom: 18 },
  logoFrame: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    ...tacticalGlow,
  },
  logo: { width: '100%', height: 120, resizeMode: 'contain' },
  kicker: {
    color: T.inkMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tituloEditorial: { color: T.ink, fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  divider: { height: 3, backgroundColor: T.inkMuted, width: 48, marginVertical: 12, borderRadius: 2 },
  badge: {
    color: T.inkMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  statNumber: { color: T.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  statLabel: {
    color: T.inkMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  heroDesc: { color: T.inkMuted, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  panel: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    borderLeftWidth: 4,
    borderLeftColor: T.accent,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...tacticalGlow,
  },
  panelKicker: {
    color: T.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  panelTitle: { color: T.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginBottom: 10 },
  panelDesc: { color: T.inkMuted, fontSize: 14, lineHeight: 22 },
  comandoStrong: { color: T.ink, fontWeight: '800' },
  seccionHeader: { marginBottom: 14 },
  seccionKicker: {
    color: T.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  seccionTitulo: { color: T.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  tipoCol: { gap: 10 },
  tipoBtn: {
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: 12,
    backgroundColor: T.bg,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  tipoBtnActivo: { backgroundColor: T.accent, borderColor: T.accent },
  tipoBtnText: { color: T.inkMuted, fontWeight: '700', fontSize: 14 },
  tipoBtnTextActivo: { color: '#FFFFFF' },
  fieldInline: { marginTop: 14 },
  fieldBox: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    ...tacticalGlow,
  },
  label: {
    color: T.ink,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  fieldHint: { color: T.inkMuted, fontSize: 13, lineHeight: 20, marginBottom: 10 },
  input: {
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderBottomWidth: 2,
    borderBottomColor: T.border,
    borderRadius: 10,
    color: T.ink,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  btnGps: {
    backgroundColor: T.accentDark,
    borderWidth: 2,
    borderColor: T.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnGpsText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  gpsActivo: { color: T.accent, fontSize: 13, fontWeight: '700', marginBottom: 12 },
  gpsAviso: {
    backgroundColor: '#FFF3D6',
    borderWidth: 2,
    borderColor: T.alerta,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  gpsAvisoText: { color: T.ink, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  estadoRow: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: 10,
    backgroundColor: T.bg,
  },
  chipActivo: { backgroundColor: T.inkMuted, borderColor: T.inkMuted },
  chipText: { color: T.inkMuted, fontWeight: '700', fontSize: 13 },
  chipTextActivo: { color: '#FFFFFF' },
  estadoBtn: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: 12,
    backgroundColor: T.bg,
    alignItems: 'center',
  },
  estadoText: { color: T.inkDim, fontSize: 10, fontWeight: '800', textAlign: 'center', letterSpacing: 0.4 },
  estadoTextActivo: { color: '#FFFFFF' },
  btnEmergencia: {
    backgroundColor: T.critico,
    borderWidth: 2,
    borderColor: T.critico,
    borderRadius: 14,
    paddingVertical: 18,
    marginTop: 4,
    marginBottom: 16,
    alignItems: 'center',
    ...tacticalGlow,
  },
  btnEmergenciaText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  btnDisabled: { opacity: 0.5 },
  collapsible: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T.surface,
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  collapsibleText: { color: T.ink, fontSize: 13, fontWeight: '700', flex: 1, paddingRight: 12 },
  collapsibleIcon: { color: T.accent, fontSize: 22, fontWeight: '800' },
  listaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 14,
    marginBottom: 14,
  },
  listaTitulo: { color: T.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, flex: 1 },
  listaCount: { color: T.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  lista: { flex: 1, paddingHorizontal: 18 },
  listaContent: { paddingTop: 8 },
  card: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    borderLeftWidth: 5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...tacticalGlow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardEstado: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  cardId: { color: T.inkDim, fontSize: 9, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  cardNombre: { color: T.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  cardMeta: { color: T.accent, fontSize: 11, marginTop: 4, fontWeight: '700' },
  cardZona: { color: T.accentDark, fontSize: 11, marginTop: 6, fontWeight: '800' },
  cardHogar: { color: T.alerta, fontSize: 11, marginTop: 4, fontWeight: '700' },
  cardCenso: { color: T.inkMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  cardOrigen: { color: T.inkMuted, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  cardFoto: { width: '100%', height: 140, marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: T.border },
  cardContacto: { color: T.ok, fontSize: 13, marginTop: 6, fontWeight: '700' },
  cardCiudad: {
    color: T.inkMuted,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardUbicacion: { color: T.inkMuted, fontSize: 14, marginTop: 6, lineHeight: 20 },
  cardGps: {
    color: T.accent,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cardNotas: { color: T.inkMuted, fontSize: 13, marginTop: 8, fontStyle: 'italic', lineHeight: 20 },
  btnNavegar: {
    backgroundColor: T.bg,
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnNavegarText: { color: T.ink, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  cardAcciones: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnContacto: { flex: 1, borderWidth: 2, borderColor: T.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnMensaje: { backgroundColor: T.accentDark },
  btnLlamar: { backgroundColor: T.ok, borderColor: T.ok },
  btnContactoText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  cardTime: { color: T.inkDim, fontSize: 10, marginTop: 10 },
  emptyText: {
    color: T.inkMuted,
    textAlign: 'center',
    marginTop: 32,
    fontSize: 14,
    lineHeight: 22,
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: 14,
    borderStyle: 'dashed',
    padding: 32,
  },
  smsPendiente: { color: T.alerta, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  smsBox: {
    backgroundColor: T.bg,
    borderWidth: 2,
    borderColor: T.accent,
    borderRadius: 10,
    maxHeight: 120,
    padding: 12,
    marginBottom: 10,
  },
  smsBoxText: {
    color: T.accent,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  btnCopiar: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.inkMuted,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnCopiarText: { color: T.ink, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  syncInput: {
    backgroundColor: T.bg,
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: 10,
    color: T.ink,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 88,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  btnFusionar: {
    backgroundColor: T.accentDark,
    borderWidth: 2,
    borderColor: T.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnFusionarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  hubBox: {
    backgroundColor: T.bg,
    borderWidth: 2,
    borderColor: T.accent,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  hubBoxText: { color: T.ink, fontSize: 13, lineHeight: 20 },
  aliado: {
    backgroundColor: T.bg,
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  aliadoTitulo: { color: T.ink, fontSize: 14, fontWeight: '800' },
  aliadoHost: { color: T.accent, fontSize: 12, marginTop: 4, fontWeight: '600' },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: T.surfaceElevated,
    borderTopWidth: 2,
    borderTopColor: T.border,
    paddingTop: 10,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  labelSwitch: { color: T.ink, fontSize: 13, fontWeight: '700', flex: 1 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8, position: 'relative' },
  navItemActiva: { backgroundColor: T.surface },
  navLabel: { color: T.inkDim, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  navLabelActiva: { color: T.ink, fontWeight: '800' },
  navIndicator: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 3, backgroundColor: T.accent },
});
