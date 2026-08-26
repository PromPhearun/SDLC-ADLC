import { NotificationDigest, compressEntries } from "../../src/notifications/digest";
import { DigestEntry } from "../../src/notifications/types";

describe("NotificationDigest", () => {
  let digest: NotificationDigest;

  beforeEach(() => {
    digest = new NotificationDigest(3);
  });

  describe("addEntry / addEntries", () => {
    it("should track entry count", () => {
      expect(digest.size).toBe(0);
      digest.addEntry(createEntry("test", "message", "info"));
      expect(digest.size).toBe(1);
    });

    it("should add multiple entries", () => {
      digest.addEntries([
        createEntry("a", "msg1", "info"),
        createEntry("b", "msg2", "warning"),
      ]);
      expect(digest.size).toBe(2);
    });
  });

  describe("generateDigest", () => {
    it("should return null when no entries", () => {
      expect(digest.generateDigest()).toBeNull();
    });

    it("should compress entries into bullets", () => {
      digest.addEntries([
        createEntry("spec-generator", "Generated spec", "success"),
        createEntry("oneshot-builder", "Build complete", "success"),
        createEntry("bug-scanner", "Found 3 bugs", "warning"),
      ]);

      const summary = digest.generateDigest();
      expect(summary).not.toBeNull();
      expect(summary!.bullets.length).toBeLessThanOrEqual(3);
      expect(summary!.entryCount).toBe(3);
      expect(summary!.severity).toBe("warning");
    });

    it("should detect error as highest severity", () => {
      digest.addEntries([
        createEntry("a", "info msg", "info"),
        createEntry("b", "error msg", "error"),
        createEntry("c", "success msg", "success"),
      ]);

      const summary = digest.generateDigest();
      expect(summary!.severity).toBe("error");
    });

    it("should respect maxBullets limit", () => {
      const smallDigest = new NotificationDigest(2);
      for (let i = 0; i < 10; i++) {
        smallDigest.addEntry(createEntry(`source-${i}`, `msg-${i}`, "info"));
      }

      const summary = smallDigest.generateDigest();
      expect(summary!.bullets.length).toBeLessThanOrEqual(2);
    });

    it("should include time range", () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 60000);

      digest.addEntries([
        createEntry("a", "first", "info", earlier),
        createEntry("b", "last", "info", now),
      ]);

      const summary = digest.generateDigest();
      expect(summary!.timeRange.from).toEqual(earlier);
      expect(summary!.timeRange.to).toEqual(now);
    });
  });

  describe("clear", () => {
    it("should clear all entries", () => {
      digest.addEntry(createEntry("a", "msg", "info"));
      digest.clear();
      expect(digest.size).toBe(0);
      expect(digest.generateDigest()).toBeNull();
    });
  });

  describe("compressEntries utility", () => {
    it("should compress entries directly", () => {
      const entries: DigestEntry[] = [
        createEntry("agent-1", "Task done", "success"),
        createEntry("agent-2", "Issue found", "warning"),
      ];

      const summary = compressEntries(entries, 3);
      expect(summary).not.toBeNull();
      expect(summary!.entryCount).toBe(2);
    });
  });
});

function createEntry(
  source: string,
  message: string,
  severity: "info" | "success" | "warning" | "error",
  timestamp?: Date
): DigestEntry {
  return {
    source,
    message,
    severity,
    timestamp: timestamp || new Date(),
  };
}
