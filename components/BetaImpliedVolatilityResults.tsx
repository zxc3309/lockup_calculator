'use client';

import React, { useState } from 'react';
import { ArrowTrendingUpIcon, InformationCircleIcon, ChartBarIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { DiscountCalculation, CustomTokenInput } from '@/types';

interface BetaImpliedVolatilityResultsProps {
  calculation: DiscountCalculation;
  spotPrice: number;
  customTokenInput: CustomTokenInput;
  betaAnalysis?: any; // Beta analysis data from API
  historicalCalculation?: DiscountCalculation | null; // For comparison
}

const formatCurrency = (value: number) => {
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

export default function BetaImpliedVolatilityResults({ 
  calculation, 
  spotPrice, 
  customTokenInput,
  betaAnalysis,
  historicalCalculation
}: BetaImpliedVolatilityResultsProps) {
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);
  const [showBetaDetails, setShowBetaDetails] = useState(false);

  const callDiscount = calculation.callDiscount || 0;
  const callTheoretical = calculation.theoreticalCallPrice || 0;
  
  const periodDaysMap = {
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '2Y': 730
  };
  const lockupDays = periodDaysMap[customTokenInput.period as keyof typeof periodDaysMap] || 365;
  
  const callAnnualizedRate = (callDiscount * 365) / lockupDays;
  const callFairValue = spotPrice - callTheoretical;

  // Comparison metrics if historical calculation is available
  const hasComparison = historicalCalculation && betaAnalysis;
  const discountDifference = hasComparison ? 
    (callDiscount - (historicalCalculation.callDiscount || 0)) : 0;
  const volatilityDifference = hasComparison ? 
    ((calculation.impliedVolatility || 0) - (historicalCalculation.impliedVolatility || 0)) : 0;

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          🚀 {customTokenInput.symbol.toUpperCase()} {customTokenInput.period} BTC隱含波動率推導分析
        </h2>
        <p className="text-sm text-gray-600">
          基於BTC選擇權市場預期和Beta係數的折扣率計算
        </p>
      </div>

      {/* Beta分析卡片 */}
      {betaAnalysis && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <ScaleIcon className="w-5 h-5 mr-2" />
            Beta係數分析
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700 font-medium">Beta係數</span>
              <p className="text-blue-900 font-bold text-lg">{betaAnalysis?.betaAnalysis?.beta?.toFixed(3) || 'N/A'}</p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">相關性</span>
              <p className="text-blue-900 font-bold">{betaAnalysis?.betaAnalysis?.correlation ? (betaAnalysis.betaAnalysis.correlation * 100).toFixed(1) + '%' : 'N/A'}</p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">R²</span>
              <p className="text-blue-900 font-bold">{betaAnalysis?.betaAnalysis?.rSquared ? (betaAnalysis.betaAnalysis.rSquared * 100).toFixed(1) + '%' : 'N/A'}</p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">信心水準</span>
              <p className={`font-bold ${
                betaAnalysis?.volatilityComparison?.confidence === 'high' ? 'text-green-700' :
                betaAnalysis?.volatilityComparison?.confidence === 'medium' ? 'text-yellow-700' : 'text-red-700'
              }`}>
                {betaAnalysis?.volatilityComparison?.confidence === 'high' ? '高' :
                 betaAnalysis?.volatilityComparison?.confidence === 'medium' ? '中' : '低'}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowBetaDetails(!showBetaDetails)}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800"
          >
            {showBetaDetails ? '隱藏Beta詳情' : '顯示Beta詳情'}
          </button>
          
          {showBetaDetails && betaAnalysis && (
            <div className="mt-4 pt-3 border-t border-blue-200 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>BTC波動率:</span>
                <span className="font-medium">{betaAnalysis.betaAnalysis?.btcVolatility?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>小幣波動率:</span>
                <span className="font-medium">{betaAnalysis.betaAnalysis?.altcoinVolatility?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>數據點數:</span>
                <span className="font-medium">{betaAnalysis.betaAnalysis?.dataPoints}</span>
              </div>
              <div className="flex justify-between">
                <span>計算期間:</span>
                <span className="font-medium">{betaAnalysis.betaAnalysis?.calculationPeriodDays}天</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Call折扣率主卡片 */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <ArrowTrendingUpIcon className="w-8 h-8" />
            <div>
              <h3 className="text-xl font-semibold">BTC隱含波動率折扣率</h3>
              <p className="text-purple-100">整合市場預期的折扣率計算</p>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="text-4xl font-bold mb-2">
            {formatPercentage(callDiscount)}
          </div>
          <div className="text-purple-100">
            理論Call期權價值: {formatCurrency(callTheoretical)}
          </div>
        </div>
        
        <p className="text-purple-100">
          基於BTC選擇權市場隱含波動率({betaAnalysis?.btcImpliedVolatility?.impliedVolatility?.toFixed(1)}%)
          和Beta係數({betaAnalysis?.betaAnalysis?.beta?.toFixed(3)})推導的折扣率。
        </p>
      </div>

      {/* 方法比較 */}
      {hasComparison && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <ScaleIcon className="w-5 h-5 mr-2 text-gray-600" />
            方法比較：BTC推導 vs 歷史波動率
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* BTC推導結果 */}
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <h4 className="font-medium text-purple-900 mb-3">🚀 BTC隱含波動率推導</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>折扣率:</span>
                  <span className="font-bold text-purple-700">{formatPercentage(callDiscount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>推導波動率:</span>
                  <span className="font-medium">{calculation.impliedVolatility?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Call期權價格:</span>
                  <span className="font-medium">{formatCurrency(callTheoretical)}</span>
                </div>
              </div>
            </div>
            
            {/* 歷史波動率結果 */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">📈 歷史波動率方法</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>折扣率:</span>
                  <span className="font-bold text-gray-700">{formatPercentage(historicalCalculation.callDiscount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>歷史波動率:</span>
                  <span className="font-medium">{historicalCalculation.impliedVolatility?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Call期權價格:</span>
                  <span className="font-medium">{formatCurrency(historicalCalculation.theoreticalCallPrice || 0)}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* 差異分析 */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h5 className="font-medium text-yellow-900 mb-2">📊 差異分析</h5>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-yellow-700">折扣率差異:</span>
                <span className={`ml-2 font-medium ${discountDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {discountDifference > 0 ? '+' : ''}{discountDifference.toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="text-yellow-700">波動率差異:</span>
                <span className={`ml-2 font-medium ${volatilityDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {volatilityDifference > 0 ? '+' : ''}{volatilityDifference.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 詳細分析 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2 text-gray-600" />
          折扣率詳細分析
        </h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 break-words">
              {formatPercentage(callDiscount)}
            </div>
            <div className="text-sm text-gray-600">Call折扣率</div>
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
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <h4 className="font-medium text-blue-900 mb-2">💡 BTC隱含波動率推導優勢</h4>
          <p className="text-sm text-blue-800">
            相比歷史波動率，BTC隱含波動率方法整合了選擇權市場的forward-looking預期，
            通過Beta係數反映小幣相對BTC的風險倍數({betaAnalysis?.betaAnalysis?.beta?.toFixed(2)}倍)，
            更能反映當前市場對未來波動的預期。信心水準：
            <span className={`font-medium ml-1 ${
              betaAnalysis?.volatilityComparison?.confidence === 'high' ? 'text-green-700' :
              betaAnalysis?.volatilityComparison?.confidence === 'medium' ? 'text-yellow-700' : 'text-red-700'
            }`}>
              {betaAnalysis?.volatilityComparison?.confidence === 'high' ? '高' :
               betaAnalysis?.volatilityComparison?.confidence === 'medium' ? '中' : '低'}
            </span>
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
          <div className="p-4 space-y-4">
            {/* BTC隱含波動率推導步驟 */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">🔄 BTC隱含波動率推導步驟</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-3 bg-blue-50 rounded">
                  <span>1. BTC隱含波動率獲取:</span>
                  <span className="font-medium">
                    {betaAnalysis?.btcImpliedVolatility?.impliedVolatility?.toFixed(1)}% 
                    ({betaAnalysis?.btcImpliedVolatility?.source === 'deribit_options' ? 'Deribit' : '預設值'})
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-blue-50 rounded">
                  <span>2. Beta係數計算:</span>
                  <span className="font-medium">
                    {betaAnalysis?.betaAnalysis?.beta?.toFixed(3)} (相關性: {betaAnalysis?.betaAnalysis?.correlation ? (betaAnalysis.betaAnalysis.correlation * 100).toFixed(1) + '%' : 'N/A'})
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-blue-50 rounded">
                  <span>3. 推導隱含波動率:</span>
                  <span className="font-medium">
                    {betaAnalysis?.btcImpliedVolatility?.impliedVolatility?.toFixed(1)}% × {betaAnalysis?.betaAnalysis?.beta?.toFixed(3)} = {calculation.impliedVolatility?.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-green-50 rounded border border-green-200">
                  <span className="font-medium">最終折扣率:</span>
                  <span className="font-bold text-green-700">{formatPercentage(callDiscount)}</span>
                </div>
              </div>
            </div>

            {/* Beta係數詳細信息 */}
            {betaAnalysis && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">📊 Beta係數計算詳情</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">計算公式:</span>
                    <span className="font-medium">Cov(小幣,BTC)/Var(BTC)</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">數據期間:</span>
                    <span className="font-medium">{betaAnalysis.betaAnalysis?.calculationPeriodDays}天</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">數據點數:</span>
                    <span className="font-medium">{betaAnalysis.betaAnalysis?.dataPoints}個</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}