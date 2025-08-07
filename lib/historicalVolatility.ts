// Historical volatility calculation utilities with multi-API support and caching

import { apiCache, cacheKeys, cacheTTL } from './apiCache';

export interface HistoricalPriceData {
  date: string;
  price: number;
}

export interface VolatilityResult {
  annualizedVolatility: number;
  dailyVolatility: number;
  priceData: HistoricalPriceData[];
  dataPoints: number;
  apiProvider?: string;
  cached?: boolean;
}

export interface ApiResult<T> {
  data: T;
  provider: string;
  error?: string;
  cached?: boolean;
}

export type ApiProvider = 'binance' | 'coincap' | 'coingecko';

// Token symbol mappings for different APIs
const TOKEN_MAPPINGS = {
  binance: {
    'bitcoin': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'solana': 'SOLUSDT',
    'cardano': 'ADAUSDT',
    'polkadot': 'DOTUSDT',
    'chainlink': 'LINKUSDT',
    'uniswap': 'UNIUSDT',
    'litecoin': 'LTCUSDT',
    'bitcoin-cash': 'BCHUSDT',
    'stellar': 'XLMUSDT'
  },
  coincap: {
    'bitcoin': 'bitcoin',
    'ethereum': 'ethereum',
    'solana': 'solana',
    'cardano': 'cardano',
    'polkadot': 'polkadot',
    'chainlink': 'chainlink',
    'uniswap': 'uniswap',
    'litecoin': 'litecoin',
    'bitcoin-cash': 'bitcoin-cash',
    'stellar': 'stellar'
  },
  coingecko: {
    'bitcoin': 'bitcoin',
    'ethereum': 'ethereum',
    'solana': 'solana',
    'cardano': 'cardano',
    'polkadot': 'polkadot',
    'chainlink': 'chainlink',
    'uniswap': 'uniswap',
    'litecoin': 'litecoin',
    'bitcoin-cash': 'bitcoin-cash',
    'stellar': 'stellar'
  }
};

/**
 * Fetch historical price data from Binance API
 */
async function fetchHistoricalPricesFromBinance(
  tokenId: string,
  days: number = 90
): Promise<HistoricalPriceData[]> {
  const symbol = TOKEN_MAPPINGS.binance[tokenId as keyof typeof TOKEN_MAPPINGS.binance];
  if (!symbol) {
    throw new Error(`Token ${tokenId} not supported on Binance API`);
  }

  // Calculate start time (days ago)
  const endTime = Date.now();
  const startTime = endTime - (days * 24 * 60 * 60 * 1000);
  
  const response = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&startTime=${startTime}&endTime=${endTime}&limit=${days}`
  );
  
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!Array.isArray(data)) {
    throw new Error('Invalid Binance API response format');
  }
  
  return data.map((kline: any[]) => ({
    date: new Date(kline[0]).toISOString().split('T')[0], // Open time
    price: parseFloat(kline[4]) // Close price
  }));
}

/**
 * Fetch historical price data from CoinCap API
 */
async function fetchHistoricalPricesFromCoinCap(
  tokenId: string,
  days: number = 90
): Promise<HistoricalPriceData[]> {
  const coinCapId = TOKEN_MAPPINGS.coincap[tokenId as keyof typeof TOKEN_MAPPINGS.coincap] || tokenId;
  
  // CoinCap uses different intervals
  let interval = 'd1'; // daily
  if (days <= 1) interval = 'h1'; // hourly for very short periods
  
  const response = await fetch(
    `https://api.coincap.io/v2/assets/${coinCapId}/history?interval=${interval}`
  );
  
  if (!response.ok) {
    throw new Error(`CoinCap API error: ${response.status}`);
  }
  
  const result = await response.json();
  
  if (!result.data || !Array.isArray(result.data)) {
    throw new Error('Invalid CoinCap API response format');
  }
  
  // Get the most recent 'days' data points
  const recentData = result.data.slice(-days);
  
  return recentData.map((item: any) => ({
    date: new Date(item.time).toISOString().split('T')[0],
    price: parseFloat(item.priceUsd)
  }));
}

