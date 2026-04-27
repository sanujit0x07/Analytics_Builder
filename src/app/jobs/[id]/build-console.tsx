"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
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
  Square,
  Trash2,
  XCircle,
} from "lucide-react";
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
            <Overview job={job} />
          </TabsContent>
          <TabsContent value="classification" className="py-6">
            <Placeholder
              title="Archetype: Lending (pooled, isolated mode)"
              body="Confidence 0.94 — derived from Pool.sol::supply / withdraw / borrow / repay / liquidationCall, ReserveConfiguration, and PriceOracleSentinel. Detail panel coming next."
            />
          </TabsContent>
          <TabsContent value="fetch" className="py-6">
            <Placeholder
              title={`${job.stats.fetchCalls} fetch calls across ${new Set(job.source.contracts.map((c) => c.chainId)).size} chains`}
              body="Multicall3 batches, queryFilter configs, and refresh cadences will render here as a per-parameter table."
            />
          </TabsContent>
          <TabsContent value="tokens" className="py-6">
            <Placeholder
              title="Design tokens — auto_extracted from app.aave.com"
              body="Palette / typography / radius / shadow inspector will render here once the brand explorer is wired in."
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

function Overview({ job }: { job: JobRun }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BuildSummary job={job} />
      <BuildProgress job={job} />
      <SourceCard job={job} />
      <HowItWorksCard />
    </div>
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
