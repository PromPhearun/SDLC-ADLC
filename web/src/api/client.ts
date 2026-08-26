const BASE_URL = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data as T;
}

/**
 * Parse SSE events from a streaming fetch response.
 * Yields { event, data } for each event received.
 */
async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<{ event: string; data: unknown }> {
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let currentData = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        currentData = line.slice(6).trim();
      } else if (line === "" && currentEvent) {
        try {
          yield { event: currentEvent, data: JSON.parse(currentData) };
        } catch {
          yield { event: currentEvent, data: currentData };
        }
        currentEvent = "";
        currentData = "";
      }
    }
  }

  // Flush remaining buffer
  if (currentEvent && currentData) {
    try {
      yield { event: currentEvent, data: JSON.parse(currentData) };
    } catch {
      yield { event: currentEvent, data: currentData };
    }
  }
}

/**
 * Make a streaming POST request and return an async generator of SSE events.
 */
export async function streamRequest(
  path: string,
  body: unknown
): Promise<AsyncGenerator<{ event: string; data: unknown }>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `Request failed: ${res.status}` }));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  if (!res.body) {
    throw new Error("Response body is null — streaming not supported");
  }

  return parseSSEStream(res.body.getReader());
}

// ─── Types ──────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  errors?: string[];
  warnings?: string[];
  duration?: number;
}

export interface SpecMetadata {
  projectName: string;
  version: string;
  userStoryCount: number;
  apiEndpointCount: number;
  sectionCount: number;
}

export interface SpecEntry {
  path: string;
  projectName: string;
  version: string;
  status: string;
  lastModified: string;
  coverageScore: number;
  userStoryCount: number;
  apiEndpointCount: number;
  isValid: boolean;
  validationErrors: string[];
}

export interface SpecsDirectory {
  version: string;
  lastScan: string;
  totalSpecs: number;
  validSpecs: number;
  invalidSpecs: number;
  stats: {
    averageCoverage: number;
    minCoverage: number;
    maxCoverage: number;
    statusBreakdown: Record<string, number>;
  };
  entries: SpecEntry[];
}

export interface BugReport {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface BugScanResult {
  bugs: BugReport[];
  summary: { critical: number; high: number; medium: number; low: number; total: number };
}

export interface AuditReport {
  timestamp: string;
  summary: {
    totalProjects: number;
    withSpec: number;
    withoutSpec: number;
    validSpecs: number;
    invalidSpecs: number;
    averageCoverage: number;
  };
  flagged: {
    projectName: string;
    path: string;
    issue: string;
    details: string;
    severity: string;
  }[];
  recommendations: string[];
}

export interface DigestSummary {
  title: string;
  bullets: string[];
  severity: string;
  entryCount: number;
  timeRange: { from: string; to: string };
}

export interface PipelineStage {
  stage: string;
  success: boolean;
  duration: number;
  error?: string;
}

export interface BuildResult {
  filesGenerated: string[];
  iterations: number;
  testsPassing: boolean;
  duration: number;
}

// ─── API Functions ──────────────────────────────────────────

export const api = {
  // Health
  health: () => request<{ status: string }>("/health"),

  // Specs
  generateSpec: (body: {
    prompt: string;
    projectName?: string;
    constraints?: string[];
    dryRun?: boolean;
  }) =>
    request<ApiResponse<SpecMetadata>>("/specs/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listSpecs: () => request<ApiResponse<SpecsDirectory>>("/specs"),

  getSpec: (projectName: string) =>
    request<ApiResponse<{ projectName: string; content: string; path: string }>>(
      `/specs/${projectName}`
    ),

  // Build
  runBuild: (body: {
    specPath: string;
    outputDir?: string;
    mode?: string;
  }) =>
    request<{ success: boolean; data: BuildResult; pipeline: { stages: PipelineStage[]; totalDuration: number; errors: string[] } }>(
      "/build/oneshot",
      { method: "POST", body: JSON.stringify(body) }
    ),

  // Features
  addFeature: (body: {
    specPath: string;
    featurePrompt: string;
    autoApprove?: boolean;
  }) =>
    request<ApiResponse<null>>("/features/add", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Bugs
  scanBugs: (body: {
    scanPath: string;
    specPath?: string;
    scanTypes?: string[];
  }) =>
    request<ApiResponse<BugScanResult>>("/bugs/scan", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  fixBug: (body: {
    bug: BugReport;
    specPath?: string;
    sourcePath: string;
    dryRun?: boolean;
  }) =>
    request<ApiResponse<{ fixDescription: string; filesModified: string[]; validated: boolean }>>(
      "/bugs/fix",
      { method: "POST", body: JSON.stringify(body) }
    ),

  // Audit
  runAudit: (paths?: string) =>
    request<ApiResponse<AuditReport>>(paths ? `/audit?paths=${paths}` : "/audit"),

  // Notifications
  getDigest: (demo = false) =>
    request<ApiResponse<DigestSummary | null>>(
      `/notifications/digest${demo ? "?demo=true" : ""}`
    ),
};
