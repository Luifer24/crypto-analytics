import { useQuery } from "@tanstack/react-query";
import type { CryptoAsset } from "@/types/crypto";

const CRYPTOCOMPARE_API = "https://min-api.cryptocompare.com/data";

interface CryptoCompareRaw {
  PRICE: number;
  MKTCAP: number;
  TOTALVOLUME24HTO: number;
  CHANGEPCT24HOUR: number;
  HIGH24HOUR: number;
  LOW24HOUR: number;
  CIRCULATINGSUPPLY: number;
  SUPPLY: number;
}

interface CryptoCompareCoin {
  CoinInfo: {
    Id: string;
    Name: string;
    FullName: string;
    ImageUrl: string;
  };
  RAW?: {
    USD: CryptoCompareRaw;
  };
}

interface CryptoCompareResponse {
  Data: CryptoCompareCoin[];
}

// Map CryptoCompare symbols to CoinGecko IDs for sector matching
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  // Layer 1
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "ripple",
  SOL: "solana",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  TRX: "tron",
  NEAR: "near",
  ATOM: "cosmos",
  ALGO: "algorand",
  FTM: "fantom",
  APT: "aptos",
  SUI: "sui",
  HBAR: "hedera-hashgraph",
  ICP: "internet-computer",
  XLM: "stellar",
  ETC: "ethereum-classic",
  KAS: "kaspa",
  SEI: "sei-network",
  INJ: "injective-protocol",
  TON: "the-open-network",
  MNT: "mantle",
  TIA: "celestia",

  // Layer 2
  MATIC: "matic-network",
  POL: "matic-network",
  ARB: "arbitrum",
  OP: "optimism",
  IMX: "immutable-x",
  STRK: "starknet",
  METIS: "metis-token",
  SKL: "skale",
  LRC: "loopring",
  ZK: "zksync",
  MANTA: "manta-network",
  BLAST: "blast",

  // DeFi
  UNI: "uniswap",
  AAVE: "aave",
  LINK: "chainlink",
  LDO: "lido-dao",
  MKR: "maker",
  COMP: "compound-governance-token",
  CRV: "curve-dao-token",
  CAKE: "pancakeswap-token",
  RPL: "rocket-pool",
  CVX: "convex-finance",
  FXS: "frax-share",
  GMX: "gmx",
  DYDX: "dydx",
  ONEINCH: "1inch",
  JUP: "jupiter-exchange-solana",
  RAY: "raydium",
  ONDO: "ondo-finance",
  ENA: "ethena",
  PENDLE: "pendle",
  JTO: "jito-governance-token",
  RUNE: "thorchain",
  SNX: "synthetix-network-token",
  YFI: "yearn-finance",
  SUSHI: "sushi",
  BAL: "balancer",

  // Exchange
  BNB: "binancecoin",
  OKB: "okb",
  CRO: "crypto-com-chain",
  KCS: "kucoin-shares",
  LEO: "leo-token",
  BGB: "bitget-token",
  GT: "gatechain-token",
  MX: "mx-token",
  HT: "huobi-token",

  // Stablecoins
  USDT: "tether",
  USDC: "usd-coin",
  DAI: "dai",
  FDUSD: "first-digital-usd",
  FRAX: "frax",
  TUSD: "true-usd",
  USDP: "paxos-standard",
  USDD: "usdd",
  USDE: "ethena-usde",
  PYUSD: "paypal-usd",

  // Gaming & NFT
  SAND: "the-sandbox",
  MANA: "decentraland",
  AXS: "axie-infinity",
  GALA: "gala",
  ENJ: "enjincoin",
  ILV: "illuvium",
  GMT: "stepn",
  APE: "apecoin",
  RON: "ronin",
  FLOW: "flow",
  BEAM: "beam-2",
  PIXEL: "pixels",
  MAGIC: "magic",
  PRIME: "echelon-prime",
  BLUR: "blur",

  // AI & Data
  RENDER: "render-token",
  FET: "fetch-ai",
  AGIX: "singularitynet",
  OCEAN: "ocean-protocol",
  GRT: "the-graph",
  TAO: "bittensor",
  AKT: "akash-network",
  WLD: "worldcoin-wld",
  ARKM: "arkham",
  NMR: "numeraire",
  ASI: "artificial-superintelligence-alliance",
  THETA: "theta-token",
  TFUEL: "theta-fuel",
  GLM: "golem",
  IOTX: "iotex",
  AR: "arweave",
  FIL: "filecoin",

  // Oracles
  BAND: "band-protocol",
  API3: "api3",
  UMA: "uma",
  TRB: "tellor",
  PYTH: "pyth-network",
  DIA: "dia-data",

  // Meme
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  BONK: "bonk",
  FLOKI: "floki",
  WIF: "dogwifcoin",
  MEME: "memecoin-2",
  BOME: "book-of-meme",
  MEW: "cat-in-a-dogs-world",
  BRETT: "brett",
  POPCAT: "popcat",
  MOG: "mog-coin",
  WOJAK: "wojak",
  BABYDOGE: "babydoge",

  // Privacy
  XMR: "monero",
  ZEC: "zcash",
  DASH: "dash",
  SCRT: "secret",
  ROSE: "oasis-network",
  ZEN: "horizen",
  XVG: "verge",

  // Infrastructure
  WBTC: "wrapped-bitcoin",
  STETH: "lido-staked-ether",
  WETH: "weth",
  WSTETH: "wrapped-steth",
  QNT: "quant-network",
  EGLD: "elrond-erd-2",
  VET: "vechain",
  HNT: "helium",
  CFX: "conflux-token",
  STX: "stacks",
  CKB: "nervos-network",
  KAVA: "kava",
  NEO: "neo",
  IOTA: "iota",
  XTZ: "tezos",
  EOS: "eos",
  ZIL: "zilliqa",

  // RWA
  CFG: "centrifuge",
  MPL: "maple",
  GFI: "goldfinch",
  POLYX: "polymesh",
  OM: "mantra-dao",

  // Legacy/Other
  LTC: "litecoin",
  BCH: "bitcoin-cash",
};

