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
  INFRAESTRUCTURA_DANADA: 'Infraestructura',
  SIN_VIVIENDA: 'Sin vivienda',
};

type TabId = 'inicio' | 'registro' | 'reportes' | 'sms' | 'comando';

const TABS: { id: TabId; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'registro', label: 'Registro' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'sms', label: 'Enlace' },
  { id: 'comando', label: 'Comando' },
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
  const [tabActiva, setTabActiva] = useState<TabId>('inicio');
  const [censoPersonas, setCensoPersonas] = useState<string[]>([]);
  const [tieneHogarActual, setTieneHogarActual] = useState(true);
  const [direccionOrigen, setDireccionOrigen] = useState('');
  const [zonaAfectadaTag, setZonaAfectadaTag] = useState('');
  const [fotoEstructuraB64, setFotoEstructuraB64] = useState('');
  const [capturandoFoto, setCapturandoFoto] = useState(false);
  const [fotosCache, setFotosCache] = useState<Record<string, string>>({});
  const [pendientesHub, setPendientesHub] = useState(0);

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
        '🛰️ GPS CAPTURADO',
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
        Alert.alert('Error SQLite', 'No se pudo escribir en la base de datos. Reintente.');
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
      '📲 Cadena comprimida',
      `${reportes.length} reporte(s) · ${lotes.length} lote(s) SMS\nCopiado al portapapeles.`
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
      Alert.alert('⚠ NAVEGACIÓN', mensaje);
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
        Alert.alert('⚠ MENSAJE', mensaje);
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
      Alert.alert('⚠ LLAMADA', 'No se pudo iniciar la llamada.');
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
        Alert.alert('⚠ SIN DATOS', 'Pegue la cadena SMS en el campo o cópiela al portapapeles.');
        return;
      }

      const resultado = await repository.importarYFusionarCadena(cadena);
      setCadenaImport('');
      Alert.alert(
        '📥 FUSIÓN COMPLETADA',
        `Nuevos: ${resultado.importados}\nActualizados: ${resultado.actualizados}\nIgnorados: ${resultado.ignorados}`
      );
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al importar datos.';
      Alert.alert('⚠ ERROR DE IMPORTACIÓN', mensaje);
    } finally {
      setImportando(false);
    }
  }, [repository, cadenaImport]);

  const renderHeader = (): React.JSX.Element => (
    <View style={styles.header}>
      <View style={styles.logoFrame}>
        <Image
          source={require('../../assets/logo.jpg')}
          style={styles.logo}
          accessibilityLabel="Mesh Network Venezuela"
        />
      </View>
      <Text style={styles.appNombre}>Mesh Network Venezuela</Text>
      <Text style={styles.kicker}>Unidad de registro táctico · La Guaira</Text>
      <Text style={styles.tituloEditorial}>Mesh{'\n'}Network</Text>
      <View style={styles.divider} />
      <Text style={styles.badge}>{OperacionConfig.VERSION_DATOS} · GPS · SMS · Hub</Text>
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
              activeOpacity={0.8}
            >
              <Text style={styles.btnContactoText}>ENVIAR MENSAJE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnContacto, styles.btnLlamar]}
              onPress={() => llamarPersona(item)}
              activeOpacity={0.8}
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
          <Image source={{ uri: fotoUri }} style={styles.cardFoto} accessibilityLabel="Foto evicción" />
        ) : null}
        {item.notas_paramedicos ? (
          <Text style={styles.cardNotas}>{item.notas_paramedicos}</Text>
        ) : null}
        {item.latitud !== 0 || item.longitud !== 0 ? (
          <TouchableOpacity
            style={styles.btnNavegar}
            onPress={() => navegarAlPunto(item)}
            activeOpacity={0.8}
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
      <StatusBar barStyle="light-content" backgroundColor={TacticalTheme.bg} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {tabActiva === 'inicio' ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 88 }]}
          >
            {renderHeader()}

            <View style={styles.panel}>
              <Text style={styles.panelKicker}>01 — Operación activa</Text>
              <Text style={styles.panelTitle}>Red de rescate local</Text>
              <Text style={styles.panelDesc}>
                Registre puntos de rescate con GPS. Los datos se sincronizan entre brigadas por SMS.
              </Text>
              <View style={styles.statsRow}>
                <View style={[styles.statCard, tacticalGlow]}>
                  <Text style={styles.statNumber}>{stats.total}</Text>
                  <Text style={styles.statLabel}>Reportes</Text>
                </View>
                <View style={[styles.statCard, tacticalGlow]}>
                  <Text style={[styles.statNumber, { color: TacticalTheme.critico }]}>
                    {stats.criticos}
                  </Text>
                  <Text style={styles.statLabel}>Críticos</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={[styles.statCard, tacticalGlow]}>
                  <Text style={[styles.statNumber, { color: TacticalTheme.ok }]}>
                    {stats.localizados}
                  </Text>
                  <Text style={styles.statLabel}>Localizados</Text>
                </View>
                <View style={[styles.statCard, tacticalGlow]}>
                  <Text style={styles.statNumber}>{stats.ciudades}</Text>
                  <Text style={styles.statLabel}>Zonas</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, tacticalGlow]}
              onPress={() => setTabActiva('registro')}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>Registrar punto de rescate</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}

        {tabActiva === 'registro' ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 88 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.panel}>
              <Text style={styles.panelKicker}>02 — Personas afectadas</Text>
              <Text style={styles.panelTitle}>Registro en campo</Text>
              <Text style={styles.panelDesc}>
                Complete los datos clave. No comparta información sensible de terceros sin permiso.
              </Text>
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.label}>Tipo de registro</Text>
              <View style={styles.chips}>
                {TIPOS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, tipoRegistro === t && styles.chipActivo]}
                    onPress={() => setTipoRegistro(t)}
                  >
                    <Text style={[styles.chipText, tipoRegistro === t && styles.chipTextActivo]}>
                      {ETIQUETA_TIPO[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.label}>Teléfono, WhatsApp o correo</Text>
              <TextInput
                style={styles.input}
                value={telefonoContacto}
                onChangeText={setTelefonoContacto}
                placeholder="+58 412 000 0000"
                placeholderTextColor="#555555"
                keyboardType="phone-pad"
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
                    <Text style={[styles.chipText, ciudad === c && styles.chipTextActivo]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.label}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                value={nombreCompleto}
                onChangeText={setNombreCompleto}
                placeholder="Ej: Juan Pérez (opcional)"
                placeholderTextColor="#555555"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldBox, styles.half]}>
                <Text style={styles.label}>Edad</Text>
                <TextInput
                  style={styles.input}
                  value={edad}
                  onChangeText={setEdad}
                  placeholder="34"
                  placeholderTextColor="#555555"
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
                      <Text style={[styles.chipText, genero === g && styles.chipTextActivo]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.label}>Ubicación exacta *</Text>
              {latitud === undefined || longitud === undefined ? (
                <View style={styles.gpsAviso}>
                  <Text style={styles.gpsAvisoText}>
                    Sin GPS. Toque el botón azul y permita ubicación en su teléfono.
                  </Text>
                </View>
              ) : null}
              <TextInput
                style={[styles.input, styles.inputGrande]}
                value={ubicacion}
                onChangeText={setUbicacion}
                placeholder="Sector / calle / edificio"
                placeholderTextColor="#555555"
              />
              <TouchableOpacity
                style={[styles.btnGps, obteniendoGps && styles.btnDisabled]}
                onPress={capturarGps}
                disabled={obteniendoGps}
                activeOpacity={0.8}
              >
                <Text style={styles.btnGpsText}>
                  {obteniendoGps ? 'Obteniendo GPS…' : 'Capturar coordenadas GPS'}
                </Text>
              </TouchableOpacity>
              {latitud !== undefined && longitud !== undefined ? (
                <Text style={styles.gpsActivo}>
                  GPS activo: {LocationService.formatearCoordenadas(latitud, longitud)}
                </Text>
              ) : null}
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.label}>
                Estado actual (prioridad: CRÍTICO → POR LOCALIZAR → LOCALIZADO)
              </Text>
              <View style={styles.chips}>
                {ESTADOS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[
                      styles.estadoBtn,
                      estado === e && {
                        backgroundColor: BORDE_ESTADO[e],
                        borderColor: BORDE_ESTADO[e],
                      },
                    ]}
                    onPress={() => setEstado(e)}
                  >
                    <Text style={[styles.estadoText, estado === e && styles.estadoTextActivo]}>
                      {e}
                    </Text>
                  </TouchableOpacity>
                ))}
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
                      <Text
                        style={[styles.chipText, estadoEstructura === es && styles.chipTextActivo]}
                      >
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
                placeholderTextColor="#555555"
              />
              <View style={[styles.chips, { marginTop: 10 }]}>
                {OperacionConfig.ZONAS_SUGERIDAS.map((z) => (
                  <TouchableOpacity
                    key={z}
                    style={[styles.chip, zonaAfectadaTag === z && styles.chipActivo]}
                    onPress={() => setZonaAfectadaTag(z)}
                  >
                    <Text style={[styles.chipText, zonaAfectadaTag === z && styles.chipTextActivo]}>
                      {z}
                    </Text>
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
                placeholderTextColor="#555555"
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
                  trackColor={{ false: TacticalTheme.inkDim, true: TacticalTheme.critico }}
                  thumbColor={TacticalTheme.ink}
                />
              </View>
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.label}>Foto de evicción / estructura</Text>
              <FotoEviccionCapture
                base64={fotoEstructuraB64}
                capturando={capturandoFoto}
                onCapturar={capturarFotoEviccion}
              />
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.label}>Notas del paramédico</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={notas}
                onChangeText={setNotas}
                placeholder="Ej: Se escuchan ruidos bajo la losa oeste"
                placeholderTextColor="#555555"
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[styles.btnEmergencia, guardando && styles.btnDisabled]}
              onPress={registrarPunto}
              activeOpacity={0.8}
              disabled={guardando}
            >
              <Text style={styles.btnEmergenciaText}>
                {guardando ? 'Guardando en disco…' : 'Registrar punto de rescate'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}

        {tabActiva === 'reportes' ? (
          <FlatList
            data={busquedaTactica.trim() ? reportesFiltrados : reportes}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={styles.lista}
            contentContainerStyle={[styles.listaContent, { paddingBottom: insets.bottom + 88 }]}
            ListHeaderComponent={
              <View style={styles.listaHeader}>
                <Text style={styles.listaTitulo}>Reportes en dispositivo</Text>
                <Text style={styles.listaCount}>
                  {(busquedaTactica.trim() ? reportesFiltrados : reportes).length} activos
                </Text>
                <TacticalSearchBar value={busquedaTactica} onChangeText={setBusquedaTactica} />
              </View>
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                Sin registros. Registre un punto con ubicación y GPS.
              </Text>
            }
          />
        ) : null}

        {tabActiva === 'sms' ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 88 }]}
          >
            <View style={[styles.panel, styles.smsPanel]}>
              <Text style={styles.smsTitle}>Enlace SMS</Text>
              {pendientesHub > 0 ? (
                <Text style={styles.smsPendiente}>
                  {pendientesHub} pendiente(s) de subir al Hub (auto con internet)
                </Text>
              ) : null}
              <Text style={styles.smsMeta}>
                Comparta sus reportes con otra brigada: copie la cadena y péguela en un mensaje.
                {'\n'}
                Protocolo {OperacionConfig.VERSION_DATOS} · Lotes MNv2|1/3|... (sin foto)
              </Text>
              <ScrollView style={styles.smsBox} nestedScrollEnabled>
                <Text style={styles.smsBoxText} selectable>
                  {cadenaComprimida}
                </Text>
              </ScrollView>
              <TouchableOpacity
                style={styles.btnCopiarCadena}
                onPress={comprimirParaSMS}
                activeOpacity={0.8}
              >
                <Text style={styles.btnCopiarCadenaText}>Copiar cadena comprimida</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.syncInput}
                value={cadenaImport}
                onChangeText={setCadenaImport}
                placeholder="Pegue cadena JSON o lotes MNv1|1/3|..."
                placeholderTextColor="#555555"
                multiline
                numberOfLines={4}
              />
              <TouchableOpacity
                style={[styles.btnFusionar, importando && styles.btnDisabled]}
                onPress={pegarYFusionar}
                activeOpacity={0.8}
                disabled={importando}
              >
                <Text style={styles.btnFusionarText}>
                  {importando ? 'Fusionando…' : '📥 PEGAR Y FUSIONAR SMS'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : null}

        {tabActiva === 'comando' ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 88 }]}
          >
            {renderHeader()}
            <View style={styles.panel}>
              <Text style={styles.panelKicker}>04 — Comando central</Text>
              <Text style={styles.panelTitle}>{OperacionConfig.NOMBRE_COMANDO}</Text>
              <Text style={styles.panelDesc}>
                Mesh Network Venezuela opera de forma autónoma. Los reportes se transmiten por SMS al
                comando cuando hay señal.
              </Text>
              <Text style={[styles.panelDesc, styles.comandoLinea]}>
                <Text style={styles.comandoStrong}>Brigada:</Text> {OperacionConfig.BRIGADA_ID}
              </Text>
              <Text style={styles.panelDesc}>
                <Text style={styles.comandoStrong}>SMS:</Text> {OperacionConfig.COMANDO_CENTRAL_SMS}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btnPrimary, tacticalGlow]}
              onPress={() => setTabActiva('registro')}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>Ir a registro en campo</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}

        <View style={[styles.bottomNav, tacticalGlow, { paddingBottom: insets.bottom + 8 }]}>
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  header: { marginBottom: 24 },
  logoFrame: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    padding: 12,
    marginBottom: 16,
    ...tacticalGlow,
  },
  logo: { width: '100%', height: 140, resizeMode: 'contain' },
  appNombre: {
    color: T.ink,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  kicker: {
    color: T.inkMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tituloEditorial: {
    color: T.ink,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 44,
  },
  divider: { height: 3, backgroundColor: T.ink, width: 48, marginVertical: 14 },
  badge: {
    color: T.accentDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
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
  panelTitle: {
    color: T.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  panelDesc: { color: T.inkMuted, fontSize: 14, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statCard: {
    flex: 1,
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
  },
  statNumber: { color: T.ink, fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  statLabel: {
    color: T.inkMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  btnPrimary: {
    backgroundColor: T.accent,
    borderWidth: 2,
    borderColor: T.accent,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnPrimaryText: {
    color: T.bg,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  comandoLabel: {
    color: T.inkMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  comandoValor: { color: T.ink, fontSize: 15, fontWeight: '800', marginTop: 2 },
  comandoLinea: { marginTop: 12 },
  comandoStrong: { color: T.ink, fontWeight: '800' },
  fieldBox: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    padding: 14,
    marginBottom: 12,
    ...tacticalGlow,
  },
  label: {
    color: T.ink,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderBottomWidth: 2,
    borderBottomColor: T.border,
    color: T.ink,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputGrande: { fontSize: 17, minHeight: 48 },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  btnGps: {
    marginTop: 12,
    backgroundColor: T.accentDark,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnGpsText: {
    color: T.bg,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  gpsActivo: { color: T.accentDark, fontSize: 12, fontWeight: '600', marginTop: 10 },
  gpsAviso: {
    backgroundColor: '#1A1A00',
    borderWidth: 2,
    borderColor: T.alerta,
    padding: 10,
    marginBottom: 10,
  },
  gpsAvisoText: { color: T.ink, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: T.bg,
  },
  chipActivo: { backgroundColor: T.accent, borderColor: T.accent },
  chipText: { color: T.inkMuted, fontWeight: '700', fontSize: 12 },
  chipTextActivo: { color: T.bg },
  estadoBtn: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: T.bg,
    alignItems: 'center',
  },
  estadoText: {
    color: T.inkMuted,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  estadoTextActivo: { color: T.bg },
  btnEmergencia: {
    backgroundColor: T.critico,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 20,
    marginTop: 8,
    marginBottom: 24,
    alignItems: 'center',
    ...tacticalGlow,
  },
  btnEmergenciaText: {
    color: T.bg,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  btnDisabled: { opacity: 0.5 },
  listaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 16,
    marginBottom: 16,
  },
  listaTitulo: {
    color: T.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    flex: 1,
  },
  listaCount: {
    color: T.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lista: { flex: 1, paddingHorizontal: 20 },
  listaContent: { paddingBottom: 16, paddingTop: 8 },
  card: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    borderLeftWidth: 5,
    padding: 16,
    marginBottom: 12,
    ...tacticalGlow,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardEstado: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  cardId: { color: T.inkDim, fontSize: 9, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  cardNombre: { color: T.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  cardMeta: { color: T.accent, fontSize: 11, marginTop: 4, fontWeight: '700' },
  cardZona: { color: T.accentDark, fontSize: 11, marginTop: 6, fontWeight: '800' },
  cardHogar: { color: T.alerta, fontSize: 11, marginTop: 4, fontWeight: '700' },
  cardCenso: { color: T.inkMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  cardOrigen: { color: T.inkMuted, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  cardFoto: {
    width: '100%',
    height: 120,
    marginTop: 10,
    borderWidth: 1,
    borderColor: T.border,
  },
  cardContacto: { color: T.ok, fontSize: 13, marginTop: 6, fontWeight: '600' },
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
    color: T.accentDark,
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
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnNavegarText: {
    color: T.ink,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardAcciones: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  btnContacto: {
    flex: 1,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnMensaje: {
    backgroundColor: T.accentDark,
  },
  btnLlamar: {
    backgroundColor: T.ok,
  },
  btnContactoText: {
    color: T.bg,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardTime: { color: T.inkDim, fontSize: 10, marginTop: 10 },
  emptyText: { color: T.inkMuted, textAlign: 'center', marginTop: 32, fontSize: 14, lineHeight: 22 },
  smsPanel: { gap: 12 },
  smsTitle: {
    color: T.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  smsPendiente: {
    color: T.alerta,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  smsMeta: { color: T.inkMuted, fontSize: 13, lineHeight: 22, marginBottom: 4 },
  smsMetaStrong: { color: T.ink, fontWeight: '800' },
  smsBox: {
    backgroundColor: T.bg,
    borderWidth: 2,
    borderColor: T.border,
    maxHeight: 120,
    padding: 12,
    marginBottom: 4,
  },
  smsBoxText: {
    color: T.ink,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  btnCopiarCadena: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 4,
  },
  btnCopiarCadenaText: {
    color: T.ink,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  syncInput: {
    backgroundColor: T.surfaceElevated,
    borderWidth: 2,
    borderColor: T.border,
    color: T.ink,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 88,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  btnFusionar: {
    backgroundColor: T.accentDark,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnFusionarText: {
    color: T.bg,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: T.surfaceElevated,
    borderTopWidth: 2,
    borderTopColor: T.border,
    paddingBottom: 10,
    paddingTop: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  labelSwitch: {
    color: T.ink,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 6, position: 'relative' },
  navItemActiva: { backgroundColor: T.surface },
  navLabel: {
    color: T.inkMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  navLabelActiva: { color: T.ink, fontWeight: '900' },
  navIndicator: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 3,
    backgroundColor: T.accent,
  },
});
