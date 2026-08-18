const MODEL_ID = "@cf/zai-org/glm-4.7-flash";

const SYSTEM_PROMPT = `You write DuckDB SQL queries.

Rules:
- Output exactly ONE SQL statement.
- SELECT only. Never use INSERT, UPDATE, DELETE, DROP, ATTACH, COPY, CREATE, ALTER, or PRAGMA.
- Use only the tables and columns listed in the schema below. Never invent column names.
- Always add a LIMIT clause (max 1000 rows) unless the question asks for a single aggregate value.
- Respond with ONLY valid JSON, no markdown, no code fences, in this exact shape:
{"sql": "SELECT ...", "rationale": "one sentence explaining the approach"}`;

//provide question + schema +snippets
function buildUserPrompt(question, schemaText, snippets) {
  const snippetBlock = snippets.length
    ? `Relevant notes:\n${snippets.join('\n')}\n\n`
    : '';
  return `${schemaText}\n\n${snippetBlock}Question: ${question}`;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};


//the responses are fetchable from different origins (localhost:5174 > localhost:8787)
function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}


//workers AI response is different depending on the model chosen
//this normalises it to text
function extractResponseText(aiResponse) {
  const res = aiResponse;

  if ("response" in res) {
    return res.response;
  }

  if (
    "choices" in res &&
    Array.isArray(res.choices) &&
    res.choices[0]?.message?.content !== undefined
  ) {
    return res.choices[0].message.content;
  }

  return res;
}


//handler: calls env.AI and returns the sql + rationale
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return new Response("Use POST", { status: 405, headers: CORS_HEADERS });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.question || !body.schemaText) {
      return json({ error: "Missing 'question' or 'schemaText'" }, 400);
    }

    const userPrompt = buildUserPrompt(
      body.question,
      body.schemaText,
      body.snippets ?? []
    );

    const aiResponse = await env.AI.run(MODEL_ID, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    console.log(JSON.stringify(aiResponse));
    const raw = extractResponseText(aiResponse);

    let parsed;

    if (typeof raw === "object" && raw !== null && "sql" in raw) {
      parsed = raw;
    } else if (typeof raw === "string") {
      try {
        const cleaned = raw.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        return json({ error: "Model did not return valid JSON", raw }, 502);
      }
    } else {
      return json({ error: "Unexpected response shape from model", raw }, 502);
    }

    return json(parsed);
  },
};