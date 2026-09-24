/**
 * Lightweight ownership model (no accounts).
 *
 * - Anonymous: a random device id cookie owns the project.
 * - Joined: class code + student name owns the project, so the same
 *   name + code on any computer sees the same projects.
 *
 * Pure helpers only (no Next.js / Cloudflare imports) so they are unit-testable.
 */

export const DEVICE_COOKIE = "basil_device";
export const STUDENT_COOKIE = "basil_student";
export const TEACHER_COOKIE = "basil_teacher";

export type OwnerType = "device" | "class";

export interface StudentIdentity {
  classCode: string;
  studentName: string;
}

export interface RequestIdentity {
  deviceId: string | null;
  student: StudentIdentity | null;
  isTeacher: boolean;
}

export interface Owner {
  ownerType: OwnerType;
  ownerKey: string;
  classCode: string | null;
  studentName: string | null;
}

export interface OwnedRecord {
  ownerType: string | null;
  ownerKey: string | null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Display form of a student name: trimmed, single spaces, max 60 chars. */
export function normalizeStudentName(value: string): string {
  return collapseSpaces(value).slice(0, 60);
}

/**
 * Canonical class code: upper-case, letters/digits only, and generated
 * 7-character codes are re-dashed as ABC-DEFG. So "bio 7k3q" → "BIO-7K3Q".
 */
export function normalizeClassCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length === 7) {
    return `${compact.slice(0, 3)}-${compact.slice(3)}`;
  }
  return compact.slice(0, 20);
}

export function classOwnerKey(student: StudentIdentity): string {
  return `${normalizeClassCode(student.classCode)}|${normalizeStudentName(
    student.studentName,
  ).toLowerCase()}`;
}

export function isValidDeviceId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** The owner new projects get: class identity when joined, else the device. */
export function ownerForIdentity(identity: RequestIdentity): Owner | null {
  if (identity.student) {
    return {
      ownerType: "class",
      ownerKey: classOwnerKey(identity.student),
      classCode: normalizeClassCode(identity.student.classCode),
      studentName: normalizeStudentName(identity.student.studentName),
    };
  }
  if (identity.deviceId) {
    return {
      ownerType: "device",
      ownerKey: identity.deviceId,
      classCode: null,
      studentName: null,
    };
  }
  return null;
}

/**
 * Can this request open the project?
 * - legacy projects (no owner) stay reachable by direct link
 * - teachers can view everything
 * - otherwise the class identity or this device must own it
 */
export function canAccessProject(
  project: OwnedRecord,
  identity: RequestIdentity,
): boolean {
  if (!project.ownerType || !project.ownerKey) return true;
  if (identity.isTeacher) return true;
  if (
    project.ownerType === "class" &&
    identity.student &&
    project.ownerKey === classOwnerKey(identity.student)
  ) {
    return true;
  }
  if (
    project.ownerType === "device" &&
    identity.deviceId &&
    project.ownerKey === identity.deviceId
  ) {
    return true;
  }
  return false;
}

export function encodeStudentCookie(student: StudentIdentity): string {
  return encodeURIComponent(
    JSON.stringify({
      c: normalizeClassCode(student.classCode),
      n: normalizeStudentName(student.studentName),
    }),
  );
}

export function decodeStudentCookie(
  value: string | null | undefined,
): StudentIdentity | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as { c?: unknown; n?: unknown };
    if (typeof parsed.c !== "string" || typeof parsed.n !== "string") return null;
    const classCode = normalizeClassCode(parsed.c);
    const studentName = normalizeStudentName(parsed.n);
    if (!classCode || !studentName) return null;
    return { classCode, studentName };
  } catch {
    return null;
  }
}

/** Short readable class code, e.g. BIO-7K3Q (no ambiguous 0/O/1/I). */
export function generateClassCode(
  randomBytes: (n: number) => Uint8Array = (n) =>
    crypto.getRandomValues(new Uint8Array(n)),
): string {
  const bytes = randomBytes(4);
  let suffix = "";
  for (const byte of bytes) {
    suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `BIO-${suffix}`;
}
