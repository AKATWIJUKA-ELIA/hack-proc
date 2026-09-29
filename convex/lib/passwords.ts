/**
 * Password hashing for the custom auth built into this app.
 *
 * PBKDF2-HMAC-SHA256 via Web Crypto, which is available in Convex's runtime
 * with no dependency to vendor. Argon2id or scrypt would be stronger per unit
 * of CPU, but neither exists in the runtime and a WASM build of either is a
 * large, unaudited dependency to take on for a procurement tool. A high
 * iteration count is the honest lever available here, so it is turned up.
 *
 * Stored format is self-describing: `pbkdf2$<iterations>$<salt>$<hash>`. The
 * iteration count travels with the hash, so raising it later does not lock out
 * anyone who signed up before the change — their password simply verifies
 * against the count it was written with, and is rehashed on next login.
 */

const ITERATIONS = 210_000; // OWASP's 2023 floor for PBKDF2-HMAC-SHA256.
const KEY_BITS = 256;
const SALT_BYTES = 16;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * Constant-time comparison. A `===` on the hashes would leak, through timing,
 * how many leading bytes a guess got right — which is enough to reconstruct a
 * hash byte by byte given enough attempts.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;

  try {
    const salt = fromBase64(parts[2]);
    const expected = fromBase64(parts[3]);
    const actual = await derive(password, salt, iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    // A malformed stored hash is a failed login, not a crash.
    return false;
  }
}

/** 256 bits of entropy, URL-safe. Used for session tokens. */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Session tokens are stored hashed, exactly as passwords are.
 *
 * A token in the database is a bearer credential: anyone who reads the table —
 * a leaked backup, an over-broad support query — could impersonate every signed
 * in user. Hashing means the stored value is useless on its own. SHA-256 with
 * no salt is correct here and wrong for passwords: the token already has 256
 * bits of entropy, so there is nothing for a rainbow table to precompute, and a
 * fast hash lets lookup stay a single indexed read.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return toBase64(new Uint8Array(digest));
}
