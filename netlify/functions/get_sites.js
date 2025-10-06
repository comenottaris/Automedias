// netlify/functions/get_sites.js
// Favorise Neon REST API si NEON_REST_URL + NEON_REST_KEY sont définis.
// Sinon retombe sur NEON_URL (pg).
const { Client } = require("pg");

// Node 18+ a fetch global ; si ton runtime Netlify n'a pas fetch, installe node-fetch.
// Ici on suppose que fetch est disponible.
const TIMEOUT_MS = 60000;

async function fetchFromRest(restUrl, restKey) {
  const url = `${restUrl.replace(/\/$/, "")}/sites?select=*&order=id.asc&limit=2000`;
  const headers = {
    "Content-Type": "application/json",
  };
  if (restKey) {
    headers["apikey"] = restKey;
    headers["Authorization"] = `Bearer ${restKey}`;
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(url, { method: "GET", headers, signal: controller.signal });
    clearTimeout(id);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`REST ${resp.status} ${resp.statusText} - ${text}`);
    }
    const data = await resp.json();
    return { source: "rest", rows: data };
  } catch (err) {
    clearTimeout(id);
    throw new Error(`REST fetch failed: ${err.message}`);
  }
}

async function fetchFromPg(pgUrl) {
  const client = new Client({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();

    // debug info
    try {
      const info = await client.query(
        "SELECT current_database() AS db, current_schema() AS schema, current_setting('search_path') AS search_path;"
      );
      console.log("DB INFO:", info.rows[0]);
    } catch (e) {
      console.warn("DB INFO failed:", e.message);
    }

    // ensure table exists (safe)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.sites (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT,
        type TEXT,
        language TEXT,
        country TEXT,
        platforms JSONB,
        data_formats TEXT[],
        emails TEXT[],
        html_path TEXT,
        md_path TEXT,
        wayback_status TEXT,
        notes TEXT
      );
    `);

    const res = await client.query("SELECT * FROM public.sites ORDER BY id ASC LIMIT 2000;");
    await client.end();
    return { source: "pg", rows: res.rows };
  } catch (err) {
    try { await client.end(); } catch (e) {}
    throw new Error(`PG fetch failed: ${err.message}`);
  }
}

exports.handler = async function (event, context) {
  const restUrl = process.env.NEON_REST_URL;
  const restKey = process.env.NEON_REST_KEY;
  const pgUrl = process.env.NEON_URL;

  // 1) Prefer REST if configured
  if (restUrl) {
    try {
      console.log("Trying Neon REST:", restUrl);
      const { rows } = await fetchFromRest(restUrl, restKey);
      console.log(`REST returned ${Array.isArray(rows) ? rows.length : 0} rows`);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      };
    } catch (restErr) {
      console.warn("Neon REST failed:", restErr.message);
      // fall through to pg fallback if available
    }
  }

  // 2) Fallback to PG if REST missing or failed
  if (pgUrl) {
    try {
      console.log("Falling back to PG");
      const { rows } = await fetchFromPg(pgUrl);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      };
    } catch (pgErr) {
      console.error("PG fallback failed:", pgErr.message);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Both REST and PG fetch failed", details: pgErr.message }),
      };
    }
  }

  // 3) Nothing configured
  return {
    statusCode: 500,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "No NEON_REST_URL or NEON_URL configured in environment" }),
  };
};
