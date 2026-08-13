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

## Changes from this plan + Steps Taken

Choose and download dataset NYC Yellow Taxi January 2025
Create the snippets using the PDF file "Data Dictionary – Yellow Taxi Trip Records"
Create the frontend component using React (this includes the React page and the DuckDB files)
Test DuckDB on the frontend by displaying the number of trips (useTripsCount)
Test the Worker by creating a example_request_1.json file and running  curl.exe -X POST http://127.0.0.1:8787 -H "Content-Type: application/json" --data @scripts/example_request_1.json
Create a python script ground_truth.py to get the real values in the dataset


## Improvements

Look into the DuckDB parser and update the validator based on that (also look into making the DB read-only)
Add more snippets and make the Worker select the most relevant ones
