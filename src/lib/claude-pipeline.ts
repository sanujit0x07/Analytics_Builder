import Anthropic from "@anthropic-ai/sdk";
import JSZip from "jszip";

export type RiskSurface =
  | "solvency"
  | "liquidity"
  | "oracle"
  | "market"
  | "smart_contract"
  | "governance";

export type Parameter = {
  id: string;
  name: string;
  surface: RiskSurface;
  description: string;
  source: string;
  cadence: "real-time" | "per-block" | "per-N-minutes" | "event-driven";
  unit: "USD" | "%" | "x" | "count" | "ratio";
  needs_indexing?: boolean;
};

export type Analysis = {
  archetype: string;
  subtype: string;
  confidence: number;
  parameters: Parameter[];
  risk_summary: string;
  open_questions: string[];
};

export type AnalysisInput = {
  protocol: string;
  websiteUrl?: string;
  description?: string;
  contracts: { name: string; address: string; chainId: number }[];
  bundleBuffer: Buffer;
  bundleName: string;
};

const SYSTEM_PROMPT = `You are a senior DeFi systems engineer, risk analyst, and product designer.

You're analyzing a smart-contract protocol so we can auto-generate a production-grade analytics + risk dashboard for it.

Your job:
1. Classify the protocol's archetype from its source code (lending, perps, AMM, CDP, LST/LRT, RWA vault, options, yield aggregator, restaking, oracle, governance, other) and identify the sub-type and notable design choices.
2. Extract the canonical metric set for that archetype, plus any protocol-specific parameters discovered in the code.
3. For every parameter, classify under one of: solvency, liquidity, oracle, market, smart_contract, governance.
4. For every parameter, cite the on-chain source: function signature (e.g. "Pool.getReserveData(asset).liquidityIndex"), event topic, or storage slot.
5. Surface the conditions under which the protocol could accumulate bad debt or become insolvent — derived from the actual code.
6. Identify which parameters are servable from on-chain reads alone vs. which need historical event indexing.

Constraints:
- Do NOT invent parameters that aren't grounded in the submitted code or description.
- Prefer multicall + direct RPC over indexed data; flag indexer needs.
- For upgradeable contracts (EIP-1967 / Beacon / Diamond), reason about the implementation.
- The protocol is EVM-only (Solidity / Vyper).

Coverage targets:
- Lending: TVL, total borrows, utilization, supply/borrow APY, LTV distribution, health-factor distribution, bad debt, reserve factor, oracle deviation, liquidation buffer, top-N concentration.
- Perps: open interest (long/short), funding rate, insurance fund, mark vs. index deviation, liquidation queue depth, skew, ADL risk.
- AMM: pool TVL, volume, fees, IL exposure, LP concentration, price-impact curves, MEV/sandwich exposure.
- CDP: collateral mix, debt ceiling utilization, stability fee, peg deviation, surplus/deficit buffer.
- LST/LRT: TVL, validator distribution, slashing exposure, redemption queue, peg deviation.

For new / unknown protocols where you don't have prior knowledge, anchor every parameter in the actual source code and surface uncertainty in open_questions.

REFERENCE — COMMON DEFI RISK PATTERNS (Pashov Audit Group + ethskills):

Production realities (do not rely on stale training data):
- Mainnet transfers ~$0.004; swaps ~$0.04 (not expensive). L2s 10-100x cheaper still.
- USDC has 6 decimals (not 18) — common "where did my money go?" bug.
- Pectra and Fusaka upgrades shipped; EIP-7702 (set-EOA-code) is live.
- Use the term "onchain" (one word).
- Polygon zkEVM is shutting down; Celo migrated to OP Stack.

High-impact audit-class risks to surface as risk_summary or open_questions when relevant:

1. Oracle manipulation
   - Single-source oracles (Uniswap v3 slot0, Curve get_p) are spot-price; manipulable in one block. Look for TWAP usage, multi-oracle, sanity bounds, staleness checks.
   - Chainlink: check sequencer-uptime feed on L2s; fallback on price-feed staleness; minAnswer/maxAnswer bounds.

2. Re-entrancy
   - Always Checks-Effects-Interactions. Look for state writes after external calls.
   - ERC777/hook tokens, callbacks (onERC721Received), arbitrary token transfers in claim/withdraw paths.

3. Share inflation / first-depositor attacks (ERC4626, lending pools)
   - Donation to empty vault → first depositor LP gets all subsequent deposits' yield.
   - Mitigations: virtual shares (OZ), dead shares burned to address(0), minimum-deposit floor.

4. Liquidation soundness
   - Liquidation bonus + close factor must leave the protocol better off after partial liquidation; misconfigured can cause liquidation cascades that worsen health factor.
   - Check oracle manipulation → forced bad-debt creation.

5. MEV / front-running / sandwich
   - Open auctions (DEX swaps without slippage protection), low-slippage liquidations, oracle updates.
   - Mitigation: commit-reveal, batch auctions, private mempools.

6. Approval / permit signature replay
   - DOMAIN_SEPARATOR depends on chainId — chains forking can replay signed permits if not bound to chainId.
   - permit2 / EIP-2612 nonce drift.

7. Bad-debt socialization
   - Lending: when liquidation buffer < 0, who eats the loss? Reserve factor, insurance fund, LPs?
   - Perps: insurance fund depletion, ADL (auto-deleverage), socialized loss.

8. Access control / governance
   - onlyOwner / onlyAdmin functions that change parameters in real time (collateral factor, oracle source, fee).
   - Governance attacks: flash-loan vote, low-quorum bribery, instant param change without timelock.
   - Look for timelocks, multisig thresholds, upgrade delays.

9. Token compatibility
   - Fee-on-transfer, rebasing, blacklist (USDC/USDT), 0-decimal, non-standard ERC20.
   - Approval race (USDT requires zero-approve before set).

10. Withdrawal queue / liquid-staking peg risk
    - LST/LRT: redemption queue depth, validator slashing exposure, peg deviation under stress.
    - Restaking (EigenLayer-style): operator slashing, pool composition risk.

When emitting parameters, ground them in the protocol's actual code. When the source is too thin (e.g., a hello-world Counter contract), say so honestly in open_questions and don't invent DeFi metrics that aren't supported by the code.`;

