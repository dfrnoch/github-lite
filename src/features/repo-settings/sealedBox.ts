/**
 * libsodium `crypto_box_seal` — what GitHub requires for Actions secrets
 * (https://docs.github.com/rest/guides/encrypting-secrets-for-the-rest-api).
 *
 *   ephemeral keypair (epk, esk)
 *   nonce  = BLAKE2b-192(epk || recipientPk)
 *   sealed = epk || crypto_box(message, nonce, recipientPk, esk)
 *
 * tweetnacl + blakejs (~35 kB) are imported lazily, so the cost is only paid
 * on the page that saves a secret.
 */
export async function sealSecret(value: string, publicKeyB64: string): Promise<string> {
  const [{ default: nacl }, { blake2b }] = await Promise.all([import('tweetnacl'), import('blakejs')]);
  const recipient = fromB64(publicKeyB64);
  const message = new TextEncoder().encode(value);
  const ephemeral = nacl.box.keyPair();
  const nonceInput = new Uint8Array(64);
  nonceInput.set(ephemeral.publicKey, 0);
  nonceInput.set(recipient, 32);
  const nonce = blake2b(nonceInput, undefined, nacl.box.nonceLength);
  const boxed = nacl.box(message, nonce, recipient, ephemeral.secretKey);
  const out = new Uint8Array(ephemeral.publicKey.length + boxed.length);
  out.set(ephemeral.publicKey, 0);
  out.set(boxed, ephemeral.publicKey.length);
  return toB64(out);
}

function fromB64(b64: string) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
function toB64(bytes: Uint8Array) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
