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
    description:
      "Identify protocol archetype, sub-type, oracle source, liquidation model.",
  },
  {
    id: "extraction",
    title: "Parameter & risk-surface extraction",
    description:
      "Derive canonical metric set + protocol-specific parameters from code.",
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
      "Auto-extract palette/typography/logo; verify WCAG AA; emit design_tokens.",
  },
  {
    id: "rendering",
    title: "Layout & dashboard rendering",
    description:
      "Compose KPI grid, positions monitor, risk panels per archetype layout.",
  },
];

const PHASE_DURATION_MS: Record<PhaseId, number> = {
  parsing: 1500,
  classification: 2200,
  extraction: 2800,
  fetch_plan: 2400,
  branding: 1700,
  rendering: 1800,
};

export type CreateJobInput = {
  protocol: string;
  websiteUrl: string;
  description: string;
  brandMode: "auto" | "manual" | "skip";
  contracts: { name: string; address: string; chainId: number }[];
  abiCount: number;
  sourceCount: number;
  layout: string;
  bundleName: string;
  bundleSize: number;
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

function doneLog(p: PhaseId, j: JobRun): string {
  switch (p) {
    case "parsing":
      return `Resolved ${j.source.contracts.length} address(es); merged ABIs from bundle`;
    case "classification":
      return `Archetype identified: ${j.archetype}`;
    case "extraction":
      return `Extracted ${j.stats.parameters} parameters, ${j.stats.riskSurfaces} risk surfaces`;
    case "fetch_plan":
      return `Generated ${j.stats.fetchCalls} multicall3 reads across ${new Set(j.source.contracts.map((c) => c.chainId)).size} chain(s)`;
    case "branding":
      return j.source.brandSource === "auto_extracted"
        ? "Brand auto-extracted; WCAG AA verified"
        : j.source.brandSource === "manual_input"
          ? "Manual brand tokens validated"
          : "Default theme applied";
    case "rendering":
      return "Dashboard composed — Overview / Positions / Risk / Oracles ready";
  }
}

export function createJob(id: string, input: CreateJobInput): JobRun {
  const startedAt = new Date().toISOString();
  const phases: Phase[] = PHASES_TEMPLATE.map((p, i) => ({
    ...p,
    status: i === 0 ? "running" : "pending",
    startedAt: i === 0 ? startedAt : undefined,
  }));
  const totalEstimate = Object.values(PHASE_DURATION_MS).reduce(
    (a, b) => a + b,
    0
  );

  const parameters = Math.max(
    12,
    input.sourceCount * 5 + Math.floor(input.abiCount * 1.2)
  );
  const riskSurfaces = Math.max(4, Math.round(parameters * 0.22));
  const fetchCalls = Math.max(8, Math.round(parameters * 0.7));

  const job: JobRun = {
    id,
    protocol: input.protocol,
    archetype: "Pending classification…",
    status: "running",
    startedAt,
    estimatedMs: totalEstimate,
    durationMs: 0,
    currentPhase: "parsing",
    stats: { parameters, riskSurfaces, fetchCalls },
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
  };

  store.set(id, job);
  scheduleAdvance(id, 0);
  return job;
}

function scheduleAdvance(id: string, phaseIndex: number) {
  const tpl = PHASES_TEMPLATE[phaseIndex];
  if (!tpl) return;
  setTimeout(() => {
    const j = store.get(id);
    if (!j) return;

    if (tpl.id === "classification") {
      // Set a plausible archetype name once classification "completes"
      j.archetype = "Lending — pooled (mock classification)";
    }

    j.phases = j.phases.map((p, i) =>
      i === phaseIndex
        ? { ...p, status: "done", finishedAt: new Date().toISOString() }
        : p
    );
    j.logs.push({
      ts: ts(),
      level: "info",
      phase: tpl.id,
      message: doneLog(tpl.id, j),
    });
    j.durationMs = Date.now() - new Date(j.startedAt).getTime();

    const next = PHASES_TEMPLATE[phaseIndex + 1];
    if (next) {
      j.currentPhase = next.id;
      j.phases = j.phases.map((p, i) =>
        i === phaseIndex + 1
          ? { ...p, status: "running", startedAt: new Date().toISOString() }
          : p
      );
      store.set(id, j);
      scheduleAdvance(id, phaseIndex + 1);
    } else {
      j.status = "completed";
      j.finishedAt = new Date().toISOString();
      j.history = j.history.map((h) =>
        h.id === id
          ? { ...h, status: "completed", durationMs: j.durationMs }
          : h
      );
      store.set(id, j);
    }
  }, PHASE_DURATION_MS[tpl.id]);
}
