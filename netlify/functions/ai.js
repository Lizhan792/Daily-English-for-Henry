// Netlify Function: proxies chat/scoring requests to the Anthropic API.
// The API key lives only here (as an environment variable), never in the browser.
//
// Set this in the Netlify dashboard under:
// Site settings > Environment variables > ANTHROPIC_API_KEY

exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY is not set on the server. Add it in Netlify > Site settings > Environment variables." })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  // Basic guardrails: cap tokens, require the fields the app actually sends.
  const safePayload = {
    model: payload.model || "claude-sonnet-5",
    max_tokens: Math.min(payload.max_tokens || 400, 1000),
    system: payload.system,
    messages: payload.messages
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(safePayload)
    });

    const data = await response.json();
    return {
      statusCode: response.status,
      headers: { ...corsHeaders, "content-type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to reach Anthropic API", detail: String(e) })
    };
  }
};
