"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileCode2,
  GaugeCircle,
  Layers,
  Loader2,
  Palette,
  Play,
  Plug,
  RefreshCw,
  Search,
  ShieldAlert,
  Square,
  Trash2,
  XCircle,
} from "lucide-react";
import type { Parameter, RiskSurface } from "@/lib/claude-pipeline";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  chainName,
  type JobRun,
  type Phase,
  type PhaseId,
  type PhaseStatus,
} from "@/lib/mock-job";
import { formatDateTime, formatDuration, shortAddress } from "@/lib/format";

const PHASE_ICONS: Record<PhaseId, React.ComponentType<{ className?: string }>> = {
  parsing: FileCode2,
  classification: Search,
  extraction: Layers,
  fetch_plan: Plug,
  branding: Palette,
  rendering: GaugeCircle,
};

export function BuildConsole({ initialJob }: { initialJob: JobRun }) {
  const [job, setJob] = useState<JobRun>(initialJob);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (job.status !== "running") return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as JobRun;
        if (!cancelled) setJob(next);
      } catch {
        // network blip — retry next tick
      }
    }, 700);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [job.status, job.id]);

  return (
    <div className="flex flex-1 flex-col">
      <Header job={job} />

      <div className="border-b border-border/60 px-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="h-10 -mb-px">
            <TabTrigger value="overview" icon={<Boxes className="size-3.5" />} label="Overview" />
            <TabTrigger value="classification" label="Classification" count={1} />
            <TabTrigger value="fetch" label="Fetch Plan" count={job.stats.fetchCalls} />
            <TabTrigger value="tokens" label="Design Tokens" count={42} />
            <TabTrigger value="logs" label="Logs" count={job.logs.length} />
          </TabsList>

          <TabsContent value="overview" className="py-6">
            <Overview job={job} setJob={setJob} />
          </TabsContent>
          <TabsContent value="classification" className="py-6">
            <ClassificationPanel job={job} />
          </TabsContent>
          <TabsContent value="fetch" className="py-6">
            <FetchPlanPanel job={job} />
          </TabsContent>
          <TabsContent value="tokens" className="py-6">
            <Placeholder
              title="Design tokens"
              body="Palette / typography / radius / shadow inspector will render here once the brand auto-extract step is wired in."
            />
          </TabsContent>
          <TabsContent value="logs" className="py-6">
            <LogStream job={job} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Header({ job }: { job: JobRun }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 px-6 py-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-lime-400" />
          <span className="font-heading text-base font-semibold tracking-tight">
            Analytics Builder
          </span>
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="font-heading text-base font-medium">
          {job.protocol}
        </span>
        <RunSelector job={job} />
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" className="bg-lime-400 text-black hover:bg-lime-400/90">
          <Play className="size-3.5" />
          Start build
        </Button>
        <Button size="sm" variant="outline" disabled={job.status !== "running"}>
          <Square className="size-3.5" />
          Stop
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Delete run">
          <Trash2 className="size-3.5" />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Re-run">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>
    </header>
  );
}

function RunSelector({ job }: { job: JobRun }) {
  const current = job.history.find((h) => h.id === job.id) ?? job.history[0];
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-md border border-lime-400/40 bg-lime-400/10 px-3 py-1.5 text-xs font-medium text-lime-300 hover:bg-lime-400/15"
    >
      <span className="size-1.5 rounded-full bg-lime-400" />
      <span>{current.startedAt} —</span>
      <span className="capitalize">{current.status}</span>
      <ChevronDown className="size-3.5 opacity-60" />
    </button>
  );
}

function TabTrigger({
  value,
  label,
  icon,
  count,
}: {
  value: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}) {
  return (
    <TabsTrigger value={value} className="gap-2">
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-foreground/80">
          {count}
        </span>
      )}
    </TabsTrigger>
  );
}

