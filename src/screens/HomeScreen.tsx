import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { EstadoReporte, ReporteEmergencia } from '../domain/entities/Reporte';
import { OperacionConfig } from '../config/OperacionConfig';
import { SQLiteReporteRepository } from '../infrastructure/repositories/SQLiteReporteRepository';
import { LocationService } from '../infrastructure/services/LocationService';
import { NavigationService } from '../infrastructure/services/NavigationService';
import { SmsDirectService } from '../infrastructure/services/SmsDirectService';

const ESTADOS: EstadoReporte[] = ['CRITICO', 'POR LOCALIZAR', 'LOCALIZADO'];
const GENEROS = ['M', 'F', 'Otro'];

type TabId = 'inicio' | 'registro' | 'reportes' | 'sms' | 'red';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'inicio', label: 'Inicio', icon: '🏠' },
  { id: 'registro', label: 'Ayuda', icon: '🆘' },
  { id: 'reportes', label: 'Reportes', icon: '📋' },
  { id: 'sms', label: 'SMS', icon: '📲' },
  { id: 'red', label: 'Red', icon: '🌐' },
];

const BORDE_ESTADO: Record<EstadoReporte, string> = {
  CRITICO: '#FF0000',
  'POR LOCALIZAR': '#FF8800',
  LOCALIZADO: '#00FF00',
};

interface HomeScreenProps {
  repository: SQLiteReporteRepository;
}

