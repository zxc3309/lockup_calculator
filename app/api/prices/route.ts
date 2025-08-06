import { NextRequest, NextResponse } from 'next/server';
import { fetchPrices } from '@/lib/priceService';
import { Token } from '@/types';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const debugLog: any[] = [];
  
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') as Token;
    const debug = searchParams.get('debug') === 'true';
    
    debugLog.push({
      step: 'parameter_validation',
      timestamp: Date.now(),
      params: { token }
    });
    
    if (!token || !['BTC', 'ETH'].includes(token)) {
      return NextResponse.json(
        { error: 'Invalid token. Must be BTC or ETH' },
        { status: 400 }
      );
    }
    
    console.log(`[API] Fetching prices for ${token}`);
    
    const fetchStartTime = Date.now();
    const prices = await fetchPrices(token);
    const fetchDuration = Date.now() - fetchStartTime;
    
    debugLog.push({
      step: 'prices_fetched',
      timestamp: Date.now(),
      duration: fetchDuration,
      spot_price: prices.spot
    });
    
    // 數據合理性檢查
    const qualityChecks = {
      spot_price_valid: prices.spot > 0,
      timestamp_fresh: (Date.now() - new Date(prices.timestamp).getTime()) < 60000 // less than 1 minute old
    };
    
    debugLog.push({
      step: 'quality_checks',
      timestamp: Date.now(),
      checks: qualityChecks
    });
    
    const totalDuration = Date.now() - startTime;
    
    const response = {
      ...prices,
      success: true,
      performance: {
        total_duration: totalDuration,
        fetch_duration: fetchDuration,
      },
      quality: qualityChecks,
      ...(debug && { debugLog })
    };
    
    console.log(`[API] Prices fetch completed in ${totalDuration}ms for ${token} at $${prices.spot}`);
    
    return NextResponse.json(response);
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    console.error('Error fetching prices:', error);
    
    debugLog.push({
      step: 'error_occurred',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch prices',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: errorDuration,
        debugLog
      },
      { status: 500 }
    );
  }
}