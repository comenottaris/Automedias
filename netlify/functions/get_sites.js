// netlify/functions/get_sites.js
const { Client } = require("pg");
const fetch = require("node-fetch");

const REST_URL = process.env.NEON_REST_URL || "https://ep-dark-forest-abvkn94d.apirest.eu-west-2.aws.neon.tech/neondb/rest/v1/sites";
const REST_KEY = process.env.NEON_REST_KEY; // JWT token pour Neon REST
const DATABASE_URL = process.env.DATABASE_URL; // Postgres fallback

exports.handler = async function(event, context) {
  console.log("INFO: Starting get_sites function");

  // 1️⃣ Essayer Neon REST si token disponible
  if (REST_KEY) {
    console.log("INFO: Trying Neon REST:", REST_URL);
    try {
      const res = await fetch(REST_URL, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${REST_KEY}`,
          "Content-Type": "application/json",
          "apikey": REST_KEY // parfois requis
        }
      });
      if (!res.ok) throw new Error(`REST fetch failed: ${res.status} ${res.statusText}`);
      const json = await res.json();
      console.log("INFO: Neon REST returned", json.length, "records");
      return {
        statusCode: 200,
        body: JSON.stringify(json)
      };
    } catch (err) {
      console.warn("WARN: Neon REST failed:", err.message);
      console.log("INFO: Falling back to PG");
    }
  }

  // 2️⃣ Fallback Postgres
  try {
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    console.log("INFO: Connected to Postgres:", { db: client.database, schema: "public" });

    const result = await client.query("SELECT * FROM sites"); // adapter si table différente
    await client.end();
    console.log("INFO: PG query returned", result.rows.length, "records");

    return {
      statusCode: 200,
      body: JSON.stringify(result.rows)
    };
  } catch (err) {
    console.error("ERROR: Postgres fetch failed:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Database fetch failed", details: err.message })
    };
  }
};
