import { NextRequest, NextResponse } from 'next/server';
import { deriveAltcoinImpliedVolatility, BtcImpliedVolDerivation } from '@/lib/betaCalculator';
import { calculateHistoricalVolatility, fetchHistoricalPrices, getCurrentPrice } from '@/lib/historicalVolatility';
import { LockupPeriod } from '@/types';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('tokenId');
    const period = searchParams.get('period') as LockupPeriod;
    
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
    
    console.log(`[Beta Analysis API] 🚀 Starting beta analysis for ${tokenId}`);
    
    // Get historical volatility for comparison
    const historicalPricesResult = await fetchHistoricalPrices(tokenId, 90);
    const historicalVolResult = calculateHistoricalVolatility(historicalPricesResult.data, historicalPricesResult.provider);
    const historicalVolatility = historicalVolResult.annualizedVolatility * 100; // Convert to percentage
    
    console.log(`[Beta Analysis API] 📈 Historical volatility: ${historicalVolatility.toFixed(1)}%`);
    
    // Perform BTC implied volatility derivation
    const derivationResult: BtcImpliedVolDerivation = await deriveAltcoinImpliedVolatility(
      tokenId, 
      historicalVolatility
    );
    
    // Get current price for context
    const currentPriceResult = await getCurrentPrice(tokenId);
    
    const totalDuration = Date.now() - startTime;
    
    console.log(`[Beta Analysis API] ✅ Analysis completed in ${totalDuration}ms`);
    console.log(`[Beta Analysis API] 📊 Results:`, {
      beta: derivationResult.betaCoefficient.beta.toFixed(3),
      btcIV: derivationResult.btcImpliedVol.impliedVolatility.toFixed(1) + '%',
      derivedIV: derivationResult.derivedAltcoinImpliedVol.toFixed(1) + '%',
      historicalIV: derivationResult.altcoinHistoricalVol.toFixed(1) + '%',
      confidence: derivationResult.comparisonMetrics.confidence
    });
    
    const response = {
      success: true,
      tokenId,
      period,
      currentPrice: currentPriceResult.data,
      betaAnalysis: {
        beta: derivationResult.betaCoefficient.beta,
        correlation: derivationResult.betaCoefficient.correlation,
        rSquared: derivationResult.betaCoefficient.rSquared,
        altcoinVolatility: derivationResult.betaCoefficient.altcoinVolatility,
        btcVolatility: derivationResult.betaCoefficient.btcVolatility,
        dataPoints: derivationResult.betaCoefficient.dataPoints,
        calculationPeriodDays: derivationResult.betaCoefficient.calculationPeriodDays
      },
      btcImpliedVolatility: {
        impliedVolatility: derivationResult.btcImpliedVol.impliedVolatility,
        source: derivationResult.btcImpliedVol.source,
        atmStrike: derivationResult.btcImpliedVol.atmStrike,
        optionsUsed: derivationResult.btcImpliedVol.optionsUsed,
        calculationMethod: derivationResult.btcImpliedVol.calculationMethod
      },
      volatilityComparison: {
        historicalVolatility: derivationResult.altcoinHistoricalVol,
        derivedImpliedVolatility: derivationResult.derivedAltcoinImpliedVol,
        difference: derivationResult.comparisonMetrics.impliedVsHistoricalDiff,
        ratio: derivationResult.comparisonMetrics.impliedVsHistoricalRatio,
        confidence: derivationResult.comparisonMetrics.confidence
      },
      methodology: {
        description: 'BTC implied volatility scaled by altcoin-Bitcoin beta coefficient',
        formula: 'Altcoin Implied Vol = BTC Implied Vol × Beta',
        betaFormula: 'Beta = Covariance(altcoin, BTC) / Variance(BTC)',
        period: '90-day rolling calculation',
        btcImpliedVolSource: derivationResult.btcImpliedVol.source === 'deribit_options' ? 
          'Deribit BTC options (ATM weighted average)' : 'Historical fallback estimate'
      },
      performance: {
        totalDuration,
        timestamp: new Date().toISOString()
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    console.error('[Beta Analysis API] ❌ Error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to perform beta analysis',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: errorDuration,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}