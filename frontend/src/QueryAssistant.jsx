import { useState } from 'react'
import { getSchema, schemaToPromptText, executeQuery } from './duckdb'
import { askQuestion } from './workerClient'
import { DATASET_SNIPPETS } from './snippets'
import { validateSql } from './sqlGuard'
import { useTripsCount } from './useDuckDB'
import './App.css'


//stringifies cell values: json cannot handle bigint directly
function displayValue(value) {
  return typeof value === 'bigint' ? value.toString() : String(value ?? '')
}

//renders rows as a table
function ResultsTable({ rows }) {
  if (rows.length === 0) return null
  const columns = Object.keys(rows[0])

  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col}>{displayValue(row[col])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function QueryAssistant() {
  const [question, setQuestion] = useState('..?')
  const [sql, setSql] = useState('SELECT..')
  const [rationale, setRationale] = useState(null)
  const [asking, setAsking] = useState(false)
  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)
  const { count, loading: countLoading } = useTripsCount()

  // ask question to the worker
  const ask = async () => {
    setErr(null)
    setAsking(true)
    try {
      const schema = await getSchema()
      const schemaText = schemaToPromptText(schema)
      const result = await askQuestion(question, schemaText, DATASET_SNIPPETS)
      setSql(result.sql)
      setRationale(result.rationale)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setAsking(false)
    }
  }


  //runs the sql if it passes the validation
  const run = async () => {
    setErr(null)
    try {
      const validation = validateSql(sql)
      if (!validation.valid) {
        throw new Error(validation.reason)
      }
      const result = await executeQuery(sql)
      setRows(result)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div style={{ padding: '1rem' }}>
      <p>
        {countLoading
          ? 'Loading trips.parquet…'
          : `Dataset loaded: ${count?.toLocaleString()} trips`}
      </p>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={2}
        style={{ width: '100%' }}
        placeholder="Ask a question about the trips dataset…"
      />
      <button onClick={ask} disabled={asking}>
        {asking ? 'Asking…' : 'Ask'}
      </button>

      {rationale && <p><em>{rationale}</em></p>}

      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        rows={3}
        style={{ width: '100%' }}
      />
      <button onClick={run}>Run</button>

      {err && <pre style={{ color: 'red' }}>{err}</pre>}
      <ResultsTable rows={rows} />
    </div>
  )
}