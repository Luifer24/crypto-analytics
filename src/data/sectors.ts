// Crypto Sector Definitions and Coin Mappings
// This is a curated list - sectors don't change frequently

export interface Sector {
  id: string;
  name: string;
  description: string;
  color: string;
}

export const SECTORS: Sector[] = [
  {
    id: "layer-1",
    name: "Layer 1",
    description: "Base layer blockchains that process transactions",
    color: "#3b82f6", // blue
  },
  {
    id: "layer-2",
    name: "Layer 2",
    description: "Scaling solutions built on top of L1s",
    color: "#8b5cf6", // purple
  },
  {
    id: "defi",
    name: "DeFi",
    description: "Decentralized finance protocols",
    color: "#10b981", // green
  },
  {
    id: "exchange",
    name: "Exchange",
    description: "Centralized and decentralized exchange tokens",
    color: "#f59e0b", // amber
  },
  {
    id: "stablecoin",
    name: "Stablecoins",
    description: "Tokens pegged to fiat currencies",
    color: "#6b7280", // gray
  },
  {
    id: "gaming",
    name: "Gaming & NFT",
    description: "Gaming, metaverse, and NFT projects",
    color: "#ec4899", // pink
  },
  {
    id: "ai",
    name: "AI & Data",
    description: "Artificial intelligence and data protocols",
    color: "#06b6d4", // cyan
  },
  {
    id: "oracle",
    name: "Oracles",
    description: "Data feed providers for smart contracts",
    color: "#f97316", // orange
  },
  {
    id: "meme",
    name: "Meme",
    description: "Community-driven meme tokens",
    color: "#eab308", // yellow
  },
  {
    id: "privacy",
    name: "Privacy",
    description: "Privacy-focused cryptocurrencies",
    color: "#1e293b", // slate
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    description: "Blockchain infrastructure and tooling",
    color: "#64748b", // slate
  },
  {
    id: "rwa",
    name: "Real World Assets",
    description: "Tokenization of real-world assets",
    color: "#84cc16", // lime
  },
];

