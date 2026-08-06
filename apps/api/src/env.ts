import { loadServerEnv } from "@lunchmeet/config";

/** Parsed once at import. Exits with a readable report if anything is invalid. */
export const env = loadServerEnv();
