import { NextRequest, NextResponse } from 'next/server';
import { apiCache, cacheKeys, cacheTTL } from '@/lib/apiCache';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

// Treasury series mapping for different periods
const TREASURY_SERIES_MAP = {
  '3M': 'DGS3MO',   // 3-Month Treasury
  '6M': 'DGS6MO',   // 6-Month Treasury  
  '1Y': 'DGS1',     // 1-Year Treasury
  '2Y': 'DGS2'      // 2-Year Treasury
} as const;

// Fallback rates (current market rates as of Aug 2025)
const FALLBACK_RATES = {
  '3M': 4.20,
  '6M': 4.23,
  '1Y': 4.25,
  '2Y': 4.30
} as const;

type Period = keyof typeof TREASURY_SERIES_MAP;

// FRED API interface
interface FredResponse {
  observations: {
    realtime_start: string;
    realtime_end: string;
    date: string;
    value: string;
  }[];
}

// Treasury rate cache interface
interface TreasuryRateData {
  period: Period;
  rate: number;
  series_id: string;
  date: string;
  source: string;
}

async function fetchTreasuryRateFromFRED(seriesId: string): Promise<{ rate: number; date: string } | null> {
  const fredApiKey = process.env.FRED_API_KEY;
  
  if (!fredApiKey) {
    console.warn('[Treasury API] ⚠️ FRED_API_KEY not found, using fallback rates');
    return null;
  }

  try {
    console.log(`[Treasury API] 🔄 Fetching ${seriesId} from FRED API...`);
    
    // Get the most recent data point
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json&limit=1&sort_order=desc`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BTC-ETH-Lockup-Calculator/1.0'
      }
    });

    if (!response.ok) {
      console.error(`[Treasury API] ❌ FRED API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: FredResponse = await response.json();
    
    if (!data.observations || data.observations.length === 0) {
      console.error(`[Treasury API] ❌ No data returned for series ${seriesId}`);
      return null;
    }

    const observation = data.observations[0];
    
    if (observation.value === '.') {
      console.warn(`[Treasury API] ⚠️ No value available for ${seriesId} on ${observation.date}`);
      return null;
    }

    const rate = parseFloat(observation.value);
    if (isNaN(rate)) {
      console.error(`[Treasury API] ❌ Invalid rate value: ${observation.value} for ${seriesId}`);
      return null;
    }

    console.log(`[Treasury API] ✅ ${seriesId}: ${rate}% (${observation.date})`);
    
    return {
      rate,
      date: observation.date
    };
    
  } catch (error) {
    console.error(`[Treasury API] ❌ Error fetching ${seriesId}:`, error);
    return null;
  }
}

async function getTreasuryRate(period: Period): Promise<TreasuryRateData> {
  // Check cache first
  const cacheKey = `treasury_rate_${period}`;
  const cached = apiCache.get<TreasuryRateData>(cacheKey);
  
  if (cached) {
    console.log(`[Treasury API] 💾 Cache hit for ${period}: ${cached.data.rate}%`);
    return cached.data;
  }

  const seriesId = TREASURY_SERIES_MAP[period];
  
  // Try to fetch from FRED API
  const fredData = await fetchTreasuryRateFromFRED(seriesId);
  
  let result: TreasuryRateData;
  
  if (fredData) {
    result = {
      period,
      rate: fredData.rate / 100, // Convert percentage to decimal
      series_id: seriesId,
      date: fredData.date,
      source: 'FRED'
    };
  } else {
    // Fallback to hardcoded rates
    console.warn(`[Treasury API] 🔄 Using fallback rate for ${period}`);
    
    result = {
      period,
      rate: FALLBACK_RATES[period] / 100, // Convert percentage to decimal
      series_id: seriesId,
      date: new Date().toISOString().split('T')[0], // Today's date
      source: 'FALLBACK'
    };
  }

  // Cache for 24 hours (Treasury data updates daily)
  apiCache.set(cacheKey, result, 24 * 60 * 60 * 1000, result.source);
  
  return result;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') as Period;
    
    // Validate period parameter
    if (!period || !Object.keys(TREASURY_SERIES_MAP).includes(period)) {
      return NextResponse.json(
        { 
          error: 'Invalid period. Must be one of: 3M, 6M, 1Y, 2Y',
          available_periods: Object.keys(TREASURY_SERIES_MAP)
        },
        { status: 400 }
      );
    }

    console.log(`[Treasury API] 🚀 Fetching ${period} U.S. Treasury rate...`);

    const treasuryData = await getTreasuryRate(period);
    const duration = Date.now() - startTime;

    console.log(`[Treasury API] ✅ ${period} rate: ${(treasuryData.rate * 100).toFixed(2)}% (source: ${treasuryData.source}, in ${duration}ms)`);

    return NextResponse.json({
      success: true,
      ...treasuryData,
      rate_percentage: treasuryData.rate * 100, // Also include percentage format
      performance: {
        duration,
        cached: treasuryData.source !== 'FRED' || apiCache.has(`treasury_rate_${period}`)
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Treasury API] ❌ Error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch treasury rate',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration
      },
      { status: 500 }
    );
  }
}
