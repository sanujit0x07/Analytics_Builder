import JSZip from "jszip";

export type AbiEntry = {
  name: string;
  chainId: number;
  address: string;
  abi: unknown[];
};

type AbiItem = { type: string; name?: string; inputs?: unknown[]; outputs?: unknown[]; stateMutability?: string };

function looksLikeAbi(value: unknown): value is AbiItem[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) => typeof item === "object" && item !== null && "type" in item
  );
}

export async function extractAbis(
  bundleBuffer: Buffer,
  contracts: { name: string; address: string; chainId: number }[]
): Promise<AbiEntry[]> {
  const zip = await JSZip.loadAsync(bundleBuffer);
  const wantedNames = new Set(contracts.map((c) => c.name));
  const found = new Map<string, unknown[]>();

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!path.toLowerCase().endsWith(".json")) continue;
    if (path.includes("/build-info/") || path.includes("/dbg.")) continue;

    // Heuristic: derive contract name from path
    // Foundry: out/<File>.sol/<Name>.json
    // Hardhat: artifacts/contracts/<File>.sol/<Name>.json
    const baseName = path.split("/").pop()?.replace(/\.json$/, "");
    if (!baseName) continue;

    const inFoundry = /(^|\/)out\//.test(path);
    const inHardhat = /(^|\/)artifacts\/contracts\//.test(path);
    const isAtRoot = !path.includes("/") || path.split("/").length <= 2;

    if (!inFoundry && !inHardhat && !isAtRoot) continue;
    if (!wantedNames.has(baseName)) continue;
    if (found.has(baseName)) continue;

    try {
      const raw = await entry.async("string");
      const parsed = JSON.parse(raw) as
        | { abi?: unknown }
        | unknown[]
        | Record<string, unknown>;
      let abi: unknown = null;
      if (Array.isArray(parsed)) {
        abi = parsed;
      } else if (typeof parsed === "object" && parsed !== null && "abi" in parsed) {
        abi = (parsed as { abi: unknown }).abi;
      }
      if (looksLikeAbi(abi)) {
        found.set(baseName, abi);
      }
    } catch {
      // skip unparseable
    }
  }

  return contracts.map((c) => ({
    name: c.name,
    chainId: c.chainId,
    address: c.address,
    abi: found.get(c.name) ?? [],
  }));
}
