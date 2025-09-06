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
      {/* Title */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          🚀 {customTokenInput.symbol.toUpperCase()} {customTokenInput.period} BTC-Implied Volatility Derived Analysis
        </h2>
        <p className="text-sm text-gray-600">
          Discount derived from BTC options market expectations and beta
        </p>
      </div>

      {/* Beta分析卡片 */}
      {betaAnalysis && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <ScaleIcon className="w-5 h-5 mr-2" />
            Beta Analysis
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700 font-medium">Beta</span>
              <p className="text-blue-900 font-bold text-lg">{betaAnalysis?.betaAnalysis?.beta?.toFixed(3) || 'N/A'}</p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Correlation</span>
              <p className="text-blue-900 font-bold">{betaAnalysis?.betaAnalysis?.correlation ? (betaAnalysis.betaAnalysis.correlation * 100).toFixed(1) + '%' : 'N/A'}</p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">R²</span>
              <p className="text-blue-900 font-bold">{betaAnalysis?.betaAnalysis?.rSquared ? (betaAnalysis.betaAnalysis.rSquared * 100).toFixed(1) + '%' : 'N/A'}</p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Confidence</span>
              <p className={`font-bold ${
                betaAnalysis?.volatilityComparison?.confidence === 'high' ? 'text-green-700' :
                betaAnalysis?.volatilityComparison?.confidence === 'medium' ? 'text-yellow-700' : 'text-red-700'
              }`}>
                {betaAnalysis?.volatilityComparison?.confidence === 'high' ? 'High' :
                 betaAnalysis?.volatilityComparison?.confidence === 'medium' ? 'Medium' : 'Low'}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowBetaDetails(!showBetaDetails)}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800"
          >
            {showBetaDetails ? 'Hide Beta details' : 'Show Beta details'}
          </button>
          
          {showBetaDetails && betaAnalysis && (
            <div className="mt-4 pt-3 border-t border-blue-200 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>BTC volatility:</span>
                <span className="font-medium">{betaAnalysis.betaAnalysis?.btcVolatility?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Altcoin volatility:</span>
                <span className="font-medium">{betaAnalysis.betaAnalysis?.altcoinVolatility?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Data points:</span>
                <span className="font-medium">{betaAnalysis.betaAnalysis?.dataPoints}</span>
              </div>
              <div className="flex justify-between">
                <span>Period:</span>
                <span className="font-medium">{betaAnalysis.betaAnalysis?.calculationPeriodDays} days</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Call discount main card */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <ArrowTrendingUpIcon className="w-8 h-8" />
            <div>
              <h3 className="text-xl font-semibold">BTC-Implied Vol Discount</h3>
              <p className="text-purple-100">Market-implied discount</p>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="text-4xl font-bold mb-2">
            {formatPercentage(callDiscount)}
          </div>
          <div className="text-purple-100">
            Theoretical Call Value: {formatCurrency(callTheoretical)}
          </div>
        </div>
        
        <p className="text-purple-100">
          Discount derived from BTC implied volatility ({betaAnalysis?.btcImpliedVolatility?.impliedVolatility?.toFixed(1)}%)
          and beta ({betaAnalysis?.betaAnalysis?.beta?.toFixed(3)}).
        </p>
      </div>

      {/* 方法比較 */}
      {hasComparison && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <ScaleIcon className="w-5 h-5 mr-2 text-gray-600" />
            Method Comparison: BTC-derived vs Historical
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* BTC推導結果 */}
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <h4 className="font-medium text-purple-900 mb-3">🚀 BTC-derived IV</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span className="font-bold text-purple-700">{formatPercentage(callDiscount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Derived volatility:</span>
                  <span className="font-medium">{calculation.impliedVolatility?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Call price:</span>
                  <span className="font-medium">{formatCurrency(callTheoretical)}</span>
                </div>
              </div>
            </div>
            
            {/* 歷史波動率結果 */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">📈 Historical method</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span className="font-bold text-gray-700">{formatPercentage(historicalCalculation.callDiscount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Historical volatility:</span>
                  <span className="font-medium">{historicalCalculation.impliedVolatility?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Call price:</span>
                  <span className="font-medium">{formatCurrency(historicalCalculation.theoreticalCallPrice || 0)}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* 差異分析 */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h5 className="font-medium text-yellow-900 mb-2">📊 Differences</h5>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-yellow-700">Discount diff:</span>
                <span className={`ml-2 font-medium ${discountDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {discountDifference > 0 ? '+' : ''}{discountDifference.toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="text-yellow-700">Volatility diff:</span>
                <span className={`ml-2 font-medium ${volatilityDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {volatilityDifference > 0 ? '+' : ''}{volatilityDifference.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2 text-gray-600" />
          Discount — Detailed Analysis
        </h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 break-words">
              {formatPercentage(callDiscount)}
            </div>
            <div className="text-sm text-gray-600">Call Discount</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 break-words">
              {formatPercentage(callAnnualizedRate)}
            </div>
            <div className="text-sm text-gray-600">Annualized Rate</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(callFairValue)}
            </div>
            <div className="text-sm text-gray-600">Fair Value</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(callTheoretical)}
            </div>
            <div className="text-sm text-gray-600">Theoretical Call Price</div>
        </div>
        </div>

        {/* 投資建議 */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <h4 className="font-medium text-blue-900 mb-2">💡 Why BTC-derived IV</h4>
          <p className="text-sm text-blue-800">
            Compared to historical IV, BTC-implied IV reflects forward-looking market expectations. Beta scales BTC risk
            to altcoins ({betaAnalysis?.betaAnalysis?.beta?.toFixed(2)}×). Confidence:
            <span className={`font-medium ml-1 ${
              betaAnalysis?.volatilityComparison?.confidence === 'high' ? 'text-green-700' :
              betaAnalysis?.volatilityComparison?.confidence === 'medium' ? 'text-yellow-700' : 'text-red-700'
            }`}>
              {betaAnalysis?.volatilityComparison?.confidence === 'high' ? 'High' :
               betaAnalysis?.volatilityComparison?.confidence === 'medium' ? 'Medium' : 'Low'}
            </span>
          </p>
        </div>
      </div>

      {/* Calculation details */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setShowCalculationDetails(!showCalculationDetails)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-lg font-semibold text-gray-900">
              🧮 Calculation Details
            </h3>
            <span className="text-sm text-gray-500">
              {showCalculationDetails ? 'Hide details' : 'Show details'}
            </span>
          </button>
        </div>

        {showCalculationDetails && (
          <div className="p-4 space-y-4">
            {/* BTC隱含波動率推導步驟 */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">🔄 BTC-IV Derivation Steps</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-3 bg-blue-50 rounded">
                  <span>1. Fetch BTC implied volatility:</span>
                  <span className="font-medium">
                    {betaAnalysis?.btcImpliedVolatility?.impliedVolatility?.toFixed(1)}% 
                    ({betaAnalysis?.btcImpliedVolatility?.source === 'deribit_options' ? 'Deribit' : 'Fallback'})
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-blue-50 rounded">
                  <span>2. Compute Beta:</span>
                  <span className="font-medium">
                    {betaAnalysis?.betaAnalysis?.beta?.toFixed(3)} (corr: {betaAnalysis?.betaAnalysis?.correlation ? (betaAnalysis.betaAnalysis.correlation * 100).toFixed(1) + '%' : 'N/A'})
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-blue-50 rounded">
                  <span>3. Derive implied volatility:</span>
                  <span className="font-medium">
                    {betaAnalysis?.btcImpliedVolatility?.impliedVolatility?.toFixed(1)}% × {betaAnalysis?.betaAnalysis?.beta?.toFixed(3)} = {calculation.impliedVolatility?.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-green-50 rounded border border-green-200">
                  <span className="font-medium">Final discount rate:</span>
                  <span className="font-bold text-green-700">{formatPercentage(callDiscount)}</span>
                </div>
              </div>
            </div>

            {/* Beta係數詳細信息 */}
            {betaAnalysis && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">📊 Beta Computation Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">Formula:</span>
                    <span className="font-medium">Cov(Altcoin, BTC) / Var(BTC)</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">Data window:</span>
                    <span className="font-medium">{betaAnalysis.betaAnalysis?.calculationPeriodDays} days</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">Data points:</span>
                    <span className="font-medium">{betaAnalysis.betaAnalysis?.dataPoints}</span>
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
