

const FORBIDDEN_KEYWORDS = [
  // data modification
  "INSERT", "UPDATE", "DELETE", "MERGE", "REPLACE", "UPSERT",
  // schema / DDL
  "CREATE", "DROP", "ALTER", "TRUNCATE", "RENAME", "COMMENT",
  // access to files, other databases, or the network from inside DuckDB
  "ATTACH", "DETACH", "COPY", "EXPORT", "IMPORT", "INSTALL", "LOAD",
  // engine / session state
  "PRAGMA", "SET", "RESET", "VACUUM", "CHECKPOINT", "CALL",
  // permissions
  "GRANT", "REVOKE",
  // transactions -- irrelevant for a single read, but a free way to wrap
  // something else and confuse a naive "starts with SELECT" check
  "BEGIN", "COMMIT", "ROLLBACK", "START",
  // prepared statements
  "EXECUTE", "PREPARE", "DEALLOCATE",
];

// Substrings that suggest the query is trying to reach outside the loaded
// Parquet file -- a remote URL, cloud storage, or another local file.
// Note "read_parquet" is in here even though the APP ITSELF uses that
// function to load trips.parquet: that internal call happens directly in
// duckdb.js and never passes through this validator, so blocking it here
// only stops user/LLM-supplied SQL from pointing it at a different
// (attacker-controlled) URL.
const FORBIDDEN_SUBSTRINGS = [
  "http://", "https://", "s3://", "ftp://",
  "read_csv", "read_json", "read_parquet", "read_parquet_metadata",
  "glob(", "sniff_csv",
];

function stripStringLiterals(sql) {
  // Standard SQL escapes a quote inside a string by doubling it: 'it''s'.
  // Replace whole literals with a placeholder so keywords/semicolons INSIDE
  // quoted text (e.g. WHERE Zone = 'Select Ave; Queens') don't trip the
  // checks below, and so we don't misreport their contents as the problem.
  return sql.replace(/'(?:[^']|'')*'/g, "''");
}

function stripComments(sql) {
  // Order matters: this runs AFTER stripStringLiterals, so a literal like
  // 'a -- not a comment' has already been blanked out and won't confuse this.
  let out = sql.replace(/\/\*[\s\S]*?\*\//g, " "); // /* block comments */
  out = out.replace(/--.*$/gm, " "); // -- line comments
  return out;
}

export function validateSql(rawSql) {
  if (typeof rawSql !== "string" || rawSql.trim().length === 0) {
    return { valid: false, reason: "Empty query." };
  }

  const noLiterals = stripStringLiterals(rawSql);
  const cleaned = stripComments(noLiterals).trim();

  if (cleaned.length === 0) {
    return { valid: false, reason: "Query is empty once comments are removed." };
  }

  // Stacked statements: allow exactly one optional trailing semicolon.
  // Anything else with a semicolon in it is trying to start a second statement.
  const withoutTrailingSemicolon = cleaned.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    return { valid: false, reason: "Only a single statement is allowed (no ';' in the middle of the query)." };
  }

  // Must be a read: either a plain SELECT, or a CTE (WITH ...) that
  // eventually selects. The forbidden-keyword scan below still applies to
  // the whole statement, so "WITH x AS (DELETE ...)" is caught there, not here.
  const firstWord = withoutTrailingSemicolon.trim().match(/^[A-Za-z]+/);
  const startsReadOnly = firstWord && ["SELECT", "WITH"].includes(firstWord[0].toUpperCase());
  if (!startsReadOnly) {
    return { valid: false, reason: "Query must start with SELECT or WITH." };
  }

  const upper = withoutTrailingSemicolon.toUpperCase();
  for (const word of FORBIDDEN_KEYWORDS) {
    const pattern = new RegExp(`\\b${word}\\b`);
    if (pattern.test(upper)) {
      return { valid: false, reason: `Disallowed keyword: ${word}.` };
    }
  }

  const lower = withoutTrailingSemicolon.toLowerCase();
  for (const needle of FORBIDDEN_SUBSTRINGS) {
    if (lower.includes(needle)) {
      return { valid: false, reason: `Disallowed pattern: ${needle}` };
    }
  }

  return { valid: true };
}
