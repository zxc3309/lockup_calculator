import { NextRequest, NextResponse } from 'next/server';
import { fetchHistoricalPrices, calculateHistoricalVolatility, getCurrentPrice } from '@/lib/historicalVolatility';
import { lockupPeriodToDays } from '@/lib/calculator';
import { getTreasuryRateServer } from '@/lib/treasuryRates';
import { deriveAltcoinImpliedVolatility, BtcImpliedVolDerivation } from '@/lib/betaCalculator';
import { LockupPeriod } from '@/types';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

// Black-Scholes Call option pricing function
function blackScholesCall(
  S: number,     // Current price
  K: number,     // Strike price (target price)
  T: number,     // Time to expiry (years)
  r: number,     // Risk-free rate
  sigma: number  // Volatility
): number {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  // Standard normal cumulative distribution function approximation
  const normCdf = (x: number): number => {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

    return 0.5 * (1.0 + sign * y);
  };
  
  return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const debugLog: any[] = [];
  
  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('tokenId');
    const period = searchParams.get('period') as LockupPeriod;
    const targetPriceStr = searchParams.get('targetPrice');
    const volatilityDaysStr = searchParams.get('volatilityDays');
    const debug = searchParams.get('debug') === 'true';
    
    // Parse volatility days with default value of 90
    const volatilityDays = volatilityDaysStr ? parseInt(volatilityDaysStr) : 90;
    
    debugLog.push({
      step: 'parameter_validation',
      timestamp: Date.now(),
      params: { tokenId, period, targetPrice: targetPriceStr, volatilityDays }
    });
    
    // Validate inputs
    if (!tokenId) {
      return NextResponse.json(
        { error: 'Token ID is required' },
        { status: 400 }
      );
    }
    
    if (!period || !['3M', '6M', '1Y', '2Y'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Must be 3M, 6M, 1Y, or 2Y' },
        { status: 400 }
      );
    }
    
    if (!targetPriceStr) {
      return NextResponse.json(
        { error: 'Target price is required' },
        { status: 400 }
      );
    }
    
    const targetPrice = parseFloat(targetPriceStr);
    if (isNaN(targetPrice) || targetPrice <= 0) {
      return NextResponse.json(
        { error: 'Invalid target price' },
        { status: 400 }
      );
    }
    
    // Validate volatility days
    if (![60, 90, 180].includes(volatilityDays)) {
      return NextResponse.json(
        { error: 'Invalid volatility days. Must be 60, 90, or 180' },
        { status: 400 }
      );
    }
    
    console.log(`[Custom Token API] 🚀 計算 ${tokenId} ${period} 折扣率, 目標價格: $${targetPrice}, 波動率天數: ${volatilityDays}`);
    
    debugLog.push({
      step: 'validation_complete',
      timestamp: Date.now(),
      validated_params: { tokenId, period, targetPrice, volatilityDays }
    });
    
    // Phase 1: Get current price with multi-API support
    console.log(`[Custom Token API] 📊 Phase 1: 獲取 ${tokenId} 當前價格...`);
    
    const currentPriceStartTime = Date.now();
    const currentPriceResult = await getCurrentPrice(tokenId);
    const currentPrice = currentPriceResult.data;
    const currentPriceDuration = Date.now() - currentPriceStartTime;
    
    console.log(`[Custom Token API] ✅ 當前價格: $${currentPrice} (來源: ${currentPriceResult.provider.toUpperCase()}${currentPriceResult.cached ? ', 緩存' : ''})`);
    
    debugLog.push({
      step: 'current_price_fetched',
      timestamp: Date.now(),
      current_price: currentPrice,
      api_provider: currentPriceResult.provider,
      cached: currentPriceResult.cached || false,
      duration: currentPriceDuration
    });
    
    // Phase 2: Fetch historical data and calculate volatility with multi-API support
    console.log(`[Custom Token API] 📈 Phase 2: 獲取 ${volatilityDays} 天歷史數據並計算波動率...`);
    
    const historicalStartTime = Date.now();
    const historicalPricesResult = await fetchHistoricalPrices(tokenId, volatilityDays);
    const volatilityResult = calculateHistoricalVolatility(historicalPricesResult.data, historicalPricesResult.provider);
    const historicalDuration = Date.now() - historicalStartTime;
    
    console.log(`[Custom Token API] ✅ 年化波動率: ${(volatilityResult.annualizedVolatility * 100).toFixed(1)}% (來源: ${historicalPricesResult.provider.toUpperCase()}${historicalPricesResult.cached ? ', 緩存' : ''})`);
    
    debugLog.push({
      step: 'volatility_calculated',
      timestamp: Date.now(),
      data_points: volatilityResult.dataPoints,
      annualized_volatility: volatilityResult.annualizedVolatility,
      historical_api_provider: historicalPricesResult.provider,
      historical_data_cached: historicalPricesResult.cached || false,
      historical_days: volatilityDays,
      duration: historicalDuration
    });
    
    // Phase 3: Calculate option pricing
    console.log(`[Custom Token API] 🧮 Phase 3: 計算期權價格...`);
    
    const lockupDays = lockupPeriodToDays(period);
    const timeToExpiry = lockupDays / 365; // Convert to years
    
    // Get dynamic treasury rate based on lockup period
    const treasuryPeriodMap: Record<LockupPeriod, '3M' | '6M' | '1Y' | '2Y'> = {
      '3M': '3M',
      '6M': '6M', 
      '1Y': '1Y',
      '2Y': '2Y'
    };
    
    const treasuryPeriod = treasuryPeriodMap[period];
    const riskFreeRate = await getTreasuryRateServer(treasuryPeriod);
    
    console.log(`[Custom Token API] 💰 Using ${treasuryPeriod} treasury rate: ${(riskFreeRate * 100).toFixed(2)}%`);
    
    const calculationStartTime = Date.now();
    
    // Calculate Call option with strike = target price
    const theoreticalCallPrice = blackScholesCall(
      currentPrice,        // Current spot price
      targetPrice,         // Strike price (user's target)
      timeToExpiry,        // Time to expiry
      riskFreeRate,        // Risk-free rate
      volatilityResult.annualizedVolatility  // Volatility
    );
    
    // Calculate discount rate
    const callDiscountRate = (theoreticalCallPrice / currentPrice) * 100;
    const annualizedRate = (callDiscountRate * 365) / lockupDays;
    
    // Calculate fair value (current price - option premium)
    const fairValue = currentPrice - theoreticalCallPrice;
    
    const calculationDuration = Date.now() - calculationStartTime;
    
    console.log(`[Custom Token API] ✅ 計算完成!`);
    console.log(`[Custom Token API] 💰 Call期權價格: $${theoreticalCallPrice.toFixed(4)}`);
    console.log(`[Custom Token API] 📊 折扣率: ${callDiscountRate.toFixed(2)}%`);
    console.log(`[Custom Token API] 📈 年化折扣率: ${annualizedRate.toFixed(2)}%`);
    
    debugLog.push({
      step: 'calculation_complete',
      timestamp: Date.now(),
      theoretical_call_price: theoreticalCallPrice,
      discount_rate: callDiscountRate,
      annualized_rate: annualizedRate,
      duration: calculationDuration
    });
    
    const totalDuration = Date.now() - startTime;
    
    // Prepare response
    const response = {
      success: true,
      tokenId,
      period,
      calculation: {
        currentPrice,
        targetPrice,
        theoreticalCallPrice,
        callDiscountRate,
        annualizedRate,
        fairValue,
        method: 'historical-volatility-target-price',
        impliedVolatility: volatilityResult.annualizedVolatility * 100, // Convert to percentage
        timeToExpiry,
        riskFreeRate: riskFreeRate * 100, // Convert to percentage
        lockupDays
      },
      volatilityAnalysis: {
        annualizedVolatility: volatilityResult.annualizedVolatility * 100,
        dailyVolatility: volatilityResult.dailyVolatility * 100,
        dataPoints: volatilityResult.dataPoints,
        historicalDays: volatilityDays,
        actualDataPoints: historicalPricesResult.data.length,
        apiProvider: historicalPricesResult.provider,
        cached: historicalPricesResult.cached || false
      },
      blackScholesParameters: {
        spotPrice: currentPrice,
        strikePrice: targetPrice,
        timeToExpiry,
        riskFreeRate: riskFreeRate * 100, // Convert to percentage
        volatility: volatilityResult.annualizedVolatility * 100,
        lockupDays
      },
      targetPriceAnalysis: {
        currentPrice,
        targetPrice,
        multiplier: targetPrice / currentPrice,
        percentageIncrease: ((targetPrice / currentPrice) - 1) * 100,
        moneyness: targetPrice > currentPrice ? 'OTM' : targetPrice < currentPrice ? 'ITM' : 'ATM'
      },
      performance: {
        total_duration: totalDuration,
        current_price_duration: currentPriceDuration,
        historical_data_duration: historicalDuration,
        calculation_duration: calculationDuration
      },
      timestamp: new Date().toISOString(),
      ...(debug && { debugLog })
    };
    
    console.log(`[Custom Token API] 🎉 ${tokenId} 計算完成，耗時 ${totalDuration}ms`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    console.error('[Custom Token API] ❌ Error:', error);
    
    debugLog.push({
      step: 'error_occurred',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to calculate custom token discount',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: errorDuration,
        debugLog
      },
      { status: 500 }
    );
  }
}