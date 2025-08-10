import { Token, PriceData, MarketData } from '@/types';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// 獲取現貨價格
export async function fetchSpotPrice(token: Token): Promise<number> {
  const id = token === 'BTC' ? 'bitcoin' : 'ethereum';
  
  try {
    // Add API key if available
    const apiKey = process.env.COINGECKO_API_KEY;
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };
    
    if (apiKey) {
      headers['x-cg-demo-api-key'] = apiKey;
    }
    
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${id}&vs_currencies=usd`,
      { 
        headers,
        // Cache for 30 seconds to avoid rate limits
        next: { revalidate: 30 }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch spot price: ${response.status}`);
    }
    
    const data: MarketData = await response.json();
    return token === 'BTC' ? data.bitcoin.usd : data.ethereum.usd;
  } catch (error) {
    console.error('Error fetching spot price:', error);
    throw error;
  }
}

// 獲取價格數據
export async function fetchPrices(token: Token): Promise<PriceData> {
  const spotPrice = await fetchSpotPrice(token);
  
  return {
    token,
    spot: spotPrice,
    timestamp: new Date(),
  };
}

// 獲取歷史價格數據
export interface HistoricalPriceData {
  date: string;
  price: number;
}

export async function fetchPriceHistory(coinId: string, days: number = 90): Promise<HistoricalPriceData[]> {
  try {
    console.log(`[Price Service] 🔄 Fetching ${days} days of price history for ${coinId}`);
    
    // Add API key if available
    const apiKey = process.env.COINGECKO_API_KEY;
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };
    
    if (apiKey) {
      headers['x-cg-demo-api-key'] = apiKey;
    }
    
    // Fetch historical price data from CoinGecko
    const response = await fetch(
      `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
      { 
        headers,
        // Cache for 5 minutes for historical data
        next: { revalidate: 300 }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch price history for ${coinId}: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.prices || !Array.isArray(data.prices)) {
      throw new Error(`Invalid price history data for ${coinId}`);
    }
    
    // Convert timestamps to dates and prices
    const priceHistory: HistoricalPriceData[] = data.prices.map(([timestamp, price]: [number, number]) => ({
      date: new Date(timestamp).toISOString().split('T')[0], // YYYY-MM-DD format
      price: price
    }));
    
    console.log(`[Price Service] ✅ Retrieved ${priceHistory.length} price points for ${coinId} over ${days} days`);
    
    return priceHistory.reverse(); // Most recent first
    
  } catch (error) {
    console.error(`[Price Service] ❌ Error fetching price history for ${coinId}:`, error);
    throw error;
  }
}