// Map CoinGecko IDs to sectors
// A coin can belong to multiple sectors, but we assign the primary one
export const COIN_SECTOR_MAP: Record<string, string> = {
  // Layer 1
  "bitcoin": "layer-1",
  "ethereum": "layer-1",
  "ripple": "layer-1",
  "solana": "layer-1",
  "cardano": "layer-1",
  "avalanche-2": "layer-1",
  "polkadot": "layer-1",
  "tron": "layer-1",
  "near": "layer-1",
  "cosmos": "layer-1",
  "algorand": "layer-1",
  "fantom": "layer-1",
  "aptos": "layer-1",
  "sui": "layer-1",
  "hedera-hashgraph": "layer-1",
  "internet-computer": "layer-1",
  "stellar": "layer-1",
  "ethereum-classic": "layer-1",
  "kaspa": "layer-1",
  "sei-network": "layer-1",
  "injective-protocol": "layer-1",
  "the-open-network": "layer-1",
  "mantle": "layer-1",
  "celestia": "layer-1",

  // Layer 2
  "matic-network": "layer-2",
  "arbitrum": "layer-2",
  "optimism": "layer-2",
  "immutable-x": "layer-2",
  "starknet": "layer-2",
  "polygon-ecosystem-token": "layer-2",
  "metis-token": "layer-2",
  "skale": "layer-2",
  "loopring": "layer-2",
  "zksync": "layer-2",
  "manta-network": "layer-2",
  "blast": "layer-2",

  // DeFi
  "uniswap": "defi",
  "aave": "defi",
  "chainlink": "defi", // Could also be oracle
  "lido-dao": "defi",
  "maker": "defi",
  "compound-governance-token": "defi",
  "curve-dao-token": "defi",
  "pancakeswap-token": "defi",
  "rocket-pool": "defi",
  "convex-finance": "defi",
  "frax-share": "defi",
  "gmx": "defi",
  "dydx": "defi",
  "1inch": "defi",
  "jupiter-exchange-solana": "defi",
  "raydium": "defi",
  "ondo-finance": "defi",
  "ethena": "defi",
  "pendle": "defi",
  "jito-governance-token": "defi",
  "thorchain": "defi",
  "synthetix-network-token": "defi",
  "yearn-finance": "defi",
  "sushi": "defi",
  "balancer": "defi",

  // Exchange Tokens
  "binancecoin": "exchange",
  "okb": "exchange",
  "crypto-com-chain": "exchange",
  "kucoin-shares": "exchange",
  "leo-token": "exchange",
  "bitget-token": "exchange",
  "gatechain-token": "exchange",
  "mx-token": "exchange",
  "huobi-token": "exchange",

  // Stablecoins
  "tether": "stablecoin",
  "usd-coin": "stablecoin",
  "dai": "stablecoin",
  "first-digital-usd": "stablecoin",
  "frax": "stablecoin",
  "true-usd": "stablecoin",
  "paxos-standard": "stablecoin",
  "usdd": "stablecoin",
  "ethena-usde": "stablecoin",
  "paypal-usd": "stablecoin",

  // Gaming & NFT
  "the-sandbox": "gaming",
  "decentraland": "gaming",
  "axie-infinity": "gaming",
  "gala": "gaming",
  "enjincoin": "gaming",
  "illuvium": "gaming",
  "stepn": "gaming",
  "apecoin": "gaming",
  "ronin": "gaming",
  "flow": "gaming",
  "beam-2": "gaming",
  "pixels": "gaming",
  "magic": "gaming",
  "echelon-prime": "gaming",
  "super-rare": "gaming",
  "blur": "gaming",

  // AI & Data
  "render-token": "ai",
  "fetch-ai": "ai",
  "singularitynet": "ai",
  "ocean-protocol": "ai",
  "the-graph": "ai",
  "bittensor": "ai",
  "akash-network": "ai",
  "worldcoin-wld": "ai",
  "arkham": "ai",
  "numeraire": "ai",
  "artificial-superintelligence-alliance": "ai",
  "theta-token": "ai",
  "theta-fuel": "ai",
  "golem": "ai",
  "iotex": "ai",
  "arweave": "ai",
  "filecoin": "ai",

  // Oracles (chainlink is in DeFi as primary)
  "band-protocol": "oracle",
  "api3": "oracle",
  "uma": "oracle",
  "tellor": "oracle",
  "pyth-network": "oracle",
  "dia-data": "oracle",

  // Meme
  "dogecoin": "meme",
  "shiba-inu": "meme",
  "pepe": "meme",
  "bonk": "meme",
  "floki": "meme",
  "dogwifcoin": "meme",
  "memecoin-2": "meme",
  "book-of-meme": "meme",
  "cat-in-a-dogs-world": "meme",
  "brett": "meme",
  "popcat": "meme",
  "mog-coin": "meme",
  "wojak": "meme",
  "babydoge": "meme",

  // Privacy
  "monero": "privacy",
  "zcash": "privacy",
  "dash": "privacy",
  "secret": "privacy",
  "oasis-network": "privacy",
  "horizen": "privacy",
  "verge": "privacy",

  // Infrastructure
  "wrapped-bitcoin": "infrastructure",
  "lido-staked-ether": "infrastructure",
  "weth": "infrastructure",
  "wrapped-steth": "infrastructure",
  "quant-network": "infrastructure",
  "elrond-erd-2": "infrastructure",
  "vechain": "infrastructure",
  "helium": "infrastructure",
  "conflux-token": "infrastructure",
  "stacks": "infrastructure",
  "nervos-network": "infrastructure",
  "kava": "infrastructure",
  "neo": "infrastructure",
  "iota": "infrastructure",
  "tezos": "infrastructure",
  "eos": "infrastructure",
  "zilliqa": "infrastructure",

  // Real World Assets (ondo-finance is in DeFi as primary)
  "centrifuge": "rwa",
  "maple": "rwa",
  "goldfinch": "rwa",
  "polymesh": "rwa",
  "mantra-dao": "rwa",
};

// Get sector for a coin (returns undefined if not mapped)
export const getCoinSector = (coinId: string): string | undefined => {
  return COIN_SECTOR_MAP[coinId];
};

// Get sector details
export const getSectorById = (sectorId: string): Sector | undefined => {
  return SECTORS.find(s => s.id === sectorId);
};

// Get all coins in a sector
export const getCoinsBySector = (sectorId: string): string[] => {
  return Object.entries(COIN_SECTOR_MAP)
    .filter(([_, sector]) => sector === sectorId)
    .map(([coinId]) => coinId);
};

// Get sector with coin count
export const getSectorStats = () => {
  const stats: Record<string, number> = {};

  Object.values(COIN_SECTOR_MAP).forEach(sector => {
    stats[sector] = (stats[sector] || 0) + 1;
  });

  return SECTORS.map(sector => ({
    ...sector,
    coinCount: stats[sector.id] || 0,
  }));
};
