
## Requirements

**Node.js** and **npm**
**Cloudflare account**, logged in via `npx wrangler login`


## Setup (from a clean clone)

Two terminals, one per project both need `npm install` once each:

```
cd worker
npm install
npx wrangler login      # only needed once per machine
```

```
cd frontend
npm install
```


## Environment variables & bindings

`AI` binding in `worker/wrangler.jsonc` (`"ai": { "binding": "AI" }`): Gives the Worker access to Workers AI via `env.AI.run(...)`. No API key needed 

`VITE_WORKER_URL`,`frontend/.env` (not committed): Tells the frontend where the Worker is running
Check the terminal output from wrangler dev: if it's not 8787, create frontend/.env with VITE_WORKER_URL=<that URL> before starting the frontend

`VITE_WORKER_URL`, `frontend/.env.production` (committed): Holds the deployed
Worker's URL (`https://worker.nastasantonia1910.workers.dev`). Picked up
automatically by `vite build` / `npm run preview` — `npm run dev` never reads
this file, only `frontend/.env`.

**Model ID** 
(hardcoded in `worker/src/index.js`): `@cf/zai-org/glm-4.7-flash`


## Running it

**Terminal 1 — start the Worker:**
```
cd worker
npx wrangler dev
```

**Terminal 2 — start the frontend:**
```
cd frontend
npm run dev
```


Open the printed frontend URL in a browser. You should see "Dataset loaded:
3,475,226 trips" once DuckDB-WASM finishes loading the Parquet file, that's
the first sign everything is wired up correctly.


**Running against the deployed Worker (production):**

The Worker is already deployed. To (re)deploy it after making changes:
```
cd worker
npm run deploy      # or: npx wrangler deploy
```
Wrangler prints the live URL — if it changes (e.g. Worker renamed), update
`frontend/.env.production` to match.

To run the frontend against that deployed Worker instead of a local one:
```
cd frontend
npm run build
npm run preview
```
`vite build` reads `frontend/.env.production` automatically, so no local
Worker needs to be running for this.


## Testing it as a reviewer

In the browser: type a question like
*"How many trips happened on January 15th?"*, click **Ask** (calls the
Worker/LLM, shows generated SQL + a one-sentence rationale), then click
**Run** (executes locally against DuckDB-WASM, renders a table). Try a
couple more questions — e.g. *"What is the average trip distance?"* or
*"Which payment type is most common?"*.

**Try to break the validator** Edit the SQL box directly to
something like `SELECT * FROM trips; DROP TABLE trips;` and hit **Run** — it
should be rejected with an error, not executed. 

**Check the LLM in isolation, no browser needed** With the
Worker running, from the repo root:
```
curl -X POST http://127.0.0.1:8787 -H "Content-Type: application/json" --data @scripts/example_request_1.json
```
Returns `{"sql": "...", "rationale": "..."}` straight from the Worker. To try a
different question, copy `scripts/example_request_1.json` and edit the
`"question"` field (keep `schemaText`/`snippets` as-is).

**Check DuckDB's actual answers, independent of the LLM**
Requires Python with the `duckdb` package installed (`pip install duckdb`):
```
python scripts/ground_truth.py
```
Runs 10 hand-written SQL queries directly against the Parquet file and prints the results.
