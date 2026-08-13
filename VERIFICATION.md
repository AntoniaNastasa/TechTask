

##GOLDEN SET

Wrote 10 questions covering different query shapes (simple
count, aggregate, group+rank, top-N, filtered aggregate, semantic-code lookup,
computed duration, and one trap question).

Ran a python script (/scripts/ground_truth.py to get the actual results of the queries on the dataset).

Q1. "How many trips happened on January 15th, 2025?"

  Expected SQL:  SELECT COUNT(*) FROM trips WHERE date_trunc('day', tpep_pickup_datetime) = DATE '2025-01-15'
  Generated SQL: SELECT COUNT(*) FROM trips WHERE date_trunc('day', tpep_pickup_datetime) = DATE '2025-01-15'
  Expected result: 125359
  Actual result:   125359
  PASS 


Q2. "What is the average trip distance in miles?"

  Expected SQL:  SELECT AVG(trip_distance) FROM trips
  Generated SQL: SELECT AVG(trip_distance) FROM trips
  Expected result: 5.855126178843539
  Actual result:   5.855126178843539
  PASS but this number is a good
  worked example of "correct SQL, questionable answer"

Q3. "Which payment type is most common?"

  Expected SQL:  SELECT payment_type, COUNT(*) AS cnt FROM trips GROUP BY payment_type ORDER BY cnt DESC LIMIT 1
  Generated SQL: SELECT payment_type, COUNT(*) AS cnt FROM trips GROUP BY payment_type ORDER BY cnt DESC LIMIT 1
  Expected result: payment_type=1 (Credit card), cnt=2444393
  Actual result:   payment_type=1, cnt=2444393
  PASS 

Q4. "What is the total revenue from tips?"

  Expected SQL:  SELECT SUM(tip_amount) FROM trips
  Generated SQL: SELECT SUM(tip_amount) FROM trips
  Expected result: 10286018.349998116
  Actual result:   10286018.349998116
  PASS 

Q5. "Show me the 5 longest trips by distance"

  Expected SQL:  SELECT trip_distance FROM trips ORDER BY trip_distance DESC LIMIT 5
  Generated SQL: SELECT * FROM trips ORDER BY trip_distance DESC LIMIT 5
  Expected result (trip_distance only): 276423.57, 276099.95, 222167.49, 206137.99, 202771.63
  Actual result (all columns, same 5 rows, same order): same trip_distance
  values, plus every other column. Top row also has fare_amount = -4.75.
  PASS. The model chose SELECT * instead of just trip_distance column.

Q6. "What is the average fare amount for trips with more than 2 passengers?"

  Expected SQL:  SELECT AVG(fare_amount) FROM trips WHERE passenger_count > 2
  Generated SQL: SELECT AVG(fare_amount) FROM trips WHERE passenger_count > 2
  Expected result: 19.28203677604799
  Actual result:   19.28203677604799
  PASS

Q7. "How many trips had a trip distance of zero?"

  Expected SQL:  SELECT COUNT(*) FROM trips WHERE trip_distance = 0
  Generated SQL: SELECT COUNT(*) FROM trips WHERE trip_distance = 0
  Expected result: 90893
  Actual result:   90893
  PASS
  Note: 90,893 zero-distance trips out of 3.47M
  (~2.6%) is itself a data-quality signal worth knowing about — see
  section 4.

Q8. "What is the busiest pickup location (PULocationID)?"

  Expected SQL:  SELECT PULocationID, COUNT(*) AS cnt FROM trips GROUP BY PULocationID ORDER BY cnt DESC LIMIT 1
  Generated SQL: SELECT PULocationID, COUNT(*) AS trip_count FROM trips GROUP BY PULocationID ORDER BY trip_count DESC LIMIT 1
  Expected result: PULocationID=161, cnt=169977
  Actual result:   PULocationID=161, trip_count=169977
  PASS. This question test the "'busy' means highest COUNT(*)" snippet directly, and the model used it correctly.

