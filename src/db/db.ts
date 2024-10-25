import postgres from "postgres";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/postgres-js";
import * as catalogSchema from "./schemas/catalogSchema";
import * as itemsSchema from "./schemas/itemsSchema";
import * as modsSchema from "./schemas/modsSchema";

let db;
let pool: Pool;
main().catch((err) => console.error(err));
async function main() {
  const connectionString = process.env.POSTGRES_URL;
  pool = new Pool({ connectionString: connectionString });
  const client = postgres(connectionString);
  db = drizzle(client, {
    schema: { ...catalogSchema, ...itemsSchema, ...modsSchema },
  });
}

export { db, pool };
