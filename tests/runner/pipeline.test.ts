import { executePipeline, createStage, PipelineContext } from "../../src/runner/pipeline";

describe("Pipeline", () => {
  const createContext = (): PipelineContext => ({
    workingDir: "/tmp/test",
    specPath: "/tmp/test/spec.md",
    outputDir: "/tmp/test/output",
    config: {},
    results: new Map(),
    dryRun: true,
  });

  describe("executePipeline", () => {
    it("should execute stages in sequence", async () => {
      const order: number[] = [];
      const stages = [
        createStage("s1", "Stage 1", async (input: number) => {
          order.push(1);
          return input + 1;
        }),
        createStage("s2", "Stage 2", async (input: number) => {
          order.push(2);
          return input * 2;
        }),
      ];

      const result = await executePipeline(stages, 5, createContext());
      expect(result.success).toBe(true);
      expect(order).toEqual([1, 2]);
      expect(result.stages).toHaveLength(2);
    });

    it("should pass output of one stage as input to next", async () => {
      const stages = [
        createStage("double", "Double", async (n: number) => n * 2),
        createStage("add10", "Add 10", async (n: number) => n + 10),
      ];

      const result = await executePipeline(stages, 5, createContext());
      expect(result.success).toBe(true);
      expect(result.stages[1].output).toBe(20); // (5*2) + 10
    });

    it("should stop on non-optional stage failure", async () => {
      const stages = [
        createStage("ok", "OK", async () => "pass"),
        createStage("fail", "Fail", async () => {
          throw new Error("Stage failed");
        }),
        createStage("never", "Never runs", async () => "nope"),
      ];

      const result = await executePipeline(stages, null, createContext());
      expect(result.success).toBe(false);
      expect(result.failedStage).toBe("fail");
      expect(result.stages).toHaveLength(2);
    });

    it("should continue past optional stage failures", async () => {
      const stages = [
        createStage("ok", "OK", async () => "pass"),
        createStage(
          "optional-fail",
          "Optional Fail",
          async () => {
            throw new Error("Optional failure");
          },
          true // optional
        ),
        createStage("final", "Final", async () => "done"),
      ];

      const result = await executePipeline(stages, null, createContext());
      expect(result.success).toBe(true);
      expect(result.stages).toHaveLength(3);
      expect(result.stages[1].success).toBe(false);
      expect(result.stages[2].success).toBe(true);
    });

    it("should track duration per stage", async () => {
      const stages = [
        createStage("slow", "Slow", async () => {
          await new Promise((r) => setTimeout(r, 50));
          return "done";
        }),
      ];

      const result = await executePipeline(stages, null, createContext());
      expect(result.stages[0].duration).toBeGreaterThanOrEqual(40);
      expect(result.totalDuration).toBeGreaterThanOrEqual(40);
    });
  });

  describe("createStage", () => {
    it("should create a stage with all properties", () => {
      const stage = createStage("test", "desc", async () => 42, true);
      expect(stage.name).toBe("test");
      expect(stage.description).toBe("desc");
      expect(stage.optional).toBe(true);
    });

    it("should default optional to false", () => {
      const stage = createStage("test", "desc", async () => 42);
      expect(stage.optional).toBe(false);
    });
  });
});