Q9. "What is the average trip duration in minutes?"

  Expected SQL:  SELECT AVG(date_diff('minute', tpep_pickup_datetime, tpep_dropoff_datetime)) FROM trips
  Generated SQL: SELECT AVG(date_diff('minute', tpep_pickup_datetime, tpep_dropoff_datetime)) FROM trips
  Expected result: 15.01820543469691
  Actual result:   15.01820543469691
  PASS. Confirms the model picked up the date_diff snippet correctly rather than inventing its own duration formula.

Q10. "What is the average amount passengers actually paid, including cash tips?"

  Expected SQL: none — this question cannot be answered correctly with the
  columns available, because cash tips are not recorded anywhere in the
  dataset (per the snippet: "cash tips are not recorded and appear as 0").
  Any single number returned is, strictly, an answer to a question that
  wasn't asked.
  Generated SQL: SELECT AVG(total_amount) FROM trips
  Actual result: 25.611291697280986
  Rationale returned by the model: "The 'total_amount' column represents
  the sum of all recorded charges (fare, extras, tax, and credit card
  tips). Since cash tips are not recorded in the database and appear as 0
  in the 'tip_amount' column, this aggregate is the best available metric
  for the average amount passenger's fares cost."
  VERDICT: partial pass. The SQL result on its own looks like a clean answer to "including cash tips" when it
  structurally cannot include cash tips at all. A user who reads the table and not the rationale will walk away with a wrong belief.

Score: 9/10 pass, 1/10 partial (correct-given-the-constraints, but
the underlying question has no true answer in this dataset).



##SEMANTIC CORRECTNESS

The SQL can be syntactically valid, execute without
error, and return a well-formed table, while still not answering what the
person actually meant. I did not find a general solution to this.

The main lever available is the snippets file (frontend/src/snippets.js).
Where this breaks down is anything the snippets don't anticipate. Q10 was
designed to find that edge: "including cash tips" directly contradicts
what's possible with the schema.


A second problem is Q2 (average trip distance = 5.86 miles). That number 
is arithmetically correct, but it's inflated by a small number of impossible 
outlier trips (one row claims 276,423.57 miles physically impossible for a taxi trip).
A user asking "what's the average trip" almost certainly means "what's a typical
trip", not "what's the average including corrupted rows." SQL
can't tell the difference between those two questions on its own, and
neither the schema nor the snippets currently say anything about
filtering outliers or data quality. AVG(trip_distance) is semantically
correct as a literal SQL question, and semantically misleading as an
answer to what was actually asked.

I did not build any automated check for this class of problem (e.g.
comparing the model's answer to a second model's judgment, or asking the
model to flag its own confidence). The golden set above is the closest
thing I have to a check, and it's manual: I read the question, the SQL,
and the result myself and judged whether they matched. That doesn't
scale past 10 questions, and it would miss anything I didn't personally think to ask.



##ATTACKING THE VALIDATOR (frontend/src/sqlGuard.js)