const MAX_SOURCE_BYTES = 600_000;

const SOURCE_EXCLUDE_RE = /\/(test|tests|script|scripts|mock|mocks|lib\/forge-std|lib\/openzeppelin|node_modules|cache|broadcast)\//i;

async function extractSources(zip: JSZip): Promise<{ path: string; content: string }[]> {
  const sources: { path: string; content: string }[] = [];
  let totalBytes = 0;

  const candidates = Object.entries(zip.files)
    .filter(([path, entry]) => {
      if (entry.dir) return false;
      const lower = path.toLowerCase();
      if (!(lower.endsWith(".sol") || lower.endsWith(".vy"))) return false;
      if (SOURCE_EXCLUDE_RE.test(path)) return false;
      return true;
    })
    .sort(([a], [b]) => {
      const score = (p: string) => {
        const lower = p.toLowerCase();
        if (lower.startsWith("src/") || lower.startsWith("contracts/")) return 0;
        if (lower.includes("/src/") || lower.includes("/contracts/")) return 1;
        return 2;
      };
      return score(a) - score(b) || a.length - b.length;
    });

  for (const [path, entry] of candidates) {
    const content = await entry.async("string");
    if (totalBytes + content.length > MAX_SOURCE_BYTES) continue;
    sources.push({ path, content });
    totalBytes += content.length;
  }
  return sources;
}

