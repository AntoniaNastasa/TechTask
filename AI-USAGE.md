
The most used agent was Claude Code.

The first step was to request a Jargon decoder, an architecture overview and a basic step by step plan.
Asked about a well documented dataset from the provided examples.
Generated the code for implementing DuckDB and testing its functionality by displaying a result on the page.
The first suggested test for DuckDB was by running a script that reads the Parquet file, but that wouldn`t have actually tested DuckDB-WASM. (I have used the python script idea later to get relevant data from the dataset).
Generated the Cloudflare Worker Component (looked into the models but chose @cf/zai-org/glm-4.7-flash instead of the suggested llama one).

When looking into creating the validator, it provided 2 interesting solutions I`ve rejected due to not being able to further look into them and their effect on the app (making the DB read-only and using a DuckDB parser).

Generated the Validator as I have not played around with SQL validation before so I was not aware of all the possible attacks (this would need to be further studied).






