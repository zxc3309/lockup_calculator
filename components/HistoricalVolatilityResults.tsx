'use client';

import React, { useState, useEffect } from 'react';
import { ArrowTrendingUpIcon, InformationCircleIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { DiscountCalculation, CustomTokenInput, LockupPeriod } from '@/types';
import { getTreasuryRateInfo } from '@/lib/treasuryRates';

interface HistoricalVolatilityResultsProps {
  calculation: DiscountCalculation;
  spotPrice: number;
  customTokenInput: CustomTokenInput;
  volatilityData?: any;
  treasuryRateData?: {
    rate: number;
    displayText: string;
    source: string;
    date: string;
  };
}

const formatCurrency = (value: number) => {
  // For very small values, use more compact formatting
  if (value < 1) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  } else if (value < 100) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } else {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(2)}%`;
};

export default function HistoricalVolatilityResults({ 
  calculation, 
  spotPrice, 
  customTokenInput,
  volatilityData,
  treasuryRateData
}: HistoricalVolatilityResultsProps) {
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);
  const [treasuryRateInfo, setTreasuryRateInfo] = useState<{
    displayText: string;
    source: string;
    rate: number;
  } | null>(null);

  const callDiscount = calculation.callDiscount || 0;
  const callTheoretical = calculation.theoreticalCallPrice || 0;

  // Fetch treasury rate info for display
  useEffect(() => {
    const fetchTreasuryInfo = async () => {
      // If treasury rate data is passed in from API, use it directly
      if (treasuryRateData) {
        setTreasuryRateInfo({
          displayText: treasuryRateData.displayText,
          source: treasuryRateData.source,
          rate: treasuryRateData.rate
        });
        return;
      }

      // Otherwise, fetch from treasury API
      try {
        const info = await getTreasuryRateInfo(customTokenInput.period as LockupPeriod);
        setTreasuryRateInfo({
          displayText: info.displayText,
          source: info.source,
          rate: info.rate
        });
      } catch (error) {
        console.warn('Failed to fetch treasury rate info:', error);
      }
    };
    
    fetchTreasuryInfo();
  }, [customTokenInput.period, treasuryRateData]);
  
  // Calculate period-specific values
  const periodDaysMap = {
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '2Y': 730
  };
  const lockupDays = periodDaysMap[customTokenInput.period as keyof typeof periodDaysMap] || 365;
  
  const callAnnualizedRate = (callDiscount * 365) / lockupDays;
  const callFairValue = spotPrice - callTheoretical;

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          💎 {customTokenInput.symbol.toUpperCase()} {customTokenInput.period} 鎖倉折扣率分析
        </h2>
        <p className="text-sm text-gray-600">
          基於歷史波動率和目標價格的Call期權定價方法
          {volatilityData?.apiProvider && (
            <span className="ml-1">
              (數據來源: {volatilityData.apiProvider.toUpperCase()})
            </span>
          )}
        </p>
      </div>

      {/* 計算參數摘要 */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
        <h3 className="font-semibold text-purple-900 mb-3 flex items-center">
          <InformationCircleIcon className="w-5 h-5 mr-2" />
          計算參數概覽
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-purple-700 font-medium">當前價格</span>
            <p className="text-purple-900 font-bold">{formatCurrency(spotPrice)}</p>
          </div>
          <div>
            <span className="text-purple-700 font-medium">目標價格</span>
            <p className="text-purple-900 font-bold">{formatCurrency(customTokenInput.targetPrice)}</p>
            <p className="text-purple-600 text-xs">
              {((customTokenInput.targetPrice / spotPrice - 1) * 100).toFixed(1)}% 上漲
            </p>
          </div>
          <div>
            <span className="text-purple-700 font-medium">鎖倉期限</span>
            <p className="text-purple-900">{lockupDays} 天</p>
          </div>
          <div>
            <span className="text-purple-700 font-medium">歷史波動率</span>
            <p className="text-purple-900 font-bold">
              {calculation.impliedVolatility?.toFixed(1)}%
            </p>
          </div>
        </div>
        {treasuryRateInfo && (
          <div className="mt-4 pt-3 border-t border-purple-200">
            <span className="text-purple-700 font-medium text-sm">無風險利率: </span>
            <span className="text-purple-900 font-semibold">{treasuryRateInfo.displayText}</span>
            {treasuryRateInfo.source === 'FALLBACK' && (
              <span className="ml-2 text-orange-600 text-xs">⚠️ 預設值</span>
            )}
            {treasuryRateInfo.source === 'FRED_API' && (
              <span className="ml-2 text-green-600 text-xs">✅ 即時數據</span>
            )}
          </div>
        )}
      </div>

      {/* Call 折扣率主卡片 */}
      <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <ArrowTrendingUpIcon className="w-8 h-8" />
            <div>
              <h3 className="text-xl font-semibold">Call 折扣率</h3>
              <p className="text-red-100">基於目標價格的機會成本分析</p>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="text-4xl font-bold mb-2">
            {formatPercentage(callDiscount)}
          </div>
          <div className="text-red-100">
            理論Call期權價值: {formatCurrency(callTheoretical)}
          </div>
        </div>
        
        <p className="text-red-100">
          基於您設定的目標價格 {formatCurrency(customTokenInput.targetPrice)}，
          鎖倉的機會成本為 {formatPercentage(callDiscount)}。
          這反映了如果代幣價格達到目標價格時，您可能錯過的潛在收益。
        </p>
      </div>

      {/* 詳細分析 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2 text-gray-600" />
          Call折扣率詳細分析
        </h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 break-words">
              {formatPercentage(callDiscount)}
            </div>
            <div className="text-sm text-gray-600">Call 折扣率</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 break-words">
              {formatPercentage(callAnnualizedRate)}
            </div>
            <div className="text-sm text-gray-600">年化折扣率</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(callFairValue)}
            </div>
            <div className="text-sm text-gray-600">合理購買價格</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(callTheoretical)}
            </div>
            <div className="text-sm text-gray-600">理論Call價格</div>
          </div>
        </div>

        {/* 投資建議 */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <h4 className="font-medium text-yellow-900 mb-2">💡 VC投資邏輯分析</h4>
          <p className="text-sm text-yellow-800">
            <strong>目標價格設定</strong>: {formatPercentage(callDiscount)} 
            反映了基於您對 {customTokenInput.symbol.toUpperCase()} 
            長期價值判斷({formatCurrency(customTokenInput.targetPrice)})的機會成本。
            目標倍數越高，反映的折扣率越低，表示您對該代幣的看好程度越強。
            適合與其他VC投資項目的預期收益進行比較。
          </p>
        </div>
      </div>

      {/* 計算過程詳情 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setShowCalculationDetails(!showCalculationDetails)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-lg font-semibold text-gray-900">
              🧮 計算過程詳情
            </h3>
            <span className="text-sm text-gray-500">
              {showCalculationDetails ? '隱藏詳情' : '顯示詳情'}
            </span>
          </button>
        </div>

        {showCalculationDetails && (
          <div className="p-4">
            <div className="space-y-4">
              {/* Black-Scholes 參數 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">📊 Black-Scholes 計算參數</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">S (當前價格):</span>
                    <span className="font-medium">{formatCurrency(spotPrice)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">K (執行價格):</span>
                    <span className="font-medium">{formatCurrency(customTokenInput.targetPrice)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">T (時間到期):</span>
                    <span className="font-medium">{(lockupDays / 365).toFixed(3)} 年</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">σ (波動率):</span>
                    <span className="font-medium">{calculation.impliedVolatility?.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">r (無風險利率):</span>
                    <span className="font-medium">{treasuryRateInfo ? (treasuryRateInfo.rate * 100).toFixed(2) + '%' : '載入中...'}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-green-50 rounded border border-green-200">
                    <span className="text-gray-600">Call期權價格:</span>
                    <span className="font-bold text-green-700">{formatCurrency(callTheoretical)}</span>
                  </div>
                </div>
              </div>

              {/* 計算步驟 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">🔄 計算步驟</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-3 bg-blue-50 rounded">
                    <span>1. 歷史波動率計算:</span>
                    <span className="font-medium">
                      90天歷史數據 → {calculation.impliedVolatility?.toFixed(1)}% 年化
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-blue-50 rounded">
                    <span>2. Black-Scholes期權定價:</span>
                    <span className="font-medium">
                      Call價格 = {formatCurrency(callTheoretical)}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-blue-50 rounded">
                    <span>3. 折扣率計算:</span>
                    <span className="font-medium">
                      {formatCurrency(callTheoretical)} ÷ {formatCurrency(spotPrice)} = {formatPercentage(callDiscount)}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-green-50 rounded border border-green-200">
                    <span className="font-medium">最終折扣率:</span>
                    <span className="font-bold text-green-700">{formatPercentage(callDiscount)}</span>
                  </div>
                </div>
              </div>

              {/* 數據品質信息 */}
              {volatilityData && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">📈 數據品質信息</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex justify-between p-3 bg-gray-50 rounded">
                      <span className="text-gray-600">數據來源:</span>
                      <span className="font-medium">{volatilityData.apiProvider?.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded">
                      <span className="text-gray-600">歷史數據點數:</span>
                      <span className="font-medium">{volatilityData.dataPoints}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded">
                      <span className="text-gray-600">覆蓋天數:</span>
                      <span className="font-medium">{volatilityData.historicalDays} 天</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}