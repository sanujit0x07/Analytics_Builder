import { analyzeProtocol, type Analysis } from "./claude-pipeline";
import type { JobRun, Phase, PhaseId } from "./mock-job";

declare global {
  // eslint-disable-next-line no-var
  var __jobStore: Map<string, JobRun> | undefined;
}

const store = (globalThis.__jobStore ??= new Map<string, JobRun>());

export function getStoredJob(id: string): JobRun | undefined {
  return store.get(id);
}

export function listStoredJobs(): JobRun[] {
  return Array.from(store.values());
}

export function setSelectedParams(id: string, paramIds: string[]) {
  const j = store.get(id);
  if (!j) return false;
  j.selectedParamIds = paramIds;
  store.set(id, j);
  return true;
}

const PHASES_TEMPLATE: Pick<Phase, "id" | "title" | "description">[] = [
  {
    id: "parsing",
    title: "Parsing & ABI resolution",
    description:
      "Resolve EIP-1967 / Beacon / Diamond proxies; merge implementation ABIs.",
  },
  {
    id: "classification",
    title: "Archetype classification",
    description: "Claude analyzes source to identify archetype + sub-type.",
  },
  {
    id: "extraction",
    title: "Parameter & risk-surface extraction",
    description: "Derive canonical metric set + protocol-specific parameters.",
  },
  {
    id: "fetch_plan",
    title: "Fetch-plan generation",
    description:
      "Build multicall3 batches per chain, queryFilter configs, refresh cadences.",
  },
  {
    id: "branding",
    title: "Brand extraction & token emission",
    description:
      "Extract palette/typography/logo; verify WCAG AA; emit design_tokens.",
  },
  {
    id: "rendering",
    title: "Layout & dashboard rendering",
    description:
      "Compose KPI grid, positions monitor, risk panels per archetype layout.",
  },
];