export default function HomeScreen({ repository }: HomeScreenProps): React.JSX.Element {
  const [reportes, setReportes] = useState<ReporteEmergencia[]>([]);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');
  const [ciudad, setCiudad] = useState('La Guaira');
  const [edad, setEdad] = useState('');
  const [genero, setGenero] = useState('M');
  const [ubicacion, setUbicacion] = useState('');
  const [latitud, setLatitud] = useState<number | undefined>();
  const [longitud, setLongitud] = useState<number | undefined>();
  const [estado, setEstado] = useState<EstadoReporte>('POR LOCALIZAR');
  const [notas, setNotas] = useState('');
  const [cadenaImport, setCadenaImport] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [obteniendoGps, setObteniendoGps] = useState(false);
  const [enviandoSms, setEnviandoSms] = useState(false);
  const [lotesPendientes, setLotesPendientes] = useState<string[]>([]);
  const [indiceLote, setIndiceLote] = useState(0);
  const [tabActiva, setTabActiva] = useState<TabId>('inicio');

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

  useEffect(() => {
    return repository.suscribir(setReportes);
  }, [repository]);

  useEffect(() => {
    void (async () => {
      try {
        const coords = await LocationService.obtenerCoordenadasActuales();
        setLatitud(coords.latitud);
        setLongitud(coords.longitud);
      } catch {
        /* GPS manual si falla auto-captura */
      }
    })();
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
    setNotas('');
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
      const mensaje = error instanceof Error ? error.message : 'No se pudo obtener GPS.';
      Alert.alert('⚠ GPS', mensaje);
    } finally {
      setObteniendoGps(false);
    }
  }, []);

  const registrarPunto = useCallback(async () => {
    if (!ubicacion.trim()) {
      Alert.alert('⚠ UBICACIÓN REQUERIDA', 'Describa sector, calle o edificio en La Guaira.');
      return;
    }
    if (latitud === undefined || longitud === undefined) {
      Alert.alert('⚠ GPS REQUERIDO', 'Capture coordenadas GPS antes de registrar.');
      return;
    }

    setGuardando(true);
    try {
      await repository.guardar({
        nombre_completo: nombreCompleto.trim() || 'Anónimo',
        telefono_contacto: telefonoContacto.trim(),
        ciudad: ciudad.trim() || 'La Guaira',
        edad: edad.trim() || '0',
        genero,
        ubicacion_exacta: ubicacion.trim(),
        latitud,
        longitud,
        estado_actual: estado,
        notas_paramedicos: notas.trim(),
      });
      limpiarFormulario();
      setTabActiva('reportes');
      try {
        const coords = await LocationService.obtenerCoordenadasActuales();
        setLatitud(coords.latitud);
        setLongitud(coords.longitud);
      } catch {
        setLatitud(undefined);
        setLongitud(undefined);
      }
    } catch {
      Alert.alert('⚠ ERROR SQLITE', 'No se pudo escribir en la base de datos. Reintente.');
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
    notas,
    limpiarFormulario,
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
      '📲 DATOS COMPRIMIDOS',
      `${reportes.length} reporte(s) · ${lotes.length} lote(s) SMS\nCopiado al portapapeles.`
    );
  }, [repository, reportes.length]);

  const enviarLoteSms = useCallback(
    async (lotes: string[], indice: number) => {
      const mensaje = lotes[indice];
      const resultado = await SmsDirectService.enviarMensaje(mensaje);

      if (lotes.length === 1) {
        if (resultado === 'cancelado') {
          Alert.alert('SMS', 'Envío cancelado. Datos copiados en portapapeles.');
        }
        setLotesPendientes([]);
        setIndiceLote(0);
        return;
      }

      const quedan = indice + 1 < lotes.length;
      Alert.alert(
        `📨 SMS ${indice + 1}/${lotes.length}`,
        resultado === 'cancelado'
          ? 'Envío cancelado. Use COMPRIMIR o reintente el lote.'
          : quedan
            ? `Lote ${indice + 1} enviado. Falta(n) ${lotes.length - indice - 1} lote(s).`
            : 'Todos los lotes SMS fueron procesados.',
        quedan
          ? [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: `ENVIAR LOTE ${indice + 2}/${lotes.length}`,
                onPress: () => {
                  setIndiceLote(indice + 1);
                  void enviarLoteSms(lotes, indice + 1);
                },
              },
            ]
          : [{ text: 'OK' }]
      );
    },
    []
  );

  const enviarAlComandoCentral = useCallback(async () => {
    if (reportes.length === 0) {
      Alert.alert('Sin datos', 'No hay reportes para enviar al comando.');
      return;
    }

    setEnviandoSms(true);
    try {
      const lotes = repository.comprimirParaSMSEnLotes();
      const encabezado = `[${OperacionConfig.BRIGADA_ID}] ${OperacionConfig.NOMBRE_COMANDO}\n`;
      const mensaje = encabezado + lotes[0];
      await Clipboard.setStringAsync(lotes.map((l, i) => `${encabezado}Lote ${i + 1}/${lotes.length}\n${l}`).join('\n\n'));
      setLotesPendientes(lotes.map((l) => encabezado + l));
      setIndiceLote(0);
      const resultado = await SmsDirectService.enviarAlComandoCentral(mensaje);
      if (lotes.length > 1) {
        Alert.alert(
          '🚨 COMANDO CENTRAL',
          `SMS 1/${lotes.length} abierto para ${OperacionConfig.COMANDO_CENTRAL_SMS}.\nEnvíe cada lote cuando haya señal.`
        );
      } else if (resultado === 'cancelado') {
        Alert.alert('SMS', 'Envío cancelado. Datos en portapapeles.');
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al abrir SMS.';
      Alert.alert('⚠ COMANDO CENTRAL', mensaje);
    } finally {
      setEnviandoSms(false);
    }
  }, [repository, reportes.length]);

  const navegarAlPunto = useCallback(async (item: ReporteEmergencia) => {
    if (item.latitud === undefined || item.longitud === undefined) {
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

  const enviarSmsDirecto = useCallback(async () => {
    if (reportes.length === 0) {
      Alert.alert('Sin datos', 'No hay reportes para transmitir.');
      return;
    }

    setEnviandoSms(true);
    try {
      const lotes = repository.comprimirParaSMSEnLotes();
      await Clipboard.setStringAsync(lotes.join('\n'));
      setLotesPendientes(lotes);
      setIndiceLote(0);
      await enviarLoteSms(lotes, 0);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al abrir SMS.';
      Alert.alert('⚠ SMS', mensaje);
    } finally {
      setEnviandoSms(false);
    }
  }, [repository, reportes.length, enviarLoteSms]);

  const enviarSiguienteLote = useCallback(async () => {
    const siguiente = indiceLote + 1;
    if (lotesPendientes.length === 0 || siguiente >= lotesPendientes.length) return;
    setEnviandoSms(true);
    try {
      setIndiceLote(siguiente);
      await enviarLoteSms(lotesPendientes, siguiente);
    } finally {
      setEnviandoSms(false);
    }
  }, [lotesPendientes, indiceLote, enviarLoteSms]);

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

  const abrirRedCiudadana = useCallback(async () => {
    try {
      await Linking.openURL(OperacionConfig.RED_CIUDADANA_URL);
    } catch {
      Alert.alert('Red ciudadana', 'No se pudo abrir herovenezuela.com');
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: ReporteEmergencia }) => {
    const borde = BORDE_ESTADO[item.estado_actual];

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
        {item.telefono_contacto ? (
          <Text style={styles.cardContacto}>📞 {item.telefono_contacto}</Text>
        ) : null}
        <Text style={styles.cardCiudad}>🏙️ {item.ciudad}</Text>
        <Text style={styles.cardUbicacion}>📍 {item.ubicacion_exacta}</Text>
        {item.latitud !== undefined && item.longitud !== undefined ? (
          <Text style={styles.cardGps}>
            🛰️ {LocationService.formatearCoordenadas(item.latitud, item.longitud)}
          </Text>
        ) : null}
        {item.notas_paramedicos ? (
          <Text style={styles.cardNotas}>{item.notas_paramedicos}</Text>
        ) : null}
        {item.latitud !== undefined && item.longitud !== undefined ? (
          <TouchableOpacity
            style={styles.btnNavegar}
            onPress={() => navegarAlPunto(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnNavegarText}>🗺️ NAVEGAR AL PUNTO</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.cardTime}>
          {new Date(item.timestamp).toLocaleString('es-VE')}
        </Text>
      </View>
    );
  }, [navegarAlPunto]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.heroTopBar}>
        <Text style={styles.heroHeart}>💛</Text>
        <Text style={styles.heroSlogan}>La Guaira nos necesita</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {tabActiva === 'inicio' ? (
          <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Image source={require('../../assets/logo.jpg')} style={styles.logo} />
              <Text style={styles.titulo}>🐕 MESHNETWORK VENEZUELA</Text>
              <Text style={styles.subtitulo}>Unidad de Registro Táctico y Rescate</Text>
              <Text style={styles.badge}>OPERATIVO · SQLITE · GPS · APK</Text>
            </View>

            <View style={styles.heroSection}>
              <Text style={styles.heroSectionTitle}>RED DE RESCATE ACTIVA</Text>
              <Text style={styles.heroSectionDesc}>
                {stats.total > 0
                  ? `Hay ${stats.total} reporte(s) registrados en ${stats.ciudades} zona(s) de La Guaira. Los datos se cruzan con la red de brigadas por ubicación y triaje.`
                  : 'Registre puntos de rescate con GPS. Los datos se sincronizan entre brigadas por SMS cuando hay señal.'}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{stats.total}</Text>
                  <Text style={styles.statLabel}>REPORTES ACTIVOS</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statNumber, styles.statCritico]}>{stats.criticos}</Text>
                  <Text style={styles.statLabel}>CRÍTICOS</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={[styles.statNumber, styles.statVerde]}>{stats.localizados}</Text>
                  <Text style={styles.statLabel}>LOCALIZADOS</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{stats.ciudades}</Text>
                  <Text style={styles.statLabel}>ZONAS</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.btnHeroPrimary} onPress={() => setTabActiva('registro')}>
              <Text style={styles.btnHeroPrimaryText}>🆘 REGISTRAR PERSONA AFECTADA</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnHeroSecondary} onPress={abrirRedCiudadana}>
              <Text style={styles.btnHeroSecondaryText}>🌐 VER RED CIUDADANA (HEROVENEZUELA)</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}

        {tabActiva === 'registro' ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.heroSection}>
              <Text style={styles.heroSectionTitle}>PERSONAS AFECTADAS</Text>
              <Text style={styles.heroSectionDesc}>
                Cuéntanos qué ayuda necesitas. Completa los datos clave del punto de rescate.
              </Text>
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
                    style={[styles.chip, ciudad === c && styles.chipActivoHero]}
                    onPress={() => setCiudad(c)}
                  >
                    <Text style={[styles.chipText, ciudad === c && styles.chipTextActivoHero]}>
                      {c}
                    </Text>
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
                      style={[styles.chip, genero === g && styles.chipActivoHero]}
                      onPress={() => setGenero(g)}
                    >
                      <Text style={[styles.chipText, genero === g && styles.chipTextActivoHero]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.label}>📍 Ubicación exacta *</Text>
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
                  {obteniendoGps ? 'OBTENIENDO GPS...' : '🛰️ CAPTURAR COORDENADAS GPS'}
                </Text>
              </TouchableOpacity>
              {latitud !== undefined && longitud !== undefined ? (
                <Text style={styles.gpsActivo}>
                  GPS activo: {LocationService.formatearCoordenadas(latitud, longitud)}
                </Text>
              ) : null}
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.label}>Estado (CRÍTICO → POR LOCALIZAR → LOCALIZADO)</Text>
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
                {guardando ? 'GUARDANDO EN DISCO...' : '💾 REGISTRAR PUNTO DE RESCATE'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}

        {tabActiva === 'reportes' ? (
          <FlatList
            data={reportes}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={styles.lista}
            contentContainerStyle={styles.listaContent}
            ListHeaderComponent={
              <Text style={styles.listaTitulo}>▸ Reportes en dispositivo ({reportes.length})</Text>
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                Sin registros. Use la pestaña Ayuda para registrar un punto.
              </Text>
            }
          />
        ) : null}

        {tabActiva === 'sms' ? (
          <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
            <View style={styles.syncPanelInline}>
              <Text style={styles.syncLabel}>▸ TRANSMISIÓN MANUAL POR SMS</Text>
              <Text style={styles.syncHint}>
                Comando: {OperacionConfig.COMANDO_CENTRAL_SMS} · Lotes MNv1|1/3|...
              </Text>
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
                style={[styles.btnComando, enviandoSms && styles.btnDisabled]}
                onPress={enviarAlComandoCentral}
                disabled={enviandoSms}
                activeOpacity={0.8}
              >
                <Text style={styles.btnComandoText}>
                  {enviandoSms ? 'ABRIENDO SMS...' : '🚨 ENVIAR AL COMANDO CENTRAL'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSmsDirecto, enviandoSms && styles.btnDisabled]}
                onPress={enviarSmsDirecto}
                disabled={enviandoSms}
                activeOpacity={0.8}
              >
                <Text style={styles.btnSmsDirectoText}>
                  {enviandoSms ? 'ABRIENDO SMS...' : '📨 ENVIAR SMS DIRECTO (LOTE 1)'}
                </Text>
              </TouchableOpacity>
              {lotesPendientes.length > 1 && indiceLote < lotesPendientes.length - 1 ? (
                <TouchableOpacity
                  style={styles.btnSiguienteLote}
                  onPress={enviarSiguienteLote}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnSiguienteLoteText}>
                    📨 ENVIAR LOTE {indiceLote + 2}/{lotesPendientes.length}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.syncButtons}>
                <TouchableOpacity style={styles.btnSMSHalf} onPress={comprimirParaSMS} activeOpacity={0.8}>
                  <Text style={styles.btnSMSText}>📲 COMPRIMIR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnImportHalf, importando && styles.btnDisabled]}
                  onPress={pegarYFusionar}
                  activeOpacity={0.8}
                  disabled={importando}
                >
                  <Text style={styles.btnImportText}>
                    {importando ? 'FUSIONANDO...' : '📥 PEGAR Y FUSIONAR'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : null}

        {tabActiva === 'red' ? (
          <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
            <View style={styles.heroSection}>
              <Text style={styles.heroSectionTitle}>RED CIUDADANA ACTIVA</Text>
              <Text style={styles.heroSectionDesc}>
                MeshnetworkVenezuela complementa la red de voluntarios y acopios. Los reportes tácticos
                de rescate se transmiten por SMS al comando central cuando la señal lo permite.
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{OperacionConfig.BRIGADA_ID}</Text>
                  <Text style={styles.statLabel}>BRIGADA LOCAL</Text>
                </View>
              </View>
              <Text style={styles.redInfo}>Comando: {OperacionConfig.NOMBRE_COMANDO}</Text>
              <Text style={styles.redInfo}>SMS: {OperacionConfig.COMANDO_CENTRAL_SMS}</Text>
            </View>
            <TouchableOpacity style={styles.btnHeroPrimary} onPress={abrirRedCiudadana}>
              <Text style={styles.btnHeroPrimaryText}>🌐 ABRIR HEROVENEZUELA.COM</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnHeroSecondary} onPress={() => setTabActiva('registro')}>
              <Text style={styles.btnHeroSecondaryText}>🆘 REGISTRAR AYUDA EN CAMPO</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}

        <View style={styles.bottomNav}>
          {TABS.map((tab) => {
            const activa = tabActiva === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.navItem, activa && styles.navItemActiva]}
                onPress={() => setTabActiva(tab.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.navIcon}>{tab.icon}</Text>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
  heroTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#001A4D',
    borderBottomWidth: 2,
    borderBottomColor: '#FFCC00',
  },
  heroHeart: { fontSize: 18 },
  heroSlogan: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  heroSection: {
    backgroundColor: '#0A1428',
    borderWidth: 1,
    borderColor: '#003893',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  heroSectionTitle: {
    color: '#003893',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 10,
    overflow: 'hidden',
  },
  heroSectionDesc: { color: '#CCCCCC', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#003893',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statNumber: { color: '#003893', fontSize: 22, fontWeight: '900' },
  statCritico: { color: '#CF142B' },
  statVerde: { color: '#00843D' },
  statLabel: {
    color: '#003893',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },
  btnHeroPrimary: {
    backgroundColor: '#003893',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnHeroPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  btnHeroSecondary: {
    backgroundColor: '#111111',
    borderWidth: 2,
    borderColor: '#FFCC00',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  btnHeroSecondaryText: { color: '#FFCC00', fontSize: 12, fontWeight: '800' },
  redInfo: { color: '#888888', fontSize: 12, marginTop: 6 },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#DDDDDD',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 6,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 4, position: 'relative' },
  navItemActiva: { backgroundColor: '#E8F0FE' },
  navIcon: { fontSize: 18 },
  navLabel: { color: '#666666', fontSize: 9, fontWeight: '700', marginTop: 2 },
  navLabelActiva: { color: '#003893' },
  navIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#FFCC00',
    borderRadius: 2,
  },
  syncPanelInline: { paddingBottom: 8 },
  chipActivoHero: { backgroundColor: '#003893', borderColor: '#003893' },
  chipTextActivoHero: { color: '#FFFFFF' },
  cardContacto: { color: '#FFCC00', fontSize: 13, marginTop: 4, fontWeight: '600' },
  cardCiudad: { color: '#888888', fontSize: 12, marginTop: 2 },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    marginBottom: 16,
  },
  logo: { width: 120, height: 72, resizeMode: 'contain', marginBottom: 10 },
  emblema: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#00AEEF',
    backgroundColor: '#0A0A0A',
    marginBottom: 12,
  },
  emblemaIcon: { fontSize: 24 },
  emblemaSignal: { fontSize: 16, marginLeft: 2 },
  titulo: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitulo: {
    color: '#00FF00',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  badge: {
    color: '#00AEEF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 10,
  },
  fieldBox: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  label: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 4,
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputGrande: { fontSize: 17, minHeight: 48 },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  btnGps: {
    marginTop: 10,
    backgroundColor: '#003893',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnGpsText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  gpsActivo: { color: '#00FF00', fontSize: 11, fontWeight: '700', marginTop: 8 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#222222',
    backgroundColor: '#111111',
  },
  chipActivo: { backgroundColor: '#00AEEF', borderColor: '#00AEEF' },
  chipText: { color: '#888888', fontWeight: '700', fontSize: 13 },
  chipTextActivo: { color: '#000000' },
  estadoBtn: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#222222',
    backgroundColor: '#111111',
    alignItems: 'center',
  },
  estadoText: { color: '#888888', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  estadoTextActivo: { color: '#000000' },
  btnEmergencia: {
    backgroundColor: '#FF0000',
    borderRadius: 8,
    paddingVertical: 20,
    marginTop: 6,
    marginBottom: 20,
    alignItems: 'center',
  },
  btnEmergenciaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  btnDisabled: { opacity: 0.6 },
  listaTitulo: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  lista: { flex: 1, paddingHorizontal: 16 },
  listaContent: { paddingBottom: 8 },
  card: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#222222',
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardEstado: { fontSize: 11, fontWeight: '900' },
  cardId: { color: '#555555', fontSize: 9, fontWeight: '600' },
  cardNombre: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cardUbicacion: { color: '#CCCCCC', fontSize: 14, marginTop: 4 },
  cardGps: { color: '#00AEEF', fontSize: 12, marginTop: 4, fontWeight: '600' },
  cardNotas: { color: '#888888', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  btnNavegar: {
    backgroundColor: '#003366',
    borderWidth: 1,
    borderColor: '#00AEEF',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnNavegarText: { color: '#00AEEF', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  cardTime: { color: '#555555', fontSize: 10, marginTop: 8 },
  emptyText: { color: '#555555', textAlign: 'center', marginTop: 20, fontSize: 13 },
  syncPanel: {
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    padding: 12,
  },
  syncLabel: {
    color: '#00AEEF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  syncHint: { color: '#555555', fontSize: 10, marginBottom: 8 },
  syncInput: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 4,
    color: '#00FF00',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  btnComando: {
    backgroundColor: '#8B0000',
    borderWidth: 2,
    borderColor: '#FF0000',
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnComandoText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  btnSmsDirecto: {
    backgroundColor: '#CF142B',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnSmsDirectoText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  btnSiguienteLote: {
    backgroundColor: '#FF8800',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnSiguienteLoteText: { color: '#000000', fontSize: 12, fontWeight: '900' },
  syncButtons: { flexDirection: 'row', gap: 8 },
  btnSMSHalf: {
    flex: 1,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnImportHalf: {
    flex: 1,
    backgroundColor: '#003893',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSMSText: { color: '#00FF00', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  btnImportText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', textAlign: 'center' },
});
