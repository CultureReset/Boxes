import { assertCustomerEnv, CustomerConfigError } from "./mode.js";

/**
 * Imported first by index.ts so a customer container with missing settings
 * stops with a plain message before any other module runs.
 * Exit code 78 is EX_CONFIG. Home mode is unaffected.
 */
try {
  assertCustomerEnv();
} catch (e) {
  console.error(e instanceof CustomerConfigError ? e.message : `NODE cannot start: ${(e as Error).message}`);
  process.exit(78);
}
