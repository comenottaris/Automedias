// netlify/functions/get_sites.js
const { Client } = require("pg");

exports.handler = async function (event, context) {
  const client = new Client({
    connectionString: process.env.NEON_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Info utile dans les logs pour debug (current DB, schema, search_path)
    try {
      const info = await client.query(
        "SELECT current_database() AS db, current_schema() AS schema, current_setting('search_path') AS search_path;"
      );
      console.log("DB INFO:", info.rows[0]);
    } catch (infoErr) {
      console.warn("Impossible de récupérer DB INFO:", infoErr.message);
    }

    // CREATE TABLE IF NOT EXISTS => évite l'erreur 42P01 si la table manque.
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

    // Récupère les données (limite pour éviter trop gros payloads)
    const res = await client.query("SELECT * FROM public.sites ORDER BY id ASC LIMIT 2000;");

    await client.end();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(res.rows),
    };
  } catch (err) {
    console.error("get_sites error:", err);
    try { await client.end(); } catch (e) {}
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message, code: err.code || null }),
    };
  }
};
