/**
 * Direct Google Gemini API access using the project's own GEMINI_API_KEY.
 * Server-only: never import this from client code.
 */

const MODEL = "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type JsonSchema = Record<string, unknown>;

/**
 * Converts a strict JSON Schema (OpenAI style) into the OpenAPI subset that
 * Gemini's `responseSchema` accepts: no `additionalProperties`, and nullable
 * types expressed as `nullable: true` instead of `["string", "null"]`.
 */
export function toGeminiSchema(schema: unknown): JsonSchema {
  if (Array.isArray(schema)) return schema as unknown as JsonSchema;
  if (typeof schema !== "object" || schema === null) return schema as JsonSchema;

  const input = schema as JsonSchema;
  const out: JsonSchema = {};

  for (const [key, value] of Object.entries(input)) {
    if (key === "additionalProperties" || key === "$schema") continue;

    if (key === "type") {
      if (Array.isArray(value)) {
        const types = value as string[];
        const main = types.find((entry) => entry !== "null");
        out["type"] = main ?? "string";
        if (types.includes("null")) out["nullable"] = true;
      } else {
        out["type"] = value;
      }
      continue;
    }

    if (key === "properties" && typeof value === "object" && value !== null) {
      const properties: JsonSchema = {};
      for (const [name, child] of Object.entries(value as JsonSchema)) {
        properties[name] = toGeminiSchema(child);
      }
      out["properties"] = properties;
      continue;
    }

    if (key === "items") {
      out["items"] = toGeminiSchema(value);
      continue;
    }

    out[key] = value;
  }

  return out;
}

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

/**
 * Calls Gemini and returns the raw JSON text of the response.
 * `schema` is a JSON Schema; it is converted to Gemini's subset automatically.
 */
export async function geminiJson(options: {
  parts: GeminiPart[];
  schema: unknown;
  systemInstruction?: string;
  apiKey: string;
  label: string;
}): Promise<string> {
  const { parts, schema, systemInstruction, apiKey, label } = options;

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      ...(systemInstruction
        ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
        : {}),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(schema),
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[${label}] gemini error`, response.status, detail);
    if (response.status === 429) {
      throw new Error("Gemini is rate-limiting requests right now. Please try again in a moment.");
    }
    if (response.status === 400 && detail.includes("API key")) {
      throw new Error("Your Gemini API key was rejected. Please check the key and try again.");
    }
    if (response.status === 403) {
      throw new Error("Your Gemini API key doesn't have access to this model.");
    }
    throw new Error("We couldn't reach Gemini right now. Please try again.");
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");

  return text;
}
