import { NextRequest, NextResponse } from 'next/server';
import { fetchOptionsChain, fetchDualExpiryOptionsData } from '@/lib/optionsService';
import { calculateDiscountFromDualExpiry } from '@/lib/calculator';
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
    
    console.log(`[API] 🚀 開始獲取 ${token} ${period} 選擇權數據，現貨價格: $${spotPrice.toLocaleString()}`);
    
    const fetchStartTime = Date.now();
    
    // Phase 1: 嘗試使用雙到期日方法
    console.log(`[API] 📊 Phase 1: 嘗試雙到期日方差外推法...`);
    
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
      console.log(`[API] ✅ 雙到期日數據獲取${dualExpiryData ? '成功' : '失敗'}`);
      
      if (dualExpiryData) {
        console.log(`[API] 📈 雙到期日策略: ${dualExpiryData.strategy}`);
        console.log(`[API] 📈 短期: ${dualExpiryData.shortTerm.expiry} (${dualExpiryData.shortTerm.optionsData.length}個合約)`);
        console.log(`[API] 📈 長期: ${dualExpiryData.longTerm.expiry} (${dualExpiryData.longTerm.optionsData.length}個合約)`);
        console.log(`[API] 📈 目標時間: ${dualExpiryData.targetTimeToExpiry.toFixed(3)}年`);
      }
    } catch (error) {
      dualExpiryError = error;
      console.error(`[API] ❌ 雙到期日數據獲取失敗:`, error);
    }
    
    // Phase 2: 雙到期日折扣率計算
    let optionsData: any[] = [];
    let calculationMethod = 'single_expiry_fallback';
    let dualExpiryCalculation = null;
    let calculationError = null;
    
    if (dualExpiryData) {
      console.log(`[API] 🧮 Phase 2: 執行雙到期日折扣率計算...`);
      
      try {
        const lockupDays = period === '3M' ? 90 : period === '6M' ? 180 : period === '1Y' ? 365 : 730;
        
        debugLog.push({
          step: 'dual_expiry_calculation_start',
          timestamp: Date.now(),
          phase: 2,
          lockup_days: lockupDays,
          strategy: dualExpiryData.strategy,
          short_term_expiry: dualExpiryData.shortTerm.expiry,
          long_term_expiry: dualExpiryData.longTerm.expiry
        });
        
        dualExpiryCalculation = calculateDiscountFromDualExpiry(dualExpiryData, spotPrice, lockupDays);
        calculationMethod = 'dual_expiry_variance_extrapolation';
        
        // 使用長期合約作為展示數據
        optionsData = dualExpiryData.longTerm.optionsData;
        
        console.log(`[API] ✅ 雙到期日計算成功!`);
        console.log(`[API] 💰 Call折扣: ${dualExpiryCalculation.callDiscount?.toFixed(2)}%`);
        console.log(`[API] 💰 Put折扣: ${dualExpiryCalculation.putDiscount?.toFixed(2)}%`);
        console.log(`[API] 📊 外推波動率: ${dualExpiryCalculation.impliedVolatility?.toFixed(1)}%`);
        
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
        console.error(`[API] ❌ 雙到期日計算失敗:`, error);
        
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
      console.log(`[API] 🔄 Phase 3: 回退到單一到期日方法...`);
      console.log(`[API] 🔄 回退原因: ${dualExpiryData ? '計算失敗' : '數據獲取失敗'}`);
      
      if (dualExpiryError) {
        console.log(`[API] 🔄 雙到期日獲取錯誤: ${dualExpiryError instanceof Error ? dualExpiryError.message : String(dualExpiryError)}`);
      }
      if (calculationError) {
        console.log(`[API] 🔄 雙到期日計算錯誤: ${calculationError instanceof Error ? calculationError.message : String(calculationError)}`);
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
        
        console.log(`[API] ✅ 單一到期日數據獲取成功: ${optionsData.length}個合約`);
        
        debugLog.push({
          step: 'single_expiry_success',
          timestamp: Date.now(),
          phase: 3,
          contracts_found: optionsData.length
        });
        
      } catch (singleExpiryError) {
        console.error(`[API] ❌ 單一到期日方法也失敗了:`, singleExpiryError);
        
        debugLog.push({
          step: 'single_expiry_failed',
          timestamp: Date.now(),
          phase: 3,
          error: singleExpiryError instanceof Error ? singleExpiryError.message : 'Unknown error'
        });
        
        // 如果所有方法都失敗，拋出錯誤
        const dualErrorMsg = dualExpiryError instanceof Error ? dualExpiryError.message : String(dualExpiryError || 'N/A');
        const calcErrorMsg = calculationError instanceof Error ? calculationError.message : String(calculationError || 'N/A');
        const singleErrorMsg = singleExpiryError instanceof Error ? singleExpiryError.message : String(singleExpiryError);
        throw new Error(`所有選擇權數據獲取方法都失敗了。雙到期日錯誤: ${dualErrorMsg}, 計算錯誤: ${calcErrorMsg}, 單一到期日錯誤: ${singleErrorMsg}`);
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