function buildUserMessage(
  input: AnalysisInput,
  sources: { path: string; content: string }[]
): string {
  const contractList = input.contracts
    .map((c) => `  - ${c.name} on chain ${c.chainId}: ${c.address}`)
    .join("\n");
  const sourceText = sources
    .map((s) => `===== ${s.path} =====\n${s.content}`)
    .join("\n\n");

  return [
    `PROTOCOL: ${input.protocol}`,
    `WEBSITE: ${input.websiteUrl || "(not provided)"}`,
    `BUNDLE: ${input.bundleName}`,
    "",
    "USER-PROVIDED DESCRIPTION / DOCS:",
    input.description?.trim() || "(not provided — rely on source + your knowledge of the named protocol if any)",
    "",
    "DEPLOYED CONTRACTS:",
    contractList,
    "",
    `SOURCE FILES (${sources.length} files, ${sourceText.length.toLocaleString()} chars — selected from src/contracts/, excluding tests/scripts/mocks):`,
    "",
    sourceText,
    "",
    "Analyze the protocol and emit the structured JSON. Ground every parameter in the source above; if you can't, say so in open_questions.",
  ].join("\n");
}

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    archetype: {
      type: "string",
      description: "One of: lending, perps, amm, cdp, lst, lrt, rwa_vault, options, yield_aggregator, restaking, oracle, governance, other",
    },
    subtype: {
      type: "string",
      description: "Short description of sub-type and notable design choices (e.g. 'pooled markets, isolated mode, Chainlink oracles, fixed-bonus liquidation')",
    },
    confidence: {
      type: "number",
      description: "0.0-1.0 confidence in classification",
    },
    parameters: {
      type: "array",
      description: "8-30 parameters covering the archetype's canonical metric set plus protocol-specific ones",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "snake_case identifier" },
          name: { type: "string", description: "Human-readable name" },
          surface: {
            type: "string",
            description: "One of: solvency, liquidity, oracle, market, smart_contract, governance",
          },
          description: { type: "string", description: "What this measures and why it matters for risk" },
          source: { type: "string", description: "Contract.functionName() or event Topic or storage slot" },
          cadence: {
            type: "string",
            description: "One of: real-time, per-block, per-N-minutes, event-driven",
          },
          unit: {
            type: "string",
            description: "One of: USD, %, x, count, ratio",
          },
          needs_indexing: {
            type: "boolean",
            description: "True if servable only from event indexing, not direct multicall reads",
          },
        },
        required: ["id", "name", "surface", "description", "source", "cadence", "unit"],
        additionalProperties: false,
      },
    },
    risk_summary: {
      type: "string",
      description: "1-2 paragraphs describing the protocol's primary risk surface and the conditions under which it could accumulate bad debt or become insolvent",
    },
    open_questions: {
      type: "array",
      description: "Things you're uncertain about, missing context for, or need docs to resolve",
      items: { type: "string" },
    },
  },
  required: ["archetype", "subtype", "confidence", "parameters", "risk_summary", "open_questions"],
  additionalProperties: false,
} as const;

function looksLikeZipBytes(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

export async function analyzeProtocol(input: AnalysisInput): Promise<Analysis> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to web/.env.local to enable real analysis."
    );
  }

  const lowerName = input.bundleName.toLowerCase();
  const isZip = lowerName.endsWith(".zip") || looksLikeZipBytes(input.bundleBuffer);

  let sources: { path: string; content: string }[];
  if (isZip) {
    const zip = await JSZip.loadAsync(input.bundleBuffer);
    sources = await extractSources(zip);
    if (sources.length === 0) {
      throw new Error(
        "Could not find any .sol or .vy sources in the bundle (after excluding tests/scripts/mocks). Make sure your ZIP includes the src/ or contracts/ directory."
      );
    }
  } else {
    // Single source file
    const content = input.bundleBuffer.toString("utf-8");
    if (content.length === 0) {
      throw new Error("Source file is empty");
    }
    if (content.length > MAX_SOURCE_BYTES) {
      throw new Error(
        `Source file is too large (${(content.length / 1024).toFixed(0)} KB > ${(MAX_SOURCE_BYTES / 1024).toFixed(0)} KB cap)`
      );
    }
    sources = [{ path: input.bundleName, content }];
  }

  const client = new Anthropic();
  const userMessage = buildUserMessage(input, sources);

  const stream = client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
    },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const finalMessage = await stream.finalMessage();
  const textBlock = finalMessage.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block");
  }

  let analysis: Analysis;
  try {
    analysis = JSON.parse(textBlock.text) as Analysis;
  } catch (err) {
    throw new Error(`Failed to parse analysis JSON: ${(err as Error).message}`);
  }

  return analysis;
}
