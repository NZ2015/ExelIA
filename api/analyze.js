import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helpers: cleaning, type inference, simple anomaly detection (z-score)
function inferColumnTypes(data) {
  const types = {};
  if (!Array.isArray(data) || data.length === 0) return types;
  const sample = data[0];
  for (const key of Object.keys(sample)) {
    let num = 0,
      date = 0,
      text = 0,
      total = 0;
    for (const row of data.slice(0, 50)) {
      total++;
      const v = row[key];
      if (v === null || v === undefined || v === "") continue;
      if (typeof v === "number") num++;
      else if (!isNaN(Date.parse(v))) date++;
      else if (!isNaN(parseFloat(String(v).replace(/,/g,".")))) num++;
      else text++;
    }
    if (num / Math.max(1, total) > 0.6) types[key] = "number";
    else if (date / Math.max(1, total) > 0.6) types[key] = "date";
    else types[key] = "text";
  }
  return types;
}

function cleanData(data, types) {
  return data.map((row) => {
    const out = {};
    for (const k of Object.keys(row)) {
      let v = row[k];
      if (v === null || v === undefined) {
        out[k] = null;
        continue;
      }
      if (types[k] === "number") {
        const n = parseFloat(String(v).replace(/,/g, "."));
        out[k] = isNaN(n) ? null : n;
      } else if (types[k] === "date") {
        const d = new Date(v);
        out[k] = isNaN(d.getTime()) ? null : d.toISOString();
      } else {
        out[k] = String(v).trim();
      }
    }
    return out;
  });
}

function summarizeColumns(cleaned, types) {
  const summary = {};
  const cols = Object.keys(types);
  for (const col of cols) {
    const vals = cleaned.map((r) => r[col]).filter((v) => v !== null && v !== undefined);
    if (types[col] === "number") {
      const n = vals.length;
      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = n ? sum / n : null;
      const variance = n ? vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n : null;
      const std = variance === null ? null : Math.sqrt(variance);
      const min = n ? Math.min(...vals) : null;
      const max = n ? Math.max(...vals) : null;
      summary[col] = { type: "number", count: n, mean, std, min, max };
    } else if (types[col] === "date") {
      summary[col] = { type: "date", sampleValues: vals.slice(0, 5) };
    } else {
      const counts = {};
      for (const v of vals) counts[v] = (counts[v] || 0) + 1;
      summary[col] = { type: "text", topValues: Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5) };
    }
  }
  return summary;
}

function detectAnomalies(summary, cleaned, types) {
  const anomalies = [];
  for (const col of Object.keys(types)) {
    if (types[col] !== "number") continue;
    const vals = cleaned.map((r) => r[col]).filter((v) => v !== null && v !== undefined);
    const n = vals.length;
    if (n < 2) continue;
    const mean = summary[col].mean;
    const std = summary[col].std || 0;
    if (!std || std === 0) continue;
    for (let i = 0; i < cleaned.length; i++) {
      const v = cleaned[i][col];
      if (v === null || v === undefined) continue;
      const z = Math.abs((v - mean) / std);
      if (z > 3) {
        anomalies.push({ row: i + 1, column: col, value: v, score: z.toFixed(2), method: "z-score" });
      }
    }
  }
  return anomalies;
}

export default async function handler(req, res) {
  try {
    const { data } = req.body || {};
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "Données manquantes ou mal formées : 'data' doit être un tableau." });
    }

    // 1) type inference
    const types = inferColumnTypes(data);

    // 2) cleaning
    const cleaned = cleanData(data, types);

    // 3) basic summaries
    const summary = summarizeColumns(cleaned, types);

    // 4) detect anomalies locally
    const anomalies = detectAnomalies(summary, cleaned, types);

    // 5) prepare prompt to AI: provide cleaned summary + ask for structured JSON output
    const prompt = `Tu es une IA experte en analyse de tableaux. Je te donne un petit résumé statistique et quelques lignes d'exemples, puis je veux une réponse STRICTEMENT au format JSON avec les clés: summary, trends, anomalies, conclusions, suggestions.

Résumé statistique (colonnes et mesures) :
${JSON.stringify(summary, null, 2)}

Anomalies détectées localement :
${JSON.stringify(anomalies, null, 2)}

Exemples de lignes (jusqu'à 10) :
${JSON.stringify(cleaned.slice(0, 10), null, 2)}

Consignes :
- Ne renvoie que du JSON valide.
- summary : court (2-4 phrases) en français.
- trends : tableau d'objets décrivant 1-3 tendances importantes (champ: description, evidence).
- anomalies : regroupe anomalies locales et potentiellement détectées par IA (décrire pourquoi).
- conclusions : 1-3 conclusions actionnables.
- suggestions : actions concrètes (ex: nettoyer colonnes X, vérifier valeurs y, créer pivot, exporter).
`;

    const completion = await client.responses.create({
      model: "gpt-5",
      input: prompt
    });

    const raw = completion.output_text || JSON.stringify(completion);

    // Attempt to parse JSON from model output
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // try to extract JSON substring
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch (e2) {
          // fall through
        }
      }
    }

    if (!parsed) {
      // fallback: return structured object with AI text in summary
      parsed = {
        summary: raw.substring(0, 1000),
        trends: [],
        anomalies: anomalies,
        conclusions: [],
        suggestions: []
      };
    }

    // Attach local analysis details for transparency
    parsed._local = { types, summaryStats: summary, localAnomalies: anomalies };

    return res.status(200).json(parsed);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
