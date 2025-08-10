// Beta calculator for cryptocurrency volatility analysis
// Calculates beta coefficient between altcoin and Bitcoin

import { fetchPriceHistory } from './priceService';
import { fetchOptionsChain } from './optionsService';

export interface BetaCalculationResult {
  beta: number;
  correlation: number;
  altcoinVolatility: number;
  btcVolatility: number;
  rSquared: number;
  dataPoints: number;
  calculationPeriodDays: number;
}

export interface ImpliedVolatilityResult {
  impliedVolatility: number; // Annualized %
  source: 'deribit_options' | 'fallback';
  atmStrike: number;
  optionsUsed: number;
  calculationMethod: 'average_atm' | 'vwap' | 'simple';
}

export interface BtcImpliedVolDerivation {
  btcImpliedVol: ImpliedVolatilityResult;
  altcoinHistoricalVol: number;
  betaCoefficient: BetaCalculationResult;
  derivedAltcoinImpliedVol: number; // BTC implied vol * beta
  comparisonMetrics: {
    impliedVsHistoricalDiff: number; // percentage points difference
    impliedVsHistoricalRatio: number; // ratio
    confidence: 'high' | 'medium' | 'low';
  };
}

/**
 * Calculate beta coefficient between an altcoin and Bitcoin
 * Beta = Covariance(altcoin, BTC) / Variance(BTC)
 */
export async function calculateBetaCoefficient(
  altcoinId: string,
  periodDays: number = 90
): Promise<BetaCalculationResult> {
  try {
    console.log(`[Beta Calculator] 🔄 Computing beta for ${altcoinId} vs BTC over ${periodDays} days`);
    
    // Fetch price histories
    const [altcoinHistory, btcHistory] = await Promise.all([
      fetchPriceHistory(altcoinId, periodDays),
      fetchPriceHistory('bitcoin', periodDays)
    ]);
    
    if (altcoinHistory.length === 0 || btcHistory.length === 0) {
      throw new Error(`Insufficient price data for ${altcoinId} or Bitcoin`);
    }
    
    // Align data points by date
    const alignedData = alignPriceData(altcoinHistory, btcHistory);
    
    if (alignedData.length < 30) {
      throw new Error(`Insufficient aligned data points: ${alignedData.length} < 30`);
    }
    
    // Calculate daily returns
    const altcoinReturns = calculateDailyReturns(alignedData.map(d => d.altcoinPrice));
    const btcReturns = calculateDailyReturns(alignedData.map(d => d.btcPrice));
    
    // Calculate statistics
    const altcoinMean = calculateMean(altcoinReturns);
    const btcMean = calculateMean(btcReturns);
    
    const covariance = calculateCovariance(altcoinReturns, btcReturns, altcoinMean, btcMean);
    const btcVariance = calculateVariance(btcReturns, btcMean);
    const altcoinVariance = calculateVariance(altcoinReturns, altcoinMean);
    
    // Calculate beta and other metrics
    const beta = covariance / btcVariance;
    const correlation = covariance / Math.sqrt(btcVariance * altcoinVariance);
    const rSquared = correlation * correlation;
    
    // Annualize volatilities
    const altcoinVolatility = Math.sqrt(altcoinVariance) * Math.sqrt(365) * 100;
    const btcVolatility = Math.sqrt(btcVariance) * Math.sqrt(365) * 100;
    
    const result: BetaCalculationResult = {
      beta,
      correlation,
      altcoinVolatility,
      btcVolatility,
      rSquared,
      dataPoints: alignedData.length,
      calculationPeriodDays: periodDays
    };
    
    console.log(`[Beta Calculator] ✅ Beta calculation completed:`, {
      beta: beta.toFixed(3),
      correlation: correlation.toFixed(3),
      altcoinVol: altcoinVolatility.toFixed(1) + '%',
      btcVol: btcVolatility.toFixed(1) + '%',
      dataPoints: alignedData.length
    });
    
    return result;
    
  } catch (error) {
    console.error(`[Beta Calculator] ❌ Error calculating beta for ${altcoinId}:`, error);
    throw error;
  }
}

/**
 * Get Bitcoin's current implied volatility from options market
 */
