import { ethers } from "ethers";
import type { Parameter } from "./claude-pipeline";
import { rpcFor } from "./rpc";
import { chainName } from "./mock-job";

export type EvaluatedValue = {
  paramId: string;
  value: string | number | null;
  formatted: string;
  source: "rpc" | "rpc_call" | "metadata" | "unsupported";
  error?: string;
};

type ContractEntry = {
  name: string;
  chainId: number;
  address: string;
  abi: unknown[];
};

const ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/;

function findContract(
  contracts: ContractEntry[],
  hint: string
): ContractEntry | undefined {
  // Try by name match first
  const byName = contracts.find((c) =>
    new RegExp(`\\b${c.name}\\b`).test(hint)
  );
  if (byName) return byName;
  // Try by address in the hint
  const addrMatch = hint.match(ADDRESS_REGEX);
  if (addrMatch) {
    return contracts.find(
      (c) => c.address.toLowerCase() === addrMatch[0].toLowerCase()
    );
  }
  return undefined;
}

function findFunctionInAbi(
  abi: unknown[],
  fnName: string
): { name: string; inputs: unknown[]; outputs: unknown[] } | undefined {
  for (const item of abi) {
    if (typeof item !== "object" || item === null) continue;
    const fn = item as { type?: string; name?: string; inputs?: unknown[]; outputs?: unknown[] };
    if (fn.type === "function" && fn.name === fnName) {
      return {
        name: fn.name,
        inputs: fn.inputs ?? [],
        outputs: fn.outputs ?? [],
      };
    }
  }
  return undefined;
}

function formatValue(value: unknown, unit: Parameter["unit"]): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "bigint") {
    if (unit === "USD") {
      const eth = Number(value) / 1e18;
      return `$${eth.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
    }
    return value.toString();
  }
  if (typeof value === "number") {
    if (unit === "%") return `${value.toFixed(2)}%`;
    if (unit === "x") return `${value.toFixed(2)}x`;
    return value.toLocaleString();
  }
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `[${value.length} items]`;
  return String(value);
}

async function evaluateOne(
  param: Parameter,
  contracts: ContractEntry[]
): Promise<EvaluatedValue> {
  if (param.needs_indexing) {
    return {
      paramId: param.id,
      value: null,
      formatted: "needs indexer",
      source: "unsupported",
    };
  }

  const contract = findContract(contracts, param.source);
  if (!contract) {
    return {
      paramId: param.id,
      value: null,
      formatted: "—",
      source: "unsupported",
      error: "no matching contract",
    };
  }

  const rpcUrl = rpcFor(contract.chainId);
  if (!rpcUrl) {
    return {
      paramId: param.id,
      value: null,
      formatted: "—",
      source: "unsupported",
      error: `no public RPC for chain ${contract.chainId}`,
    };
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  try {
    // Pattern: chain ID metadata
    if (/chain\s*id|deployment\s*chain|chain\s*metadata/i.test(param.source)) {
      return {
        paramId: param.id,
        value: contract.chainId,
        formatted: `${chainName(contract.chainId)} (${contract.chainId})`,
        source: "metadata",
      };
    }

    // Pattern: ETH balance (eth_getBalance)
    if (/eth_getBalance|getBalance/i.test(param.source)) {
      const bal = await provider.getBalance(contract.address);
      return {
        paramId: param.id,
        value: bal.toString(),
        formatted: `${ethers.formatEther(bal)} ETH`,
        source: "rpc",
      };
    }

    // Pattern: bytecode hash
    if (/eth_getCode|bytecode|keccak/i.test(param.source)) {
      const code = await provider.getCode(contract.address);
      if (!code || code === "0x") {
        return {
          paramId: param.id,
          value: null,
          formatted: "no bytecode",
          source: "rpc",
        };
      }
      const hash = ethers.keccak256(code);
      return {
        paramId: param.id,
        value: hash,
        formatted: `${hash.slice(0, 10)}…${hash.slice(-6)}`,
        source: "rpc",
      };
    }

    // Pattern: ContractName.fnName() — function call with no args
    if (contract.abi.length > 0) {
      const fnMatch = param.source.match(/(\w+)\s*\(\s*\)/);
      if (fnMatch) {
        const fnName = fnMatch[1];
        const fn = findFunctionInAbi(contract.abi, fnName);
        if (fn && fn.inputs.length === 0) {
          const c = new ethers.Contract(
            contract.address,
            contract.abi as ethers.InterfaceAbi,
            provider
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (c as any)[fnName]();
          return {
            paramId: param.id,
            value: typeof result === "bigint" ? result.toString() : String(result),
            formatted: formatValue(result, param.unit),
            source: "rpc_call",
          };
        }
      }
    }

    return {
      paramId: param.id,
      value: null,
      formatted: "—",
      source: "unsupported",
      error: "source pattern not recognized",
    };
  } catch (err) {
    return {
      paramId: param.id,
      value: null,
      formatted: "rpc error",
      source: "unsupported",
      error: (err as Error).message,
    };
  }
}

export async function evaluateParameters(
  params: Parameter[],
  contracts: ContractEntry[]
): Promise<EvaluatedValue[]> {
  return Promise.all(params.map((p) => evaluateOne(p, contracts)));
}
