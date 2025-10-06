// netlify/functions/seed_sites.js
// Seed script: lit db.json et insère/maj via Neon REST (POST/PATCH).
// WARNING: This will write dans ta base. Lance une seule fois.

// ---------- CONFIG (hardcoded) ----------
const NEON_REST_BASE = "https://ep-dark-forest-abvkn94d.apirest.eu-west-2.aws.neon.tech/neondb/rest/v1";
const NEON_REST_KEY  = "ssk_yf7rgwj2zee3awscs2s3yat1xzg9r12x71sp2nk5svppr";
// Optionnel fallback PG si REST non dispo (utilise la même DATABASE_URL que pour get_sites)
const DATABASE_URL   = "postgresql://neondb_owner:npg_4XfqJQhV3bpe@ep-dark-forest-abvkn94d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
// Protection simple : token d'admin à passer en query param pour éviter seed accidentel
const ADMIN_TOKEN = "seed-me-please"; 
// ----------------------------------------

const { Client } = require("pg");
const path = require("path");
const fs = require("fs");

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function restInsertOne(item) {
  const urlPost = `${NEON_REST_BASE.replace(/\/$/, "")}/sites`;
  const headers = {
    "Content-Type": "application/json",
    "apikey": NEON_REST_KEY,
    "Authorization": `Bearer ${NEON_REST_KEY}`,
    "Prefer": "return=representation"
  };

  // Try POST (insert)
  let res = await fetch(urlPost, {
    method: "POST",
    headers,
    body: JSON.stringify(item)
  });
  if (res.ok) {
    return { ok: true, action: "insert", status: res.status, body: await safeJson(res) };
  }

  // If conflict or not ok, try PATCH by url (update)
  const encodedUrl = encodeURIComponent(item.url || "");
  const urlPatch = `${NEON_REST_BASE.replace(/\/$/, "")}/sites?url=eq.${encodedUrl}`;
  res = await fetch(urlPatch, {
    method: "PATCH",
    headers,
    body: JSON.stringify(item)
  });
  if (res.ok) {
    return { ok: true, action: "patch", status: res.status, body: await safeJson(res) };
  }

  // return error
  const text = await res.text().catch(()=>"");
  return { ok: false, status: res.status, text };
}

async function safeJson(res){
  try { return await res.json(); } catch(e){ return null; }
}

async function seedViaPg(items) {
  // fallback PG insertion (simple insert ignoring duplicates)
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    // ensure table exists
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
    for (const item of items) {
      const q = `
        INSERT INTO public.sites (url, title, type, language, country, platforms, data_formats, emails, html_path, md_path, wayback_status, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (url) DO UPDATE
          SET title=EXCLUDED.title,
              type=EXCLUDED.type,
              language=EXCLUDED.language,
              country=EXCLUDED.country,
              platforms=EXCLUDED.platforms,
              data_formats=EXCLUDED.data_formats,
              emails=EXCLUDED.emails,
              html_path=EXCLUDED.html_path,
              md_path=EXCLUDED.md_path,
              wayback_status=EXCLUDED.wayback_status,
              notes=EXCLUDED.notes;
      `;
      const vals = [
        item.url || null,
        item.title || null,
        item.type || null,
        item.language || null,
        item.country || null,
        JSON.stringify(item.platforms || []),
        item.data_formats || [],
        item.emails || [],
        item.html_path || null,
        item.md_path || null,
        item.wayback_status || null,
        item.notes || null
      ];
      await client.query(q, vals);
    }
    await client.end();
    return { ok: true, count: items.length };
  } catch (err) {
    try { await client.end(); } catch(e){}
    return { ok: false, error: err.message };
  }
}

exports.handler = async function(event, context) {
  console.log("INFO: seed_sites starting");

  // simple auth: ?token=seed-me-please
  const qs = event.queryStringParameters || {};
  if (qs.token !== ADMIN_TOKEN) {
    return { statusCode: 403, body: "Forbidden: missing/invalid token. Use ?token=" + ADMIN_TOKEN };
  }

  // read local db.json (root/db.json)
  const dbPath = path.join(__dirname, "..", "..", "db.json");
  if (!fs.existsSync(dbPath)) {
    return { statusCode: 500, body: "db.json not found at " + dbPath };
  }
  const raw = fs.readFileSync(dbPath, "utf8");
  let items;
  try { items = JSON.parse(raw); } catch (e) {
    return { statusCode: 500, body: "db.json parse error: " + e.message };
  }

  // Try REST insert loop
  const results = [];
  let restOk = true;
  for (const item of items) {
    try {
      const r = await restInsertOne(item);
      results.push({ url: item.url, result: r });
      // small delay to avoid rate-limits
      await sleep(120);
    } catch (err) {
      restOk = false;
      results.push({ url: item.url, error: err.message });
    }
  }

  // If REST completely failed (e.g. auth) do fallback PG insertion
  if (!restOk) {
    console.log("WARN: REST partially failed, trying PG fallback");
    const pgRes = await seedViaPg(items);
    return {
      statusCode: pgRes.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restResults: results, pgResult: pgRes })
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restResults: results })
  };
};
