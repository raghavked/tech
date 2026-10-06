import { describe, expect, it } from "vitest";
import { canStyleTeam, findTeam, OrgsFile, TeamTheme, type User } from "../src/identity.js";

describe("TeamTheme", () => {
  it("accepts an empty theme and every field in range", () => {
    expect(TeamTheme.parse({})).toEqual({});
    const full = {
      accent: "#56352D",
      highlight: "#e2c4a6",
      surface: "#2A3244",
      glow: "#E2C4A6",
      mark: "dot",
      motion: "calm",
      emblem: "Py",
    };
    expect(TeamTheme.parse(full)).toEqual(full);
    expect(TeamTheme.parse({ emblem: "É" }).emblem).toBe("É");
    expect(TeamTheme.parse({ emblem: "A1" }).emblem).toBe("A1");
  });

  it("rejects colours that are not #RRGGBB, unknown marks, long emblems and extra keys", () => {
    for (const bad of ["red", "#FFF", "#GGGGGG", "56352D", "#56352D00", ""])
      expect(TeamTheme.safeParse({ accent: bad }).success).toBe(false);
    expect(TeamTheme.safeParse({ mark: "square" }).success).toBe(false);
    expect(TeamTheme.safeParse({ motion: "wild" }).success).toBe(false);
    for (const bad of ["", "ABC", "A B", "!", "a-"])
      expect(TeamTheme.safeParse({ emblem: bad }).success).toBe(false);
    expect(TeamTheme.safeParse({ font: "Comic Sans" }).success).toBe(false);
  });

  it("rides along on a team in orgs.json", () => {
    const file = OrgsFile.parse({
      orgs: [
        {
          id: "o",
          name: "O",
          teams: [
            { id: "t", name: "T", theme: { accent: "#56352D" }, projects: [] },
            { id: "u", name: "U", projects: [] },
          ],
        },
      ],
    });
    expect(findTeam(file, "t")?.team.theme).toEqual({ accent: "#56352D" });
    expect(findTeam(file, "u")?.team.theme).toBeUndefined();
    expect(findTeam(file, "x")).toBeNull();
    expect(
      OrgsFile.safeParse({
        orgs: [
          {
            id: "o",
            name: "O",
            teams: [{ id: "t", name: "T", theme: { accent: "x" }, projects: [] }],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("is changed by a lead, a manager or an org admin, never a member", () => {
    const file = OrgsFile.parse({
      orgs: [{ id: "o", name: "O", teams: [{ id: "t", name: "T", projects: [] }] }],
    });
    const user = (over: Partial<User>): User => ({
      id: "u",
      name: "U",
      orgs: [],
      teams: [],
      projects: [],
      ...over,
    });
    expect(canStyleTeam(user({ teams: [{ teamId: "t", role: "lead" }] }), file, "t")).toBe(true);
    expect(canStyleTeam(user({ teams: [{ teamId: "t", role: "manager" }] }), file, "t")).toBe(true);
    expect(canStyleTeam(user({ teams: [{ teamId: "t", role: "member" }] }), file, "t")).toBe(false);
    expect(canStyleTeam(user({ orgs: [{ orgId: "o", role: "admin" }] }), file, "t")).toBe(true);
    expect(canStyleTeam(user({ orgs: [{ orgId: "o", role: "member" }] }), file, "t")).toBe(false);
    expect(canStyleTeam(user({ teams: [{ teamId: "t", role: "lead" }] }), file, "zzz")).toBe(false);
    expect(canStyleTeam(null, file, "t")).toBe(false);
  });
});
