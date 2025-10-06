// netlify/functions/get_sites.js
const { Client } = require("pg");

/**
 * CONFIG
 * - Vous pouvez remplacer PG_CONNECTION directement ici, ou définir process.env.PG_CONNECTION.
 * - TABLE_SCHEMA (default: public)
 * - TABLE_NAME (default: sites) -> mettez "Automedias" si votre table s'appelle Automedias (sans quotes)
 */
const PG_CONNECTION = process.env.PG_CONNECTION || "postgresql://neondb_owner:npg_4XfqJQhV3bpe@ep-dark-forest-abvkn94d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const TABLE_SCHEMA = process.env.TABLE_SCHEMA || "public";
const TABLE_NAME = process.env.TABLE_NAME || "Automedias"; // ex: Automedias

// limit pour GET
const GET_LIMIT = 100;

// helper pour quotifier identifiants SQL proprement
function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

// construit qualified identifier: "schema"."table"
function qualifiedTable(schema, table) {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

/** Vérifie si la table existe dans information_schema */
async function tableExists(client, schema, table) {
  const q = `
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = $1 AND table_name = $2
    LIMIT 1
  `;
  const r = await client.query(q, [schema, table]);
  return r.rowCount > 0;
}

/** Crée la table si absente (schéma attendu) */
async function createTableIfMissing(client, schema, table) {
  const exists = await tableExists(client, schema, table);
  if (exists) return false;
  const qt = qualifiedTable(schema, table);
  await client.query(`
    CREATE TABLE ${qt} (
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
  return true;
}

/** Crée contrainte unique url si elle n'existe pas */
async function ensureUniqueUrlConstraint(client, schema, table) {
  // constraint name deterministic
  const constraintName = `${table}_url_unique`;
  const q = `
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = $1 AND table_name = $2 AND constraint_name = $3
    LIMIT 1
  `;
  const r = await client.query(q, [schema, table, constraintName]);
  if (r.rowCount > 0) return false;

  // créer la contrainte dans un block pour ignorer duplicate_object race
  const qt = qualifiedTable(schema, table);
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = ${client.escapeLiteral(schema)} AND table_name = ${client.escapeLiteral(table)} AND constraint_name = ${client.escapeLiteral(constraintName)}
      ) THEN
        BEGIN
          ALTER TABLE ${qt} ADD CONSTRAINT ${quoteIdent(constraintName)} UNIQUE (url);
        EXCEPTION WHEN duplicate_object THEN
          -- ignore race condition
        END;
      END IF;
    END$$;
  `);
  return true;
}

/** Upsert item into chosen table */
async function upsertOne(client, schema, table, item) {
  const qt = qualifiedTable(schema, table);
  const q = `
    WITH upsert AS (
      INSERT INTO ${qt} (
        url, title, type, language, country,
        platforms, data_formats, emails,
        html_path, md_path, wayback_status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
  if (res && res.rows && res.rows[0]) {
    return { url: item.url || null, inserted: !!res.rows[0].inserted };
  }
  return { url: item.url || null, inserted: false };
}

/** Handler */
exports.handler = async function (event) {
  const method = (event.httpMethod || "GET").toUpperCase();

  const client = new Client({ connectionString: PG_CONNECTION, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("DB INFO: connected to", PG_CONNECTION);

    // s'assurer que la table existe et qu'elle a la contrainte UNIQUE(url)
    const created = await createTableIfMissing(client, TABLE_SCHEMA, TABLE_NAME);
    if (created) console.log(`Table ${TABLE_SCHEMA}.${TABLE_NAME} created (was missing).`);
    const addedConstraint = await ensureUniqueUrlConstraint(client, TABLE_SCHEMA, TABLE_NAME);
    if (addedConstraint) console.log(`Unique constraint on url added to ${TABLE_SCHEMA}.${TABLE_NAME}`);

    const qualified = qualifiedTable(TABLE_SCHEMA, TABLE_NAME);

    if (method === "GET") {
      const limit = GET_LIMIT;
      const q = `SELECT * FROM ${qualified} ORDER BY id ASC LIMIT $1;`;
      const resp = await client.query(q, [limit]);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resp.rows)
      };
    }

    if (method === "POST") {
      // upsert array or single object
      let payload;
      try {
        payload = event.body ? JSON.parse(event.body) : null;
      } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
      }

      if (!payload) return { statusCode: 400, body: JSON.stringify({ error: "Empty body" }) };

      const items = Array.isArray(payload) ? payload : [payload];
      const results = [];
      let inserted = 0, updated = 0;

      for (const it of items) {
        if (!it.url) {
          results.push({ url: null, error: "missing url" });
          continue;
        }
        try {
          const r = await upsertOne(client, TABLE_SCHEMA, TABLE_NAME, it);
          results.push(r);
          if (r.inserted) inserted++; else updated++;
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

    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };

  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    try { await client.end(); } catch (e) {}
  }
};
