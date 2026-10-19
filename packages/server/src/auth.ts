/**
 * Who is asking. Two modes, picked by configuration (docs/07_security_and_compliance.md,
 * "Identity"):
 *
 * - `dev` (Starter, the default): an optional shared token and a client-asserted user id that
 *   users.json may or may not know. Nothing is proven; first in owns a session.
 * - `oidc` (Team): the organisation's provider signs an ID token in the browser; the server
 *   verifies it against the provider's discovery document and JWKS (issuer, audience, expiry)
 *   and the user id is the token's subject (or email, when orgs.json says so). A user id a
 *   client asserts beside the token must match it. The token's groups claim becomes
 *   memberships through the `sso` mapping in orgs.json (packages/fleet/src/identity.ts).
 *
 * Verification is `jose`; the discovery document and the key set are fetched once and the
 * key set re-fetched on an unknown key id, as jose does on its own.
 */
import { createRemoteJWKSet, type JWTPayload, errors as joseErrors, jwtVerify } from "jose";

export type AuthMode = "dev" | "oidc";

export interface OidcConfig {
  /** `HENOSIS_OIDC_ISSUER`: the provider's issuer URL; `/.well-known/openid-configuration` hangs off it. */
  issuer: string;
  /** `HENOSIS_OIDC_CLIENT_ID`: the public client the web app signs in as. */
  clientId: string;
  /** `HENOSIS_OIDC_AUDIENCE`: what the token's `aud` must carry when it is not the client id. */
  audience?: string | undefined;
  /** Which claim names the person; `sub` unless orgs.json `sso.userIdClaim` says `email`. */
  userIdClaim?: "sub" | "email" | undefined;
  /** The claim carrying the directory groups; `groups` unless orgs.json says otherwise. */
  groupsClaim?: string | undefined;
  /** What the web app asks for; `openid profile email` unless told otherwise. */
  scopes?: readonly string[] | undefined;
  /** The provider's name on the sign-in button; the issuer's host when absent. */
  name?: string | undefined;
}

export type AuthConfig =
  | { mode: "dev"; token?: string | undefined }
  | ({ mode: "oidc" } & OidcConfig);

/** The person behind a request, as far as the server can tell. */
export interface Principal {
  userId: string;
  name: string | null;
  email: string | null;
  /** The directory groups the token carried; empty in dev mode. */
  groups: string[];
  /** True when a verified ID token named this person; false for a dev-mode assertion. */
  verified: boolean;
}

/** What `GET /api/auth` tells a client, so it knows how to sign in. */
export interface AuthDescription {
  mode: AuthMode;
  /** dev: whether the server wants the shared token. */
  tokenRequired?: boolean;
  /** oidc: the provider as the web app needs it for the authorization code flow with PKCE. */
  provider?: string;
  issuer?: string;
  clientId?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  endSessionEndpoint?: string | null;
  scopes?: string[];
  /** oidc: why the provider's endpoints are missing (discovery failed); the client shows it. */
  error?: string;
}

/** A refusal: the message is what the client sees, always starting with `unauthorized`. */
export class AuthError extends Error {
  readonly status = 401;
  constructor(reason?: string) {
    super(reason ? `unauthorized: ${reason}` : "unauthorized");
    this.name = "AuthError";
  }
}

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

const DEFAULT_SCOPES = ["openid", "profile", "email"];

/**
 * The mode the environment asks for: `HENOSIS_OIDC_ISSUER` turns oidc on (and then
 * `HENOSIS_OIDC_CLIENT_ID` is required, `HENOSIS_OIDC_AUDIENCE` optional); otherwise dev with
 * the shared token given (`--token` or `HENOSIS_TOKEN`).
 */
export function authConfigFromEnv(
  env: Record<string, string | undefined>,
  devToken?: string | undefined,
): AuthConfig {
  const issuer = env.HENOSIS_OIDC_ISSUER?.trim();
  if (!issuer) return { mode: "dev", token: devToken };
  const clientId = env.HENOSIS_OIDC_CLIENT_ID?.trim();
  if (!clientId) throw new Error("HENOSIS_OIDC_ISSUER is set but HENOSIS_OIDC_CLIENT_ID is not");
  const audience = env.HENOSIS_OIDC_AUDIENCE?.trim();
  return { mode: "oidc", issuer, clientId, ...(audience ? { audience } : {}) };
}

export class Auth {
  readonly mode: AuthMode;
  /** dev: the shared token, when the server wants one. */
  readonly sharedToken: string | null;
  private readonly oidc: OidcConfig | null;
  private discovery: Promise<Discovery> | null = null;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(cfg: AuthConfig = { mode: "dev" }) {
    this.mode = cfg.mode;
    if (cfg.mode === "dev") {
      this.sharedToken = cfg.token || null;
      this.oidc = null;
    } else {
      this.sharedToken = null;
      const { mode: _mode, ...rest } = cfg;
      this.oidc = { ...rest, issuer: rest.issuer.replace(/\/+$/, "") };
    }
  }

  /** The provider's name for the sign-in button. */
  get providerName(): string | null {
    if (!this.oidc) return null;
    if (this.oidc.name) return this.oidc.name;
    try {
      return new URL(this.oidc.issuer).host;
    } catch {
      return this.oidc.issuer;
    }
  }

  /**
   * dev: whether a write carrying this token may go ahead (no shared token, or the right one).
   * oidc: always true here; the ID token was checked by `authenticate` first.
   */
  acceptsSharedToken(token: string | null | undefined): boolean {
    if (this.mode !== "dev" || !this.sharedToken) return true;
    return token === this.sharedToken;
  }