// Convert CryptoCompare symbol to CoinGecko ID
const toCoinGeckoId = (symbol: string): string => {
  return SYMBOL_TO_COINGECKO[symbol] || symbol.toLowerCase();
};

// Fetch top coins from CryptoCompare
const fetchTopCoins = async (limit: number): Promise<CryptoAsset[]> => {
  // CryptoCompare allows max 100 per request, so we paginate if needed
  const perPage = 100;
  const pages = Math.ceil(limit / perPage);
  const allCoins: CryptoAsset[] = [];
  const seenIds = new Set<string>(); // Track seen IDs to avoid duplicates

  for (let page = 0; page < pages; page++) {
    const pageLimit = Math.min(perPage, limit - page * perPage);
    const response = await fetch(
      `${CRYPTOCOMPARE_API}/top/mktcapfull?limit=${pageLimit}&tsym=USD&page=${page}`
    );

    if (!response.ok) {
      throw new Error(`CryptoCompare API error: ${response.status}`);
    }

    const json: CryptoCompareResponse = await response.json();

    if (!json.Data) {
      break;
    }

    const coins = json.Data.filter((coin) => coin.RAW?.USD)
      .map((coin, index): CryptoAsset => {
        const raw = coin.RAW!.USD;
        const imageUrl = coin.CoinInfo.ImageUrl
          ? `https://www.cryptocompare.com${coin.CoinInfo.ImageUrl}`
          : `https://ui-avatars.com/api/?name=${coin.CoinInfo.Name}&background=1e293b&color=fff&size=64`;
        return {
          id: toCoinGeckoId(coin.CoinInfo.Name),
          symbol: coin.CoinInfo.Name.toLowerCase(),
          name: coin.CoinInfo.FullName,
          image: imageUrl,
          current_price: raw.PRICE,
          market_cap: raw.MKTCAP,
          market_cap_rank: page * perPage + index + 1,
          total_volume: raw.TOTALVOLUME24HTO,
          price_change_percentage_24h: raw.CHANGEPCT24HOUR,
          high_24h: raw.HIGH24HOUR,
          low_24h: raw.LOW24HOUR,
          ath: 0, // CryptoCompare doesn't provide ATH in this endpoint
          ath_change_percentage: 0,
          circulating_supply: raw.CIRCULATINGSUPPLY,
          total_supply: raw.SUPPLY || null,
        };
      })
      .filter((coin) => {
        // Deduplicate by ID (keep first occurrence with better rank)
        if (seenIds.has(coin.id)) {
          return false;
        }
        seenIds.add(coin.id);
        return true;
      });

    allCoins.push(...coins);

    // Stop if we got fewer coins than requested (end of data)
    if (json.Data.length < pageLimit) {
      break;
    }
  }

  return allCoins;
};

// Hook to get crypto list from CryptoCompare
export const useCryptoCompareList = (limit: number = 100) => {
  return useQuery<CryptoAsset[]>({
    queryKey: ["cryptoCompareList", limit],
    queryFn: () => fetchTopCoins(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchInterval: 3 * 60 * 1000, // Refetch every 3 min
    retry: 2,
  });
};
