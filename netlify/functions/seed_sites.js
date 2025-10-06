// netlify/functions/seed_sites.js
const { Client } = require("pg");

// CONFIG : remplacer par tes infos Neon directement
const PG_CONFIG = {
  connectionString: "postgresql://neondb_owner:npg_4XfqJQhV3bpe@ep-dark-forest-abvkn94d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
};

// Exemple de données à seed
const SITES = [
  { title: "Site A", url: "https://sitea.example", type: "blog", country: "FR", language: "fr" },
  { title: "Site B", url: "https://siteb.example", type: "archive", country: "US", language: "en" },
  // ajouter toutes tes entrées ici
];

exports.handler = async function(event, context) {
  const client = new Client(PG_CONFIG);

  try {
    await client.connect();
    console.info("INFO: Connected to Neon");

    // ✅ Crée la contrainte UNIQUE si elle n'existe pas
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name='sites' AND constraint_type='UNIQUE' AND constraint_name='sites_url_unique'
        ) THEN
          ALTER TABLE sites
          ADD CONSTRAINT sites_url_unique UNIQUE(url);
        END IF;
      END$$;
    `);

    let insertedCount = 0;

    for (const site of SITES) {
      try {
        await client.query(
          `INSERT INTO sites(title, url, type, country, language)
           VALUES($1, $2, $3, $4, $5)
           ON CONFLICT(url) DO NOTHING`,
          [site.title, site.url, site.type, site.country, site.language]
        );
        insertedCount++;
      } catch (e) {
        console.warn("WARN: Could not insert site", site.url, e.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Seed complete, attempted ${SITES.length}, inserted ${insertedCount}` })
    };
  } catch (err) {
    console.error("ERROR: Seed failed", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.end();
  }
};