CAUGHT:

  - Basic stacked statement:
      SELECT * FROM trips; DROP TABLE trips;
      -> "Only a single statement is allowed"
  - Stacked statement with no space after the semicolon:
      SELECT 1;DELETE FROM trips
      -> same
  - Two independent SELECTs stacked:
      SELECT 1; SELECT 2
      -> same
  - DELETE hidden inside a CTE body (no stacking needed, keyword scan
    covers the whole statement, not just the first word):
      WITH x AS (DELETE FROM trips RETURNING 1) SELECT * FROM x
      -> "Disallowed keyword: DELETE"
  - Mixed-case keywords (case-insensitive matching confirmed):
      select * from trips; droP TABLE trips;
      -> "Only a single statement is allowed"
  - A second statement hidden after a line comment on the next line
    (comment gets stripped, but the following line's keyword is still
    scanned):
      SELECT 1 -- comment
      DROP TABLE trips
      -> "Disallowed keyword: DROP"
  - Reading an arbitrary local file:
      SELECT * FROM read_csv('C:/Windows/System32/drivers/etc/hosts')
      -> "Disallowed pattern: read_csv"
  - Reading a remote URL (SSRF-style):
      SELECT * FROM read_parquet('http://attacker.example/evil.parquet')
      -> "Disallowed pattern: read_parquet"
  - ATTACH, COPY (both "COPY table TO file" and "COPY (subquery) TO
    file"), EXPORT DATABASE, SET, CALL — all rejected, because none of
    them start with SELECT or WITH:
      -> "Query must start with SELECT or WITH"
  - Directory listing via glob():
      SELECT * FROM glob('C:/Users/*')
      -> "Disallowed pattern: glob("
  - Trailing double semicolon:
      SELECT 1;;
      -> "Only a single statement is allowed"

CORRECTLY ALLOWED (false-positive check):

  - Multi-line formatting of an ordinary query.
  - A semicolon that appears inside a string literal or is built via
    CONCAT(), rather than as a real statement separator — confirmed the
    validator doesn't misfire on this.
  - SELECT 1; -- trailing comment after the one real statement.

NOT CAUGHT: 

  - SELECT * FROM pragma_table_info('trips')  -> valid: true
  - SELECT * FROM duckdb_settings()           -> valid: true
  - SELECT * FROM sqlite_scan('other.db', 'secrets') -> valid: true
    DuckDB exposes PRAGMA-style introspection and cross-database access as
    ordinary callable table functions, not as a PRAGMA keyword, so a
    plain SELECT can reach them without ever containing a blocked word.
    We discussed adding a regex to block the whole pragma_*/duckdb_*/
    sqlite_* function-name family and deliberately decided not to (I
    wasn't confident in that regex, so we cut it rather than ship
    something half-verified). This is a known, accepted gap, not an
    oversight — see section 4.
  - Block comments containing "malicious" text:
      SELECT 1 /*; DROP TABLE trips; */   -> valid: true
    This is not actually a bypass: the validator strips the comment before
    checking it, but so does DuckDB's own parser — the content inside
    /* */ never executes either way. Confirmed as a non-issue, included
    here because it looks alarming at first glance.
  - Unicode homoglyph keyword, single statement, no semicolon (Cyrillic
    "Е" substituted into "DELETE"):
      WITH x AS (DEL<CYRILLIC-E>TE FROM trips) SELECT 1   -> valid: true
    The regex only matches literal ASCII keywords, so a confusable
    character slips past it. In practice this is not currently
    exploitable against this app, because DuckDB's own SQL parser also
    doesn't recognize the homoglyph as the DELETE keyword — it would fail
    with a parser error before doing anything, so the SQL engine's own
    strictness is incidentally covering for the validator here. This
    would become a real hole if the app ever swapped in an engine that
    normalizes Unicode confusables before parsing.


##KNOWN FAILURES

1. No row limit is enforced anywhere except a sentence in the LLM prompt.
   The Worker's system prompt tells the model to "always add a LIMIT
   clause (max 1000 rows) unless the question asks for a single aggregate
   value". validateSql() has no concept of row limits at all. I tested
   this directly: typed "SELECT * FROM trips LIMIT 500000" into the SQL
   box and hit Run. The validator accepted it (correctly, it's a normal
   SELECT), DuckDB-WASM presumably started executing it, and the tab sat
   with no visible feedback for over 30 seconds with no result. The Run button, unlike Ask, 
   has no loading state, so a slow or oversized query is indistinguishable from a
   frozen app. 

2. The Worker performs no SQL validation of its own. sqlGuard.js only
   runs in the browser, right before execution. Anything that calls the Worker directly
   (not through this frontend) gets back raw, unvalidated LLM SQL text.
   This is not currently dangerous to the dataset, because the Worker
   never has data access in the first place and the frontend still
   enforces the real check before touching DuckDB.

3. AVG-style questions are silently vulnerable to outlier rows with no
   warning anywhere in the pipeline. Confirmed in the golden set: Q2's
   "average trip distance" (5.86 mi) is measurably distorted by rows with
   physically impossible values (one trip reports 276,423.57 miles; the
   longest-5 query in Q5 also surfaces a row with fare_amount = -4.75).
   Neither the schema, the snippets, nor the validator know anything
   about data quality — an AVG() or SUM() over a column with unfiltered
   garbage values will happily return a precise-looking number that
   doesn't represent a "typical" trip. Diagnosis: this is a documentation
   gap, not a code bug, nothing tells the LLM (or the user) that these
   columns contain known-bad rows, so there's no mechanism by which the
   generated SQL would ever filter them out unless a question happens to
   ask for it explicitly.
