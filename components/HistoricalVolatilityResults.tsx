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
      {/* Title */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          💎 {customTokenInput.symbol.toUpperCase()} {customTokenInput.period} Lockup Discount Analysis
        </h2>
        <p className="text-sm text-gray-600">
          Call option pricing based on historical volatility and target price
          {volatilityData?.apiProvider && (
            <span className="ml-1">
              (Source: {volatilityData.apiProvider.toUpperCase()})
            </span>
          )}
        </p>
      </div>

      {/* Calculation parameters */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
        <h3 className="font-semibold text-purple-900 mb-3 flex items-center">
          <InformationCircleIcon className="w-5 h-5 mr-2" />
          Parameters Summary
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-purple-700 font-medium">Current Price</span>
            <p className="text-purple-900 font-bold">{formatCurrency(spotPrice)}</p>
          </div>
          <div>
            <span className="text-purple-700 font-medium">Target Price</span>
            <p className="text-purple-900 font-bold">{formatCurrency(customTokenInput.targetPrice)}</p>
            <p className="text-purple-600 text-xs">
              {((customTokenInput.targetPrice / spotPrice - 1) * 100).toFixed(1)}% up
            </p>
          </div>
          <div>
            <span className="text-purple-700 font-medium">Lockup Period</span>
            <p className="text-purple-900">{lockupDays} days</p>
          </div>
          <div>
            <span className="text-purple-700 font-medium">Historical Volatility</span>
            <p className="text-purple-900 font-bold">
              {calculation.impliedVolatility?.toFixed(1)}%
            </p>
            {volatilityData?.historicalDays && (
              <p className="text-purple-600 text-xs">
                {volatilityData.historicalDays} days of data
              </p>
            )}
          </div>
        </div>
        {treasuryRateInfo && (
          <div className="mt-4 pt-3 border-t border-purple-200">
            <span className="text-purple-700 font-medium text-sm">Risk-free rate: </span>
            <span className="text-purple-900 font-semibold">{treasuryRateInfo.displayText}</span>
            {treasuryRateInfo.source === 'FALLBACK' && (
              <span className="ml-2 text-orange-600 text-xs">⚠️ Fallback</span>
            )}
            {treasuryRateInfo.source === 'FRED_API' && (
              <span className="ml-2 text-green-600 text-xs">✅ Live</span>
            )}
          </div>
        )}
      </div>

      {/* Call discount main card */}
      <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <ArrowTrendingUpIcon className="w-8 h-8" />
            <div>
              <h3 className="text-xl font-semibold">Call Discount Rate</h3>
              <p className="text-red-100">Opportunity cost vs target price</p>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="text-4xl font-bold mb-2">
            {formatPercentage(callDiscount)}
          </div>
          <div className="text-red-100">
            Theoretical Call Value: {formatCurrency(callTheoretical)}
          </div>
        </div>
        
        <p className="text-red-100">
          With target price {formatCurrency(customTokenInput.targetPrice)}, the lockup opportunity cost
          is {formatPercentage(callDiscount)} — potential upside forgone if price reaches the target.
        </p>
      </div>

      {/* Detailed analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2 text-gray-600" />
          Call Discount — Detailed Analysis
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

        {/* Investment note */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <h4 className="font-medium text-yellow-900 mb-2">💡 VC Investment Logic</h4>
          <p className="text-sm text-yellow-800">
            <strong>Target setting</strong>: {formatPercentage(callDiscount)} reflects the opportunity cost implied by your
            long-term view on {customTokenInput.symbol.toUpperCase()} ({formatCurrency(customTokenInput.targetPrice)}).
            Higher target multiples imply lower discount rates — stronger bullish conviction. Useful to compare against
            other VC opportunities.
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
          <div className="p-4">
            <div className="space-y-4">
              {/* Black-Scholes parameters */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">📊 Black-Scholes Parameters</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">S (Spot):</span>
                    <span className="font-medium">{formatCurrency(spotPrice)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">K (Strike):</span>
                    <span className="font-medium">{formatCurrency(customTokenInput.targetPrice)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">T (Time to expiry):</span>
                    <span className="font-medium">{(lockupDays / 365).toFixed(3)} yr</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">σ (Volatility):</span>
                    <span className="font-medium">{calculation.impliedVolatility?.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-600">r (Risk-free rate):</span>
                    <span className="font-medium">{treasuryRateInfo ? (treasuryRateInfo.rate * 100).toFixed(2) + '%' : 'Loading...'}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-green-50 rounded border border-green-200">
                    <span className="text-gray-600">Call price:</span>
                    <span className="font-bold text-green-700">{formatCurrency(callTheoretical)}</span>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">🔄 Steps</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-3 bg-blue-50 rounded">
                    <span>1. Historical volatility:</span>
                    <span className="font-medium">
                      {volatilityData?.historicalDays || 90} days → {calculation.impliedVolatility?.toFixed(1)}% annualized
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-blue-50 rounded">
                    <span>2. Black-Scholes pricing:</span>
                    <span className="font-medium">
                      Call price = {formatCurrency(callTheoretical)}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-blue-50 rounded">
                    <span>3. Discount calculation:</span>
                    <span className="font-medium">
                      {formatCurrency(callTheoretical)} ÷ {formatCurrency(spotPrice)} = {formatPercentage(callDiscount)}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-green-50 rounded border border-green-200">
                    <span className="font-medium">Final discount rate:</span>
                    <span className="font-bold text-green-700">{formatPercentage(callDiscount)}</span>
                  </div>
                </div>
              </div>

              {/* Data quality */}
              {volatilityData && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">📈 Data Quality</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex justify-between p-3 bg-gray-50 rounded">
                      <span className="text-gray-600">Source:</span>
                      <span className="font-medium">{volatilityData.apiProvider?.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded">
                      <span className="text-gray-600">Data points:</span>
                      <span className="font-medium">{volatilityData.dataPoints}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded">
                      <span className="text-gray-600">Days covered:</span>
                      <span className="font-medium">{volatilityData.historicalDays} days</span>
                    </div>
                    {volatilityData.actualDataPoints && (
                      <div className="flex justify-between p-3 bg-gray-50 rounded">
                        <span className="text-gray-600">Actual points:</span>
                        <span className="font-medium">{volatilityData.actualDataPoints}</span>
                      </div>
                    )}
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
