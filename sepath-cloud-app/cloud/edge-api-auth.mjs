function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signPayload(payloadBase64, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadBase64));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createEdgeApiToken(claims, secret) {
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600,
    ...claims,
  };
  const payloadBase64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signPayload(payloadBase64, secret);
  return `sepath.${payloadBase64}.${signature}`;
}

export async function verifyEdgeApiToken(token, secret, nowMs = Date.now()) {
  if (!token || typeof token !== "string") {
    return { ok: false, error: "missing_token" };
  }
  const compact = token.startsWith("Bearer ") ? token.slice("Bearer ".length).trim() : token.trim();
  const parts = compact.split(".");
  if (parts.length !== 3 || parts[0] !== "sepath") {
    return { ok: false, error: "bad_token_format" };
  }
  const [, payloadBase64, signature] = parts;
  const expected = await signPayload(payloadBase64, secret);
  if (signature !== expected) {
    return { ok: false, error: "bad_signature" };
  }
  let claims;
  try {
    claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadBase64)));
  } catch {
    return { ok: false, error: "bad_payload" };
  }
  const now = Math.floor(nowMs / 1000);
  if (claims.exp && Number(claims.exp) < now) {
    return { ok: false, error: "token_expired" };
  }
  if (claims.nbf && Number(claims.nbf) > now) {
    return { ok: false, error: "token_not_yet_valid" };
  }
  return { ok: true, claims };
}
