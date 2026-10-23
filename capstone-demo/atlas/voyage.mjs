// Minimal Voyage AI embeddings client (Node 18+ fetch).
// Keys created in Atlas (prefix "al-") use the MongoDB-hosted endpoint; others use voyageai.com.
// VOYAGE_URL overrides either.

const URL =
  process.env.VOYAGE_URL ??
  (process.env.VOYAGE_API_KEY?.startsWith('al-')
    ? 'https://ai.mongodb.com/v1/embeddings'
    : 'https://api.voyageai.com/v1/embeddings');
const MODEL = process.env.VOYAGE_MODEL ?? 'voyage-3.5-lite';

export const hasVoyage = () => Boolean(process.env.VOYAGE_API_KEY);

export async function embed(texts, inputType) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: inputType }),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}
