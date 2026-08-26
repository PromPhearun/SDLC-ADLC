import {
  extractTitle,
  extractMeta,
  extractSections,
  countUserStories,
  countApiEndpoints,
  validateSections,
} from "../../src/utils/markdown";

describe("Markdown Utilities", () => {
  const sampleSpec = `# My Trading App

> **Version:** 1.0.0
> **Status:** draft
> **Last Updated:** 2024-01-15
> **Owner:** Team Alpha

---

## 1. Executive Summary

A real-time trading dashboard for derivatives.

---

## 2. Business Facts & Requirements

### 2.3 User Stories

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| US-001 | As a trader, I want to see live prices | Given I am logged in | P0 |
| US-002 | As a trader, I want to place orders | Given I have funds | P0 |

---

## 3. API Schemas & Data Contracts

### 3.2 API Endpoints

#### \`GET /api/prices\`

**Description:** Get live prices

#### \`POST /api/orders\`

**Description:** Place an order

---

## 4. Design System Constraints & Component Mappings

---

## 5. Acceptance Criteria & Test Specifications

---

## 6. Technical Architecture
`;

  describe("extractTitle", () => {
    it("should extract H1 title", () => {
      expect(extractTitle(sampleSpec)).toBe("My Trading App");
    });

    it("should return null for missing title", () => {
      expect(extractTitle("No title here")).toBeNull();
    });
  });

  describe("extractMeta", () => {
    it("should extract version", () => {
      expect(extractMeta(sampleSpec, "Version")).toBe("1.0.0");
    });

    it("should extract status", () => {
      expect(extractMeta(sampleSpec, "Status")).toBe("draft");
    });

    it("should extract owner", () => {
      expect(extractMeta(sampleSpec, "Owner")).toBe("Team Alpha");
    });

    it("should return null for missing meta", () => {
      expect(extractMeta(sampleSpec, "NonExistent")).toBeNull();
    });
  });

  describe("extractSections", () => {
    it("should extract all H2 sections", () => {
      const sections = extractSections(sampleSpec);
      expect(sections.length).toBeGreaterThanOrEqual(5);
      expect(sections).toContain("1. Executive Summary");
      expect(sections).toContain("6. Technical Architecture");
    });
  });

  describe("countUserStories", () => {
    it("should count user stories", () => {
      expect(countUserStories(sampleSpec)).toBe(2);
    });

    it("should return 0 for no stories", () => {
      expect(countUserStories("No stories")).toBe(0);
    });
  });

  describe("countApiEndpoints", () => {
    it("should count API endpoints", () => {
      expect(countApiEndpoints(sampleSpec)).toBe(2);
    });

    it("should return 0 for no endpoints", () => {
      expect(countApiEndpoints("No endpoints")).toBe(0);
    });
  });

  describe("validateSections", () => {
    it("should pass with all required sections", () => {
      const result = validateSections(sampleSpec, [
        "Executive Summary",
        "Business Facts & Requirements",
        "API Schemas & Data Contracts",
        "Design System Constraints",
        "Acceptance Criteria",
        "Technical Architecture",
      ]);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it("should fail with missing sections", () => {
      const result = validateSections("# Title\n\n## Only Section", [
        "Executive Summary",
        "Technical Architecture",
      ]);
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });
  });
});