/**
 * Fetch historical price data from CoinGecko API
 */
async function fetchHistoricalPricesFromCoinGecko(
  tokenId: string,
  days: number = 90
): Promise<HistoricalPriceData[]> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart?vs_currency=usd&days=${days}&interval=daily`
  );
  
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.prices || !Array.isArray(data.prices)) {
    throw new Error('Invalid CoinGecko API response format');
  }
  
  return data.prices.map(([timestamp, price]: [number, number]) => ({
    date: new Date(timestamp).toISOString().split('T')[0],
    price
  }));
}

/**
 * Fetch historical price data with API fallback mechanism and caching
 */
export async function fetchHistoricalPrices(
  tokenId: string, 
  days: number = 90,
  preferredProvider?: ApiProvider
): Promise<ApiResult<HistoricalPriceData[]>> {
  const cacheKey = cacheKeys.historicalPrices(tokenId, days);
  
  // Check cache first
  const cached = apiCache.get<HistoricalPriceData[]>(cacheKey);
  if (cached) {
    console.log(`💾 Cache hit for ${tokenId} historical data (${days} days) from ${cached.provider?.toUpperCase()}`);
    return { data: cached.data, provider: cached.provider || 'cached', cached: true };
  }
  
  const providers: ApiProvider[] = preferredProvider 
    ? [preferredProvider, ...['binance', 'coincap', 'coingecko'].filter(p => p !== preferredProvider)] as ApiProvider[]
    : ['binance', 'coincap', 'coingecko'];
    
  const errors: string[] = [];
  
  for (const provider of providers) {
    try {
      console.log(`🔄 Trying ${provider.toUpperCase()} API for ${tokenId} historical data...`);
      
      let data: HistoricalPriceData[];
      
      switch (provider) {
        case 'binance':
          data = await fetchHistoricalPricesFromBinance(tokenId, days);
          break;
        case 'coincap':
          data = await fetchHistoricalPricesFromCoinCap(tokenId, days);
          break;
        case 'coingecko':
          data = await fetchHistoricalPricesFromCoinGecko(tokenId, days);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
      
      // Cache the successful result
      apiCache.set(cacheKey, data, cacheTTL.historicalPrices, provider);
      
      console.log(`✅ Successfully fetched ${data.length} price points from ${provider.toUpperCase()}`);
      return { data, provider, cached: false };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${provider}: ${errorMsg}`);
      console.warn(`❌ ${provider.toUpperCase()} failed: ${errorMsg}`);
    }
  }
  
  throw new Error(`All API providers failed:\n${errors.join('\n')}`);
}

/**
 * Calculate historical volatility from price data
 */
export function calculateHistoricalVolatility(
  prices: HistoricalPriceData[],
  apiProvider?: string
): VolatilityResult {
  if (prices.length < 2) {
    throw new Error('Need at least 2 price points to calculate volatility');
  }
  
  // Sort prices by date to ensure correct order
  const sortedPrices = [...prices].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Calculate daily returns (log returns)
  const dailyReturns: number[] = [];
  for (let i = 1; i < sortedPrices.length; i++) {
    const currentPrice = sortedPrices[i].price;
    const previousPrice = sortedPrices[i - 1].price;
    
    if (previousPrice <= 0 || currentPrice <= 0) {
      continue; // Skip invalid prices
    }
    
    const logReturn = Math.log(currentPrice / previousPrice);
    dailyReturns.push(logReturn);
  }
  
  if (dailyReturns.length < 2) {
    throw new Error('Insufficient valid price data for volatility calculation');
  }
  
  // Calculate mean of daily returns
  const meanReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
  
  // Calculate variance
  const variance = dailyReturns.reduce((sum, ret) => {
    const diff = ret - meanReturn;
    return sum + (diff * diff);
  }, 0) / (dailyReturns.length - 1); // Sample variance (n-1)
  
  // Calculate standard deviation (daily volatility)
  const dailyVolatility = Math.sqrt(variance);
  
  // Annualize the volatility (assuming 365 trading days per year)
  const annualizedVolatility = dailyVolatility * Math.sqrt(365);
  
  console.log(`📊 Volatility Calculation for ${prices.length} price points:`);
  console.log(`   Daily returns: ${dailyReturns.length} points`);
  console.log(`   Daily volatility: ${(dailyVolatility * 100).toFixed(2)}%`);
  console.log(`   Annualized volatility: ${(annualizedVolatility * 100).toFixed(2)}%`);
  
  return {
    annualizedVolatility,
    dailyVolatility,
    priceData: sortedPrices,
    dataPoints: dailyReturns.length,
    apiProvider
  };
}