  /**
   * What the client needs to sign in. In oidc mode this reads the discovery document once;
   * when the provider cannot be reached the mode is still oidc (the client must not fall
   * back to the dev form), with `error` saying why and no endpoints.
   */
  async describe(): Promise<AuthDescription> {
    if (!this.oidc) return { mode: "dev", tokenRequired: Boolean(this.sharedToken) };
    const base: AuthDescription = {
      mode: "oidc",
      provider: this.providerName ?? this.oidc.issuer,
      issuer: this.oidc.issuer,
      clientId: this.oidc.clientId,
      scopes: [...(this.oidc.scopes ?? DEFAULT_SCOPES)],
    };
    try {
      const doc = await this.discover();
      return {
        ...base,
        authorizationEndpoint: doc.authorization_endpoint,
        tokenEndpoint: doc.token_endpoint,
        endSessionEndpoint: doc.end_session_endpoint ?? null,
      };
    } catch (err) {
      return { ...base, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Resolve a request to a person, or to nobody (null) when nothing identifies it.
   *
   * dev: `enforceShared` makes a wrong or missing shared token a refusal (a `join` does this;
   * reads do not); the asserted user id is taken at its word.
   * oidc: a token is verified and names the person; an asserted user id that differs from it
   * is refused, and an asserted user id without a token is refused too. No token and no
   * assertion is nobody.
   */
  async authenticate(input: {
    token?: string | null | undefined;
    userId?: string | null | undefined;
    name?: string | null | undefined;
    enforceShared?: boolean;
  }): Promise<Principal | null> {
    const token = input.token || null;
    const asserted = input.userId || null;
    if (!this.oidc) {
      if (input.enforceShared && this.sharedToken && token !== this.sharedToken)
        throw new AuthError();
      if (!asserted) return null;
      return {
        userId: asserted,
        name: input.name ?? null,
        email: null,
        groups: [],
        verified: false,
      };
    }
    if (!token) {
      if (asserted) throw new AuthError(`sign in with ${this.providerName}`);
      return null;
    }
    const who = await this.verify(token);
    if (asserted && asserted !== who.userId)
      throw new AuthError("the user id does not match the token");
    return who;
  }

  /** Verify an ID token against the provider and read the person out of it. */
  async verify(token: string): Promise<Principal> {
    const cfg = this.oidc;
    if (!cfg) throw new AuthError("the server runs in dev mode");
    const doc = await this.discover();
    const jwks = this.jwks;
    if (!jwks) throw new AuthError("the provider's keys are not available");
    let payload: JWTPayload;
    try {
      const issuers = [cfg.issuer, doc.issuer].filter((v, i, a) => v && a.indexOf(v) === i);
      ({ payload } = await jwtVerify(token, jwks, {
        issuer: issuers,
        audience: cfg.audience ?? cfg.clientId,
      }));
    } catch (err) {
      throw new AuthError(describeJoseError(err));
    }
    const claim = cfg.userIdClaim ?? "sub";
    const userId = stringClaim(payload, claim);
    if (!userId) throw new AuthError(`the token has no ${claim} claim`);
    const email = stringClaim(payload, "email");
    const name =
      stringClaim(payload, "name") ?? stringClaim(payload, "preferred_username") ?? email;
    return {
      userId,
      name,
      email,
      groups: groupsOf(payload[cfg.groupsClaim ?? "groups"]),
      verified: true,
    };
  }

  /** The provider's discovery document, fetched once; a failure is retried on the next call. */
  private discover(): Promise<Discovery> {
    const cfg = this.oidc;
    if (!cfg) return Promise.reject(new AuthError("the server runs in dev mode"));
    if (!this.discovery) {
      const url = `${cfg.issuer}/.well-known/openid-configuration`;
      this.discovery = (async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`discovery ${url} answered ${res.status}`);
        const doc = (await res.json()) as Partial<Discovery>;
        if (!doc.jwks_uri || !doc.authorization_endpoint || !doc.token_endpoint)
          throw new Error(
            `discovery ${url} lacks jwks_uri, authorization_endpoint or token_endpoint`,
          );
        this.jwks = createRemoteJWKSet(new URL(doc.jwks_uri));
        return { ...doc, issuer: doc.issuer ?? cfg.issuer } as Discovery;
      })().catch((err: unknown) => {
        this.discovery = null;
        throw err;
      });
    }
    return this.discovery;
  }
}

function stringClaim(payload: JWTPayload, name: string): string | null {
  const v = payload[name];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Groups arrive as an array of strings, or as one space-separated string from some providers. */
function groupsOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((g): g is string => typeof g === "string");
  if (typeof v === "string") return v.split(/\s+/).filter(Boolean);
  return [];
}

function describeJoseError(err: unknown): string {
  if (err instanceof joseErrors.JWTExpired) return "the token has expired";
  if (err instanceof joseErrors.JWTClaimValidationFailed) {
    if (err.claim === "aud") return "the token is for another audience";
    if (err.claim === "iss") return "the token is from another issuer";
    return `the token's ${err.claim} claim is not acceptable`;
  }
  if (err instanceof joseErrors.JWSSignatureVerificationFailed)
    return "the token's signature does not verify";
  if (err instanceof joseErrors.JWKSNoMatchingKey) return "the token is signed by an unknown key";
  if (err instanceof joseErrors.JOSEError) return `invalid token (${err.code})`;
  return err instanceof Error ? err.message : String(err);
}
