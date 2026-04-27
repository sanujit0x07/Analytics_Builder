export type SupportedChain = {
  id: number;
  name: string;
  short: string;
  testnet?: boolean;
};

export const SUPPORTED_CHAINS: SupportedChain[] = [
  // Mainnets
  { id: 1, name: "Ethereum", short: "ETH" },
  { id: 10, name: "Optimism", short: "OP" },
  { id: 56, name: "BNB Chain", short: "BNB" },
  { id: 100, name: "Gnosis", short: "GNO" },
  { id: 137, name: "Polygon", short: "POL" },
  { id: 324, name: "zkSync Era", short: "ZKS" },
  { id: 5000, name: "Mantle", short: "MNT" },
  { id: 8453, name: "Base", short: "BASE" },
  { id: 42161, name: "Arbitrum", short: "ARB" },
  { id: 59144, name: "Linea", short: "LIN" },
  { id: 81457, name: "Blast", short: "BLAST" },
  { id: 534352, name: "Scroll", short: "SCR" },
  // Testnets
  { id: 11155111, name: "Sepolia", short: "SEP", testnet: true },
  { id: 11155420, name: "Optimism Sepolia", short: "OP-SEP", testnet: true },
  { id: 84532, name: "Base Sepolia", short: "BASE-SEP", testnet: true },
  { id: 421614, name: "Arbitrum Sepolia", short: "ARB-SEP", testnet: true },
  { id: 80002, name: "Polygon Amoy", short: "POL-AMOY", testnet: true },
];

export const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
