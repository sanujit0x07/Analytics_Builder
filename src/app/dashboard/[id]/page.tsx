import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <Link
        href={`/jobs/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to build console
      </Link>
      <div className="space-y-3">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 text-xs font-medium text-lime-300">
          <Sparkles className="size-3" />
          Generated dashboard · {id}
        </span>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Dashboard renderer coming next
        </h1>
        <p className="text-muted-foreground">
          KPI grid + positions monitor + risk panels — wired live to contracts
          via ethers.js v6 + multicall3, themed with the protocol&apos;s design
          tokens. Building this view next.
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/jobs/${id}`}
          className={buttonVariants({ size: "lg" }) + " bg-lime-400 text-black hover:bg-lime-400/90"}
        >
          Open build console
        </Link>
      </div>
    </div>
  );
}
