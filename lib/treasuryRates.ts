// Treasury rates utility functions for getting risk-free rates based on lockup periods

import { LockupPeriod } from '@/types';

// Mapping from lockup periods to treasury periods
const LOCKUP_TO_TREASURY_MAP: Record<LockupPeriod, string> = {
  '3M': '3M',
  '6M': '6M', 
  '1Y': '1Y',
  '2Y': '2Y'
};

// Treasury rate response interface
export interface TreasuryRateResponse {
  success: boolean;
  period: string;
  rate: number;
  series_id: string;
  date: string;
  source: string;
  rate_percentage: number;
  performance: {
    duration: number;
    cached: boolean;
  };
  error?: string;
  details?: string;
}

/**
 * Get the appropriate treasury rate for a given lockup period
 * @param period Lockup period (3M, 6M, 1Y, 2Y)
 * @returns Promise<number> Risk-free rate as decimal (e.g., 0.0425 for 4.25%)
 */
export async function getTreasuryRateForPeriod(period: LockupPeriod): Promise<number> {
  const treasuryPeriod = LOCKUP_TO_TREASURY_MAP[period];
  
  if (!treasuryPeriod) {
    console.warn(`[Treasury Rates] ⚠️ Unknown period ${period}, defaulting to 1Y rate`);
    return getTreasuryRateForPeriod('1Y');
  }

  try {
    console.log(`[Treasury Rates] 🔄 Fetching treasury rate for ${period} (${treasuryPeriod})...`);
    
    const response = await fetch(`/api/treasury-rates?period=${treasuryPeriod}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Treasury API returned ${response.status}`);
    }

    const data: TreasuryRateResponse = await response.json();
    
    if (!data.success || typeof data.rate !== 'number') {
      throw new Error(data.details || data.error || 'Invalid response from treasury API');
    }

    console.log(`[Treasury Rates] ✅ ${period} rate: ${(data.rate * 100).toFixed(2)}% (${data.source}${data.performance.cached ? ', cached' : ''})`);
    
    return data.rate;
    
  } catch (error) {
    console.error(`[Treasury Rates] ❌ Error fetching ${period} rate:`, error);
    
    // Return fallback rates
    const fallbackRates = {
      '3M': 0.0420,  // 4.20%
      '6M': 0.0423,  // 4.23%
      '1Y': 0.0425,  // 4.25%
      '2Y': 0.0430   // 4.30%
    };
    
    const fallbackRate = fallbackRates[period];
    console.warn(`[Treasury Rates] 🔄 Using fallback rate for ${period}: ${(fallbackRate * 100).toFixed(2)}%`);
    
    return fallbackRate;
  }
}

/**
 * Get treasury rate for server-side usage (direct API call)
 * @param period Treasury period (3M, 6M, 1Y, 2Y) 
 * @returns Promise<number> Risk-free rate as decimal
 */
export async function getTreasuryRateServer(period: '3M' | '6M' | '1Y' | '2Y'): Promise<number> {
  const treasurySeriesMap = {
    '3M': 'DGS3MO',
    '6M': 'DGS6MO', 
    '1Y': 'DGS1',
    '2Y': 'DGS2'
  };

  // Fallback rates for server-side usage
  const fallbackRates = {
    '3M': 0.0420,
    '6M': 0.0423,
    '1Y': 0.0425,
    '2Y': 0.0430
  };

  const fredApiKey = process.env.FRED_API_KEY;
  
  if (!fredApiKey) {
    console.warn(`[Treasury Rates Server] ⚠️ No FRED API key, using fallback for ${period}`);
    return fallbackRates[period];
  }

  try {
    const seriesId = treasurySeriesMap[period];
    console.log(`[Treasury Rates Server] 🔄 Fetching ${seriesId} from FRED...`);
    
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json&limit=1&sort_order=desc`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BTC-ETH-Lockup-Calculator/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`FRED API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.observations || data.observations.length === 0) {
      throw new Error(`No data for ${seriesId}`);
    }

    const observation = data.observations[0];
    
    if (observation.value === '.') {
      throw new Error(`No value for ${seriesId} on ${observation.date}`);
    }

    const rate = parseFloat(observation.value) / 100; // Convert percentage to decimal
    
    if (isNaN(rate)) {
      throw new Error(`Invalid rate value: ${observation.value}`);
    }

    console.log(`[Treasury Rates Server] ✅ ${period}: ${(rate * 100).toFixed(2)}% (${observation.date})`);
    
    return rate;
    
  } catch (error) {
    console.error(`[Treasury Rates Server] ❌ Error fetching ${period}:`, error);
    console.warn(`[Treasury Rates Server] 🔄 Using fallback rate: ${(fallbackRates[period] * 100).toFixed(2)}%`);
    
    return fallbackRates[period];
  }
}

/**
 * Get treasury rate information for display purposes
 * @param period Lockup period
 * @returns Promise<{rate: number, displayText: string}>
 */
export async function getTreasuryRateInfo(period: LockupPeriod): Promise<{
  rate: number;
  displayText: string;
  source: string;
  date: string;
}> {
  const treasuryPeriod = LOCKUP_TO_TREASURY_MAP[period];
  
  try {
    const response = await fetch(`/api/treasury-rates?period=${treasuryPeriod}`);
    const data: TreasuryRateResponse = await response.json();
    
    if (data.success) {
      const displayText = `${(data.rate * 100).toFixed(2)}% (${getPeriodDisplayName(treasuryPeriod)}美國國庫券, ${data.date})`;
      
      return {
        rate: data.rate,
        displayText,
        source: data.source,
        date: data.date
      };
    }
  } catch (error) {
    console.error('Error fetching treasury rate info:', error);
  }
  
  // Fallback
  const fallbackRate = {
    '3M': 0.0420,
    '6M': 0.0423, 
    '1Y': 0.0425,
    '2Y': 0.0430
  }[period];
  
  return {
    rate: fallbackRate,
    displayText: `${(fallbackRate * 100).toFixed(2)}% (${getPeriodDisplayName(treasuryPeriod)}美國國庫券, 預設值)`,
    source: 'FALLBACK',
    date: new Date().toISOString().split('T')[0]
  };
}

function getPeriodDisplayName(period: string): string {
  const displayNames = {
    '3M': '3個月',
    '6M': '6個月',
    '1Y': '1年期',
    '2Y': '2年期'
  };
  
  return displayNames[period as keyof typeof displayNames] || period;
}