/**
 * Get current price from Binance API
 */
async function getCurrentPriceFromBinance(tokenId: string): Promise<number> {
  const symbol = TOKEN_MAPPINGS.binance[tokenId as keyof typeof TOKEN_MAPPINGS.binance];
  if (!symbol) {
    throw new Error(`Token ${tokenId} not supported on Binance API`);
  }
  
  const response = await fetch(
    `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
  );
  
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.price || isNaN(parseFloat(data.price))) {
    throw new Error('Invalid Binance price data format');
  }
  
  return parseFloat(data.price);
}

/**
 * Get current price from CoinCap API
 */
async function getCurrentPriceFromCoinCap(tokenId: string): Promise<number> {
  const coinCapId = TOKEN_MAPPINGS.coincap[tokenId as keyof typeof TOKEN_MAPPINGS.coincap] || tokenId;
  
  const response = await fetch(
    `https://api.coincap.io/v2/assets/${coinCapId}`
  );
  
  if (!response.ok) {
    throw new Error(`CoinCap API error: ${response.status}`);
  }
  
  const result = await response.json();
  
  if (!result.data || !result.data.priceUsd || isNaN(parseFloat(result.data.priceUsd))) {
    throw new Error('Invalid CoinCap price data format');
  }
  
  return parseFloat(result.data.priceUsd);
}

/**
 * Get current price from CoinGecko API
 */
async function getCurrentPriceFromCoinGecko(tokenId: string): Promise<number> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`
  );
  
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data[tokenId] || typeof data[tokenId].usd !== 'number') {
    throw new Error('Invalid CoinGecko price data format');
  }
  
  return data[tokenId].usd;
}

/**
 * Get current price with API fallback mechanism and caching
 */
export async function getCurrentPrice(
  tokenId: string,
  preferredProvider?: ApiProvider
): Promise<ApiResult<number>> {
  const cacheKey = cacheKeys.currentPrice(tokenId);
  
  // Check cache first
  const cached = apiCache.get<number>(cacheKey);
  if (cached) {
    console.log(`💾 Cache hit for ${tokenId} current price: $${cached.data.toLocaleString()} from ${cached.provider?.toUpperCase()}`);
    return { data: cached.data, provider: cached.provider || 'cached', cached: true };
  }
  
  const providers: ApiProvider[] = preferredProvider 
    ? [preferredProvider, ...['binance', 'coincap', 'coingecko'].filter(p => p !== preferredProvider)] as ApiProvider[]
    : ['binance', 'coincap', 'coingecko'];
    
  const errors: string[] = [];
  
  for (const provider of providers) {
    try {
      console.log(`🔄 Trying ${provider.toUpperCase()} API for ${tokenId} current price...`);
      
      let price: number;
      
      switch (provider) {
        case 'binance':
          price = await getCurrentPriceFromBinance(tokenId);
          break;
        case 'coincap':
          price = await getCurrentPriceFromCoinCap(tokenId);
          break;
        case 'coingecko':
          price = await getCurrentPriceFromCoinGecko(tokenId);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
      
      // Cache the successful result
      apiCache.set(cacheKey, price, cacheTTL.currentPrice, provider);
      
      console.log(`✅ Current ${tokenId} price from ${provider.toUpperCase()}: $${price.toLocaleString()}`);
      return { data: price, provider, cached: false };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${provider}: ${errorMsg}`);
      console.warn(`❌ ${provider.toUpperCase()} failed: ${errorMsg}`);
    }
  }
  
  throw new Error(`All API providers failed:\n${errors.join('\n')}`);
}