import { Client } from "pg";

export async function handler(event, context) {
  const client = new Client({
    connectionString: process.env.NEON_URL, // stocké dans les variables Netlify
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const res = await client.query("SELECT * FROM sites ORDER BY title ASC;");
    await client.end();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(res.rows),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
