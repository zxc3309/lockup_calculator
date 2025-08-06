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