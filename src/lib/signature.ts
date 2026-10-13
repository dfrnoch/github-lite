/**
 * Commit signature verification (the Verified / Unverified badge), normalized
 * from GraphQL `Commit.signature` or REST `commit.verification`.
 */

export interface CommitSignature {
  kind: 'GPG' | 'SSH' | 'SMIME' | 'UNKNOWN';
  isValid: boolean;
  /** GitSignatureState: VALID, UNKNOWN_KEY, BAD_EMAIL, … */
  state: string;
  wasSignedByGitHub: boolean;
  signer: { login: string; avatarUrl: string } | null;
  /** GPG key ID or SSH key fingerprint. */
  keyId: string | null;
  verifiedAt: string | null;
}

/** GraphQL selection for `Commit.signature` (use inside `... on Commit{}`). */
export const SIGNATURE_FIELDS = `signature{__typename isValid state wasSignedByGitHub verifiedAt signer{login avatarUrl}
  ... on GpgSignature{keyId} ... on SshSignature{keyFingerprint}}`;

const KIND: Record<string, CommitSignature['kind']> = {
  GpgSignature: 'GPG',
  SshSignature: 'SSH',
  SmimeSignature: 'SMIME',
};

export function signatureFromGql(s: any): CommitSignature | null {
  if (!s || s.state === 'UNSIGNED') return null;
  return {
    kind: KIND[s.__typename] ?? 'UNKNOWN',
    isValid: !!s.isValid,
    state: s.state ?? (s.isValid ? 'VALID' : 'INVALID'),
    wasSignedByGitHub: !!s.wasSignedByGitHub,
    signer: s.signer ?? null,
    keyId: s.keyId ?? s.keyFingerprint ?? null,
    verifiedAt: s.verifiedAt ?? null,
  };
}

/** REST reasons that differ from the GraphQL GitSignatureState names. */
const REST_REASON: Record<string, string> = { malformed_signature: 'MALFORMED_SIG', unknown_signature_type: 'UNKNOWN_SIG_TYPE' };

export function signatureFromRest(
  v: { verified: boolean; reason: string; signature?: string | null; verified_at?: string | null } | null | undefined,
  committer?: { login: string; avatar_url: string } | null,
): CommitSignature | null {
  if (!v || v.reason === 'unsigned' || (!v.verified && !v.signature)) return null;
  const sig = v.signature ?? '';
  const kind: CommitSignature['kind'] = sig.includes('BEGIN PGP')
    ? 'GPG'
    : sig.includes('BEGIN SSH')
      ? 'SSH'
      : sig.includes('BEGIN SIGNED MESSAGE')
        ? 'SMIME'
        : 'UNKNOWN';
  return {
    kind,
    isValid: v.verified,
    state: REST_REASON[v.reason] ?? v.reason.toUpperCase(),
    wasSignedByGitHub: committer?.login === 'web-flow',
    signer: v.verified && committer ? { login: committer.login, avatarUrl: committer.avatar_url } : null,
    keyId: null,
    verifiedAt: v.verified_at ?? null,
  };
}

/** Why a signature failed, in github.com's words. */
export const SIGNATURE_REASON: Record<string, string> = {
  INVALID: 'The signature could not be cryptographically verified using the key whose key-id was found in the signature.',
  MALFORMED_SIG: 'There was an error parsing the signature.',
  UNKNOWN_KEY: "The key that made the signature has not been registered with any user's account.",
  BAD_EMAIL: 'The committer email address in the commit is not included in the identities of the key that made the signature.',
  UNVERIFIED_EMAIL: 'The committer email address in the commit was associated with a user, but the email address is not verified on their account.',
  NO_USER: 'No user was associated with the committer email address in the commit.',
  UNKNOWN_SIG_TYPE: 'A signature of an unknown type was found in the commit.',
  GPGVERIFY_UNAVAILABLE: 'The signature verification service is currently unavailable.',
  GPGVERIFY_ERROR: 'There was an error communicating with the signature verification service.',
  NOT_SIGNING_KEY: "The 'signing' flag is not among the usage flags of the key that made the signature.",
  EXPIRED_KEY: 'The key that made the signature is expired.',
  OCSP_PENDING: 'Certificate revocation checking is still pending.',
  OCSP_ERROR: 'Certificate revocation checking failed.',
  BAD_CERT: 'The signing certificate or its chain could not be verified.',
  OCSP_REVOKED: 'The signing certificate has been revoked.',
};
