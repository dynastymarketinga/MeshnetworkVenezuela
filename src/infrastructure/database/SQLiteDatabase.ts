import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'meshnetwork_venezuela.db';

let instancia: SQLite.SQLiteDatabase | null = null;

export async function obtenerBaseDeDatos(): Promise<SQLite.SQLiteDatabase> {
  if (instancia) return instancia;

  instancia = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await instancia.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS reportes (
      id TEXT PRIMARY KEY NOT NULL,
      fuente_origen TEXT NOT NULL DEFAULT 'MeshApp',
      tipo_registro TEXT NOT NULL DEFAULT 'PERSONA_ATRAPADA',
      nombre TEXT NOT NULL,
      edad TEXT NOT NULL,
      genero TEXT NOT NULL,
      telefono TEXT NOT NULL DEFAULT '',
      ciudad TEXT NOT NULL DEFAULT 'La Guaira',
      ubicacion TEXT NOT NULL,
      latitud REAL NOT NULL DEFAULT 0,
      longitud REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL,
      estado_estructura TEXT NOT NULL DEFAULT 'SEGURO',
      notas TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reportes_estado ON reportes(estado);
    CREATE INDEX IF NOT EXISTS idx_reportes_timestamp ON reportes(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_reportes_ciudad ON reportes(ciudad);
    CREATE INDEX IF NOT EXISTS idx_reportes_fuente ON reportes(fuente_origen);
  `);

  await migrarColumnasReportes(instancia);

  return instancia;
}

async function migrarColumnasReportes(db: SQLite.SQLiteDatabase): Promise<void> {
  const columnas = await db.getAllAsync<{ name: string }>('PRAGMA table_info(reportes)');
  const nombres = new Set(columnas.map((c) => c.name));

  const agregar = async (sql: string): Promise<void> => {
    await db.execAsync(sql);
  };

  if (!nombres.has('telefono')) {
    await agregar(`ALTER TABLE reportes ADD COLUMN telefono TEXT NOT NULL DEFAULT ''`);
  }
  if (!nombres.has('ciudad')) {
    await agregar(`ALTER TABLE reportes ADD COLUMN ciudad TEXT NOT NULL DEFAULT 'La Guaira'`);
  }
  if (!nombres.has('fuente_origen')) {
    await agregar(`ALTER TABLE reportes ADD COLUMN fuente_origen TEXT NOT NULL DEFAULT 'MeshApp'`);
  }
  if (!nombres.has('tipo_registro')) {
    await agregar(
      `ALTER TABLE reportes ADD COLUMN tipo_registro TEXT NOT NULL DEFAULT 'PERSONA_ATRAPADA'`
    );
  }
  if (!nombres.has('estado_estructura')) {
    await agregar(`ALTER TABLE reportes ADD COLUMN estado_estructura TEXT NOT NULL DEFAULT 'SEGURO'`);
  }
  if (nombres.has('latitud')) {
    await db.execAsync(`UPDATE reportes SET latitud = 0 WHERE latitud IS NULL`);
  }
  if (nombres.has('longitud')) {
    await db.execAsync(`UPDATE reportes SET longitud = 0 WHERE longitud IS NULL`);
  }
}

export async function cerrarBaseDeDatos(): Promise<void> {
  if (instancia) {
    await instancia.closeAsync();
    instancia = null;
  }
}
