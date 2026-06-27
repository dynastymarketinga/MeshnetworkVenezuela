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
      nombre TEXT NOT NULL,
      edad TEXT NOT NULL,
      genero TEXT NOT NULL,
      ubicacion TEXT NOT NULL,
      latitud REAL,
      longitud REAL,
      estado TEXT NOT NULL,
      notas TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reportes_estado ON reportes(estado);
    CREATE INDEX IF NOT EXISTS idx_reportes_timestamp ON reportes(timestamp DESC);
  `);

  return instancia;
}

export async function cerrarBaseDeDatos(): Promise<void> {
  if (instancia) {
    await instancia.closeAsync();
    instancia = null;
  }
}
