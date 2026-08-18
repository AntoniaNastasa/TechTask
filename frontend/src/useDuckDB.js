import { useEffect, useState } from "react";
import { runQuery } from "./duckdb";


//a confirmation that the parquet file loaded
export function useTripsCount() {
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { rows } = await runQuery("SELECT COUNT(*) AS count FROM trips");
        //stops from calling on a component that doesnt exist no more
        if (!cancelled) setCount(Number(rows[0].count));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    //cleanup for when the component unmounts
    return () => {
      cancelled = true;
    };
  }, []);

  return { count, loading, error };
}
