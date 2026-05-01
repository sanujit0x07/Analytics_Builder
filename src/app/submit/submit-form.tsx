"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  FileArchive,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ADDRESS_REGEX, SUPPORTED_CHAINS } from "@/lib/chains";

type BrandMode = "auto" | "manual" | "skip";
type ContractRow = { name: string; address: string; chainId: number };

const EMPTY_CONTRACT: ContractRow = { name: "", address: "", chainId: 1 };

export function SubmitForm() {
  const router = useRouter();
  const [protocol, setProtocol] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");
  const [bundle, setBundle] = useState<File | null>(null);
  const [contracts, setContracts] = useState<ContractRow[]>([
    { ...EMPTY_CONTRACT },
  ]);
  const [brandMode, setBrandMode] = useState<BrandMode>("auto");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandPrimary, setBrandPrimary] = useState("");
  const [themeMode, setThemeMode] = useState<"dark" | "light" | "both">("dark");
  const [submitting, setSubmitting] = useState(false);

  const isValid =
    protocol.trim().length > 0 &&
    contracts.length > 0 &&
    contracts.every(
      (c) => ADDRESS_REGEX.test(c.address) && c.name.trim().length > 0
    ) &&
    bundle !== null;

  function setContractAt(i: number, patch: Partial<ContractRow>) {
    setContracts((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    );
  }

  async function onSubmit() {
    if (!isValid) {
      toast.error(
        "Upload a project ZIP, add a protocol name, and at least one valid contract."
      );
      return;
    }
    setSubmitting(true);
    const form = new FormData();
    form.set("protocol", protocol);
    form.set("websiteUrl", websiteUrl);
    form.set("description", description);
    form.set("brandMode", brandMode);
    form.set("brandLogoUrl", brandLogoUrl);
    form.set("brandPrimary", brandPrimary);
    form.set("themeMode", themeMode);
    form.set("contracts", JSON.stringify(contracts));
    if (bundle) form.set("bundle", bundle);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        id?: string;
        error?: string;
        scan?: { abis: number; sources: number; layout: string };
      };
      if (!res.ok || !data.id) {
        toast.error(data.error ?? "Submission failed");
        setSubmitting(false);
        return;
      }
      const layoutLabel = data.scan?.layout ?? "unknown";
      toast.success(
        `Bundle scanned — ${data.scan?.abis ?? 0} ABIs, ${data.scan?.sources ?? 0} source files (${layoutLabel})`
      );
      router.push(`/jobs/${data.id}`);
    } catch (err) {
      toast.error(`Network error: ${(err as Error).message}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-lime-400" />
          <span className="font-heading text-base font-semibold tracking-tight">
            Analytics Builder
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Cancel
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <div className="space-y-2">
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 text-xs font-medium text-lime-300">
            <Sparkles className="size-3" />
            Submit a protocol
          </span>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Build your dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload ABIs and source, list deployed contracts on EVM chains, and
            choose a brand input. We classify the protocol, derive metrics +
            risk surfaces, and wire a live dashboard via ethers.js v6 +
            multicall3.
          </p>
        </div>

        <Section
          title="Protocol details"
          subtitle="Used in metadata and (if no manual brand) for auto-extracting brand tokens."
        >
          <Field label="Protocol name" htmlFor="protocol" required>
            <Input
              id="protocol"
              placeholder="Aave V3"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
            />
          </Field>
          <Field
            label="Website URL"
            htmlFor="website"
            hint="Used for brand auto-extract when selected below."
          >
            <Input
              id="website"
              type="url"
              placeholder="https://app.aave.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
          </Field>
          <Field
            label="Description"
            htmlFor="description"
            hint="Optional — free text or a docs link to ground classification."
          >
            <Textarea
              id="description"
              placeholder="Pooled lending, isolated mode, Chainlink oracles…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </Section>

        <Section
          title={
            <>
              Contracts <span className="text-lime-400">*</span>
            </>
          }
          subtitle="The deployed addresses of YOUR contracts on-chain — this is where ethers.js will read from. If you deployed via Foundry, look in broadcast/<Script>/<chainId>/run-latest.json. One row per contract; add more for multi-chain."
        >
          <div className="flex flex-col gap-2">
            {contracts.map((row, i) => (
              <ContractRowFields
                key={i}
                row={row}
                onChange={(patch) => setContractAt(i, patch)}
                onRemove={
                  contracts.length > 1
                    ? () => setContracts((rows) => rows.filter((_, idx) => idx !== i))
                    : undefined
                }
              />
            ))}
            <button
              type="button"
              onClick={() =>
                setContracts((rows) => [...rows, { ...EMPTY_CONTRACT }])
              }
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Add contract
            </button>
          </div>
        </Section>

        <Section
          title={
            <>
              Project source <span className="text-lime-400">*</span>
            </>
          }
          subtitle="Drop a zipped Foundry / Hardhat project, OR a single .sol / .vy file."
          info={
            <div className="flex flex-col gap-2">
              <div>
                <span className="font-heading text-foreground">ZIP (recommended)</span>
                <p className="mt-1 text-muted-foreground">
                  Full project context — multiple contracts, imports, full ABIs. Richer analysis and the dashboard can read live state via ethers.js calls (e.g. <span className="font-mono">Pool.totalSupply()</span>).
                </p>
              </div>
              <div className="border-t border-border/60 pt-2">
                <span className="font-heading text-foreground">Single .sol / .vy</span>
                <p className="mt-1 text-muted-foreground">
                  Faster for quick prototyping but limits live values to what doesn&apos;t need an ABI: ETH balance, deployed bytecode hash, and chain ID. Function-call parameters will show <span className="font-mono">—</span>.
                </p>
              </div>
            </div>
          }
        >
          <BundleDropzone bundle={bundle} onBundle={setBundle} />
        </Section>

        <Section
          title="Brand"
          subtitle="Auto-extract from your site, fill manually, or skip and use the default theme."
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <BrandModeChip
              active={brandMode === "auto"}
              onClick={() => setBrandMode("auto")}
              label="Auto-extract"
              hint="From website URL"
            />
            <BrandModeChip
              active={brandMode === "manual"}
              onClick={() => setBrandMode("manual")}
              label="Manual"
              hint="Tokens + logo"
            />
            <BrandModeChip
              active={brandMode === "skip"}
              onClick={() => setBrandMode("skip")}
              label="Use defaults"
              hint="Neutral fallback"
            />
          </div>

          {brandMode === "auto" && (
            <Field
              label="Logo URL"
              htmlFor="logoUrl"
              hint="Optional — falls back to favicon scraping."
            >
              <Input
                id="logoUrl"
                type="url"
                placeholder="https://aave.com/logo.svg"
                value={brandLogoUrl}
                onChange={(e) => setBrandLogoUrl(e.target.value)}
              />
            </Field>
          )}

          {brandMode === "manual" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Primary color (hex)" htmlFor="primary">
                <Input
                  id="primary"
                  placeholder="#A3E635"
                  value={brandPrimary}
                  onChange={(e) => setBrandPrimary(e.target.value)}
                />
              </Field>
              <Field label="Theme mode" htmlFor="themeMode">
                <Select
                  value={themeMode}
                  onValueChange={(v) =>
                    setThemeMode(v as "dark" | "light" | "both")
                  }
                >
                  <SelectTrigger id="themeMode" className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
        </Section>

        <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-xl border border-border/60 bg-card/95 p-3 backdrop-blur ring-1 ring-foreground/5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {!isValid ? (
              <span>
                Missing:{" "}
                <span className="text-foreground">
                  {missingFields(protocol, bundle, contracts).join(" · ")}
                </span>
              </span>
            ) : (
              <span>
                Ready —{" "}
                <span className="text-foreground">{contracts.length}</span>{" "}
                contract(s),{" "}
                <span className="text-foreground">
                  {bundle ? bundle.name : "—"}
                </span>
              </span>
            )}
          </div>
          <Button
            disabled={!isValid || submitting}
            onClick={onSubmit}
            className="bg-lime-400 text-black hover:bg-lime-400/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Queuing…
              </>
            ) : (
              <>
                Start build
                <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}

function missingFields(
  protocol: string,
  bundle: File | null,
  contracts: ContractRow[]
): string[] {
  const out: string[] = [];
  if (!protocol.trim()) out.push("protocol name");
  if (!bundle) out.push("project ZIP");
  const validRows = contracts.filter(
    (c) => c.name.trim() && ADDRESS_REGEX.test(c.address)
  );
  if (validRows.length === 0) out.push("1+ valid contract (name + 0x address)");
  return out;
}

function Section({
  title,
  subtitle,
  info,
  children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  info?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 font-heading text-base font-medium">
          {title}
          {info && <InfoTooltip>{info}</InfoTooltip>}
        </h2>
        {subtitle && (
          <p className="text-xs leading-5 text-muted-foreground">{subtitle}</p>
        )}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function InfoTooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="More info"
        className="flex size-4 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground"
      >
        <Info className="size-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-full z-20 mt-2 w-80 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-xs font-normal leading-5 text-popover-foreground opacity-0 shadow-xl ring-1 ring-foreground/5 transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
        {required && <span className="ml-1 text-lime-400">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ContractRowFields({
  row,
  onChange,
  onRemove,
}: {
  row: ContractRow;
  onChange: (patch: Partial<ContractRow>) => void;
  onRemove?: () => void;
}) {
  const addressOk = row.address === "" || ADDRESS_REGEX.test(row.address);
  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-muted/20 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_auto]">
      <Input
        placeholder="Name (e.g. Pool)"
        value={row.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <Input
        placeholder="0x…"
        value={row.address}
        onChange={(e) => onChange({ address: e.target.value })}
        aria-invalid={!addressOk}
        className={cn("font-mono", !addressOk && "ring-destructive/40")}
      />
      <Select
        value={String(row.chainId)}
        onValueChange={(v) => onChange({ chainId: Number(v) })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Chain" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Mainnet</SelectLabel>
            {SUPPORTED_CHAINS.filter((c) => !c.testnet).map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                <span>{c.name}</span>
                <span className="text-muted-foreground"> · {c.id}</span>
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Testnet</SelectLabel>
            {SUPPORTED_CHAINS.filter((c) => c.testnet).map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                <span>{c.name}</span>
                <span className="text-muted-foreground"> · {c.id}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {onRemove ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Remove contract"
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : (
        <span className="size-7" />
      )}
    </div>
  );
}

function BundleDropzone({
  bundle,
  onBundle,
}: {
  bundle: File | null;
  onBundle: (next: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function accept(file: File) {
    const lower = file.name.toLowerCase();
    const ok =
      lower.endsWith(".zip") ||
      lower.endsWith(".sol") ||
      lower.endsWith(".vy") ||
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed";
    if (!ok) {
      toast.error("Supported: .zip, .sol, .vy");
      return;
    }
    onBundle(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) accept(f);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) accept(f);
    e.target.value = "";
  }

  if (bundle) {
    const lower = bundle.name.toLowerCase();
    const isZip = lower.endsWith(".zip");
    const kindLabel = isZip
      ? "ZIP project"
      : lower.endsWith(".vy")
        ? "Vyper file"
        : "Solidity file";
    return (
      <div className="flex items-center gap-3 rounded-lg border border-lime-400/40 bg-lime-400/5 px-3 py-3 ring-1 ring-lime-400/20">
        <div className="flex size-10 items-center justify-center rounded-full bg-lime-400/15 text-lime-300 ring-1 ring-lime-400/40">
          <FileArchive className="size-4" />
        </div>
        <div className="flex flex-1 flex-col">
          <span className="font-heading text-sm font-medium text-foreground">
            {bundle.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {(bundle.size / 1024).toFixed(1)} KB · {kindLabel} · ready to upload
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onBundle(null)}
          aria-label="Remove bundle"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-10 text-center transition-colors hover:border-foreground/30 hover:bg-muted/30",
        drag && "border-lime-400/70 bg-lime-400/5"
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted/40 ring-1 ring-border">
        <FileArchive className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-heading text-sm font-medium">
          Drop a <span className="font-mono">.zip</span> /{" "}
          <span className="font-mono">.sol</span> /{" "}
          <span className="font-mono">.vy</span>
        </span>
        <span className="text-xs text-muted-foreground">
          Zipped Foundry / Hardhat project (with ABIs), OR a single
          Solidity / Vyper file · click to browse
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,.sol,.vy,application/zip,application/x-zip-compressed,text/plain"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}

function BrandModeChip({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-lg border bg-muted/20 px-3 py-2.5 text-left transition-colors",
        active
          ? "border-lime-400/60 bg-lime-400/10 ring-1 ring-lime-400/30"
          : "border-border hover:border-foreground/30 hover:bg-muted/30"
      )}
    >
      <span
        className={cn(
          "font-heading text-sm font-medium",
          active ? "text-lime-300" : "text-foreground"
        )}
      >
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}