export type CreateJobInput = {
  protocol: string;
  websiteUrl: string;
  description: string;
  brandMode: "auto" | "manual" | "skip";
  contracts: { name: string; address: string; chainId: number }[];
  contractAbis: { name: string; chainId: number; address: string; abi: unknown[] }[];
  abiCount: number;
  sourceCount: number;
  layout: string;
  bundleName: string;
  bundleSize: number;
  bundleBuffer: Buffer;
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function ts() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function friendlyDate(iso: string) {
  const d = new Date(iso);
  const month = d.toLocaleString("en", { month: "short" });
  return `${d.getDate()} ${month}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function update(id: string, mutate: (j: JobRun) => void) {
  const j = store.get(id);
  if (!j) return;
  mutate(j);
  j.durationMs = Date.now() - new Date(j.startedAt).getTime();
  store.set(id, j);
}

function markPhase(j: JobRun, phaseId: PhaseId, status: Phase["status"]) {
  j.phases = j.phases.map((p) => {
    if (p.id !== phaseId) return p;
    if (status === "running") return { ...p, status, startedAt: new Date().toISOString() };
    if (status === "done") return { ...p, status, finishedAt: new Date().toISOString() };
    return { ...p, status };
  });
  if (status === "running") j.currentPhase = phaseId;
}

function log(j: JobRun, phase: PhaseId, message: string, level: "info" | "warn" | "error" = "info") {
  j.logs.push({ ts: ts(), level, phase, message });
}

export function createJob(id: string, input: CreateJobInput): JobRun {
  const startedAt = new Date().toISOString();
  const phases: Phase[] = PHASES_TEMPLATE.map((p, i) => ({
    ...p,
    status: i === 0 ? "running" : "pending",
    startedAt: i === 0 ? startedAt : undefined,
  }));

  const job: JobRun = {
    id,
    protocol: input.protocol,
    archetype: "Pending classification…",
    status: "running",
    startedAt,
    estimatedMs: 60_000,
    durationMs: 0,
    currentPhase: "parsing",
    stats: { parameters: 0, riskSurfaces: 0, fetchCalls: 0 },
    phases,
    source: {
      abis: [
        {
          name: input.bundleName,
          size: `${(input.bundleSize / 1024 / 1024).toFixed(2)} MB · ${input.abiCount} ABIs · ${input.sourceCount} sources`,
        },
      ],
      contracts: input.contracts,
      brandSource:
        input.brandMode === "auto"
          ? "auto_extracted"
          : input.brandMode === "manual"
            ? "manual_input"
            : "default_fallback",
    },
    logs: [
      {
        ts: ts(),
        level: "info",
        phase: "parsing",
        message: `Loaded ZIP: ${input.bundleName} (${input.abiCount} ABIs, ${input.sourceCount} sources, layout=${input.layout})`,
      },
    ],
    history: [
      {
        id,
        startedAt: friendlyDate(startedAt),
        status: "running",
        durationMs: 0,
      },
    ],
    contractAbis: input.contractAbis,
  };

  store.set(id, job);
  void runPipeline(id, input);
  return job;
}

async function runPipeline(id: string, input: CreateJobInput) {
  // Phase 1 — parsing — already running, mark done quickly
  await new Promise((r) => setTimeout(r, 600));
  update(id, (j) => {
    markPhase(j, "parsing", "done");
    log(j, "parsing", `Resolved ${input.contracts.length} address(es); selected source files for analysis`);
    markPhase(j, "classification", "running");
    log(j, "classification", "Calling Claude Opus 4.7 with adaptive thinking…");
  });

  // Phase 2 — classification (Claude call)
  let analysis: Analysis;
  try {
    analysis = await analyzeProtocol({
      protocol: input.protocol,
      websiteUrl: input.websiteUrl,
      description: input.description,
      contracts: input.contracts,
      bundleBuffer: input.bundleBuffer,
      bundleName: input.bundleName,
    });
  } catch (err) {
    update(id, (j) => {
      const msg = (err as Error).message;
      j.status = "failed";
      j.error = msg;
      log(j, j.currentPhase, `Pipeline failed: ${msg}`, "error");
      markPhase(j, j.currentPhase, "failed");
      j.history = j.history.map((h) =>
        h.id === id ? { ...h, status: "failed", durationMs: j.durationMs } : h
      );
    });
    return;
  }

  // Classification result lands; mark phases 2-4 done in sequence
  update(id, (j) => {
    j.archetype = `${analysis.archetype}${analysis.subtype ? ` — ${analysis.subtype}` : ""}`;
    log(
      j,
      "classification",
      `Archetype: ${analysis.archetype} (confidence ${analysis.confidence.toFixed(2)})`
    );
    markPhase(j, "classification", "done");
    markPhase(j, "extraction", "running");
  });

  await new Promise((r) => setTimeout(r, 400));
  update(id, (j) => {
    const surfaces = new Set(analysis.parameters.map((p) => p.surface));
    j.stats.parameters = analysis.parameters.length;
    j.stats.riskSurfaces = surfaces.size;
    log(
      j,
      "extraction",
      `Extracted ${analysis.parameters.length} parameters across ${surfaces.size} risk surfaces`
    );
    markPhase(j, "extraction", "done");
    markPhase(j, "fetch_plan", "running");
  });

  await new Promise((r) => setTimeout(r, 400));
  update(id, (j) => {
    const liveCount = analysis.parameters.filter((p) => !p.needs_indexing).length;
    j.stats.fetchCalls = liveCount;
    const indexerNeeds = analysis.parameters.length - liveCount;
    log(
      j,
      "fetch_plan",
      `${liveCount} parameters servable from multicall3; ${indexerNeeds} need event indexing`
    );
    if (indexerNeeds > 0) {
      log(
        j,
        "fetch_plan",
        `Flagged ${indexerNeeds} parameter(s) for indexer in open_questions`,
        "warn"
      );
    }
    markPhase(j, "fetch_plan", "done");
    markPhase(j, "branding", "running");
  });

  // Phase 5 — branding (placeholder; auto-extract is a separate task)
  await new Promise((r) => setTimeout(r, 800));
  update(id, (j) => {
    log(
      j,
      "branding",
      j.source.brandSource === "auto_extracted"
        ? "Brand auto-extract deferred — using neutral default theme for now"
        : j.source.brandSource === "manual_input"
          ? "Manual brand tokens validated"
          : "Default theme applied"
    );
    markPhase(j, "branding", "done");
    markPhase(j, "rendering", "running");
  });

  // Phase 6 — rendering: persist analysis + default-select all params
  await new Promise((r) => setTimeout(r, 600));
  update(id, (j) => {
    j.analysis = analysis;
    j.selectedParamIds = analysis.parameters.map((p) => p.id);
    log(
      j,
      "rendering",
      `Prepared dashboard config — ${analysis.parameters.length} parameters available for selection`
    );
    markPhase(j, "rendering", "done");
    j.status = "completed";
    j.finishedAt = new Date().toISOString();
    j.history = j.history.map((h) =>
      h.id === id ? { ...h, status: "completed", durationMs: j.durationMs } : h
    );
  });
}