function Overview({
  job,
  setJob,
}: {
  job: JobRun;
  setJob: (j: JobRun) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BuildSummary job={job} />
        <BuildProgress job={job} />
        <SourceCard job={job} />
        <HowItWorksCard />
      </div>
      {job.status === "completed" && job.analysis && (
        <ParameterSelection job={job} setJob={setJob} />
      )}
      {job.status === "failed" && job.error && (
        <FailureCard error={job.error} />
      )}
    </div>
  );
}

function FailureCard({ error }: { error: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-destructive/5 p-5 ring-1 ring-destructive/30">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 text-destructive" />
        <h2 className="font-heading text-base font-medium text-destructive">
          Build failed
        </h2>
      </div>
      <p className="text-sm text-foreground/90">{error}</p>
      <p className="text-xs text-muted-foreground">
        Common causes: ANTHROPIC_API_KEY not set, ZIP missing src/ or contracts/, or the bundle exceeded the source cap.
      </p>
    </section>
  );
}

function BuildSummary({ job }: { job: JobRun }) {
  const phaseLabel = job.phases.find((p) => p.id === job.currentPhase)?.title ?? "—";
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="flex items-center justify-between">
        <h2 className="font-heading text-base font-medium">Build Summary</h2>
        <StatusPill status={job.status} />
      </header>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Stat
          icon={<Activity className="size-4 text-muted-foreground" />}
          label="Duration / Estimated"
          value={`${formatDuration(job.durationMs)} / ${formatDuration(job.estimatedMs)}`}
        />
        <Stat
          icon={<GaugeCircle className="size-4 text-muted-foreground" />}
          label="Phase"
          value={phaseLabel}
        />
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>Started: {formatDateTime(job.startedAt)}</span>
        {job.finishedAt && <span>Finished: {formatDateTime(job.finishedAt)}</span>}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-3">
        <StatTile color="lime" value={job.stats.parameters} label="Parameters" icon={<Search className="size-3.5" />} />
        <StatTile color="orange" value={job.stats.riskSurfaces} label="Risk Surfaces" icon={<Layers className="size-3.5" />} />
        <StatTile color="violet" value={job.stats.fetchCalls} label="Fetch Calls" icon={<Plug className="size-3.5" />} />
      </div>
    </section>
  );
}

function BuildProgress({ job }: { job: JobRun }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="flex items-center justify-between">
        <h2 className="font-heading text-base font-medium">Build Progress</h2>
      </header>
      <ol className="relative flex flex-col">
        {job.phases.map((phase, i) => (
          <PhaseRow
            key={phase.id}
            phase={phase}
            isLast={i === job.phases.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

function PhaseRow({ phase, isLast }: { phase: Phase; isLast: boolean }) {
  const Icon = PHASE_ICONS[phase.id];
  return (
    <li className="flex gap-4 pb-4 last:pb-0">
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-full ring-1 transition-colors",
            phase.status === "done" &&
              "bg-lime-400/10 text-lime-300 ring-lime-400/40",
            phase.status === "running" &&
              "bg-lime-400/10 text-lime-300 ring-lime-400/60",
            phase.status === "pending" &&
              "bg-muted/40 text-muted-foreground ring-border",
            phase.status === "failed" &&
              "bg-destructive/10 text-destructive ring-destructive/40"
          )}
        >
          <Icon className="size-4" />
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-px flex-1 transition-colors",
              phase.status === "done" ? "bg-lime-400/40" : "bg-border"
            )}
          />
        )}
      </div>
      <div className="flex flex-1 items-start justify-between gap-4 pt-1">
        <div className="space-y-1">
          <div
            className={cn(
              "font-heading text-sm font-medium",
              phase.status === "pending"
                ? "text-muted-foreground"
                : phase.status === "failed"
                  ? "text-destructive"
                  : "text-foreground",
              phase.status === "done" && "text-lime-300"
            )}
          >
            {phase.title}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {phase.description}
          </p>
        </div>
        <PhaseStateIndicator status={phase.status} />
      </div>
    </li>
  );
}

