import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject } from "@/lib/services/projectService";
import {
  canAccessProject,
  classOwnerKey,
  decodeStudentCookie,
  encodeStudentCookie,
  generateClassCode,
  normalizeClassCode,
  normalizeStudentName,
  ownerForIdentity,
  type RequestIdentity,
} from "@/lib/auth/identity";
import { requireProjectAccess } from "@/lib/auth/access";
import {
  countDeviceProjects,
  listProjects,
  listProjectsForClasses,
  moveDeviceProjectsToOwner,
} from "@/lib/db/queries/projects";
import {
  createClass,
  findActiveClass,
  setClassActive,
} from "@/lib/db/queries/classes";

const DEVICE_A = "11111111-1111-4111-8111-111111111111";
const DEVICE_B = "22222222-2222-4222-8222-222222222222";

function device(id: string): RequestIdentity {
  return { deviceId: id, student: null, isTeacher: false };
}
function student(id: string, name: string, code: string): RequestIdentity {
  return { deviceId: id, student: { studentName: name, classCode: code }, isTeacher: false };
}

describe("identity normalization", () => {
  it("normalizes names and class codes", () => {
    expect(normalizeStudentName("  Ada   Lovelace ")).toBe("Ada Lovelace");
    expect(normalizeClassCode(" bio 7k3q ")).toBe("BIO-7K3Q");
    expect(normalizeClassCode("bio-7K3Q")).toBe("BIO-7K3Q");
    expect(classOwnerKey({ studentName: "ada  LOVELACE", classCode: "bio7k3q" })).toBe(
      classOwnerKey({ studentName: " Ada Lovelace", classCode: "BIO-7K3Q" }),
    );
  });

  it("round-trips the student cookie and rejects junk", () => {
    const encoded = encodeStudentCookie({ studentName: "Ada", classCode: "bio-7k3q" });
    expect(decodeStudentCookie(encoded)).toEqual({ studentName: "Ada", classCode: "BIO-7K3Q" });
    expect(decodeStudentCookie("not-json")).toBeNull();
    expect(decodeStudentCookie(undefined)).toBeNull();
  });

  it("generates readable codes without ambiguous characters", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateClassCode()).toMatch(/^BIO-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it("prefers the class identity over the device for new projects", () => {
    expect(ownerForIdentity(device(DEVICE_A))?.ownerType).toBe("device");
    expect(ownerForIdentity(student(DEVICE_A, "Ada", "BIO-7K3Q"))).toMatchObject({
      ownerType: "class",
      classCode: "BIO-7K3Q",
      studentName: "Ada",
    });
    expect(ownerForIdentity({ deviceId: null, student: null, isTeacher: false })).toBeNull();
  });
});

describe("canAccessProject", () => {
  const owned = { ownerType: "device", ownerKey: DEVICE_A };
  it("allows the owner, legacy projects, and teachers only", () => {
    expect(canAccessProject(owned, device(DEVICE_A))).toBe(true);
    expect(canAccessProject(owned, device(DEVICE_B))).toBe(false);
    expect(canAccessProject({ ownerType: null, ownerKey: null }, device(DEVICE_B))).toBe(true);
    expect(canAccessProject(owned, { ...device(DEVICE_B), isTeacher: true })).toBe(true);
    const cls = { ownerType: "class", ownerKey: classOwnerKey({ studentName: "Ada", classCode: "BIO-7K3Q" }) };
    expect(canAccessProject(cls, student(DEVICE_B, "ada", "bio7k3q"))).toBe(true);
    expect(canAccessProject(cls, student(DEVICE_B, "Bob", "BIO-7K3Q"))).toBe(false);
    expect(canAccessProject(cls, device(DEVICE_A))).toBe(false);
  });
});

describe("project ownership in the database", () => {
  it("scopes lists, 404s other identities, and follows class identity across devices", async () => {
    const db = await createTestDatabase();
    const a = await createProject(db, { name: "A", owner: ownerForIdentity(device(DEVICE_A)) });
    const legacy = await createProject(db, { name: "Legacy" });

    expect((await listProjects(db, ownerForIdentity(device(DEVICE_A)))).map((p) => p.id)).toEqual([a.id]);
    expect(await listProjects(db, ownerForIdentity(device(DEVICE_B)))).toEqual([]);
    expect(await listProjects(db, null)).toEqual([]);

    await expect(requireProjectAccess(db, a.id, device(DEVICE_A))).resolves.toBeUndefined();
    await expect(requireProjectAccess(db, a.id, device(DEVICE_B))).rejects.toMatchObject({ status: 404 });
    await expect(requireProjectAccess(db, "missing", device(DEVICE_A))).rejects.toMatchObject({ status: 404 });
    await expect(requireProjectAccess(db, legacy.id, device(DEVICE_B))).resolves.toBeUndefined();

    const onA = student(DEVICE_A, "Ada", "BIO-7K3Q");
    const onB = student(DEVICE_B, " ada ", "bio 7k3q");
    const c = await createProject(db, { name: "Class work", owner: ownerForIdentity(onA) });
    expect((await listProjects(db, ownerForIdentity(onB))).map((p) => p.id)).toEqual([c.id]);
    await expect(requireProjectAccess(db, c.id, onB)).resolves.toBeUndefined();
    await expect(requireProjectAccess(db, c.id, device(DEVICE_B))).rejects.toMatchObject({ status: 404 });

    expect(await countDeviceProjects(db, DEVICE_A)).toBe(1);
    expect(await moveDeviceProjectsToOwner(db, DEVICE_A, ownerForIdentity(onA)!)).toBe(1);
    expect(await countDeviceProjects(db, DEVICE_A)).toBe(0);
    expect((await listProjects(db, ownerForIdentity(onB))).map((p) => p.id).sort()).toEqual(
      [a.id, c.id].sort(),
    );

    const teacherRows = await listProjectsForClasses(db, ["BIO-7K3Q"]);
    expect(teacherRows.map((r) => r.studentName)).toEqual(["Ada", "Ada"]);
  });

  it("only accepts existing, active class codes", async () => {
    const db = await createTestDatabase();
    const created = await createClass(db, "Period 3 Molecular Bio");
    expect(created.code).toMatch(/^BIO-/);
    expect(await findActiveClass(db, created.code.toLowerCase().replace("-", " "))).not.toBeNull();
    expect(await findActiveClass(db, "BIO-ZZZZ")).toBeNull();
    await setClassActive(db, created.code, false);
    expect(await findActiveClass(db, created.code)).toBeNull();
    await setClassActive(db, created.code, true);
    expect(await findActiveClass(db, created.code)).not.toBeNull();
  });
});
