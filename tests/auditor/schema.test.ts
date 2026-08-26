import {
  SPEC_REQUIRED_SECTIONS,
  SPEC_OPTIONAL_SECTIONS,
  COVERAGE_WEIGHTS,
} from "../../src/schemas/spec.schema";
import {
  createEmptyDirectory,
} from "../../src/schemas/spec-directory.schema";

describe("Spec Schema", () => {
  describe("SPEC_REQUIRED_SECTIONS", () => {
    it("should have 6 required sections", () => {
      expect(SPEC_REQUIRED_SECTIONS).toHaveLength(6);
    });

    it("should include Executive Summary", () => {
      expect(SPEC_REQUIRED_SECTIONS).toContain("Executive Summary");
    });

    it("should include Technical Architecture", () => {
      expect(SPEC_REQUIRED_SECTIONS).toContain("Technical Architecture");
    });
  });

  describe("SPEC_OPTIONAL_SECTIONS", () => {
    it("should have optional sections", () => {
      expect(SPEC_OPTIONAL_SECTIONS.length).toBeGreaterThan(0);
      expect(SPEC_OPTIONAL_SECTIONS).toContain("Changelog");
    });
  });

  describe("COVERAGE_WEIGHTS", () => {
    it("should have weights summing to 100", () => {
      const total = Object.values(COVERAGE_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(total).toBe(100);
    });

    it("should have userStories as highest weight", () => {
      expect(COVERAGE_WEIGHTS.userStories).toBe(15);
      expect(COVERAGE_WEIGHTS.apiEndpoints).toBe(15);
    });
  });
});

describe("Spec Directory Schema", () => {
  describe("createEmptyDirectory", () => {
    it("should create a valid empty directory", () => {
      const dir = createEmptyDirectory();
      expect(dir.version).toBe("1.0.0");
      expect(dir.totalSpecs).toBe(0);
      expect(dir.entries).toEqual([]);
      expect(dir.stats.averageCoverage).toBe(0);
    });

    it("should have a lastScan timestamp", () => {
      const dir = createEmptyDirectory();
      expect(dir.lastScan).toBeTruthy();
      expect(new Date(dir.lastScan).getTime()).not.toBeNaN();
    });
  });
});
