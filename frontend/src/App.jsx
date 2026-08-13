import { useState } from 'react'
import { getSchema, schemaToPromptText, executeQuery } from './duckdb'
import { askQuestion } from './workerClient'
import { DATASET_SNIPPETS } from './snippets'
import { validateSql } from './sqlGuard'
import { useTripsCount } from './useDuckDB'
import './App.css'
import QueryAssistant from './QueryAssistant.jsx'

function App() {
  return (
    <>
      <section id="center">

      </section>

      <QueryAssistant />
    </>
  )
}

export default App