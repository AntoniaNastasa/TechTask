"""
Runs SQL directly against the Parquet file, independent of the
Worker, the LLM, and the frontend. Used to establish ground-truth answers to
compare the app's LLM-generated SQL against.

"""

import duckdb

PARQUET_PATH = "D:/TalkToYourDataApp/frontend/public/data/yellow_tripdata_2025-01.parquet"

# label, question , hand-written SQL
QUERIES = [
    ("Q1", "How many trips happened on January 15th, 2025?",
     "SELECT COUNT(*) FROM trips WHERE date_trunc('day', tpep_pickup_datetime) = DATE '2025-01-15'"),
    ("Q2", "What is the average trip distance in miles?",
     "SELECT AVG(trip_distance) FROM trips"),
    ("Q3", "Which payment type is most common?",
     "SELECT payment_type, COUNT(*) AS cnt FROM trips GROUP BY payment_type ORDER BY cnt DESC LIMIT 1"),
    ("Q4", "What is the total revenue from tips?",
     "SELECT SUM(tip_amount) FROM trips"),
    ("Q5", "Show me the 5 longest trips by distance",
     "SELECT trip_distance FROM trips ORDER BY trip_distance DESC LIMIT 5"),
    ("Q6", "What is the average fare amount for trips with more than 2 passengers?",
     "SELECT AVG(fare_amount) FROM trips WHERE passenger_count > 2"),
    ("Q7", "How many trips had a trip distance of zero?",
     "SELECT COUNT(*) FROM trips WHERE trip_distance = 0"),
    ("Q8", "What is the busiest pickup location (PULocationID)?",
     "SELECT PULocationID, COUNT(*) AS cnt FROM trips GROUP BY PULocationID ORDER BY cnt DESC LIMIT 1"),
    ("Q9", "What is the average trip duration in minutes?",
     "SELECT AVG(date_diff('minute', tpep_pickup_datetime, tpep_dropoff_datetime)) FROM trips"),
    ("Q10", "What is the average amount passengers actually paid, including cash tips?",
     "SELECT AVG(total_amount) FROM trips"),
]


def main():
    con = duckdb.connect()
    con.execute(f"CREATE VIEW trips AS SELECT * FROM read_parquet('{PARQUET_PATH}')")

    row_count = con.execute("SELECT COUNT(*) FROM trips").fetchone()[0]
    print(f"Loaded trips view: {row_count} rows\n")

    for label, question, sql in QUERIES:
        print(f"{label} | {question}")
        print(f"  SQL: {sql}")
        try:
            result = con.execute(sql).fetchall()
            print(f"  Result: {result}")
        except Exception as e:
            print(f"  ERROR: {e}")
        print()


if __name__ == "__main__":
    main()
