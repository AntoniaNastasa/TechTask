## Goal

Build a small web application that allows a user to ask questions about a local dataset in natural language and receive the answer.

The intended flow is as follows:

User enters a natural-language question
The browser sends the question and dataset schema to a Cloudflare Worker
The Worker retrieves relevant dataset documentation and asks an LLM to generate read-only SQL
The Worker validates the generated SQL and returns it to the browser (if valid)
The browser displays the SQL
The user can edit the SQL and run it
DuckDB-WASM executes the SQL locally against the dataset
The browser renders the result as a table.
The LLM will never receive dataset rows. It will only receive the user's question, schema information, and documentation/examples about the dataset.

## I will build

a single page React app
a dataset knowledge base containing column descriptions, data types, important semantic definitions, useful SQL examples
LLM-generated SQL
SQL validation that rejects all other than read-only queries
editable generated SQL
a golden test set of ~10 questions and answers
test for SQL validator

## Riskiest, least understood

I've never touched WASM tooling before so getting DuckDB-WASM loading a Parquet file in the browser (I will do this first, try loading a dataset into DuckDB and run a query)
building a Cloudflare Worker and having it select the most relevant snippets for each question

## How I know things work

I can have a set of questions that when inputted return the expected answers
Attacking the Validator and it blocking the requests sent if not valid

## Assumptions

I will use one public dataset that is small enough to load into the browser, it should have multiple types of data (dates, numeric, text), clear semantics that can be documented
The LLM will be instructed to return structured output containing SQL
The prompt will explicitly state that it must only generate read-only SQL and must only use the supplied schema
