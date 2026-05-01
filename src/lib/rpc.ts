export const RPC_URLS: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  10: "https://mainnet.optimism.io",
  56: "https://bsc-dataseed.binance.org",
  100: "https://rpc.gnosis.gateway.fm",
  137: "https://polygon-rpc.com",
  324: "https://mainnet.era.zksync.io",
  5000: "https://rpc.mantle.xyz",
  8453: "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
  59144: "https://rpc.linea.build",
  81457: "https://rpc.blast.io",
  534352: "https://rpc.scroll.io",
  // Testnets
  11155111: "https://ethereum-sepolia.publicnode.com",
  11155420: "https://sepolia.optimism.io",
  84532: "https://sepolia.base.org",
  421614: "https://sepolia-rollup.arbitrum.io/rpc",
  80002: "https://rpc-amoy.polygon.technology",
};

export function rpcFor(chainId: number): string | undefined {
  return RPC_URLS[chainId];
}
