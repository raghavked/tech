import { describe, expect, it } from "vitest";
import { identityOfSupabaseToken } from "./supabase.js";

/** An unsigned JWT with these claims; the server verifies, the client only reads. */
function jwt(claims: Record<string, unknown>): string {
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-");
  return `${enc({ alg: "ES256", typ: "JWT" })}.${enc(claims)}.sig`;
}

describe("identityOfSupabaseToken", () => {
  it("names the person by sub, full_name and the token's expiry", () => {
    const token = jwt({
      sub: "6f1c3b8e-0000-4000-8000-000000000001",
      email: "ana@acme.test",
      user_metadata: { full_name: "Ana Lovelace", name: "ana" },
      exp: 1_800_000_000,
      aud: "authenticated",
    });
    expect(identityOfSupabaseToken(token)).toEqual({
      name: "Ana Lovelace",
      userId: "6f1c3b8e-0000-4000-8000-000000000001",
      token,
      provider: "supabase",
      expiresAt: 1_800_000_000_000,
    });
  });

  it("falls back to name, then the email, then the id, and leaves expiresAt out without exp", () => {
    expect(
      identityOfSupabaseToken(jwt({ sub: "u1", user_metadata: { name: "Bo" } })),
    ).toMatchObject({ name: "Bo", userId: "u1", provider: "supabase" });
    const byEmail = identityOfSupabaseToken(jwt({ sub: "u2", email: "cy@acme.test" }));
    expect(byEmail?.name).toBe("cy@acme.test");
    expect(byEmail).not.toHaveProperty("expiresAt");
    expect(identityOfSupabaseToken(jwt({ sub: "u3", user_metadata: "junk" }))?.name).toBe("u3");
  });

  it("is null for a token without a subject or one that is not a JWT", () => {
    expect(identityOfSupabaseToken(jwt({ email: "x@y" }))).toBeNull();
    expect(identityOfSupabaseToken("not.a.jwt")).toBeNull();
    expect(identityOfSupabaseToken("")).toBeNull();
  });
});
