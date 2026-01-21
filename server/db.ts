import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;

dotenv.config({ path: new URL("./.env", import.meta.url).pathname, override: true });

const rawConnectionString = process.env.DATABASE_URL?.trim();

if (!rawConnectionString) {
  throw new Error("DATABASE_URL is required");
}

const connectionUrl = new URL(rawConnectionString);
connectionUrl.searchParams.delete("sslmode");
connectionUrl.searchParams.delete("sslrootcert");
connectionUrl.searchParams.delete("sslcert");
connectionUrl.searchParams.delete("sslkey");
const connectionString = connectionUrl.toString();

// Log connection details with masked password for debugging.
console.log(
  "DATABASE_URL=",
  connectionString.replace(/:[^:@]*@/, ":*****@"),
);
console.log(
  "DB_CONFIG=",
  JSON.stringify({
    host: connectionUrl.hostname,
    port: connectionUrl.port,
    user: connectionUrl.username,
    ssl: true,
  }),
);

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
