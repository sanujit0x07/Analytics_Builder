import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import JSZip from "jszip";
import { createJob } from "@/lib/job-store";

export const runtime = "nodejs";

type Layout = "foundry" | "hardhat" | "abi-only" | "mixed" | "unknown";

type Scan = {
  abis: number;
  sources: number;
  layout: Layout;
  files: number;
  totalUncompressedBytes: number;
};

const MAX_SNIFF_BYTES = 64 * 1024;

async function scanBundle(file: File): Promise<Scan> {
  const buf = Buffer.from(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);

  let abis = 0;
  let sources = 0;
  let files = 0;
  let totalUncompressedBytes = 0;
  let hasFoundry = false;
  let hasHardhat = false;
  let hasAbiAtRoot = false;

  const entries = Object.entries(zip.files);

  for (const [path, entry] of entries) {
    if (entry.dir) continue;
    files++;
    const lower = path.toLowerCase();

    if (lower.endsWith(".sol") || lower.endsWith(".vy")) {
      sources++;
      continue;
    }

    if (!lower.endsWith(".json")) continue;

    const inFoundry = /(^|\/)out\//.test(path);
    const inHardhat = /(^|\/)artifacts\/contracts\//.test(path);

    if (inFoundry) {
      hasFoundry = true;
      abis++;
      continue;
    }
    if (inHardhat) {
      hasHardhat = true;
      abis++;
      continue;
    }

    // Sniff small JSON files at root for an ABI shape.
    // @ts-expect-error _data exists at runtime on jszip entries
    const uncompressed: number = entry._data?.uncompressedSize ?? 0;
    totalUncompressedBytes += uncompressed;
    if (uncompressed > 0 && uncompressed > MAX_SNIFF_BYTES) continue;

    try {
      const text = await entry.async("string");
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.type) {
        abis++;
        hasAbiAtRoot = true;
      } else if (Array.isArray(parsed?.abi)) {
        abis++;
        hasAbiAtRoot = true;
      }
    } catch {
      // not JSON or not an ABI; ignore
    }
  }

  let layout: Layout = "unknown";
  const flags = [hasFoundry, hasHardhat, hasAbiAtRoot].filter(Boolean).length;
  if (flags > 1) layout = "mixed";
  else if (hasFoundry) layout = "foundry";
  else if (hasHardhat) layout = "hardhat";
  else if (hasAbiAtRoot) layout = "abi-only";

  return { abis, sources, layout, files, totalUncompressedBytes };
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  }

  const protocol = String(form.get("protocol") ?? "").trim();
  const websiteUrl = String(form.get("websiteUrl") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const contractsJson = String(form.get("contracts") ?? "[]");
  const brandMode = String(form.get("brandMode") ?? "skip");
  const bundle = form.get("bundle");

  if (!protocol) {
    return NextResponse.json(
      { error: "Protocol name is required" },
      { status: 400 }
    );
  }

  let contracts: { name: string; address: string; chainId: number }[] = [];
  try {
    contracts = JSON.parse(contractsJson);
  } catch {
    return NextResponse.json(
      { error: "Invalid contracts payload" },
      { status: 400 }
    );
  }
  if (contracts.length === 0) {
    return NextResponse.json(
      { error: "At least one contract address is required" },
      { status: 400 }
    );
  }

  if (!(bundle instanceof File) || bundle.size === 0) {
    return NextResponse.json(
      { error: "Project bundle (.zip) is required" },
      { status: 400 }
    );
  }

  let scan: Scan;
  try {
    scan = await scanBundle(bundle);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to read ZIP: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (scan.sources === 0 && scan.abis === 0) {
    return NextResponse.json(
      {
        error:
          "No ABIs or Solidity sources found in the bundle. Make sure you zip from a built Foundry (out/) or Hardhat (artifacts/) project, or include the .sol files directly.",
      },
      { status: 400 }
    );
  }

  const id = nanoid(10);

  createJob(id, {
    protocol,
    websiteUrl,
    description,
    brandMode: (brandMode === "auto" || brandMode === "manual" ? brandMode : "skip") as
      | "auto"
      | "manual"
      | "skip",
    contracts,
    abiCount: scan.abis,
    sourceCount: scan.sources,
    layout: scan.layout,
    bundleName: bundle.name,
    bundleSize: bundle.size,
  });

  // eslint-disable-next-line no-console
  console.log("[/api/jobs] created", {
    id,
    protocol,
    contracts: contracts.length,
    bundle: { name: bundle.name, size: bundle.size },
    scan,
  });

  return NextResponse.json({ id, scan });
}
