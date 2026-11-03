import { assertCustomerEnv, CustomerConfigError, loadPaperclipKey, anonWarning, isCustomerMode } from "./mode.js";

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

// Read the Paperclip key once, now. Nothing below prints it.
const hasKey = loadPaperclipKey();
const warn = anonWarning();
if (warn) console.error(warn);
else if (!isCustomerMode() && (process.env.PAPERCLIP_API_KEY_FILE ?? "").trim() && !hasKey) console.error("PAPERCLIP_API_KEY_FILE is set but no usable key was read from it; Paperclip calls go out without a credential");