function PhaseStateIndicator({ status }: { status: PhaseStatus }) {
  if (status === "done") return <CheckCircle2 className="mt-1 size-5 text-lime-400" />;
  if (status === "running")
    return <Loader2 className="mt-1 size-5 animate-spin text-lime-300" />;
  if (status === "failed") return <XCircle className="mt-1 size-5 text-destructive" />;
  return <Circle className="mt-1 size-5 text-muted-foreground/50" />;
}

function StatusPill({ status }: { status: JobRun["status"] }) {
  const map: Record<
    JobRun["status"],
    { label: string; cls: string; icon: React.ReactNode }
  > = {
    completed: {
      label: "Completed",
      cls: "bg-lime-400/15 text-lime-300 ring-lime-400/30",
      icon: <CheckCircle2 className="size-3" />,
    },
    running: {
      label: "Running",
      cls: "bg-blue-400/15 text-blue-300 ring-blue-400/30",
      icon: (
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400/60" />
          <span className="relative inline-flex size-2 rounded-full bg-blue-400" />
        </span>
      ),
    },
    queued: {
      label: "Queued",
      cls: "bg-muted text-muted-foreground ring-border",
      icon: <Circle className="size-3" />,
    },
    failed: {
      label: "Failed",
      cls: "bg-destructive/15 text-destructive ring-destructive/30",
      icon: <XCircle className="size-3" />,
    },
  };
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1",
        s.cls
      )}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex size-7 items-center justify-center rounded-md bg-muted/40 ring-1 ring-border">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-sm text-foreground">{value}</span>
      </div>
    </div>
  );
}

function StatTile({
  color,
  value,
  label,
  icon,
}: {
  color: "lime" | "orange" | "violet";
  value: number | string;
  label: string;
  icon: React.ReactNode;
}) {
  const cls =
    color === "lime"
      ? "text-lime-300"
      : color === "orange"
        ? "text-orange-300"
        : "text-violet-300";
  return (
    <div className="flex flex-col items-start gap-1 rounded-lg bg-muted/30 p-3 ring-1 ring-border">
      <span className={cn("font-heading text-2xl font-semibold", cls)}>
        {value}
      </span>
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </span>
    </div>
  );
}

