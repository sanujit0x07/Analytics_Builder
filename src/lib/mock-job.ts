import type { Analysis } from "./claude-pipeline";

export type PhaseId =
  | "parsing"
  | "classification"
  | "extraction"
  | "fetch_plan"
  | "branding"
  | "rendering";

export type PhaseStatus = "pending" | "running" | "done" | "failed";

export type Phase = {
  id: PhaseId;
  title: string;
  description: string;
  status: PhaseStatus;
  startedAt?: string;
  finishedAt?: string;
};

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type LogLine = {
  ts: string;
  level: "info" | "warn" | "error";
  phase: PhaseId;
  message: string;
};

export type JobSource = {
  abis: { name: string; size: string }[];
  contracts: { name: string; address: string; chainId: number }[];
  brandSource: "auto_extracted" | "manual_input" | "default_fallback";
};

export type JobRunSummary = {
  id: string;
  startedAt: string;
  status: JobStatus;
  durationMs: number;
};

export type JobRun = {
  id: string;
  protocol: string;
  archetype: string;
  status: JobStatus;
  startedAt: string;
  finishedAt?: string;
  estimatedMs: number;
  durationMs: number;
  currentPhase: PhaseId;
  stats: {
    parameters: number;
    riskSurfaces: number;
    fetchCalls: number;
  };
  phases: Phase[];
  source: JobSource;
  logs: LogLine[];
  history: JobRunSummary[];
  analysis?: Analysis;
  selectedParamIds?: string[];
  error?: string;
  contractAbis?: { name: string; chainId: number; address: string; abi: unknown[] }[];
};

import { SUPPORTED_CHAINS } from "@/lib/chains";

export function chainName(id: number) {
  return SUPPORTED_CHAINS.find((c) => c.id === id)?.name ?? `Chain ${id}`;
}

export const MOCK_JOB: JobRun = {
  id: "demo-aave-v3",
  protocol: "Aave V3",
  archetype: "Lending — pooled, isolated mode supported",
  status: "completed",
  startedAt: "2026-04-27T18:20:25Z",
  finishedAt: "2026-04-27T18:24:53Z",
  estimatedMs: 4 * 60 * 1000 + 30 * 1000,
  durationMs: 4 * 60 * 1000 + 28 * 1000,
  currentPhase: "rendering",
  stats: {
    parameters: 126,
    riskSurfaces: 26,
    fetchCalls: 100,
  },
  phases: [
    {
      id: "parsing",
      title: "Parsing & ABI resolution",
      description:
        "Resolve EIP-1967 / Beacon / Diamond proxies; merge implementation ABIs.",
      status: "done",
      startedAt: "2026-04-27T18:20:25Z",
      finishedAt: "2026-04-27T18:20:42Z",
    },
    {
      id: "classification",
      title: "Archetype classification",
      description:
        "Identify protocol archetype, sub-type, oracle source, liquidation model.",
      status: "done",
      startedAt: "2026-04-27T18:20:42Z",
      finishedAt: "2026-04-27T18:21:18Z",
    },
    {
      id: "extraction",
      title: "Parameter & risk-surface extraction",
      description:
        "Derive canonical metric set + protocol-specific parameters from code.",
      status: "done",
      startedAt: "2026-04-27T18:21:18Z",
      finishedAt: "2026-04-27T18:22:34Z",
    },
    {
      id: "fetch_plan",
      title: "Fetch-plan generation",
      description:
        "Build multicall3 batches per chain, queryFilter configs, refresh cadences.",
      status: "done",
      startedAt: "2026-04-27T18:22:34Z",
      finishedAt: "2026-04-27T18:23:41Z",
    },
    {
      id: "branding",
      title: "Brand extraction & token emission",
      description:
        "Auto-extract palette/typography/logo; verify WCAG AA; emit design_tokens.",
      status: "done",
      startedAt: "2026-04-27T18:23:41Z",
      finishedAt: "2026-04-27T18:24:11Z",
    },
    {
      id: "rendering",
      title: "Layout & dashboard rendering",
      description:
        "Compose KPI grid, positions monitor, risk panels per archetype layout.",
      status: "done",
      startedAt: "2026-04-27T18:24:11Z",
      finishedAt: "2026-04-27T18:24:53Z",
    },
  ],
  source: {
    abis: [
      { name: "Pool.json", size: "184 KB" },
      { name: "PoolAddressesProvider.json", size: "22 KB" },
      { name: "AaveOracle.json", size: "11 KB" },
      { name: "AToken.json", size: "47 KB" },
      { name: "VariableDebtToken.json", size: "39 KB" },
    ],
    contracts: [
      { name: "Pool", address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", chainId: 1 },
      { name: "Pool", address: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", chainId: 8453 },
      { name: "AaveOracle", address: "0x54586bE62E3c3580375aE3723C145253060Ca0C2", chainId: 1 },
    ],
    brandSource: "auto_extracted",
  },
  logs: [
    { ts: "18:20:25", level: "info", phase: "parsing", message: "Loaded 5 ABI files (303 KB)" },
    { ts: "18:20:28", level: "info", phase: "parsing", message: "Detected EIP-1967 proxy at 0x87870…fA4E2" },
    { ts: "18:20:34", level: "info", phase: "parsing", message: "Resolved implementation: 0x5fAab9…a73e" },
    { ts: "18:20:42", level: "info", phase: "classification", message: "Archetype: lending (confidence 0.94)" },
    { ts: "18:21:01", level: "info", phase: "classification", message: "Detected: pooled markets, isolated mode, Chainlink oracles, fixed-bonus liquidation" },
    { ts: "18:21:18", level: "info", phase: "extraction", message: "Generating canonical lending metric set" },
    { ts: "18:21:42", level: "info", phase: "extraction", message: "Extracted 126 parameters, 26 risk surfaces" },
    { ts: "18:22:34", level: "info", phase: "fetch_plan", message: "Grouped 100 reads into 7 multicall3 batches across 2 chains" },
    { ts: "18:22:58", level: "warn", phase: "fetch_plan", message: "Top-N borrower distribution requires event indexing — flagged in open_questions" },
    { ts: "18:23:41", level: "info", phase: "branding", message: "Extracted brand from app.aave.com (palette, logo, fonts)" },
    { ts: "18:23:55", level: "info", phase: "branding", message: "WCAG AA verified — auto-darkened muted-foreground by 4%" },
    { ts: "18:24:11", level: "info", phase: "rendering", message: "Composed Overview / Positions / Liquidations / Risk Explorer / Oracles / Whales / Alerts" },
    { ts: "18:24:53", level: "info", phase: "rendering", message: "Build complete — 100 fetch calls live in /dashboard/demo-aave-v3" },
  ],
  history: [
    { id: "demo-aave-v3", startedAt: "27 Apr, 18:20", status: "completed", durationMs: 4 * 60 * 1000 + 28 * 1000 },
    { id: "demo-aave-v3-r2", startedAt: "24 Mar, 18:20", status: "completed", durationMs: 1 * 60 * 60 * 1000 + 38 * 60 * 1000 + 48 * 1000 },
    { id: "demo-aave-v3-r1", startedAt: "21 Mar, 09:11", status: "failed", durationMs: 47 * 1000 },
  ],
};

