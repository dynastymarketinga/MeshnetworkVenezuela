import React, { useCallback, useEffect, useState } from 'react';
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
import { IReporteRepository } from '../domain/repositories/IReporteRepository';
import { MemoryReporteRepository } from '../infrastructure/repositories/MemoryReporteRepository';
import { MeshSimulationService } from '../infrastructure/services/MeshSimulationService';

const ESTADOS: EstadoReporte[] = ['POR LOCALIZAR', 'CRITICO', 'LOCALIZADO'];
const GENEROS = ['M', 'F', 'Otro'];

const BORDE_ESTADO: Record<EstadoReporte, string> = {
  CRITICO: '#FF0000',
  'POR LOCALIZAR': '#FF8800',
  LOCALIZADO: '#00FF00',
};

interface HomeScreenProps {
  repository: IReporteRepository;
  meshService: MeshSimulationService;
  memoryRepository: MemoryReporteRepository;
}

export default function HomeScreen({
  repository,
  meshService,
  memoryRepository,
}: HomeScreenProps): React.JSX.Element {
  const [reportes, setReportes] = useState<ReporteEmergencia[]>([]);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [edad, setEdad] = useState('');
  const [genero, setGenero] = useState('M');
  const [ubicacion, setUbicacion] = useState('');
  const [estado, setEstado] = useState<EstadoReporte>('POR LOCALIZAR');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    const desuscribir = memoryRepository.suscribir(setReportes);
    meshService.iniciarEscaneoMalla(() => {
      /* la suscripción refresca la lista automáticamente */
    });
    return () => {
      desuscribir();
      meshService.detenerEscaneoMalla();
    };
  }, [memoryRepository, meshService]);

  const limpiarFormulario = useCallback(() => {
    setNombreCompleto('');
    setEdad('');
    setGenero('M');
    setUbicacion('');
    setEstado('POR LOCALIZAR');
    setNotas('');
  }, []);

  const registrarPunto = useCallback(() => {
    if (!ubicacion.trim()) {
      Alert.alert('⚠ CAMPO OBLIGATORIO', 'Indique la ubicación exacta en La Guaira.');
      return;
    }

    repository.guardar({
      nombre_completo: nombreCompleto.trim() || 'Anónimo',
      edad: edad.trim() || '0',
      genero,
      ubicacion_exacta: ubicacion.trim(),
      estado_actual: estado,
      notas_paramedicos: notas.trim(),
    });

    limpiarFormulario();
  }, [repository, nombreCompleto, edad, genero, ubicacion, estado, notas, limpiarFormulario]);

  const comprimirParaSMS = useCallback(async () => {
    const cadena = repository.comprimirParaSMS();
    await Clipboard.setStringAsync(cadena);
    Alert.alert(
      '📲 DATOS COMPRIMIDOS',
      `${reportes.length} reporte(s) copiados al portapapeles.\nLongitud: ${cadena.length} caracteres.`
    );
  }, [repository, reportes.length]);

  const renderItem = useCallback(({ item }: { item: ReporteEmergencia }) => {
    const borde = BORDE_ESTADO[item.estado_actual];
    const esMalla = item.id.startsWith('BLE-');

    return (
      <View style={[styles.card, { borderLeftColor: borde }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardEstado, { color: borde }]}>{item.estado_actual}</Text>
          <Text style={styles.cardOrigen}>{esMalla ? '🛰️ Malla' : '📱 Local'}</Text>
        </View>
        <Text style={styles.cardNombre}>
          {item.nombre_completo}
          {item.edad !== '0' ? ` · ${item.edad} años` : ''} · {item.genero}
        </Text>
        <Text style={styles.cardUbicacion}>📍 {item.ubicacion_exacta}</Text>
        {item.notas_paramedicos ? (
          <Text style={styles.cardNotas}>{item.notas_paramedicos}</Text>
        ) : null}
        <Text style={styles.cardTime}>
          {new Date(item.timestamp).toLocaleTimeString('es-VE')}
        </Text>
      </View>
    );
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image source={require('../../assets/logo.jpg')} style={styles.logo} />
            <View style={styles.emblema}>
              <Text style={styles.emblemaIcon}>🐾</Text>
              <Text style={styles.emblemaSignal}>🛰️</Text>
            </View>
            <Text style={styles.titulo}>🐕 MESHNETWORK VENEZUELA</Text>
            <Text style={styles.subtitulo}>
              Unidad de Registro Táctico y Rescate - La Guaira
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
            <Text style={styles.label}>📍 Ubicación exacta *</Text>
            <TextInput
              style={[styles.input, styles.inputGrande]}
              value={ubicacion}
              onChangeText={setUbicacion}
              placeholder="Sector / calle / edificio — La Guaira"
              placeholderTextColor="#555555"
            />
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.label}>Estado actual</Text>
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

          <TouchableOpacity style={styles.btnEmergencia} onPress={registrarPunto} activeOpacity={0.8}>
            <Text style={styles.btnEmergenciaText}>💾 REGISTRAR PUNTO DE RESCATE</Text>
          </TouchableOpacity>

          <Text style={styles.listaTitulo}>Puntos en radio de malla ({reportes.length})</Text>
        </ScrollView>

        <FlatList
          data={reportes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.lista}
          contentContainerStyle={styles.listaContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Sin registros. Sync malla cada ~8 s.</Text>
          }
        />

        <TouchableOpacity style={styles.btnSMS} onPress={comprimirParaSMS} activeOpacity={0.8}>
          <Text style={styles.btnSMSText}>📲 COMPRIMIR TODO PARA SMS</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 8 },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    marginBottom: 16,
  },
  logo: {
    width: 120,
    height: 72,
    resizeMode: 'contain',
    marginBottom: 10,
  },
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
  cardOrigen: { color: '#00AEEF', fontSize: 10, fontWeight: '600' },
  cardNombre: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cardUbicacion: { color: '#CCCCCC', fontSize: 14, marginTop: 4 },
  cardNotas: { color: '#888888', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  cardTime: { color: '#555555', fontSize: 10, marginTop: 8 },
  emptyText: { color: '#555555', textAlign: 'center', marginTop: 20, fontSize: 13 },
  btnSMS: {
    backgroundColor: '#111111',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnSMSText: { color: '#00FF00', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