function SourceCard({ job }: { job: JobRun }) {
  const chains = Array.from(new Set(job.source.contracts.map((c) => c.chainId)));
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="flex items-center justify-between">
        <h2 className="font-heading text-base font-medium">Build Source</h2>
        <Badge variant="outline" className="font-normal">
          brand: {job.source.brandSource.replace("_", " ")}
        </Badge>
      </header>

      <div className="space-y-3">
        <div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            ABIs ({job.source.abis.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {job.source.abis.map((abi) => (
              <span
                key={abi.name}
                className="inline-flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs ring-1 ring-border"
              >
                <FileCode2 className="size-3 text-muted-foreground" />
                {abi.name}
                <span className="text-muted-foreground">· {abi.size}</span>
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Contracts ({job.source.contracts.length}) · Chains: {chains.map(chainName).join(", ")}
          </div>
          <div className="overflow-hidden rounded-lg ring-1 ring-border">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-border">
                {job.source.contracts.map((c) => (
                  <tr key={`${c.chainId}-${c.address}`} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {shortAddress(c.address)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="secondary" className="font-normal">
                        {chainName(c.chainId)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksCard() {
  const steps = [
    {
      n: 1,
      text: 'Click "Start build" to analyze your contracts, ABIs, and brand inputs with AI.',
    },
    {
      n: 2,
      text: "We classify the protocol archetype, extract metrics + risk surfaces, and emit a fetch plan.",
    },
    {
      n: 3,
      text: "Brand tokens are extracted and verified for WCAG AA contrast.",
    },
    {
      n: 4,
      text: "The dashboard renders live at /dashboard/[id] — wired via ethers.js v6 + multicall3.",
    },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <header>
        <h2 className="font-heading text-base font-medium">How it works</h2>
      </header>
      <ol className="space-y-3 text-sm leading-6">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-3">
            <span className="font-heading text-lime-300">{s.n}.</span>
            <span className="text-muted-foreground">{s.text}</span>
          </li>
        ))}
      </ol>
      <div className="mt-2">
        <Link
          href="/dashboard/demo-aave-v3"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          View generated dashboard
        </Link>
      </div>
    </section>
  );
}

function LogStream({ job }: { job: JobRun }) {
  return (
    <div className="overflow-hidden rounded-xl bg-black/60 p-4 font-mono text-xs ring-1 ring-foreground/10">
      <div className="flex flex-col gap-1">
        {job.logs.map((line, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-muted-foreground/60">{line.ts}</span>
            <span
              className={cn(
                "w-12 uppercase",
                line.level === "info" && "text-lime-300",
                line.level === "warn" && "text-orange-300",
                line.level === "error" && "text-destructive"
              )}
            >
              {line.level}
            </span>
            <span className="w-28 text-violet-300/80">[{line.phase}]</span>
            <span className="flex-1 text-foreground/90">{line.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <h3 className="font-heading text-base font-medium">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

const SURFACE_LABEL: Record<RiskSurface, string> = {
  solvency: "Solvency",
  liquidity: "Liquidity",
  oracle: "Oracle",
  market: "Market",
  smart_contract: "Smart contract",
  governance: "Governance",
};

const SURFACE_COLOR: Record<RiskSurface, string> = {
  solvency: "text-rose-300 bg-rose-400/10 ring-rose-400/30",
  liquidity: "text-cyan-300 bg-cyan-400/10 ring-cyan-400/30",
  oracle: "text-amber-300 bg-amber-400/10 ring-amber-400/30",
  market: "text-violet-300 bg-violet-400/10 ring-violet-400/30",
  smart_contract: "text-fuchsia-300 bg-fuchsia-400/10 ring-fuchsia-400/30",
  governance: "text-lime-300 bg-lime-400/10 ring-lime-400/30",
};

function ParameterSelection({
  job,
  setJob,
}: {
  job: JobRun;
  setJob: (j: JobRun) => void;
}) {
  const analysis = job.analysis!;
  const [selected, setSelected] = useState<Set<string>>(
    new Set(job.selectedParamIds ?? analysis.parameters.map((p) => p.id))
  );
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<RiskSurface, Parameter[]>();
    for (const p of analysis.parameters) {
      const arr = map.get(p.surface) ?? [];
      arr.push(p);
      map.set(p.surface, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [analysis.parameters]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSurface(surface: RiskSurface, on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      for (const p of analysis.parameters) {
        if (p.surface !== surface) continue;
        if (on) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/select`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paramIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save selection");
        setSaving(false);
        return;
      }
      const next = { ...job, selectedParamIds: Array.from(selected) };
      setJob(next);
      toast.success(`Saved ${selected.size} parameter(s)`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-base font-medium">
            Select parameters for the dashboard
          </h2>
          <p className="text-xs text-muted-foreground">
            All {analysis.parameters.length} are selected by default. Untick anything you don&apos;t want surfaced. Grouped by risk surface.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            <span className="text-foreground">{selected.size}</span> /{" "}
            {analysis.parameters.length} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelected(new Set(analysis.parameters.map((p) => p.id)))}
          >
            Select all
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {grouped.map(([surface, params]) => (
          <SurfaceGroup
            key={surface}
            surface={surface}
            params={params}
            selected={selected}
            onToggle={toggle}
            onToggleAll={(on) => toggleSurface(surface, on)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="text-xs text-muted-foreground">
          {analysis.risk_summary && (
            <span className="line-clamp-2 max-w-2xl">
              <span className="text-foreground">Risk summary —</span>{" "}
              {analysis.risk_summary}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save selection"}
          </Button>
          <Link
            href={`/dashboard/${job.id}`}
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-lime-400 text-black hover:bg-lime-400/90"
            )}
          >
            Open dashboard
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function SurfaceGroup({
  surface,
  params,
  selected,
  onToggle,
  onToggleAll,
}: {
  surface: RiskSurface;
  params: Parameter[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (on: boolean) => void;
}) {
  const allOn = params.every((p) => selected.has(p.id));
  const someOn = !allOn && params.some((p) => selected.has(p.id));
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3 ring-1 ring-border">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
            SURFACE_COLOR[surface]
          )}
        >
          {SURFACE_LABEL[surface]}
          <span className="opacity-70">· {params.length}</span>
        </span>
        <button
          type="button"
          onClick={() => onToggleAll(!allOn)}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          {allOn ? "Clear group" : someOn ? "Select all" : "Select all"}
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {params.map((p) => (
          <li key={p.id}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/30",
                selected.has(p.id) && "bg-muted/30"
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => onToggle(p.id)}
                className="mt-0.5 size-3.5 accent-lime-400"
              />
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm text-foreground">{p.name}</span>
                <span className="text-[11px] leading-4 text-muted-foreground">
                  {p.description}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  {p.source} · {p.cadence} · {p.unit}
                  {p.needs_indexing && (
                    <span className="ml-1 rounded bg-orange-400/15 px-1 py-0.5 text-orange-300">
                      indexer
                    </span>
                  )}
                </span>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClassificationPanel({ job }: { job: JobRun }) {
  if (!job.analysis) {
    return (
      <Placeholder
        title="Classification pending"
        body="Claude is still analyzing the source. The archetype, sub-type, and confidence will appear here once classification completes."
      />
    );
  }
  const a = job.analysis;
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-lg font-medium capitalize">
            {a.archetype.replace(/_/g, " ")}
          </span>
          <span className="text-muted-foreground">— {a.subtype}</span>
          <span className="ml-auto inline-flex h-6 items-center rounded-full bg-lime-400/15 px-2.5 text-xs font-medium text-lime-300 ring-1 ring-lime-400/30">
            confidence {a.confidence.toFixed(2)}
          </span>
        </div>
        <p className="text-sm leading-6 text-foreground/90">{a.risk_summary}</p>
      </section>

      {a.open_questions.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h3 className="font-heading text-sm font-medium">Open questions</h3>
          <ul className="space-y-1.5 text-sm leading-6 text-muted-foreground">
            {a.open_questions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-amber-300">·</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FetchPlanPanel({ job }: { job: JobRun }) {
  if (!job.analysis) {
    return (
      <Placeholder
        title="Fetch plan pending"
        body="Per-parameter on-chain sources, cadence, and indexer requirements will render here once analysis completes."
      />
    );
  }
  const params = job.analysis.parameters;
  const live = params.filter((p) => !p.needs_indexing);
  const indexer = params.filter((p) => p.needs_indexing);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-md bg-lime-400/10 px-2.5 py-1 text-lime-300 ring-1 ring-lime-400/30">
          {live.length} live multicall3 reads
        </span>
        {indexer.length > 0 && (
          <span className="rounded-md bg-orange-400/10 px-2.5 py-1 text-orange-300 ring-1 ring-orange-400/30">
            {indexer.length} need event indexing
          </span>
        )}
      </header>
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Parameter</th>
              <th className="px-3 py-2 text-left">Surface</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Cadence</th>
              <th className="px-3 py-2 text-left">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {params.map((p) => (
              <tr key={p.id} className="hover:bg-muted/20">
                <td className="px-3 py-2 text-foreground">{p.name}</td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
                      SURFACE_COLOR[p.surface]
                    )}
                  >
                    {SURFACE_LABEL[p.surface]}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-muted-foreground">
                  {p.source}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{p.cadence}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {p.unit}
                  {p.needs_indexing && (
                    <span className="ml-1 rounded bg-orange-400/15 px-1 py-0.5 text-orange-300">
                      indexer
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
