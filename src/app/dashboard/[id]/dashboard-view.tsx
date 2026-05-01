"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronDown,
  CircleDollarSign,
  Cpu,
  Droplet,
  Flame,
  Gauge,
  Info,
  LineChart,
  Network,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Waves,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { chainName, type JobRun } from "@/lib/mock-job";
import type { Parameter, RiskSurface } from "@/lib/claude-pipeline";
import { shortAddress } from "@/lib/format";

type SectionId =
  | "overview"
  | "positions"
  | "liquidations"
  | "risk"
  | "oracles"
  | "whales"
  | "alerts";

const SECTIONS: {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "positions", label: "Positions", icon: Wallet },
  { id: "liquidations", label: "Liquidations", icon: Flame },
  { id: "risk", label: "Risk Explorer", icon: ShieldAlert },
  { id: "oracles", label: "Oracles", icon: Network },
  { id: "whales", label: "Whales", icon: Waves },
  { id: "alerts", label: "Alerts", icon: Bell },
];

const SURFACE_LABEL: Record<RiskSurface, string> = {
  solvency: "Solvency",
  liquidity: "Liquidity",
  oracle: "Oracle",
  market: "Market",
  smart_contract: "Smart contract",
  governance: "Governance",
};

const SURFACE_ACCENT: Record<RiskSurface, string> = {
  solvency: "text-rose-300",
  liquidity: "text-cyan-300",
  oracle: "text-amber-300",
  market: "text-violet-300",
  smart_contract: "text-fuchsia-300",
  governance: "text-lime-300",
};

const SURFACE_BG: Record<RiskSurface, string> = {
  solvency: "bg-rose-400/10 ring-rose-400/30",
  liquidity: "bg-cyan-400/10 ring-cyan-400/30",
  oracle: "bg-amber-400/10 ring-amber-400/30",
  market: "bg-violet-400/10 ring-violet-400/30",
  smart_contract: "bg-fuchsia-400/10 ring-fuchsia-400/30",
  governance: "bg-lime-400/10 ring-lime-400/30",
};

type EvaluatedValue = {
  paramId: string;
  value: string | number | null;
  formatted: string;
  source: "rpc" | "rpc_call" | "metadata" | "unsupported";
  error?: string;
};