export async function getBtcImpliedVolatility(): Promise<ImpliedVolatilityResult> {
  try {
    console.log(`[BTC IV] 🔄 Fetching BTC implied volatility from Deribit options...`);
    
    // Get current BTC price for ATM determination
    const btcPriceHistory = await fetchPriceHistory('bitcoin', 1);
    if (btcPriceHistory.length === 0) {
      throw new Error('Unable to fetch current BTC price');
    }
    const currentBtcPrice = btcPriceHistory[0].price;
    
    // Fetch options chain for multiple periods
    const periods = ['1Y', '6M', '3M'] as const;
    let optionsData = null;
    let usedPeriod = null;
    
    for (const period of periods) {
      try {
        const options = await fetchOptionsChain('BTC', period, currentBtcPrice, 'mark');
        if (options.length > 0) {
          optionsData = options;
          usedPeriod = period;
          console.log(`[BTC IV] ✅ Found ${options.length} BTC options for period ${period}`);
          break;
        }
      } catch (error) {
        console.warn(`[BTC IV] ⚠️ Failed to fetch options for period ${period}:`, error);
      }
    }
    
    if (!optionsData || optionsData.length === 0) {
      console.warn(`[BTC IV] ⚠️ No BTC options data found, using fallback`);
      return {
        impliedVolatility: 65.0, // Historical average for BTC
        source: 'fallback',
        atmStrike: currentBtcPrice,
        optionsUsed: 0,
        calculationMethod: 'simple'
      };
    }
    
    // Find ATM options (closest to current price)
    const atmOptions = optionsData
      .map(option => ({
        ...option,
        distanceFromAtm: Math.abs(option.strike - currentBtcPrice) / currentBtcPrice
      }))
      .sort((a, b) => a.distanceFromAtm - b.distanceFromAtm)
      .slice(0, 5); // Take closest 5 strikes
    
    // Calculate weighted average implied volatility
    let totalWeight = 0;
    let weightedIV = 0;
    
    atmOptions.forEach(option => {
      const weight = 1 / (1 + option.distanceFromAtm * 10); // Weight by proximity to ATM
      const iv = option.impliedVol;
      
      if (iv > 0 && iv < 300) { // Sanity check for IV
        weightedIV += iv * weight;
        totalWeight += weight;
      }
    });
    
    const averageIV = totalWeight > 0 ? weightedIV / totalWeight : 65.0;
    
    const result: ImpliedVolatilityResult = {
      impliedVolatility: averageIV,
      source: 'deribit_options',
      atmStrike: atmOptions[0]?.strike || currentBtcPrice,
      optionsUsed: atmOptions.length,
      calculationMethod: 'vwap'
    };
    
    console.log(`[BTC IV] ✅ BTC implied volatility calculated: ${averageIV.toFixed(1)}% (${atmOptions.length} options)`);
    
    return result;
    
  } catch (error) {
    console.error(`[BTC IV] ❌ Error fetching BTC implied volatility:`, error);
    
    // Return fallback
    return {
      impliedVolatility: 65.0,
      source: 'fallback',
      atmStrike: 0,
      optionsUsed: 0,
      calculationMethod: 'simple'
    };
  }
}

/**
 * Derive altcoin implied volatility using BTC implied volatility and beta
 */
export async function deriveAltcoinImpliedVolatility(
  altcoinId: string,
  altcoinHistoricalVol: number
): Promise<BtcImpliedVolDerivation> {
  console.log(`[Altcoin IV Derivation] 🔄 Starting derivation for ${altcoinId}`);
  
  // Get BTC implied volatility and calculate beta
  const [btcImpliedVol, betaResult] = await Promise.all([
    getBtcImpliedVolatility(),
    calculateBetaCoefficient(altcoinId)
  ]);
  
  // Derive altcoin implied volatility
  const derivedAltcoinImpliedVol = btcImpliedVol.impliedVolatility * betaResult.beta;
  
  // Calculate comparison metrics
  const impliedVsHistoricalDiff = derivedAltcoinImpliedVol - altcoinHistoricalVol;
  const impliedVsHistoricalRatio = derivedAltcoinImpliedVol / altcoinHistoricalVol;
  
  // Determine confidence based on correlation and R-squared
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (betaResult.rSquared > 0.7 && betaResult.correlation > 0.8) {
    confidence = 'high';
  } else if (betaResult.rSquared > 0.5 && betaResult.correlation > 0.6) {
    confidence = 'medium';
  }
  
  const result: BtcImpliedVolDerivation = {
    btcImpliedVol,
    altcoinHistoricalVol,
    betaCoefficient: betaResult,
    derivedAltcoinImpliedVol,
    comparisonMetrics: {
      impliedVsHistoricalDiff,
      impliedVsHistoricalRatio,
      confidence
    }
  };
  
  console.log(`[Altcoin IV Derivation] ✅ Derivation completed:`, {
    btcIV: btcImpliedVol.impliedVolatility.toFixed(1) + '%',
    beta: betaResult.beta.toFixed(3),
    derivedIV: derivedAltcoinImpliedVol.toFixed(1) + '%',
    historicalIV: altcoinHistoricalVol.toFixed(1) + '%',
    confidence
  });
  
  return result;
}

// Helper functions
interface AlignedPriceData {
  date: string;
  altcoinPrice: number;
  btcPrice: number;
}

function alignPriceData(altcoinHistory: any[], btcHistory: any[]): AlignedPriceData[] {
  const btcMap = new Map(btcHistory.map(item => [item.date, item.price]));
  
  return altcoinHistory
    .filter(item => btcMap.has(item.date))
    .map(item => ({
      date: item.date,
      altcoinPrice: item.price,
      btcPrice: btcMap.get(item.date)!
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function calculateDailyReturns(prices: number[]): number[] {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i-1]) / prices[i-1]);
  }
  return returns;
}

function calculateMean(values: number[]): number {
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateCovariance(x: number[], y: number[], meanX: number, meanY: number): number {
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    sum += (x[i] - meanX) * (y[i] - meanY);
  }
  return sum / (x.length - 1);
}

function calculateVariance(values: number[], mean: number): number {
  let sum = 0;
  for (const value of values) {
    sum += (value - mean) * (value - mean);
  }
  return sum / (values.length - 1);
}