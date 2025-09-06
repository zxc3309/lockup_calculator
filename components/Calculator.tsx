'use client';

import { useState } from 'react';
import { Token, LockupPeriod, PriceData, DiscountCalculation, OptionData, CalculationStep, RawATMContract, TokenCalculationMode, CustomTokenInput as CustomTokenInputType } from '@/types';
import { lockupPeriodToDays, calculateDiscountFromOptions, validateOptionsData } from '@/lib/calculator';
import { getTreasuryRateForPeriod } from '@/lib/treasuryRates';
import CalculationFlow, { CALCULATION_STEPS_TEMPLATE } from './CalculationFlow';
import DiscountResults from './DiscountResults';
import HistoricalVolatilityResults from './HistoricalVolatilityResults';
import BetaImpliedVolatilityResults from './BetaImpliedVolatilityResults';
import TokenModeSelector from './TokenModeSelector';
import CustomTokenInput from './CustomTokenInput';
import MadeByBill from './MadeByBill';

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

export default function Calculator() {
  // 計算模式狀態
  const [calculationMode, setCalculationMode] = useState<TokenCalculationMode>('market-data');
  const [customTokenInput, setCustomTokenInput] = useState<CustomTokenInputType | null>(null);
  const [customTokenApiResult, setCustomTokenApiResult] = useState<any>(null);
  
  // Beta分析相關狀態
  const [betaAnalysisResult, setBetaAnalysisResult] = useState<any>(null);
  const [historicalCalculation, setHistoricalCalculation] = useState<DiscountCalculation | null>(null);
  
  // 原有狀態
  const [token, setToken] = useState<Token>('BTC');
  const [period, setPeriod] = useState<LockupPeriod>('6M');
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculation, setCalculation] = useState<DiscountCalculation | null>(null);
  const [optionsData, setOptionsData] = useState<OptionData[] | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [dualExpiryInfo, setDualExpiryInfo] = useState<any>(null);
  

  // 新的UI狀態
  const [calculationSteps, setCalculationSteps] = useState<CalculationStep[]>([]);
  const [showCalculationFlow, setShowCalculationFlow] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');

  // 計算步驟管理函數
  const initializeCalculationSteps = () => {
    const steps = [
      { ...CALCULATION_STEPS_TEMPLATE.MARKET_DATA },
      { ...CALCULATION_STEPS_TEMPLATE.DUAL_EXPIRY_SELECTION },
      { ...CALCULATION_STEPS_TEMPLATE.COMMON_STRIKES },
      { ...CALCULATION_STEPS_TEMPLATE.VARIANCE_EXTRAPOLATION },
      { ...CALCULATION_STEPS_TEMPLATE.BLACK_SCHOLES },
      { ...CALCULATION_STEPS_TEMPLATE.DISCOUNT_CALCULATION }
    ];
    setCalculationSteps(steps);
    setShowCalculationFlow(true);
  };

  const updateCalculationStep = (stepId: string, updates: Partial<CalculationStep>) => {
    setCalculationSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, ...updates, timestamp: new Date() }
        : step
    ));
    setCurrentStep(stepId);
  };

  // Custom token calculation
  const calculateCustomToken = async () => {
    if (!customTokenInput) {
      alert('Please complete token settings');
      return;
    }
    
    setLoading(true);
    setCalculation(null);
    setBetaAnalysisResult(null);
    setHistoricalCalculation(null);
    
    const volatilityMethod = (customTokenInput as any).volatilityMethod || 'historical';
    
    try {
      console.log(`[Calculator] 🚀 Start custom token calculation: ${customTokenInput.symbol} (method: ${volatilityMethod})`);
      
      if (volatilityMethod === 'btc-implied') {
        // Use BTC-implied volatility derivation
        await calculateWithBtcImpliedVolatility();
      } else {
        // Use historical volatility method
        await calculateWithHistoricalVolatility();
      }
      
    } catch (error) {
      console.error('[Calculator] ❌ Custom token calculation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Calculation failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Historical volatility calculation method
  const calculateWithHistoricalVolatility = async () => {
    const volatilityDays = customTokenInput!.volatilityDays || 90;
    const response = await fetch(
      `/api/custom-token?tokenId=${customTokenInput!.symbol}&period=${customTokenInput!.period}&targetPrice=${customTokenInput!.targetPrice}&volatilityDays=${volatilityDays}`
    );
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.details || result.error || 'Calculation failed');
    }
    
    console.log(`[Calculator] ✅ Historical volatility calculation completed:`, result.calculation);
    
    // Convert to DiscountCalculation compatible format
    const customCalculation: DiscountCalculation = {
      annualizedRate: result.calculation.annualizedRate,
      fairValue: result.calculation.fairValue,
      discount: result.calculation.callDiscountRate,
      method: result.calculation.method,
      callDiscount: result.calculation.callDiscountRate,
      putDiscount: 0, // 自定義代幣模式只計算 Call
      impliedVolatility: result.calculation.impliedVolatility,
      theoreticalCallPrice: result.calculation.theoreticalCallPrice,
      theoreticalPutPrice: 0, // 自定義代幣模式不計算 Put
    };
    
    setCalculation(customCalculation);
    setCustomTokenApiResult(result); // Save full API result
    
    // Set pseudo price data for display
    setPrices({
      token: 'BTC', // placeholder
      spot: result.calculation.currentPrice,
      timestamp: new Date()
    });
  };
  
  // BTC-implied volatility derived method
  const calculateWithBtcImpliedVolatility = async () => {
    // Fetch beta analysis first
    const betaResponse = await fetch(
      `/api/beta-analysis?tokenId=${customTokenInput!.symbol}&period=${customTokenInput!.period}`
    );
    
    if (!betaResponse.ok) {
      throw new Error(`Beta analysis failed: ${betaResponse.status}`);
    }
    
    const betaResult = await betaResponse.json();
    
    if (!betaResult.success) {
      throw new Error(betaResult.details || betaResult.error || 'Beta analysis failed');
    }
    
    console.log(`[Calculator] ✅ Beta analysis completed:`, betaResult);
    setBetaAnalysisResult(betaResult);
    
    // Also fetch historical volatility as comparison
    try {
      const volatilityDays = customTokenInput!.volatilityDays || 90;
      const historicalResponse = await fetch(
        `/api/custom-token?tokenId=${customTokenInput!.symbol}&period=${customTokenInput!.period}&targetPrice=${customTokenInput!.targetPrice}&volatilityDays=${volatilityDays}`
      );
      
      if (historicalResponse.ok) {
        const historicalResult = await historicalResponse.json();
        if (historicalResult.success) {
          const historicalCalc: DiscountCalculation = {
            annualizedRate: historicalResult.calculation.annualizedRate,
            fairValue: historicalResult.calculation.fairValue,
            discount: historicalResult.calculation.callDiscountRate,
            method: historicalResult.calculation.method,
            callDiscount: historicalResult.calculation.callDiscountRate,
            putDiscount: 0,
            impliedVolatility: historicalResult.calculation.impliedVolatility,
            theoreticalCallPrice: historicalResult.calculation.theoreticalCallPrice,
            theoreticalPutPrice: 0,
          };
          setHistoricalCalculation(historicalCalc);
        }
      }
    } catch (error) {
      console.warn('[Calculator] ⚠️ Unable to fetch historical volatility comparison:', error);
    }
    
    // 使用BTC推導的隱含波動率和正確的Black-Scholes公式計算Call價格
    const derivedImpliedVol = betaResult.volatilityComparison.derivedImpliedVolatility / 100; // Convert to decimal
    const lockupDays = customTokenInput!.period === '1Y' ? 365 : customTokenInput!.period === '6M' ? 180 : customTokenInput!.period === '3M' ? 90 : 730;
    const timeToExpiry = lockupDays / 365; // Convert to years
    
    // Get risk-free rate (using the same treasury rate logic)
    const riskFreeRate = await getTreasuryRateForPeriod(customTokenInput!.period);
    
    // Calculate Call option price using correct Black-Scholes formula
    const theoreticalCallPrice = blackScholesCall(
      betaResult.currentPrice,        // S: Current spot price
      customTokenInput!.targetPrice,  // K: Strike price (target price)
      timeToExpiry,                   // T: Time to expiry
      riskFreeRate,                   // r: Risk-free rate
      derivedImpliedVol              // σ: Derived implied volatility
    );
    
    // Calculate correct discount rate: Call price / Spot price
    const callDiscountRate = (theoreticalCallPrice / betaResult.currentPrice) * 100;
    const annualizedRate = (callDiscountRate * 365) / lockupDays;
    const fairValue = betaResult.currentPrice - theoreticalCallPrice;
    
    // 模擬Black-Scholes計算使用推導的隱含波動率
    const btcCalculation: DiscountCalculation = {
      annualizedRate,
      fairValue,
      discount: callDiscountRate,
      method: 'btc-implied-volatility',
      callDiscount: callDiscountRate,
      putDiscount: 0,
      impliedVolatility: betaResult.volatilityComparison.derivedImpliedVolatility,
      theoreticalCallPrice,
      theoreticalPutPrice: 0,
    };
    
    setCalculation(btcCalculation);
    
    // 設定虛擬價格數據
    setPrices({
      token: 'BTC',
      spot: betaResult.currentPrice,
      timestamp: new Date()
    });
  };

  const updatePrices = async () => {
    setLoading(true);
    setOptionsLoading(true);
    
    // Initialize calculation steps
    initializeCalculationSteps();
    
    // Reset previous results
    setCalculation(null);
    setDualExpiryInfo(null);
    setOptionsData(null);
    
    const lockupDays = lockupPeriodToDays(period);
    
    // Get dynamic treasury rate based on period
    const riskFreeRate = await getTreasuryRateForPeriod(period);
    console.log(`[Calculator] 💰 Using ${period} treasury rate: ${(riskFreeRate * 100).toFixed(2)}%`);
    
    try {
      // Step 1: Fetch spot price
      updateCalculationStep('market-data', {
        status: 'processing',
        description: `Fetching ${token} spot price from CoinGecko...`
      });
      
      const priceResponse = await fetch(`/api/prices?token=${token}`);
      
      if (!priceResponse.ok) {
        updateCalculationStep('market-data', {
          status: 'error',
          description: `Failed to fetch spot price: HTTP ${priceResponse.status}`
        });
        throw new Error('Failed to fetch prices');
      }
      
      const priceData = await priceResponse.json();
      setPrices(priceData);
      
      updateCalculationStep('market-data', {
        status: 'completed',
        description: `✅ ${token} spot: $${priceData.spot.toLocaleString('en-US')}`
      });
      
      // Step 2: Fetch options data
      updateCalculationStep('dual-expiry-selection', {
        status: 'processing',
        description: 'Trying dual-expiry variance extrapolation...'
      });
      
      const optionsResponse = await fetch(
        `/api/options?token=${token}&period=${period}&spotPrice=${priceData.spot}`
      );
      
      if (optionsResponse.ok) {
        const optionsResult = await optionsResponse.json();
        
        if (optionsResult.success && optionsResult.optionsData) {
          const optionsChainData = optionsResult.optionsData;
          const optionsCalc = optionsResult.dualExpiryCalculation;
          const dualExpiryInfo = optionsResult.dualExpiryInfo;
          
          setOptionsData(optionsChainData);
          setCalculation(optionsCalc);
          setDualExpiryInfo(dualExpiryInfo);
          
          // Update calculation steps
          updateCalculationStep('dual-expiry-selection', {
            status: 'completed',
            description: `✅ Strategy: ${dualExpiryInfo?.strategy === 'interpolation' ? 'Interpolation' : 
                                  dualExpiryInfo?.strategy === 'extrapolation' ? 'Extrapolation' : 'Bounded Extrapolation'}`
          });
          
          updateCalculationStep('common-strikes', {
            status: 'completed',
            description: `✅ Found ${optionsChainData?.length || 0} contracts`
          });
          
          updateCalculationStep('variance-extrapolation', {
            status: 'completed',
            description: `✅ Extrapolated IV: ${optionsCalc?.impliedVolatility?.toFixed(1)}%`
          });
          
          updateCalculationStep('black-scholes', {
            status: 'completed',
            description: `✅ Black-Scholes pricing completed`
          });
          
          updateCalculationStep('discount-calculation', {
            status: 'completed',
            description: `✅ Call discount: ${optionsCalc?.callDiscount?.toFixed(2)}%, Put discount: ${optionsCalc?.putDiscount?.toFixed(2)}%`
          });
        } else {
          setOptionsData([]);
        }
      } else {
        setOptionsData([]);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to fetch data. Please try again later.');
    } finally {
      setLoading(false);
      setOptionsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // 計算原始合約的折扣率 (簡化計算，僅用於顯示)
  const calculateRawContractDiscount = (contract: RawATMContract, spotPrice: number) => {
    // 簡化的折扣率計算：Call/Put價格除以現貨價格
    const callDiscount = (contract.callPrice / spotPrice) * 100;
    const putDiscount = (contract.putPrice / spotPrice) * 100;
    return { callDiscount, putDiscount };
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <MadeByBill />
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Locked Token Discount Calculator
        </h1>
        
        {/* Token Mode Selection */}
        <TokenModeSelector 
          selectedMode={calculationMode}
          onModeChange={(mode) => {
            setCalculationMode(mode);
            // Clear previous results
            setCalculation(null);
            setPrices(null);
            setOptionsData(null);
            setDualExpiryInfo(null);
          }}
        />
        
        {/* Market Data Mode - BTC/ETH Selection */}
        {calculationMode === 'market-data' && (
          <>
            {/* Token Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Token
              </label>
              <div className="flex space-x-4">
                {(['BTC', 'ETH'] as Token[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setToken(t)}
                    className={`px-6 py-2 rounded-md font-medium ${
                      token === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Period Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lockup Period
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['3M', '6M', '1Y', '2Y'] as LockupPeriod[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-2 rounded-md font-medium text-sm ${
                      period === p
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        
        {/* Historical Volatility Mode - Custom Token Input */}
        {calculationMode === 'historical-volatility' && (
          <div className="mb-6">
            <CustomTokenInput 
              onInputChange={setCustomTokenInput}
              loading={loading}
            />
          </div>
        )}


        {/* Calculate Button */}
        <div className="mb-6">
          {calculationMode === 'market-data' ? (
            <button
              onClick={updatePrices}
              disabled={loading || optionsLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : optionsLoading ? 'Fetching options data...' : 'Update Prices & Data'}
            </button>
          ) : (
            <button
              onClick={calculateCustomToken}
              disabled={loading || !customTokenInput}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Calculating...' : 'Calculate Discount'}
            </button>
          )}
          
          {/* Loading Progress */}
          {(loading || optionsLoading) && (
            <div className="mt-2 p-3 bg-blue-50 rounded-md">
              <div className="text-sm text-blue-700 font-medium mb-2">Fetching data...</div>
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            </div>
          )}
        </div>

        {/* Price Display */}
        {prices && (
          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            <h3 className="text-lg font-semibold mb-3">Market Prices</h3>
            <div className="text-sm">
              <div>
                <span className="text-gray-600">Spot Price:</span>
                <span className="font-medium ml-2">{formatCurrency(prices.spot)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Updated: {new Date(prices.timestamp).toLocaleString('en-US')}
              </div>
            </div>
          </div>
        )}

        {/* Calculation Flow */}
        {showCalculationFlow && calculationSteps.length > 0 && (
          <div className="mb-6">
            <CalculationFlow 
              steps={calculationSteps}
              currentStep={currentStep}
              isVisible={showCalculationFlow}
              onToggle={() => setShowCalculationFlow(!showCalculationFlow)}
            />
          </div>
        )}

        {/* Results */}
        {calculation && prices && (
          <div className="mb-6">
            {calculationMode === 'market-data' ? (
              <DiscountResults
                calculation={calculation}
                spotPrice={prices.spot}
                dualExpiryInfo={dualExpiryInfo}
                token={token}
                period={period}
              />
            ) : (
              // 根據計算方法顯示不同的結果組件
              (customTokenInput as any)?.volatilityMethod === 'btc-implied' ? (
                <BetaImpliedVolatilityResults
                  calculation={calculation}
                  spotPrice={prices.spot}
                  customTokenInput={customTokenInput!}
                  betaAnalysis={betaAnalysisResult}
                  historicalCalculation={historicalCalculation}
                />
              ) : (
                <HistoricalVolatilityResults
                  calculation={calculation}
                  spotPrice={prices.spot}
                  customTokenInput={customTokenInput!}
                  volatilityData={customTokenApiResult?.volatilityAnalysis}
                  treasuryRateData={customTokenApiResult?.blackScholesParameters ? {
                    rate: customTokenApiResult.blackScholesParameters.riskFreeRate / 100, // Convert to decimal
                    displayText: `${customTokenApiResult.blackScholesParameters.riskFreeRate.toFixed(2)}% (${customTokenInput!.period}) U.S. Treasury`,
                    source: 'FRED_API',
                    date: new Date().toISOString().split('T')[0]
                  } : undefined}
                />
              )
            )}
          </div>
        )}

        {/* No Options Data Warning */}
        {calculation === null && optionsData !== null && optionsData.length === 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              No options data available. Try another period or later.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
