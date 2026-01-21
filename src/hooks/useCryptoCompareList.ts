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
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "ripple",
  USDT: "tether",
  SOL: "solana",
  BNB: "binancecoin",
  USDC: "usd-coin",
  DOGE: "dogecoin",
  ADA: "cardano",
  TRX: "tron",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  DOT: "polkadot",
  MATIC: "matic-network",
  TON: "the-open-network",
  SHIB: "shiba-inu",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  DAI: "dai",
  UNI: "uniswap",
  ATOM: "cosmos",
  XLM: "stellar",
  ETC: "ethereum-classic",
  XMR: "monero",
  NEAR: "near",
  OKB: "okb",
  APT: "aptos",
  FIL: "filecoin",
  ARB: "arbitrum",
  MKR: "maker",
  OP: "optimism",
  INJ: "injective-protocol",
  AAVE: "aave",
  ALGO: "algorand",
  FTM: "fantom",
  SAND: "the-sandbox",
  MANA: "decentraland",
  AXS: "axie-infinity",
  GALA: "gala",
  PEPE: "pepe",
  BONK: "bonk",
  FLOKI: "floki",
  WIF: "dogwifcoin",
  RENDER: "render-token",
  FET: "fetch-ai",
  AGIX: "singularitynet",
  GRT: "the-graph",
  LDO: "lido-dao",
  CRV: "curve-dao-token",
  COMP: "compound-governance-token",
  SNX: "synthetix-network-token",
  SUSHI: "sushi",
  YFI: "yearn-finance",
  IMX: "immutable-x",
  SUI: "sui",
  SEI: "sei-network",
  STX: "stacks",
  KAVA: "kava",
  ZEC: "zcash",
  DASH: "dash",
  NEO: "neo",
  EOS: "eos",
  ZIL: "zilliqa",
  IOTA: "iota",
  XTZ: "tezos",
  VET: "vechain",
  THETA: "theta-token",
  HNT: "helium",
  QNT: "quant-network",
  EGLD: "elrond-erd-2",
  FLOW: "flow",
  HBAR: "hedera-hashgraph",
  ICP: "internet-computer",
  KAS: "kaspa",
  CRO: "crypto-com-chain",
  LEO: "leo-token",
  KCS: "kucoin-shares",
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

    const coins = json.Data.filter((coin) => coin.RAW?.USD).map(
      (coin, index): CryptoAsset => {
        const raw = coin.RAW!.USD;
        return {
          id: toCoinGeckoId(coin.CoinInfo.Name),
          symbol: coin.CoinInfo.Name.toLowerCase(),
          name: coin.CoinInfo.FullName,
          image: `https://www.cryptocompare.com${coin.CoinInfo.ImageUrl}`,
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
      }
    );

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
