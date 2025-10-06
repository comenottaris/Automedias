// netlify/functions/get_sites.js
const { Client } = require("pg");

/**
 * CONFIG - connection string hardcoded (change if needed)
 * Warning: hardcoding secrets in repo is unsafe for production.
 */
const PG_CONNECTION = "postgresql://neondb_owner:npg_4XfqJQhV3bpe@ep-dark-forest-abvkn94d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

/**
 * Ensure table + unique constraint exist.
 */
async function ensureTable(client) {
  // create table if missing
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

  // create unique constraint on url if not exists
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.contype = 'u' AND t.relname = 'sites' AND array_to_string(c.conkey,',') LIKE '%'
      ) THEN
        -- check whether a constraint named sites_url_unique already exists
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name='sites' AND constraint_name='sites_url_unique'
        ) THEN
          BEGIN
            ALTER TABLE public.sites ADD CONSTRAINT sites_url_unique UNIQUE (url);
          EXCEPTION WHEN duplicate_object THEN
            -- ignore if someone else created simultaneously
          END;
        END IF;
      END IF;
    END$$;
  `);
}

/**
 * Upsert a single item. Returns { inserted: boolean, url }
 * Uses a WITH ... RETURNING (xmax = 0) trick to detect insertion.
 */
async function upsertOne(client, item) {
  const q = `
    WITH upsert AS (
      INSERT INTO public.sites (
        url, title, type, language, country,
        platforms, data_formats, emails,
        html_path, md_path, wayback_status, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      ON CONFLICT (url) DO UPDATE
        SET title = EXCLUDED.title,
            type = EXCLUDED.type,
            language = EXCLUDED.language,
            country = EXCLUDED.country,
            platforms = EXCLUDED.platforms,
            data_formats = EXCLUDED.data_formats,
            emails = EXCLUDED.emails,
            html_path = EXCLUDED.html_path,
            md_path = EXCLUDED.md_path,
            wayback_status = EXCLUDED.wayback_status,
            notes = EXCLUDED.notes
      RETURNING (xmax = 0) AS inserted
    )
    SELECT inserted FROM upsert;
  `;

  const params = [
    item.url || null,
    item.title || null,
    item.type || null,
    item.language || null,
    item.country || null,
    item.platforms ? JSON.stringify(item.platforms) : null,
    item.data_formats || [],
    item.emails || [],
    item.html_path || null,
    item.md_path || null,
    item.wayback_status || null,
    item.notes || null
  ];

  const res = await client.query(q, params);
  // if INSERT/UPDATE returns a row, res.rows[0].inserted is boolean (true => inserted)
  if (res && res.rows && res.rows[0]) {
    return { url: item.url || null, inserted: !!res.rows[0].inserted };
  } else {
    // fallback - consider updated
    return { url: item.url || null, inserted: false };
  }
}

exports.handler = async function (event, context) {
  const method = (event.httpMethod || "GET").toUpperCase();

  const client = new Client({ connectionString: PG_CONNECTION, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("Connected to Neon/Postgres");

    // Ensure table + unique constraint are present
    await ensureTable(client);

    if (method === "GET") {
      // Return all rows (limit to prevent huge payloads)
      const res = await client.query("SELECT * FROM public.sites ORDER BY id ASC LIMIT 5000;");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(res.rows)
      };
    }

    if (method === "POST") {
      // Expect JSON body: either an object or an array of objects
      let payload;
      try {
        payload = event.body ? JSON.parse(event.body) : null;
      } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "invalid json body" }) };
      }

      let items = [];
      if (!payload) {
        return { statusCode: 400, body: JSON.stringify({ error: "empty body" }) };
      } else if (Array.isArray(payload)) {
        items = payload;
      } else if (typeof payload === "object") {
        items = [payload];
      } else {
        return { statusCode: 400, body: JSON.stringify({ error: "expect object or array" }) };
      }

      const results = [];
      let inserted = 0;
      let updated = 0;

      for (const it of items) {
        // Basic validation: need url
        if (!it.url) {
          results.push({ url: null, error: "missing url" });
          continue;
        }
        try {
          const r = await upsertOne(client, it);
          results.push(r);
          if (r.inserted) inserted++;
          else updated++;
        } catch (err) {
          console.error("Upsert error for", it.url, err.message);
          results.push({ url: it.url, error: err.message });
        }
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "upsert complete", inserted, updated, details: results })
      };
    }

    // Method not allowed
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("get_sites error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  } finally {
    try { await client.end(); } catch (e) {}
  }
};
