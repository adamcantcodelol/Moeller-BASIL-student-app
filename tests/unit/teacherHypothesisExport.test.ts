import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject } from "@/lib/services/projectService";
import { saveHypothesis } from "@/lib/services/hypothesisService";
import { ownerForIdentity } from "@/lib/auth/identity";
import { createClass } from "@/lib/db/queries/classes";
import {
  csvCell,
  getLatestHypothesisForProject,
  hypothesesToCsv,
  hypothesisToText,
  listLatestHypotheses,
} from "@/lib/teacher/hypothesisExport";

describe("teacher hypothesis export", () => {
  it("returns the latest saved hypothesis and an honest empty state", async () => {
    const db = await createTestDatabase();
    const cls = await createClass(db, "Period 3");
    const owner = (name: string) =>
      ownerForIdentity({
        deviceId: "11111111-1111-4111-8111-111111111111",
        student: { studentName: name, classCode: cls.code },
        isTeacher: false,
      });
    const withHyp = await createProject(db, { name: "Lysozyme", owner: owner("Ada") });
    await createProject(db, { name: "Empty", owner: owner("Bo") });
    await createProject(db, { name: "Not in class" });
    await saveHypothesis(db, withHyp.id, { text: "First draft" });
    await saveHypothesis(db, withHyp.id, { text: 'Revised, with "quotes"' });

    const rows = await listLatestHypotheses(db, [cls.code]);
    expect(rows).toHaveLength(2);
    const ada = rows.find((r) => r.studentName === "Ada")!;
    expect(ada.hypothesisText).toBe('Revised, with "quotes"');
    expect(ada.classCode).toBe(cls.code);
    expect(ada.lastUpdated).toBeTruthy();
    const bo = rows.find((r) => r.studentName === "Bo")!;
    expect(bo.hypothesisText).toBeNull();

    const csv = hypothesesToCsv(rows);
    expect(csv.startsWith("\uFEFFStudent name,Class code,Project name,PDB ID,Hypothesis,Last updated")).toBe(true);
    expect(csv).toContain('"Revised, with ""quotes"""');
    expect(csv).toContain("(no hypothesis saved yet)");

    const single = await getLatestHypothesisForProject(db, withHyp.id);
    expect(hypothesisToText(single!)).toContain('Revised, with "quotes"');
    expect(await getLatestHypothesisForProject(db, "missing")).toBeNull();
  });

  it("neutralizes spreadsheet formulas in CSV cells", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(null)).toBe("");
  });
});
