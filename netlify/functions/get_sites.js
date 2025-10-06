// netlify/functions/get_sites.js
// Renvoie les lignes de la table "sites".
// Utilise Neon REST en priorité, sinon fallback Postgres.

// ---------- CONFIG (hardcoded) ----------
const NEON_REST_BASE = "https://ep-dark-forest-abvkn94d.apirest.eu-west-2.aws.neon.tech/neondb/rest/v1";
const NEON_REST_KEY  = "ssk_yf7rgwj2zee3awscs2s3yat1xzg9r12x71sp2nk5svppr"; // token JWT / service key
const DATABASE_URL   = "postgresql://neondb_owner:npg_4XfqJQhV3bpe@ep-dark-forest-abvkn94d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
// ----------------------------------------

const { Client } = require("pg");

const TIMEOUT_MS = 30000;

async function fetchRest() {
  const url = `${NEON_REST_BASE.replace(/\/$/, "")}/sites?select=*&order=id.asc&limit=5000`;
  const headers = {
    "Content-Type": "application/json",
    "apikey": NEON_REST_KEY,
    "Authorization": `Bearer ${NEON_REST_KEY}`
  };
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { method: "GET", headers, signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) {
      const txt = await res.text().catch(()=>"");
      throw new Error(`REST ${res.status} ${res.statusText} - ${txt}`);
    }
    const data = await res.json();
    return data;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchPg() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    // create table if missing (safe default)
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
    const res = await client.query("SELECT * FROM public.sites ORDER BY id ASC LIMIT 5000;");
    await client.end();
    return res.rows;
  } catch (err) {
    try { await client.end(); } catch(e){}
    throw err;
  }
}

exports.handler = async function(event, context) {
  console.log("INFO: get_sites starting — try REST then PG");

  // try REST first
  try {
    const rows = await fetchRest();
    console.log("INFO: REST OK — rows:", Array.isArray(rows) ? rows.length : 0);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows)
    };
  } catch (restErr) {
    console.warn("WARN: Neon REST failed:", restErr.message);
  }

  // fallback PG
  try {
    const rows = await fetchPg();
    console.log("INFO: PG OK — rows:", rows.length);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows)
    };
  } catch (pgErr) {
    console.error("ERROR: PG fallback failed:", pgErr.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Both REST and PG failed", details: pgErr.message })
    };
  }
};
