const { Client } = require('pg');
const sitesData = [
  { title: "Exemple", url: "https://example.com", type: "blog", country: "FR", language: "fr" },
  // ...tes autres sites directement ici
];

exports.handler = async function(event, context) {
  if (event.queryStringParameters?.token !== "seed-me-please") {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_4XfqJQhV3bpe@ep-dark-forest-abvkn94d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
  });

  await client.connect();

  try {
    for (const site of sitesData) {
      await client.query(
        `INSERT INTO sites(title,url,type,country,language) VALUES($1,$2,$3,$4,$5)
         ON CONFLICT (url) DO NOTHING`,
        [site.title, site.url, site.type, site.country, site.language]
      );
    }
    return { statusCode: 200, body: JSON.stringify({ inserted: sitesData.length }) };
  } finally {
    await client.end();
  }
};
