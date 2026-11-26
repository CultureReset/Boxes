import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { generateKeyPairSync, createSign } from "node:crypto";
import { _setKeys, verifyCfJwt, cfAccessEmail, CF_TEAM, CF_AUDS } from "./cfaccess.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
_setKeys(new Map([["k1", publicKey]]));

function sign(claims: Record<string, unknown>, kid = "k1", key = privateKey): string {
  const h = Buffer.from(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })).toString("base64url");
  const c = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const s = createSign("RSA-SHA256"); s.update(`${h}.${c}`);
  return `${h}.${c}.${s.sign(key).toString("base64url")}`;
}
const now = Math.floor(Date.now() / 1000);
const good = { aud: [CF_AUDS[0]], email: "matt@example.com", exp: now + 600, iat: now, nbf: now, iss: `https://${CF_TEAM}`, type: "app" };

test("valid Access JWT yields its email", async () => {
  assert.equal(await verifyCfJwt(sign(good)), "matt@example.com");
});
test("rejects wrong aud, iss, expired, meta type, bad sig, unknown kid", async () => {
  assert.equal(await verifyCfJwt(sign({ ...good, aud: ["other"] })), null);
  assert.equal(await verifyCfJwt(sign({ ...good, iss: "https://evil.cloudflareaccess.com" })), null);
  assert.equal(await verifyCfJwt(sign({ ...good, exp: now - 3600 })), null);
  assert.equal(await verifyCfJwt(sign({ ...good, type: "meta" })), null);
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  assert.equal(await verifyCfJwt(sign(good, "k1", other)), null);
  assert.equal(await verifyCfJwt("not.a.jwt"), null);
});
test("a bare email header is not identity and is stripped", async () => {
  const req = { headers: { "cf-access-authenticated-user-email": "nobody@example.com" } } as unknown as http.IncomingMessage;
  assert.equal(await cfAccessEmail(req), null);
  assert.equal(req.headers["cf-access-authenticated-user-email"], undefined);
});
test("verified JWT pins the email header to the claim", async () => {
  const req = { headers: { "cf-access-jwt-assertion": sign(good), "cf-access-authenticated-user-email": "spoof@example.com" } } as unknown as http.IncomingMessage;
  assert.equal(await cfAccessEmail(req), "matt@example.com");
  assert.equal(req.headers["cf-access-authenticated-user-email"], "matt@example.com");
});
