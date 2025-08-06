import { NextRequest, NextResponse } from 'next/server';
import { fetchOptionsChain } from '@/lib/optionsService';
import { Token, LockupPeriod } from '@/types';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const debugLog: any[] = [];
  
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') as Token;
    const period = searchParams.get('period') as LockupPeriod;
    const spotPriceStr = searchParams.get('spotPrice');
    const debug = searchParams.get('debug') === 'true';
    
    debugLog.push({
      step: 'parameter_validation',
      timestamp: Date.now(),
      params: { token, period, spotPrice: spotPriceStr }
    });
    
    if (!token || !['BTC', 'ETH'].includes(token)) {
      return NextResponse.json(
        { error: 'Invalid token. Must be BTC or ETH' },
        { status: 400 }
      );
    }
    
    if (!period || !['3M', '6M', '1Y', '2Y'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Must be 3M, 6M, 1Y, or 2Y' },
        { status: 400 }
      );
    }
    
    if (!spotPriceStr) {
      return NextResponse.json(
        { error: 'Spot price is required' },
        { status: 400 }
      );
    }
    
    const spotPrice = parseFloat(spotPriceStr);
    if (isNaN(spotPrice) || spotPrice <= 0) {
      return NextResponse.json(
        { error: 'Invalid spot price' },
        { status: 400 }
      );
    }
    
    debugLog.push({
      step: 'validation_complete',
      timestamp: Date.now(),
      validated_params: { token, period, spotPrice }
    });
    
    console.log(`[API] Fetching options chain for ${token} ${period} with spot price ${spotPrice}`);
    
    const fetchStartTime = Date.now();
    const optionsData = await fetchOptionsChain(token, period, spotPrice);
    const fetchDuration = Date.now() - fetchStartTime;
    
    debugLog.push({
      step: 'options_data_fetched',
      timestamp: Date.now(),
      duration: fetchDuration,
      contracts_found: optionsData.length,
      spot_price_range: optionsData.length > 0 ? {
        min_strike: Math.min(...optionsData.map(o => o.strike)),
        max_strike: Math.max(...optionsData.map(o => o.strike)),
        closest_to_spot: optionsData.reduce((closest, current) => 
          Math.abs(current.strike - spotPrice) < Math.abs(closest.strike - spotPrice) 
            ? current : closest
        )
      } : null
    });
    
    // 數據品質檢查
    const qualityChecks = {
      has_valid_contracts: optionsData.length > 0,
      has_atm_contracts: optionsData.some(o => Math.abs(o.strike - spotPrice) / spotPrice < 0.05),
      avg_call_price: optionsData.length > 0 ? optionsData.reduce((sum, o) => sum + o.callPrice, 0) / optionsData.length : 0,
      avg_put_price: optionsData.length > 0 ? optionsData.reduce((sum, o) => sum + o.putPrice, 0) / optionsData.length : 0,
      price_sanity_check: optionsData.every(o => o.callPrice > 0 && o.putPrice > 0),
    };
    
    debugLog.push({
      step: 'quality_checks',
      timestamp: Date.now(),
      checks: qualityChecks
    });
    
    const totalDuration = Date.now() - startTime;
    
    const response = {
      success: true,
      token,
      period,
      spotPrice,
      optionsData,
      count: optionsData.length,
      timestamp: new Date().toISOString(),
      performance: {
        total_duration: totalDuration,
        fetch_duration: fetchDuration,
      },
      quality: qualityChecks,
      ...(debug && { debugLog })
    };
    
    console.log(`[API] Options data fetch completed in ${totalDuration}ms, found ${optionsData.length} contracts`);
    
    return NextResponse.json(response);
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    console.error('Error fetching options data:', error);
    
    debugLog.push({
      step: 'error_occurred',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch options data',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: errorDuration,
        debugLog
      },
      { status: 500 }
    );
  }
}