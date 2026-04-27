import Link from "next/link";
import { ArrowRight, Boxes, Palette, Plug } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArbitrumLogo,
  BaseLogo,
  EthereumLogo,
  OptimismLogo,
  PolygonLogo,
  ScrollLogo,
} from "@/components/chain-logos";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-lime-400" />
          <span className="font-heading text-base font-semibold tracking-tight">
            Analytics Builder
          </span>
        </div>
        <nav className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/jobs/demo-aave-v3" className="hover:text-foreground">
            Demo build
          </Link>
          <Link href="/dashboard/demo-aave-v3" className="hover:text-foreground">
            Demo dashboard
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-24">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 text-xs font-medium text-lime-300">
              <EthereumLogo className="size-3 text-lime-300" />
              EVM-only · Solidity / Vyper
            </span>
            <h1 className="font-heading text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Auto-dashboards for any
              <br />
              on-chain protocol.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Submit your contracts, ABIs, and brand. Get a production-grade,
              on-brand risk and analytics dashboard wired live to your contracts
              via ethers.js — no indexer, no glue code.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/submit"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-lime-400 text-black hover:bg-lime-400/90"
                )}
              >
                Build my dashboard
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/jobs/demo-aave-v3"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                Watch a sample build
              </Link>
            </div>
          </div>
          <div className="relative hidden md:block">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,oklch(0.92_0.18_122/_0.18),transparent_60%)]" />
            <EthereumLogo className="mx-auto size-64 text-foreground/85 drop-shadow-[0_0_32px_oklch(0.92_0.18_122/_0.25)]" />
          </div>
        </div>

        <ChainStrip />

        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<Boxes className="size-4 text-lime-400" />}
            title="Classify"
            body="Detect archetype (lending, perps, AMM, CDP) from source. Extract canonical metrics + risk surfaces grounded in your code."
          />
          <FeatureCard
            icon={<Plug className="size-4 text-lime-400" />}
            title="Wire"
            body="Generate ethers.js v6 + multicall3 fetch plans. Proxy-aware (EIP-1967 / Beacon / Diamond) with runtime ABI resolution."
          />
          <FeatureCard
            icon={<Palette className="size-4 text-lime-400" />}
            title="Theme"
            body="Auto-extract brand from your site (or upload tokens). WCAG-AA verified, colorblind-safe charts, native to your protocol."
          />
        </div>
      </main>

      <footer className="border-t border-border/60 px-6 py-6 text-xs text-muted-foreground">
        Supports Ethereum + EVM L2s (Arbitrum, Optimism, Base, Polygon, BNB,
        Scroll, zkSync, Linea, Blast, Mantle).
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-heading text-sm font-medium">{title}</span>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function ChainStrip() {
  const chains = [
    { name: "Ethereum", Logo: EthereumLogo },
    { name: "Arbitrum", Logo: ArbitrumLogo },
    { name: "Optimism", Logo: OptimismLogo },
    { name: "Base", Logo: BaseLogo },
    { name: "Polygon", Logo: PolygonLogo },
    { name: "Scroll", Logo: ScrollLogo },
  ];
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Built for the EVM ecosystem
        </span>
        <span className="text-[11px] text-muted-foreground">
          + Sepolia, Base Sepolia, Arbitrum Sepolia testnets
        </span>
      </div>
      <ul className="flex flex-wrap items-center gap-x-8 gap-y-4">
        {chains.map(({ name, Logo }) => (
          <li
            key={name}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Logo className="size-5 text-foreground/80" />
            <span>{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
