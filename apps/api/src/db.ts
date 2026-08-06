import { createDatabase } from "@lunchmeet/db";
import { env } from "./env.js";

const instance = createDatabase({ url: env.DATABASE_URL });

export const db = instance.db;
export const sql = instance.sql;
export const closeDatabase = instance.close;
