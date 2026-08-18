//const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? "http://127.0.0.1:8787";
const WORKER_URL = "http://127.0.0.1:8787";

//POST to the workers URL
export async function askQuestion(question, schemaText, snippets) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, schemaText, snippets }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Worker request failed (${res.status})`);
  }

  if (!data.sql) {
    throw new Error("Worker response did not contain SQL");
  }

  return data;
}
