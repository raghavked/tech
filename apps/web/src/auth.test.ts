import { describe, expect, it } from "vitest";
import {
  authorizeUrl,
  base64url,
  callbackParams,
  decodeJwt,
  identityOfToken,
  pkceChallenge,
  randomString,
} from "./auth.js";

describe("PKCE helper", () => {
  it("derives the S256 challenge of RFC 7636 appendix B", async () => {
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("makes verifiers of the allowed alphabet and length, and no two alike", () => {
    const a = randomString(32);
    const b = randomString(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).not.toBe(a);
    expect(base64url(new Uint8Array([251, 255, 254]))).toBe("-__-");
  });

  it("builds the authorization URL with the code flow and PKCE parameters", () => {
    const url = new URL(
      authorizeUrl(
        {
          mode: "oidc",
          authorizationEndpoint: "https://id.example.com/authorize?tenant=t1",
          clientId: "web",
          scopes: ["openid", "email"],
        },
        { redirectUri: "http://localhost:5173/", state: "s1", challenge: "c1", nonce: "n1" },
      ),
    );
    expect(url.origin + url.pathname).toBe("https://id.example.com/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      tenant: "t1",
      response_type: "code",
      client_id: "web",
      redirect_uri: "http://localhost:5173/",
      scope: "openid email",
      state: "s1",
      nonce: "n1",
      code_challenge: "c1",
      code_challenge_method: "S256",
    });
    expect(() =>
      authorizeUrl({ mode: "dev" }, { redirectUri: "", state: "", challenge: "", nonce: "" }),
    ).toThrow();
  });

  it("reads the provider's answer out of the query", () => {
    expect(callbackParams("?code=abc&state=s1")).toEqual({
      code: "abc",
      state: "s1",
      error: null,
      description: null,
    });
    expect(callbackParams("error=access_denied&error_description=No&state=s1")).toMatchObject({
      code: null,
      error: "access_denied",
      description: "No",
    });
    expect(callbackParams("?link=henosis://inbox")).toBeNull();
    expect(callbackParams("")).toBeNull();
  });

  it("reads an identity out of an ID token without verifying it", () => {
    const claims = { sub: "ana", name: "Ana", email: "ana@acme.test", exp: 1_900_000_000 };
    const b64 = (s: string) => Buffer.from(s).toString("base64url");
    const token = `${b64('{"alg":"RS256"}')}.${b64(JSON.stringify(claims))}.sig`;
    expect(decodeJwt(token)).toEqual(claims);
    expect(identityOfToken(token)).toEqual({
      name: "Ana",
      userId: "ana",
      token,
      provider: "oidc",
      expiresAt: 1_900_000_000_000,
    });
    expect(identityOfToken(token, "email")?.userId).toBe("ana@acme.test");
    expect(identityOfToken("nope")).toBeNull();
    expect(decodeJwt("a.b")).toBeNull();
  });
});
