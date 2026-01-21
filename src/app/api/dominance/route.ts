import { NextResponse } from "next/server";

const CMC_DATA_API = "https://api.coinmarketcap.com/data-api/v3/global-metrics/quotes/historical";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get("days") || "365";

  try {
    const response = await fetch(
      `${CMC_DATA_API}?format=chart&interval=1d&count=${days}`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; CryptoAnalytics/1.0)",
        },
        next: { revalidate: 1800 }, // Cache for 30 minutes
      }
    );

    if (!response.ok) {
      throw new Error(`CMC API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Dominance API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dominance data" },
      { status: 500 }
    );
  }
}
