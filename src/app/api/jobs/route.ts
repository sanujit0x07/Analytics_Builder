import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import JSZip from "jszip";
import { createJob } from "@/lib/job-store";
import { extractAbis } from "@/lib/abi-extract";

export const runtime = "nodejs";

type Layout =
  | "foundry"
  | "hardhat"
  | "abi-only"
  | "mixed"
  | "single-source"
  | "unknown";

type Scan = {
  abis: number;
  sources: number;
  layout: Layout;
  files: number;
  totalUncompressedBytes: number;
};

function isZipFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".zip");
}

function isSourceFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".sol") || lower.endsWith(".vy");
}

function looksLikeZipBytes(buf: Buffer): boolean {
  // ZIP local file header: 0x50 0x4B 0x03 0x04
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

const MAX_SNIFF_BYTES = 64 * 1024;

async function scanBundle(buf: Buffer): Promise<Scan> {
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
      { error: "Project source (.zip / .sol / .vy) is required" },
      { status: 400 }
    );
  }

  let bundleBuffer: Buffer;
  try {
    bundleBuffer = Buffer.from(await bundle.arrayBuffer());
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to read upload: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const isZip = isZipFilename(bundle.name) || looksLikeZipBytes(bundleBuffer);
  const isSource = !isZip && isSourceFilename(bundle.name);

  if (!isZip && !isSource) {
    return NextResponse.json(
      { error: "Unsupported file type. Use .zip, .sol, or .vy" },
      { status: 400 }
    );
  }

  let scan: Scan;
  if (isZip) {
    try {
      scan = await scanBundle(bundleBuffer);
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
  } else {
    // Single .sol / .vy file — synthesize a scan
    scan = {
      abis: 0,
      sources: 1,
      layout: "single-source",
      files: 1,
      totalUncompressedBytes: bundle.size,
    };
  }

  const id = nanoid(10);

  const contractAbis = isZip ? await extractAbis(bundleBuffer, contracts) : [];

  createJob(id, {
    protocol,
    websiteUrl,
    description,
    brandMode: (brandMode === "auto" || brandMode === "manual" ? brandMode : "skip") as
      | "auto"
      | "manual"
      | "skip",
    contracts,
    contractAbis,
    abiCount: scan.abis,
    sourceCount: scan.sources,
    layout: scan.layout,
    bundleName: bundle.name,
    bundleSize: bundle.size,
    bundleBuffer,
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
