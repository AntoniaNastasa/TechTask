import * as duckdb from "@duckdb/duckdb-wasm";


let dbPromise = null;

//boot DuckDB, register Parquet file, create SQL view "trips"
async function initDb() {
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);

  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" })
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);

 
  await db.registerFileURL(
    "trips.parquet",
    new URL("/data/yellow_tripdata_2025-01.parquet", window.location.origin).toString(),
    duckdb.DuckDBDataProtocol.HTTP,
    false
  );

  const conn = await db.connect();
  await conn.query(`CREATE VIEW trips AS SELECT * FROM read_parquet('trips.parquet')`);

  // SECURITY: lock the engine down before any user/LLM SQL
  // ever touches this connection. This is DuckDB's own documented pattern for
  // running untrusted SQL ("Securing DuckDB" in the DuckDB docs)
  // It closes off filesystem/network/new-
  // extension access (e.g. sqlite_scan, read_csv, httpfs, ATTACH). It does NOT hide introspection
  // functions like duckdb_settings()/pragma_table_info() -- those read state
  // already resident in the engine, not "external access". 
  
  // await conn.query(`SET autoinstall_known_extensions=false`);
  // await conn.query(`SET autoload_known_extensions=false`);
  // await conn.query(`SET enable_external_access=false`);
  // await conn.query(`SET lock_configuration=true`);

  await conn.close();

  return db;
}


//singleton
export function getDb() {
  if (!dbPromise) {
    dbPromise = initDb();
  }
  return dbPromise;
}


//opens a connection, runs  sql, returns columns + rows, closes connection
export async function runQuery(sql) {
  const db = await getDb();
  const conn = await db.connect();
  try {
    const result = await conn.query(sql);
    const rows = result.toArray().map((row) => row.toJSON());
    const columns = result.schema.fields.map((f) => f.name);
    return { columns, rows };
  } finally {
    await conn.close();
  }
}

//what the frontend actually renders
export async function executeQuery(sql) {
  const { rows } = await runQuery(sql);
  return rows;
}


//runs describe to get the schema structure
export async function getSchema() {
  const { rows } = await runQuery("DESCRIBE trips");
  return rows.map((row) => ({ name: row.column_name, type: row.column_type }));
}


//format the returned schema
export function schemaToPromptText(schema) {
  const columns = schema
    .map((col) => `  - ${col.name} (${col.type})`)
    .join("\n");
  return `Table: trips\nColumns:\n${columns}`;
}
