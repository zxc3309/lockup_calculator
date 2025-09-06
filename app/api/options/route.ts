import { NextRequest, NextResponse } from 'next/server';
import { fetchOptionsChain, fetchDualExpiryOptionsData } from '@/lib/optionsService';
import { calculateDiscountFromDualExpiry, lockupPeriodToDays } from '@/lib/calculator';
import { getTreasuryRateServer } from '@/lib/treasuryRates';
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
    
    console.log(`[API] 🚀 Fetching ${token} ${period} options; spot: $${spotPrice.toLocaleString()}`);
    
    const fetchStartTime = Date.now();
    
    // Phase 1: Try dual-expiry method
    console.log(`[API] 📊 Phase 1: Dual-expiry variance extrapolation...`);
    
    debugLog.push({
      step: 'dual_expiry_attempt',
      timestamp: Date.now(),
      phase: 1,
      method: 'dual_expiry_variance_extrapolation'
    });
    
    let dualExpiryData = null;
    let dualExpiryError = null;
    
    try {
      dualExpiryData = await fetchDualExpiryOptionsData(token, period, spotPrice);
      console.log(`[API] ✅ Dual-expiry data fetch ${dualExpiryData ? 'success' : 'failed'}`);
      
      if (dualExpiryData) {
        console.log(`[API] 📈 Strategy: ${dualExpiryData.strategy}`);
        console.log(`[API] 📈 Short: ${dualExpiryData.shortTerm.expiry} (${dualExpiryData.shortTerm.optionsData.length} contracts)`);
        console.log(`[API] 📈 Long: ${dualExpiryData.longTerm.expiry} (${dualExpiryData.longTerm.optionsData.length} contracts)`);
        console.log(`[API] 📈 Target T: ${dualExpiryData.targetTimeToExpiry.toFixed(3)} yr`);
      }
    } catch (error) {
      dualExpiryError = error;
      console.error(`[API] ❌ Dual-expiry data fetch failed:`, error);
    }
    
    // Phase 2: Dual-expiry discount calculation
    let optionsData: any[] = [];
    let calculationMethod = 'single_expiry_fallback';
    let dualExpiryCalculation = null;
    let calculationError = null;
    
    if (dualExpiryData) {
      console.log(`[API] 🧮 Phase 2: Run dual-expiry discount calculation...`);
      
      try {
        const lockupDays = lockupPeriodToDays(period);
        
        // Get treasury rate based on period
        const treasuryPeriodMap: Record<LockupPeriod, '3M' | '6M' | '1Y' | '2Y'> = {
          '3M': '3M',
          '6M': '6M', 
          '1Y': '1Y',
          '2Y': '2Y'
        };
        
        const treasuryPeriod = treasuryPeriodMap[period];
        const riskFreeRate = await getTreasuryRateServer(treasuryPeriod);
        
        console.log(`[API] 💰 Using ${treasuryPeriod} treasury rate: ${(riskFreeRate * 100).toFixed(2)}%`);
        
        debugLog.push({
          step: 'dual_expiry_calculation_start',
          timestamp: Date.now(),
          phase: 2,
          lockup_days: lockupDays,
          risk_free_rate: riskFreeRate,
          treasury_period: treasuryPeriod,
          strategy: dualExpiryData.strategy,
          short_term_expiry: dualExpiryData.shortTerm.expiry,
          long_term_expiry: dualExpiryData.longTerm.expiry
        });
        
        dualExpiryCalculation = calculateDiscountFromDualExpiry(dualExpiryData, spotPrice, lockupDays, riskFreeRate);
        calculationMethod = 'dual_expiry_variance_extrapolation';
        
        // Use long-term contracts for display
        optionsData = dualExpiryData.longTerm.optionsData;
        
        console.log(`[API] ✅ Dual-expiry calculation success!`);
        console.log(`[API] 💰 Call discount: ${dualExpiryCalculation.callDiscount?.toFixed(2)}%`);
        console.log(`[API] 💰 Put discount: ${dualExpiryCalculation.putDiscount?.toFixed(2)}%`);
        console.log(`[API] 📊 Extrapolated IV: ${dualExpiryCalculation.impliedVolatility?.toFixed(1)}%`);
        
        debugLog.push({
          step: 'dual_expiry_calculation_success',
          timestamp: Date.now(),
          phase: 2,
          call_discount: dualExpiryCalculation.callDiscount,
          put_discount: dualExpiryCalculation.putDiscount,
          extrapolated_volatility: dualExpiryCalculation.impliedVolatility,
          total_contracts: dualExpiryCalculation.totalContracts
        });
        
      } catch (error) {
        calculationError = error;
        console.error(`[API] ❌ Dual-expiry calculation failed:`, error);
      
        debugLog.push({
          step: 'dual_expiry_calculation_error',
          timestamp: Date.now(),
          phase: 2,
          error: error instanceof Error ? error.message : 'Unknown error',
          error_type: error instanceof Error ? error.constructor.name : 'Unknown'
        });
      }
    }
    
    // Phase 3: Fallback to Single Expiry Method
    if (!dualExpiryCalculation) {
      console.log(`[API] 🔄 Phase 3: Falling back to single-expiry method...`);
      console.log(`[API] 🔄 Reason: ${dualExpiryData ? 'calculation_failed' : 'data_fetch_failed'}`);
      
      if (dualExpiryError) {
        console.log(`[API] 🔄 Dual-expiry fetch error: ${dualExpiryError instanceof Error ? dualExpiryError.message : String(dualExpiryError)}`);
      }
      if (calculationError) {
        console.log(`[API] 🔄 Dual-expiry calc error: ${calculationError instanceof Error ? calculationError.message : String(calculationError)}`);
      }
      
      debugLog.push({
        step: 'fallback_to_single_expiry',
        timestamp: Date.now(),
        phase: 3,
        reason: dualExpiryData ? 'calculation_failed' : 'data_fetch_failed',
        dual_expiry_error: dualExpiryError instanceof Error ? dualExpiryError.message : String(dualExpiryError),
        calculation_error: calculationError instanceof Error ? calculationError.message : String(calculationError)
      });
      
      try {
        optionsData = await fetchOptionsChain(token, period, spotPrice);
        calculationMethod = 'single_expiry_nearest_match';
        
        console.log(`[API] ✅ Single-expiry data success: ${optionsData.length} contracts`);
        
        debugLog.push({
          step: 'single_expiry_success',
          timestamp: Date.now(),
          phase: 3,
          contracts_found: optionsData.length
        });
        
      } catch (singleExpiryError) {
        console.error(`[API] ❌ Single-expiry method also failed:`, singleExpiryError);
        
        debugLog.push({
          step: 'single_expiry_failed',
          timestamp: Date.now(),
          phase: 3,
          error: singleExpiryError instanceof Error ? singleExpiryError.message : 'Unknown error'
        });
        
        // If all methods fail, throw detailed error
        const dualErrorMsg = dualExpiryError instanceof Error ? dualExpiryError.message : String(dualExpiryError || 'N/A');
        const calcErrorMsg = calculationError instanceof Error ? calculationError.message : String(calculationError || 'N/A');
        const singleErrorMsg = singleExpiryError instanceof Error ? singleExpiryError.message : String(singleExpiryError);
        throw new Error(`All option data methods failed. dual_expiry_error: ${dualErrorMsg}, calc_error: ${calcErrorMsg}, single_expiry_error: ${singleErrorMsg}`);
      }
    }
    
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
      // 新增雙到期日計算相關信息
      calculationMethod,
      ...(dualExpiryCalculation && {
        dualExpiryCalculation,
        dualExpiryInfo: dualExpiryData ? {
          strategy: dualExpiryData.strategy,
          shortTermExpiry: dualExpiryData.shortTerm.expiry,
          longTermExpiry: dualExpiryData.longTerm.expiry,
          shortTermIV: dualExpiryData.shortTerm.impliedVol,
          longTermIV: dualExpiryData.longTerm.impliedVol,
          targetTimeToExpiry: dualExpiryData.targetTimeToExpiry
        } : null
      }),
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
