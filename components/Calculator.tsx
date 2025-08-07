'use client';

import { useState } from 'react';
import { Token, LockupPeriod, PriceData, DiscountCalculation, OptionData, DebugInfo, CalculationStep, DataFetchStatus, ApiCallStatus, RawATMContract, TokenCalculationMode, CustomTokenInput as CustomTokenInputType } from '@/types';
import { lockupPeriodToDays, calculateDiscountFromOptions, validateOptionsData } from '@/lib/calculator';
import DebugPanel from './DebugPanel';
import CalculationFlow, { CALCULATION_STEPS_TEMPLATE } from './CalculationFlow';
import DiscountResults from './DiscountResults';
import HistoricalVolatilityResults from './HistoricalVolatilityResults';
import TokenModeSelector from './TokenModeSelector';
import CustomTokenInput from './CustomTokenInput';

export default function Calculator() {
  // 計算模式狀態
  const [calculationMode, setCalculationMode] = useState<TokenCalculationMode>('market-data');
  const [customTokenInput, setCustomTokenInput] = useState<CustomTokenInputType | null>(null);
  const [customTokenApiResult, setCustomTokenApiResult] = useState<any>(null);
  
  // 原有狀態
  const [token, setToken] = useState<Token>('BTC');
  const [period, setPeriod] = useState<LockupPeriod>('6M');
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculation, setCalculation] = useState<DiscountCalculation | null>(null);
  const [optionsData, setOptionsData] = useState<OptionData[] | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [dualExpiryInfo, setDualExpiryInfo] = useState<any>(null);
  
  // 調試相關狀態
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);

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

  // 自定義代幣計算
  const calculateCustomToken = async () => {
    if (!customTokenInput) {
      alert('請完成代幣參數設定');
      return;
    }
    
    setLoading(true);
    setCalculation(null);
    
    try {
      console.log(`[Calculator] 🚀 開始計算自定義代幣: ${customTokenInput.symbol}`);
      
      const response = await fetch(
        `/api/custom-token?tokenId=${customTokenInput.symbol}&period=${customTokenInput.period}&targetPrice=${customTokenInput.targetPrice}&debug=${debugMode}`
      );
      
      if (!response.ok) {
        throw new Error(`API 呼叫失敗: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.details || result.error || '計算失敗');
      }
      
      console.log(`[Calculator] ✅ 自定義代幣計算完成:`, result.calculation);
      
      // 轉換成與原有 DiscountCalculation 兼容的格式
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
      setCustomTokenApiResult(result); // 保存完整的API結果
      
      // 設定虛擬價格數據以供結果顯示
      setPrices({
        token: 'BTC', // 佔位符
        spot: result.calculation.currentPrice,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('[Calculator] ❌ 自定義代幣計算失敗:', error);
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      alert(`計算失敗: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const updatePrices = async () => {
    setLoading(true);
    setOptionsLoading(true);
    
    // 初始化計算步驟
    initializeCalculationSteps();
    
    // 重置之前的結果
    setCalculation(null);
    setDualExpiryInfo(null);
    setOptionsData(null);
    
    // 初始化調試信息
    const startTime = Date.now();
    const lockupDays = lockupPeriodToDays(period);
    const riskFreeRate = 0.05;
    const timeToExpiry = lockupDays / 365;
    
    const debugInfo: DebugInfo = {
      dataFetchStatus: {
        spotPrice: null,
        optionsData: null,
        overall: 'loading'
      },
      calculationSteps: [],
      rawData: {},
      parameters: {
        riskFreeRate,
        timeToExpiry,
        lockupDays
      },
      warnings: [],
      timestamp: new Date()
    };
    
    const addCalculationStep = (step: Omit<CalculationStep, 'id'>) => {
      debugInfo.calculationSteps.push({
        ...step,
        id: `step-${debugInfo.calculationSteps.length + 1}`
      });
      setDebugInfo({ ...debugInfo });
    };
    
    const updateApiStatus = (endpoint: 'spotPrice' | 'optionsData', status: Partial<ApiCallStatus>) => {
      debugInfo.dataFetchStatus[endpoint] = {
        ...debugInfo.dataFetchStatus[endpoint],
        ...status
      } as ApiCallStatus;
      setDebugInfo({ ...debugInfo });
    };
    
    try {
      addCalculationStep({
        name: '初始化計算',
        status: 'completed',
        description: `開始計算 ${token} ${period} 鎖倉折扣率`,
        input: { token, period, lockupDays },
        duration: 0
      });
      
      // 步驟1: 獲取現貨價格
      updateCalculationStep('market-data', {
        status: 'processing',
        description: `正在從 CoinGecko API 獲取 ${token} 現貨價格...`
      });
      
      addCalculationStep({
        name: '獲取現貨價格',
        status: 'processing',
        description: '從 CoinGecko API 獲取現貨價格'
      });
      
      const priceStartTime = Date.now();
      updateApiStatus('spotPrice', {
        endpoint: '/api/prices',
        status: 'pending',
        startTime: priceStartTime
      });
      
      const priceResponse = await fetch(`/api/prices?token=${token}&debug=${debugMode}`);
      const priceDuration = Date.now() - priceStartTime;
      
      if (!priceResponse.ok) {
        updateApiStatus('spotPrice', {
          status: 'error',
          endTime: Date.now(),
          duration: priceDuration,
          errorMessage: `HTTP ${priceResponse.status}`
        });
        
        updateCalculationStep('market-data', {
          status: 'error',
          description: `現貨價格獲取失敗: HTTP ${priceResponse.status}`
        });
        
        throw new Error('Failed to fetch prices');
      }
      
      const priceData = await priceResponse.json();
      updateApiStatus('spotPrice', {
        status: 'success',
        endTime: Date.now(),
        duration: priceDuration,
        responseSize: JSON.stringify(priceData).length
      });
      
      debugInfo.rawData.spotPriceResponse = priceData;
      setPrices(priceData);
      
      updateCalculationStep('market-data', {
        status: 'completed',
        description: `✅ ${token} 現貨價格: $${priceData.spot.toLocaleString()}`,
        output: { spotPrice: priceData.spot, source: 'CoinGecko' },
        duration: priceDuration
      });
      
      addCalculationStep({
        name: '獲取現貨價格',
        status: 'completed',
        description: `成功獲取 ${token} 現貨價格`,
        output: {
          spotPrice: priceData.spot
        },
        duration: priceDuration
      });
      
      // 步驟2: 雙到期日選擇權數據獲取
      let optionsCalc: DiscountCalculation | null = null;
      let optionsChainData: OptionData[] = [];
      
      updateCalculationStep('dual-expiry-selection', {
        status: 'processing',
        description: '正在嘗試雙到期日方差外推法...'
      });
      
      addCalculationStep({
        name: '獲取選擇權數據',
        status: 'processing',
        description: '從 Deribit API 獲取選擇權鏈數據'
      });
      
      try {
        const optionsStartTime = Date.now();
        updateApiStatus('optionsData', {
          endpoint: '/api/options',
          status: 'pending',
          startTime: optionsStartTime
        });
        
        const optionsResponse = await fetch(
          `/api/options?token=${token}&period=${period}&spotPrice=${priceData.spot}&debug=${debugMode}`
        );
        const optionsDuration = Date.now() - optionsStartTime;
        
        if (optionsResponse.ok) {
          const optionsResult = await optionsResponse.json();
          optionsChainData = optionsResult.optionsData || [];
          setOptionsData(optionsChainData);
          
          // 檢查計算方法並更新相應步驟
          if (optionsResult.dualExpiryCalculation) {
            optionsCalc = optionsResult.dualExpiryCalculation;
            setDualExpiryInfo(optionsResult.dualExpiryInfo);
            console.log(`使用雙到期日計算結果: ${optionsResult.calculationMethod}`);
            
            // 更新所有雙到期日相關步驟為完成狀態
            updateCalculationStep('dual-expiry-selection', {
              status: 'completed',
              description: `✅ 策略: ${optionsResult.dualExpiryInfo?.strategy === 'interpolation' ? '內插法' : 
                                    optionsResult.dualExpiryInfo?.strategy === 'extrapolation' ? '外推法' : '有界外推法'}`,
              output: {
                strategy: optionsResult.dualExpiryInfo?.strategy,
                shortTermExpiry: optionsResult.dualExpiryInfo?.shortTermExpiry,
                longTermExpiry: optionsResult.dualExpiryInfo?.longTermExpiry
              },
              duration: optionsDuration
            });
            
            updateCalculationStep('common-strikes', {
              status: 'completed',
              description: `✅ 找到 ${optionsCalc?.totalContracts || 0} 個共同ATM執行價格`,
              output: { commonStrikes: optionsCalc?.totalContracts || 0 }
            });
            
            updateCalculationStep('variance-extrapolation', {
              status: 'completed',
              description: `✅ 外推波動率: ${optionsCalc?.impliedVolatility?.toFixed(1)}%`,
              output: { 
                shortTermIV: optionsResult.dualExpiryInfo?.shortTermIV,
                longTermIV: optionsResult.dualExpiryInfo?.longTermIV,
                extrapolatedIV: optionsCalc?.impliedVolatility 
              }
            });
            
            updateCalculationStep('black-scholes', {
              status: 'completed',
              description: `✅ 計算理論期權價格 (Call: $${optionsCalc?.theoreticalCallPrice?.toFixed(0) || 0}, Put: $${optionsCalc?.theoreticalPutPrice?.toFixed(0) || 0})`,
              output: {
                callPrice: optionsCalc?.theoreticalCallPrice,
                putPrice: optionsCalc?.theoreticalPutPrice
              }
            });
            
            updateCalculationStep('discount-calculation', {
              status: 'completed',
              description: `✅ Call折扣: ${optionsCalc?.callDiscount?.toFixed(2)}%, Put折扣: ${optionsCalc?.putDiscount?.toFixed(2)}%`,
              output: {
                callDiscount: optionsCalc?.callDiscount,
                putDiscount: optionsCalc?.putDiscount,
                annualizedRate: optionsCalc?.annualizedRate
              }
            });
          } else {
            // 回退到單一到期日方法
            setDualExpiryInfo(null);
            updateCalculationStep('dual-expiry-selection', {
              status: 'error',
              description: '❌ 雙到期日方法失敗，回退到單一到期日方法'
            });
            
            // 將其他步驟標記為跳過
            ['common-strikes', 'variance-extrapolation'].forEach(stepId => {
              updateCalculationStep(stepId, {
                status: 'pending',
                description: '⏭️ 跳過 (使用單一到期日方法)'
              });
            });
          }
          
          updateApiStatus('optionsData', {
            status: 'success',
            endTime: Date.now(),
            duration: optionsDuration,
            responseSize: JSON.stringify(optionsResult).length
          });
          
          debugInfo.rawData.optionsChainResponse = optionsResult;
          debugInfo.rawData.selectedOptions = optionsChainData;
          
          // 數據驗證
          const validationWarnings = validateOptionsData(optionsChainData, priceData.spot);
          if (validationWarnings.length > 0) {
            debugInfo.warnings.push(...validationWarnings.map(w => `選擇權數據驗證: ${w}`));
          }
          
          addCalculationStep({
            name: '獲取選擇權數據',
            status: 'completed',
            description: `找到 ${optionsChainData.length} 個可用選擇權合約${validationWarnings.length > 0 ? ` (${validationWarnings.length} 個警告)` : ''}`,
            output: {
              contractsFound: optionsChainData.length,
              quality: optionsResult.quality,
              validationWarnings: validationWarnings
            },
            duration: optionsDuration
          });
          
          if (optionsChainData.length > 0) {
            addCalculationStep({
              name: '選擇權平價法計算',
              status: 'processing',
              description: '使用 Put-Call Parity 計算隱含遠期價格',
              formula: 'Forward = Strike + e^(r×T) × (Call - Put)'
            });
            
            const optionsCalcStartTime = Date.now();
            optionsCalc = calculateDiscountFromOptions(
              optionsChainData,
              priceData.spot,
              lockupDays,
              riskFreeRate
            );
            const optionsCalcDuration = Date.now() - optionsCalcStartTime;
            
            // 找到使用的ATM選擇權
            const atmOption = optionsChainData.reduce((closest, current) => {
              const closestDiff = Math.abs(closest.strike - priceData.spot);
              const currentDiff = Math.abs(current.strike - priceData.spot);
              return currentDiff < closestDiff ? current : closest;
            });
            
            addCalculationStep({
              name: '選擇權平價法計算',
              status: 'completed',
              description: '選擇權平價法計算完成',
              input: {
                atmOption: {
                  strike: atmOption.strike,
                  callPrice: atmOption.callPrice,
                  putPrice: atmOption.putPrice
                },
                spotPrice: priceData.spot,
                riskFreeRate,
                timeToExpiry
              },
              output: optionsCalc,
              duration: optionsCalcDuration
            });
            
            setCalculation(optionsCalc);
          } else {
            debugInfo.warnings.push('未找到可用的選擇權合約');
            addCalculationStep({
              name: '選擇權平價法計算',
              status: 'error',
              description: '沒有可用的選擇權數據',
              errorMessage: '未找到符合條件的選擇權合約'
            });
          }
        } else {
          updateApiStatus('optionsData', {
            status: 'error',
            endTime: Date.now(),
            duration: optionsDuration,
            errorMessage: `HTTP ${optionsResponse.status}`
          });
          
          debugInfo.warnings.push(`選擇權數據獲取失敗: HTTP ${optionsResponse.status}`);
          addCalculationStep({
            name: '獲取選擇權數據',
            status: 'error',
            description: '選擇權數據獲取失敗',
            errorMessage: `HTTP ${optionsResponse.status}`,
            duration: optionsDuration
          });
        }
      } catch (optionsError) {
        const errorMessage = optionsError instanceof Error ? optionsError.message : '未知錯誤';
        debugInfo.warnings.push(`選擇權計算失敗: ${errorMessage}`);
        addCalculationStep({
          name: '選擇權數據處理',
          status: 'error',
          description: '選擇權數據處理過程中發生錯誤',
          errorMessage: errorMessage
        });
      }
      
      // 更新整體狀態
      debugInfo.dataFetchStatus.overall = optionsCalc ? 'success' : 'error';
      
      const totalDuration = Date.now() - startTime;
      addCalculationStep({
        name: '計算完成',
        status: 'completed',
        description: `所有計算步驟完成，總耗時 ${totalDuration}ms`,
        duration: totalDuration
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      debugInfo.dataFetchStatus.overall = 'error';
      debugInfo.warnings.push(`計算過程發生錯誤: ${errorMessage}`);
      
      addCalculationStep({
        name: '計算失敗',
        status: 'error',
        description: '計算過程中發生嚴重錯誤',
        errorMessage: errorMessage
      });
      
      console.error('Error fetching data:', error);
      alert('獲取數據失敗，請稍後再試');
    } finally {
      setLoading(false);
      setOptionsLoading(false);
      setDebugInfo(debugInfo);
      
      // 如果是第一次計算且有調試數據，自動打開調試面板
      if (debugMode && !debugPanelOpen && debugInfo.calculationSteps.length > 0) {
        setDebugPanelOpen(true);
      }
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
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          鎖倉Token折扣率計算器
        </h1>
        
        {/* Token Mode Selection */}
        <TokenModeSelector 
          selectedMode={calculationMode}
          onModeChange={(mode) => {
            setCalculationMode(mode);
            // 清空之前的結果
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
                選擇幣種
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
                鎖倉期限
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
                    {p === '1Y' ? '1年' : p === '2Y' ? '2年' : p}
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

        {/* Debug Mode Toggle */}
        <div className="mb-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">調試模式 (顯示詳細計算過程)</span>
          </label>
        </div>

        {/* Calculate Button */}
        <div className="mb-6">
          {calculationMode === 'market-data' ? (
            <button
              onClick={updatePrices}
              disabled={loading || optionsLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '更新中...' : optionsLoading ? '獲取選擇權數據中...' : '更新價格與數據'}
            </button>
          ) : (
            <button
              onClick={calculateCustomToken}
              disabled={loading || !customTokenInput}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '計算中...' : '計算折扣率'}
            </button>
          )}
          
          {/* Loading Progress */}
          {(loading || optionsLoading) && debugInfo && (
            <div className="mt-2 p-3 bg-blue-50 rounded-md">
              <div className="text-sm text-blue-700 font-medium mb-2">處理進度</div>
              <div className="space-y-1">
                {debugInfo.calculationSteps.slice(-3).map((step) => (
                  <div key={step.id} className="flex items-center space-x-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${
                      step.status === 'completed' ? 'bg-green-500' :
                      step.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                      step.status === 'error' ? 'bg-red-500' : 'bg-gray-300'
                    }`}></span>
                    <span className="text-gray-600">{step.name}</span>
                    {step.duration && (
                      <span className="text-gray-400">({step.duration}ms)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Price Display */}
        {prices && (
          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            <h3 className="text-lg font-semibold mb-3">市場價格</h3>
            <div className="text-sm">
              <div>
                <span className="text-gray-600">現貨價格:</span>
                <span className="font-medium ml-2">{formatCurrency(prices.spot)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                更新時間: {new Date(prices.timestamp).toLocaleString('zh-TW')}
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
              <HistoricalVolatilityResults
                calculation={calculation}
                spotPrice={prices.spot}
                customTokenInput={customTokenInput!}
                volatilityData={customTokenApiResult?.volatilityAnalysis}
              />
            )}
          </div>
        )}

        {/* No Options Data Warning */}
        {calculation === null && optionsData !== null && optionsData.length === 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              暫無可用的選擇權數據。請嘗試其他期限或稍後再試。
            </p>
          </div>
        )}

        {/* Debug Panel */}
        <DebugPanel 
          debugInfo={debugInfo}
          isVisible={debugPanelOpen}
          onToggle={() => setDebugPanelOpen(!debugPanelOpen)}
        />
      </div>
    </div>
  );
}