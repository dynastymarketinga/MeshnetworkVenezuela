import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import { BrutalistTheme, paperShadow } from '../theme/BrutalistTheme';
import { SQLiteReporteRepository } from '../infrastructure/repositories/SQLiteReporteRepository';
import { LocationService } from '../infrastructure/services/LocationService';
import { NavigationService } from '../infrastructure/services/NavigationService';
import { SmsDirectService } from '../infrastructure/services/SmsDirectService';

const ESTADOS: EstadoReporte[] = ['CRITICO', 'POR LOCALIZAR', 'LOCALIZADO'];
const GENEROS = ['M', 'F', 'Otro'];

type TabId = 'inicio' | 'registro' | 'reportes' | 'sms' | 'comando';

const TABS: { id: TabId; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'registro', label: 'Registro' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'sms', label: 'Enlace' },
  { id: 'comando', label: 'Comando' },
];

const BORDE_ESTADO: Record<EstadoReporte, string> = {
  CRITICO: BrutalistTheme.critico,
  'POR LOCALIZAR': BrutalistTheme.alerta,
  LOCALIZADO: BrutalistTheme.ok,
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

  const renderHeader = (): React.JSX.Element => (
    <View style={styles.header}>
      <View style={styles.logoFrame}>
        <Image source={require('../../assets/logo.jpg')} style={styles.logo} />
      </View>
      <Text style={styles.kicker}>Unidad de registro táctico · La Guaira</Text>
      <Text style={styles.tituloEditorial}>Mesh{'\n'}Network</Text>
      <View style={styles.divider} />
      <Text style={styles.badge}>SQLite · GPS · SMS · APK</Text>
    </View>
  );

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
          <Text style={styles.cardContacto}>{item.telefono_contacto}</Text>
        ) : null}
        <Text style={styles.cardCiudad}>{item.ciudad}</Text>
        <Text style={styles.cardUbicacion}>{item.ubicacion_exacta}</Text>
        {item.latitud !== undefined && item.longitud !== undefined ? (
          <Text style={styles.cardGps}>
            {LocationService.formatearCoordenadas(item.latitud, item.longitud)}
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
            <Text style={styles.btnNavegarText}>NAVEGAR AL PUNTO</Text>
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
      <StatusBar barStyle="dark-content" backgroundColor={BrutalistTheme.bg} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {tabActiva === 'inicio' ? (
          <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
            {renderHeader()}

            <View style={styles.panel}>
              <Text style={styles.panelKicker}>01 — Operación activa</Text>
              <Text style={styles.panelTitle}>Red de rescate local</Text>
              <Text style={styles.panelDesc}>
                {stats.total > 0
                  ? `${stats.total} reporte(s) en ${stats.ciudades} zona(s). Datos cruzados por ubicación y triaje entre brigadas.`
                  : 'Registre puntos con GPS. Sincronización manual por SMS cuando hay señal GSM.'}
              </Text>
              <View style={styles.statsRow}>
                <View style={[styles.statCard, paperShadow]}>
                  <Text style={styles.statNumber}>{stats.total}</Text>
                  <Text style={styles.statLabel}>Reportes</Text>
                </View>
                <View style={[styles.statCard, paperShadow]}>
                  <Text style={[styles.statNumber, { color: BrutalistTheme.critico }]}>
                    {stats.criticos}
                  </Text>
                  <Text style={styles.statLabel}>Críticos</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={[styles.statCard, paperShadow]}>
                  <Text style={[styles.statNumber, { color: BrutalistTheme.ok }]}>
                    {stats.localizados}
                  </Text>
                  <Text style={styles.statLabel}>Localizados</Text>
                </View>
                <View style={[styles.statCard, paperShadow]}>
                  <Text style={styles.statNumber}>{stats.ciudades}</Text>
                  <Text style={styles.statLabel}>Zonas</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, paperShadow]}
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
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.panel}>
              <Text style={styles.panelKicker}>02 — Personas afectadas</Text>
              <Text style={styles.panelTitle}>Registro en campo</Text>
              <Text style={styles.panelDesc}>
                Complete los datos clave del punto. No comparta información sensible de terceros sin permiso.
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
                {guardando ? 'Guardando en disco…' : 'Registrar punto de rescate'}
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
              <>
                {renderHeader()}
                <Text style={styles.listaTitulo}>Reportes en dispositivo ({reportes.length})</Text>
              </>
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                Sin registros. Use Registro para añadir un punto.
              </Text>
            }
          />
        ) : null}

        {tabActiva === 'sms' ? (
          <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
            <View style={styles.panel}>
              <Text style={styles.panelKicker}>03 — Enlace SMS</Text>
              <Text style={styles.panelTitle}>Transmisión manual</Text>
              <Text style={styles.syncHint}>
                Comando {OperacionConfig.COMANDO_CENTRAL_SMS} · Lotes MNv1|1/3|…
              </Text>
            </View>
            <View style={styles.syncPanelInline}>
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
                  {enviandoSms ? 'Abriendo SMS…' : 'Enviar al comando central'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSmsDirecto, enviandoSms && styles.btnDisabled]}
                onPress={enviarSmsDirecto}
                disabled={enviandoSms}
                activeOpacity={0.8}
              >
                <Text style={styles.btnSmsDirectoText}>
                  {enviandoSms ? 'Abriendo SMS…' : 'Enviar SMS directo (lote 1)'}
                </Text>
              </TouchableOpacity>
              {lotesPendientes.length > 1 && indiceLote < lotesPendientes.length - 1 ? (
                <TouchableOpacity
                  style={styles.btnSiguienteLote}
                  onPress={enviarSiguienteLote}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnSiguienteLoteText}>
                    Enviar lote {indiceLote + 2}/{lotesPendientes.length}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.syncButtons}>
                <TouchableOpacity style={styles.btnSMSHalf} onPress={comprimirParaSMS} activeOpacity={0.8}>
                  <Text style={styles.btnSMSText}>Comprimir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnImportHalf, importando && styles.btnDisabled]}
                  onPress={pegarYFusionar}
                  activeOpacity={0.8}
                  disabled={importando}
                >
                  <Text style={styles.btnImportText}>
                    {importando ? 'Fusionando…' : 'Pegar y fusionar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : null}

        {tabActiva === 'comando' ? (
          <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
            {renderHeader()}
            <View style={styles.panel}>
              <Text style={styles.panelKicker}>04 — Comando central</Text>
              <Text style={styles.panelTitle}>{OperacionConfig.NOMBRE_COMANDO}</Text>
              <Text style={styles.panelDesc}>
                Mesh Network Venezuela opera de forma autónoma. Los reportes tácticos se transmiten
                por SMS al comando cuando la señal lo permite.
              </Text>
              <View style={[styles.statCard, paperShadow, { marginTop: 12 }]}>
                <Text style={styles.comandoLabel}>Brigada</Text>
                <Text style={styles.comandoValor}>{OperacionConfig.BRIGADA_ID}</Text>
                <Text style={styles.comandoLabel}>SMS comando</Text>
                <Text style={styles.comandoValor}>{OperacionConfig.COMANDO_CENTRAL_SMS}</Text>
                <Text style={styles.comandoLabel}>Protocolo</Text>
                <Text style={styles.comandoValor}>{OperacionConfig.VERSION_DATOS}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.btnPrimary, paperShadow]}
              onPress={() => setTabActiva('registro')}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>Ir a registro en campo</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}

        <View style={[styles.bottomNav, paperShadow]}>
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

