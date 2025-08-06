'use client';

import { useState } from 'react';
import { Token, LockupPeriod, PriceData, DiscountCalculation, OptionData, DebugInfo, CalculationStep, DataFetchStatus, ApiCallStatus } from '@/types';
import { lockupPeriodToDays, calculateDiscountFromOptions, validateOptionsData } from '@/lib/calculator';
import DebugPanel from './DebugPanel';

export default function Calculator() {
  const [token, setToken] = useState<Token>('BTC');
  const [period, setPeriod] = useState<LockupPeriod>('6M');
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculation, setCalculation] = useState<DiscountCalculation | null>(null);
  const [optionsData, setOptionsData] = useState<OptionData[] | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  
  // 調試相關狀態
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);

  const updatePrices = async () => {
    setLoading(true);
    setOptionsLoading(true);
    
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
      
      addCalculationStep({
        name: '獲取現貨價格',
        status: 'completed',
        description: `成功獲取 ${token} 現貨價格`,
        output: {
          spotPrice: priceData.spot
        },
        duration: priceDuration
      });
      
      // 步驟2: 獲取選擇權數據並計算
      let optionsCalc: DiscountCalculation | null = null;
      let optionsChainData: OptionData[] = [];
      
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          BTC/ETH 鎖倉Token折扣率計算器
        </h1>
        
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

        {/* Update Prices Button */}
        <div className="mb-6">
          <button
            onClick={updatePrices}
            disabled={loading || optionsLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '更新中...' : optionsLoading ? '獲取選擇權數據中...' : '更新價格與數據'}
          </button>
          
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

        {/* Results */}
        {calculation && (
          <div className="p-4 bg-blue-50 rounded-md">
            <h3 className="text-lg font-semibold mb-4">
              計算結果 (多合約ATM加權平均)
              {calculation.totalContracts && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({calculation.totalContracts}個ATM合約)
                </span>
              )}
            </h3>
            
            <div className="space-y-3">
              {/* 主要折扣率 */}
              <div className="flex justify-between">
                <span className="text-gray-600">主要折扣率 (Call):</span>
                <span className="font-medium">{formatPercentage(calculation.discount)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">年化折扣率:</span>
                <span className="font-medium">{formatPercentage(calculation.annualizedRate)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">合理購買價格:</span>
                <span className="font-medium">{formatCurrency(calculation.fairValue)}</span>
              </div>
              
              {/* Call vs Put 折扣對比 */}
              {calculation.callDiscount !== undefined && calculation.putDiscount !== undefined && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <h4 className="font-medium mb-3 text-sm">Call vs Put 折扣分析</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded">
                      <div className="text-xs text-gray-500 mb-1">Call折扣 (機會成本)</div>
                      <div className="font-semibold text-red-600">{formatPercentage(calculation.callDiscount)}</div>
                      <div className="text-xs text-gray-500 mt-1">錯過上漲潛在收益</div>
                    </div>
                    <div className="bg-white p-3 rounded">
                      <div className="text-xs text-gray-500 mb-1">Put折扣 (保險成本)</div>
                      <div className="font-semibold text-green-600">{formatPercentage(calculation.putDiscount)}</div>
                      <div className="text-xs text-gray-500 mt-1">防止下跌保險費用</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* ATM合約詳細信息 */}
              {calculation.atmCalculations && calculation.atmCalculations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <h4 className="font-medium mb-3 text-sm">ATM合約明細</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-blue-100">
                          <th className="text-left pb-1">執行價</th>
                          <th className="text-left pb-1">到期日</th>
                          <th className="text-right pb-1">距離</th>
                          <th className="text-right pb-1">Call折扣</th>
                          <th className="text-right pb-1">Put折扣</th>
                          <th className="text-right pb-1">權重</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculation.atmCalculations.map((calc, index) => (
                          <tr key={index} className="border-b border-blue-50">
                            <td className="py-1">${calc.strike.toLocaleString()}</td>
                            <td className="py-1">{calc.expiry}</td>
                            <td className="text-right py-1">${calc.atmDistance.toFixed(0)}</td>
                            <td className="text-right py-1 text-red-600">{calc.callDiscount.toFixed(2)}%</td>
                            <td className="text-right py-1 text-green-600">{calc.putDiscount.toFixed(2)}%</td>
                            <td className="text-right py-1">{calc.weight.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* 波動率信息 */}
              {calculation.impliedVolatility !== undefined && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <h4 className="font-medium mb-2 text-sm">加權平均市場參數</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">隱含波動率:</span>
                      <span>{calculation.impliedVolatility.toFixed(1)}%</span>
                    </div>
                    {calculation.theoreticalCallPrice !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">理論Call價格:</span>
                        <span>{formatCurrency(calculation.theoreticalCallPrice)}</span>
                      </div>
                    )}
                    {calculation.theoreticalPutPrice !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">理論Put價格:</span>
                        <span>{formatCurrency(calculation.theoreticalPutPrice)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Options Data Summary */}
            {optionsData && optionsData.length > 0 && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <h4 className="font-medium mb-2 text-sm">選擇權數據</h4>
                <div className="text-xs text-gray-600">
                  <p>可用合約: {optionsData.length} 個</p>
                  <p>價格範圍: {formatCurrency(Math.min(...optionsData.map(o => o.strike)))} - {formatCurrency(Math.max(...optionsData.map(o => o.strike)))}</p>
                </div>
              </div>
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