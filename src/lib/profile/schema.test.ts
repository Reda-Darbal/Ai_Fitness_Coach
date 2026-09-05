import { describe, expect, it } from "vitest";
import {
  formStateToPayload,
  humanizeIssue,
  profileInputSchema,
  profilePatchSchema,
  stepSchemas,
  type OnboardingFormState,
} from "./schema";

const completeForm: OnboardingFormState = {
  age: "30",
  sex: "male",
  heightCm: "190",
  currentWeightKg: "65",
  targetWeightKg: "75",
  goal: "gain_muscle",
  experienceLevel: "beginner",
  trainingDays: ["monday", "wednesday", "friday"],
  preferredTime: "evening",
  sessionMinutes: 60,
  equipment: ["leverage machine", "cable", "dumbbell"],
  injuries: "",
  likedExercises: "chest press",
  dislikedExercises: "",
  notes: "",
  coachLanguage: "en",
  conciseReplies: true,
};

describe("formStateToPayload", () => {
  it("converts numeric strings to numbers", () => {
    const payload = formStateToPayload(completeForm);
    expect(payload.age).toBe(30);
    expect(payload.heightCm).toBe(190);
    expect(payload.currentWeightKg).toBe(65);
    expect(payload.targetWeightKg).toBe(75);
  });

  it("treats a blank target weight as null, not zero", () => {
    const payload = formStateToPayload({ ...completeForm, targetWeightKg: "" });
    expect(payload.targetWeightKg).toBeNull();
  });

  it("yields undefined for blank required numbers so Zod reports them", () => {
    const payload = formStateToPayload({ ...completeForm, age: "  " });
    expect(payload.age).toBeUndefined();
  });

  it("does not coerce non-numeric text to a number", () => {
    const payload = formStateToPayload({ ...completeForm, heightCm: "tall" });
    expect(payload.heightCm).toBeUndefined();
  });
});

describe("profileInputSchema", () => {
  it("accepts a complete profile", () => {
    const result = profileInputSchema.safeParse(formStateToPayload(completeForm));
    expect(result.success).toBe(true);
  });

  it("normalises blank free text to null", () => {
    const result = profileInputSchema.parse(formStateToPayload(completeForm));
    expect(result.injuries).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.likedExercises).toBe("chest press");
  });

  it("trims free text", () => {
    const result = profileInputSchema.parse(
      formStateToPayload({ ...completeForm, notes: "  night shift  " }),
    );
    expect(result.notes).toBe("night shift");
  });

  it("requires at least one training day", () => {
    const result = profileInputSchema.safeParse(
      formStateToPayload({ ...completeForm, trainingDays: [] }),
    );
    expect(result.success).toBe(false);
  });

  it("requires at least one piece of equipment", () => {
    const result = profileInputSchema.safeParse(
      formStateToPayload({ ...completeForm, equipment: [] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an implausible age", () => {
    const result = profileInputSchema.safeParse(
      formStateToPayload({ ...completeForm, age: "7" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a target weight wildly far from current weight", () => {
    const result = profileInputSchema.safeParse(
      formStateToPayload({
        ...completeForm,
        currentWeightKg: "65",
        targetWeightKg: "290",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unknown session length", () => {
    const result = profileInputSchema.safeParse({
      ...formStateToPayload(completeForm),
      sessionMinutes: 37,
    });
    expect(result.success).toBe(false);
  });
});

describe("stepSchemas", () => {
  it("validates only its own step's fields", () => {
    // Nothing but the basics filled in — the basics step must still pass.
    const partial = formStateToPayload({
      ...completeForm,
      trainingDays: [],
      equipment: [],
    });
    expect(stepSchemas.basics.safeParse(partial).success).toBe(true);
    expect(stepSchemas.schedule.safeParse(partial).success).toBe(false);
  });

  it("reports the offending field so the UI can place the error", () => {
    const result = stepSchemas.basics.safeParse(
      formStateToPayload({ ...completeForm, currentWeightKg: "" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("currentWeightKg");
    }
  });
});

describe("profilePatchSchema", () => {
  it("accepts a single-field settings edit", () => {
    const result = profilePatchSchema.safeParse({ coachLanguage: "ar" });
    expect(result.success).toBe(true);
  });

  it("still enforces rules on the fields it is given", () => {
    const result = profilePatchSchema.safeParse({ coachLanguage: "de" });
    expect(result.success).toBe(false);
  });
});

describe("humanizeIssue", () => {
  it("replaces Zod's type wording with something a beginner understands", () => {
    expect(humanizeIssue("Invalid input: expected number, received undefined")).toBe(
      "Required",
    );
    expect(humanizeIssue("Invalid option: expected one of 'a'|'b'")).toBe("Pick one");
  });

  it("passes through messages that are already human", () => {
    expect(humanizeIssue("Must be 13 or older")).toBe("Must be 13 or older");
  });
});