const T = BrutalistTheme;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: T.bg },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  header: { marginBottom: 24 },
  logoFrame: {
    backgroundColor: T.paperElevated,
    borderWidth: 2,
    borderColor: T.border,
    padding: 12,
    marginBottom: 16,
    ...paperShadow,
  },
  logo: { width: '100%', height: 140, resizeMode: 'contain' },
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
    color: T.meshBlueDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: T.paperElevated,
    borderWidth: 2,
    borderColor: T.border,
    padding: 18,
    marginBottom: 16,
    ...paperShadow,
  },
  panelKicker: {
    color: T.meshBlue,
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
    backgroundColor: T.paperElevated,
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
    backgroundColor: T.ink,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnPrimaryText: {
    color: T.paperElevated,
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
  fieldBox: {
    backgroundColor: T.paperElevated,
    borderWidth: 2,
    borderColor: T.border,
    padding: 14,
    marginBottom: 12,
    ...paperShadow,
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
    borderColor: T.borderLight,
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
    backgroundColor: T.meshBlueDark,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnGpsText: {
    color: T.paperElevated,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  gpsActivo: { color: T.meshBlueDark, fontSize: 12, fontWeight: '600', marginTop: 10 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: T.borderLight,
    backgroundColor: T.bg,
  },
  chipActivo: { backgroundColor: T.ink, borderColor: T.border },
  chipText: { color: T.inkMuted, fontWeight: '700', fontSize: 12 },
  chipTextActivo: { color: T.paperElevated },
  estadoBtn: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: T.borderLight,
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
  estadoTextActivo: { color: T.ink },
  btnEmergencia: {
    backgroundColor: T.critico,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 20,
    marginTop: 8,
    marginBottom: 24,
    alignItems: 'center',
    ...paperShadow,
  },
  btnEmergenciaText: {
    color: T.paperElevated,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  btnDisabled: { opacity: 0.5 },
  listaTitulo: {
    color: T.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 16,
    marginTop: 8,
  },
  lista: { flex: 1, paddingHorizontal: 20 },
  listaContent: { paddingBottom: 16 },
  card: {
    backgroundColor: T.paperElevated,
    borderWidth: 2,
    borderColor: T.border,
    borderLeftWidth: 5,
    padding: 16,
    marginBottom: 12,
    ...paperShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardEstado: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  cardId: { color: T.inkLight, fontSize: 9, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  cardNombre: { color: T.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  cardContacto: { color: T.meshBlueDark, fontSize: 13, marginTop: 6, fontWeight: '600' },
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
    color: T.meshBlueDark,
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
  cardTime: { color: T.inkLight, fontSize: 10, marginTop: 10 },
  emptyText: { color: T.inkMuted, textAlign: 'center', marginTop: 32, fontSize: 14, lineHeight: 22 },
  syncPanelInline: { paddingBottom: 8 },
  syncHint: { color: T.inkMuted, fontSize: 12, marginBottom: 12, lineHeight: 18 },
  syncInput: {
    backgroundColor: T.paperElevated,
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
  btnComando: {
    backgroundColor: T.critico,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
    ...paperShadow,
  },
  btnComandoText: {
    color: T.paperElevated,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  btnSmsDirecto: {
    backgroundColor: T.ink,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSmsDirectoText: {
    color: T.paperElevated,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  btnSiguienteLote: {
    backgroundColor: T.alerta,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSiguienteLoteText: {
    color: T.paperElevated,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  syncButtons: { flexDirection: 'row', gap: 10 },
  btnSMSHalf: {
    flex: 1,
    backgroundColor: T.paperElevated,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnImportHalf: {
    flex: 1,
    backgroundColor: T.meshBlueDark,
    borderWidth: 2,
    borderColor: T.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSMSText: {
    color: T.ink,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  btnImportText: {
    color: T.paperElevated,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: T.paperElevated,
    borderTopWidth: 2,
    borderTopColor: T.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 10,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 6, position: 'relative' },
  navItemActiva: { backgroundColor: T.bg },
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
    backgroundColor: T.ink,
  },
});