export function DashboardView({ job }: { job: JobRun }) {
  const [section, setSection] = useState<SectionId>("overview");
  const [chainFilter, setChainFilter] = useState<number | "all">("all");
  const [valuesById, setValuesById] = useState<Map<string, EvaluatedValue>>(
    new Map()
  );
  const [valuesLoading, setValuesLoading] = useState(false);
  const [valuesError, setValuesError] = useState<string | null>(null);

  useEffect(() => {
    if (!job.analysis) return;
    let cancelled = false;
    setValuesLoading(true);
    setValuesError(null);
    fetch(`/api/jobs/${job.id}/values`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as { values: EvaluatedValue[] };
        if (cancelled) return;
        const map = new Map<string, EvaluatedValue>();
        for (const v of data.values) map.set(v.paramId, v);
        setValuesById(map);
      })
      .catch((err) => {
        if (!cancelled) setValuesError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setValuesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job.id, job.analysis, job.selectedParamIds]);

  if (!job.analysis) {
    return <PendingState job={job} />;
  }

  const analysis = job.analysis;
  const selectedIds = new Set(
    job.selectedParamIds ?? analysis.parameters.map((p) => p.id)
  );
  const selected = analysis.parameters.filter((p) => selectedIds.has(p.id));
  const chains = Array.from(new Set(job.source.contracts.map((c) => c.chainId)));

  return (
    <div className="flex flex-1 flex-col">
      <TopBar job={job} />

      <div className="flex flex-1">
        <LeftRail
          section={section}
          setSection={setSection}
          counts={countBySection(selected)}
        />

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6">
            <ArchetypeHeader job={job} />
            <DataSourceBanner
              loading={valuesLoading}
              error={valuesError}
              valuesById={valuesById}
              total={selected.length}
            />

            {section === "overview" && (
              <OverviewSection
                params={selected}
                analysis={analysis}
                chains={chains}
                chainFilter={chainFilter}
                setChainFilter={setChainFilter}
                job={job}
                valuesById={valuesById}
              />
            )}
            {section === "positions" && (
              <SectionPlaceholder
                title="Positions Monitor"
                body="A sortable per-wallet table will render here once positions/balances are fetched on-chain. The schema is ready (Health Factor / Current PnL / Leverage Exposure) — wiring next."
              />
            )}
            {section === "liquidations" && (
              <FilteredParams
                title="Liquidations"
                params={selected.filter(
                  (p) =>
                    p.surface === "solvency" ||
                    /liquidat|bad.?debt|hf|health/i.test(p.name)
                )}
                valuesById={valuesById}
                empty="No liquidation-related parameters in your current selection."
              />
            )}
            {section === "risk" && <RiskExplorerSection params={selected} analysis={analysis} />}
            {section === "oracles" && (
              <FilteredParams
                title="Oracles"
                params={selected.filter((p) => p.surface === "oracle")}
                valuesById={valuesById}
                empty="No oracle parameters detected. If your protocol uses external price feeds, surface them in the Build Console parameter list."
              />
            )}
            {section === "whales" && (
              <FilteredParams
                title="Whales / Concentration"
                params={selected.filter((p) =>
                  /top.?n|concentration|whale|hhi/i.test(p.name + p.description)
                )}
                valuesById={valuesById}
                empty="No concentration metrics in your current selection. Top-N borrower / LP distribution typically requires event indexing."
              />
            )}
            {section === "alerts" && <AlertsSection params={selected} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function PendingState({ job }: { job: JobRun }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-16">
      <Link
        href={`/jobs/${job.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to build console
      </Link>
      <div className="flex flex-col gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <h1 className="font-heading text-xl font-medium">
          Build still running
        </h1>
        <p className="text-sm text-muted-foreground">
          Claude hasn&apos;t finished analyzing this protocol yet. Open the build
          console to watch progress; the dashboard will populate once
          classification completes.
        </p>
      </div>
    </div>
  );
}

function TopBar({ job }: { job: JobRun }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/60 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-lime-400" />
          <span className="font-heading text-base font-semibold tracking-tight">
            {job.protocol}
          </span>
        </Link>
        <span className="rounded-md bg-lime-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime-300 ring-1 ring-lime-400/30">
          Pro
        </span>
      </div>

      <nav className="hidden items-center gap-1 rounded-lg bg-muted/30 p-1 ring-1 ring-border md:flex">
        {["Portfolio", "Earn", "Margin", "Trade", "Farm"].map((label) => (
          <span
            key={label}
            className="cursor-default px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {label}
          </span>
        ))}
        <span className="cursor-default rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background">
          Analytics
        </span>
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="hidden h-8 items-center rounded-md bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 text-sm font-medium text-white hover:opacity-90 sm:flex"
        >
          DEPOSIT
        </button>
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 text-xs hover:bg-muted/50"
        >
          <span className="size-2 rounded-full bg-muted-foreground" />
          0x0031…968B
          <ChevronDown className="size-3" />
        </button>
      </div>
    </header>
  );
}

function LeftRail({
  section,
  setSection,
  counts,
}: {
  section: SectionId;
  setSection: (s: SectionId) => void;
  counts: Record<SectionId, number>;
}) {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-border/60 px-3 py-4 md:flex md:flex-col md:gap-1">
      {SECTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setSection(id)}
          className={cn(
            "flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors",
            section === id
              ? "bg-muted/40 text-foreground ring-1 ring-border"
              : "hover:bg-muted/20 hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <Icon className="size-4" />
            {label}
          </span>
          {counts[id] > 0 && (
            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium">
              {counts[id]}
            </span>
          )}
        </button>
      ))}

      <div className="mt-4 border-t border-border/60 pt-4">
        <Link
          href={`/jobs/${"current"}`}
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted/20 hover:text-foreground"
        >
          <BookOpen className="size-3.5" />
          Build console
        </Link>
      </div>
    </aside>
  );
}

function ArchetypeHeader({ job }: { job: JobRun }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-lime-300" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Generated dashboard · {job.id}
        </span>
      </div>
      <h1 className="font-heading text-2xl font-semibold capitalize tracking-tight">
        {job.archetype.replace(/_/g, " ")}
      </h1>
    </div>
  );
}

function DataSourceBanner({
  loading,
  error,
  valuesById,
  total,
}: {
  loading: boolean;
  error: string | null;
  valuesById: Map<string, EvaluatedValue>;
  total: number;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-200/90">
        <Activity className="size-3.5 shrink-0 animate-pulse text-cyan-300" />
        <span>Reading on-chain values via public RPC + ethers.js v6…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-400/5 px-3 py-2 text-xs text-rose-200/90">
        <Info className="mt-0.5 size-3.5 shrink-0 text-rose-300" />
        <span>Couldn&apos;t fetch on-chain values: {error}</span>
      </div>
    );
  }
  const live = Array.from(valuesById.values()).filter(
    (v) => v.source === "rpc" || v.source === "rpc_call" || v.source === "metadata"
  ).length;
  const indexer = Array.from(valuesById.values()).filter(
    (v) => v.formatted === "needs indexer"
  ).length;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-lime-400/30 bg-lime-400/5 px-3 py-2 text-xs text-lime-200/90">
      <Info className="mt-0.5 size-3.5 shrink-0 text-lime-300" />
      <span>
        <span className="text-lime-300">{live}</span> of {total} parameters reading live via public RPC + ethers.js
        {indexer > 0 && (
          <>
            {" "}· <span className="text-orange-300">{indexer}</span> need event indexing (not wired)
          </>
        )}
      </span>
    </div>
  );
}

function OverviewSection({
  params,
  analysis,
  chains,
  chainFilter,
  setChainFilter,
  job,
  valuesById,
}: {
  params: Parameter[];
  analysis: NonNullable<JobRun["analysis"]>;
  chains: number[];
  chainFilter: number | "all";
  setChainFilter: (c: number | "all") => void;
  job: JobRun;
  valuesById: Map<string, EvaluatedValue>;
}) {
  if (params.length === 0) {
    return (
      <SectionPlaceholder
        title="No parameters selected"
        body="Open the build console and select at least one parameter to surface here."
      />
    );
  }

  return (
    <>
      <ChainFilter
        chains={chains}
        active={chainFilter}
        setActive={setChainFilter}
      />

      <KpiGrid params={params.slice(0, 8)} valuesById={valuesById} />

      {params.length > 8 && (
        <SecondaryParams params={params.slice(8)} valuesById={valuesById} />
      )}

      <RiskSummaryCard analysis={analysis} />

      <PositionsMonitorPlaceholder job={job} />

      {analysis.open_questions.length > 0 && (
        <OpenQuestionsCard questions={analysis.open_questions} />
      )}
    </>
  );
}

function ChainFilter({
  chains,
  active,
  setActive,
}: {
  chains: number[];
  active: number | "all";
  setActive: (c: number | "all") => void;
}) {
  if (chains.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => setActive("all")}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium ring-1",
          active === "all"
            ? "bg-foreground text-background ring-foreground"
            : "bg-muted/30 text-muted-foreground ring-border hover:text-foreground"
        )}
      >
        All Chains
      </button>
      {chains.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setActive(c)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium ring-1",
            active === c
              ? "bg-foreground text-background ring-foreground"
              : "bg-muted/30 text-muted-foreground ring-border hover:text-foreground"
          )}
        >
          {chainName(c)}
        </button>
      ))}
    </div>
  );
}

function KpiGrid({
  params,
  valuesById,
}: {
  params: Parameter[];
  valuesById: Map<string, EvaluatedValue>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {params.map((p) => (
        <KpiTile key={p.id} param={p} value={valuesById.get(p.id)} />
      ))}
    </div>
  );
}

const ICON_BY_SURFACE: Record<RiskSurface, React.ComponentType<{ className?: string }>> = {
  solvency: CircleDollarSign,
  liquidity: Droplet,
  oracle: Activity,
  market: TrendingUp,
  smart_contract: Cpu,
  governance: Users,
};

function KpiTile({
  param,
  value,
}: {
  param: Parameter;
  value?: EvaluatedValue;
}) {
  const Icon = ICON_BY_SURFACE[param.surface];
  const isLive =
    value &&
    (value.source === "rpc" ||
      value.source === "rpc_call" ||
      value.source === "metadata");
  const display =
    value?.formatted && value.formatted !== "—" ? value.formatted : "—";
  return (
    <div
      className="group relative flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/20"
      title={param.description}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="line-clamp-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {param.name}
        </span>
        <Icon className={cn("size-3.5 shrink-0", SURFACE_ACCENT[param.surface])} />
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "font-heading text-2xl font-semibold tracking-tight",
            isLive ? "text-foreground" : "text-foreground/40"
          )}
          title={typeof value?.value === "string" ? value.value : undefined}
        >
          {display}
        </span>
        {isLive ? null : (
          <span className="text-xs text-muted-foreground">{param.unit}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="line-clamp-1 font-mono text-[10px] text-muted-foreground/80">
          {param.source}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <span
            className={cn(
              "inline-block rounded px-1 py-0.5",
              SURFACE_BG[param.surface],
              SURFACE_ACCENT[param.surface]
            )}
          >
            {SURFACE_LABEL[param.surface]}
          </span>
          <span>· {param.cadence}</span>
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded bg-lime-400/15 px-1 py-0.5 text-lime-300">
              <span className="size-1 rounded-full bg-lime-400" />
              live
            </span>
          )}
          {param.needs_indexing && (
            <span className="rounded bg-orange-400/15 px-1 py-0.5 text-orange-300">
              indexer
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function SecondaryParams({
  params,
  valuesById,
}: {
  params: Parameter[];
  valuesById: Map<string, EvaluatedValue>;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <header className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-medium">Additional metrics</h2>
        <span className="text-xs text-muted-foreground">{params.length}</span>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {params.map((p) => {
          const v = valuesById.get(p.id);
          const isLive =
            v && (v.source === "rpc" || v.source === "rpc_call" || v.source === "metadata");
          return (
            <div
              key={p.id}
              className="flex items-start gap-2 rounded-md bg-muted/20 p-2.5 text-xs ring-1 ring-border"
              title={p.description}
            >
              <span
                className={cn(
                  "mt-0.5 inline-block size-2 shrink-0 rounded-full",
                  SURFACE_ACCENT[p.surface]
                )}
              />
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-foreground">{p.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  {p.source}
                </span>
              </div>
              <span
                className={cn(
                  "shrink-0 font-mono text-[11px]",
                  isLive ? "text-foreground" : "text-foreground/40"
                )}
              >
                {v?.formatted ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RiskSummaryCard({
  analysis,
}: {
  analysis: NonNullable<JobRun["analysis"]>;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="flex items-center gap-2">
        <ShieldAlert className="size-4 text-rose-300" />
        <h2 className="font-heading text-base font-medium">Risk surface</h2>
        <span className="ml-auto rounded-full bg-lime-400/15 px-2.5 py-0.5 text-[10px] font-medium text-lime-300 ring-1 ring-lime-400/30">
          confidence {analysis.confidence.toFixed(2)}
        </span>
      </header>
      <p className="text-sm leading-6 text-foreground/90">
        {analysis.risk_summary}
      </p>
    </section>
  );
}

function PositionsMonitorPlaceholder({ job }: { job: JobRun }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-medium">
          Positions Monitor
        </h2>
        <div className="flex items-center gap-1 rounded-lg bg-muted/30 p-1 ring-1 ring-border">
          {["Health Factor", "Current PnL", "Leverage Exposure"].map(
            (tab, i) => (
              <span
                key={tab}
                className={cn(
                  "cursor-default rounded-md px-2.5 py-1 text-xs",
                  i === 0
                    ? "bg-foreground text-background"
                    : "text-muted-foreground"
                )}
              >
                {tab}
              </span>
            )
          )}
        </div>
      </header>
      <div className="overflow-hidden rounded-lg ring-1 ring-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Wallet</th>
              <th className="px-3 py-2 text-left">Chain</th>
              <th className="px-3 py-2 text-left">Health Factor</th>
              <th className="px-3 py-2 text-left">Total Debt</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {job.source.contracts.slice(0, 1).map((c, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-3 font-mono text-muted-foreground">
                  {shortAddress(c.address)}
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-md bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border">
                    {chainName(c.chainId)}
                  </span>
                </td>
                <td className="px-3 py-3 text-foreground/40">—</td>
                <td className="px-3 py-3 text-foreground/40">—</td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border">
                    awaiting wiring
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          Click any row to expand · Sorted by Health Factor ascending
        </span>
        <div className="flex items-center gap-2">
          <Legend color="bg-rose-400" label="Liquidatable" />
          <Legend color="bg-orange-400" label="Critical" />
          <Legend color="bg-cyan-400" label="Track" />
          <Legend color="bg-violet-400" label="LP" />
          <Legend color="bg-lime-400" label="aToken" />
          <Legend color="bg-foreground" label="Cash" />
        </div>
      </footer>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("size-1.5 rounded-full", color)} />
      {label}
    </span>
  );
}

function FilteredParams({
  title,
  params,
  valuesById,
  empty,
}: {
  title: string;
  params: Parameter[];
  valuesById: Map<string, EvaluatedValue>;
  empty: string;
}) {
  if (params.length === 0) {
    return <SectionPlaceholder title={title} body={empty} />;
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-base font-medium">{title}</h2>
      <KpiGrid params={params} valuesById={valuesById} />
    </section>
  );
}

function RiskExplorerSection({
  params,
  analysis,
}: {
  params: Parameter[];
  analysis: NonNullable<JobRun["analysis"]>;
}) {
  const grouped = useMemo(() => {
    const map = new Map<RiskSurface, Parameter[]>();
    for (const p of params) {
      const arr = map.get(p.surface) ?? [];
      arr.push(p);
      map.set(p.surface, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [params]);

  return (
    <div className="flex flex-col gap-4">
      <RiskSummaryCard analysis={analysis} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {grouped.map(([surface, arr]) => (
          <section
            key={surface}
            className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <header className="flex items-center justify-between">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                  SURFACE_BG[surface],
                  SURFACE_ACCENT[surface]
                )}
              >
                {SURFACE_LABEL[surface]}
                <span className="opacity-70">· {arr.length}</span>
              </span>
            </header>
            <ul className="flex flex-col gap-1">
              {arr.map((p) => (
                <li key={p.id} className="flex items-start gap-2 text-xs">
                  <ArrowUpRight className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-foreground">{p.name}</span>
                    <span className="text-[11px] leading-4 text-muted-foreground">
                      {p.description}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function AlertsSection({ params }: { params: Parameter[] }) {
  const alerts = params.slice(0, 6).map((p) => ({
    id: p.id,
    name: p.name,
    surface: p.surface,
    threshold:
      p.unit === "%"
        ? "> 80%"
        : p.unit === "x"
          ? "> 1.0x"
          : p.unit === "USD"
            ? "< $0"
            : "anomaly",
    cadence: p.cadence,
  }));
  if (alerts.length === 0) {
    return (
      <SectionPlaceholder
        title="No alerts configured"
        body="Once parameters are wired live, default thresholds will be derived from the contract state."
      />
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="flex items-center gap-2">
        <Zap className="size-4 text-lime-300" />
        <h2 className="font-heading text-base font-medium">Default alerts</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          derived from your fetch plan
        </span>
      </header>
      <ul className="flex flex-col gap-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 p-3 ring-1 ring-border"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-4 text-amber-300" />
              <div className="flex flex-col">
                <span className="text-sm text-foreground">{a.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  Threshold {a.threshold} · checked {a.cadence}
                </span>
              </div>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
                SURFACE_BG[a.surface],
                SURFACE_ACCENT[a.surface]
              )}
            >
              {SURFACE_LABEL[a.surface]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OpenQuestionsCard({ questions }: { questions: string[] }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="flex items-center gap-2">
        <LineChart className="size-4 text-amber-300" />
        <h2 className="font-heading text-sm font-medium">Open questions</h2>
      </header>
      <ul className="space-y-1.5 text-sm leading-6 text-muted-foreground">
        {questions.map((q, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-amber-300">·</span>
            <span>{q}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <h2 className="font-heading text-base font-medium">{title}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
    </section>
  );
}

function countBySection(params: Parameter[]): Record<SectionId, number> {
  return {
    overview: params.length,
    positions: 0,
    liquidations: params.filter(
      (p) =>
        p.surface === "solvency" ||
        /liquidat|bad.?debt|hf|health/i.test(p.name)
    ).length,
    risk: params.length,
    oracles: params.filter((p) => p.surface === "oracle").length,
    whales: params.filter((p) =>
      /top.?n|concentration|whale|hhi/i.test(p.name + p.description)
    ).length,
    alerts: Math.min(params.length, 6),
  };
}
