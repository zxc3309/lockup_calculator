'use client';

import React, { useState, useEffect } from 'react';
import { ArrowTrendingUpIcon, ShieldCheckIcon, InformationCircleIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { DiscountCalculation, RawATMContract, LockupPeriod } from '@/types';
import { getTreasuryRateInfo } from '@/lib/treasuryRates';

interface DiscountResultsProps {
  calculation: DiscountCalculation;
  spotPrice: number;
  dualExpiryInfo?: any;
  token: string;
  period: LockupPeriod;
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

const DiscountCard = ({ 
  title, 
  subtitle, 
  value, 
  description, 
  icon, 
  colorClass,
  theoreticalPrice,
  isSelected = false,
  onClick
}: {
  title: string;
  subtitle: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  theoreticalPrice?: number;
  isSelected?: boolean;
  onClick?: () => void;
}) => (
  <div 
    className={`
      p-6 rounded-lg border-2 transition-all duration-200 cursor-pointer
      ${isSelected 
        ? `${colorClass} border-opacity-50 shadow-lg scale-105` 
        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
      }
    `}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-3">
        {icon}
        <div>
          <h3 className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h3>
          <p className={`text-sm ${isSelected ? 'text-white text-opacity-80' : 'text-gray-600'}`}>
            {subtitle}
          </p>
        </div>
      </div>
    </div>
    
    <div className="mb-3">
      <div className={`text-3xl font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
        {formatPercentage(value)}
      </div>
      {theoreticalPrice && (
        <div className={`text-sm ${isSelected ? 'text-white text-opacity-80' : 'text-gray-600'}`}>
          Theoretical Price: {formatCurrency(theoreticalPrice)}
        </div>
      )}
    </div>
    
    <p className={`text-sm ${isSelected ? 'text-white text-opacity-90' : 'text-gray-600'}`}>
      {description}
    </p>
  </div>
);

const ContractTable = ({ 
  contracts, 
  title, 
  spotPrice,
  showDiscounts = false 
}: { 
  contracts: RawATMContract[], 
  title: string,
  spotPrice: number,
  showDiscounts?: boolean 
}) => {
  
  const calculateRawDiscount = (contract: RawATMContract) => {
    const callDiscount = (contract.callPrice / spotPrice) * 100;
    const putDiscount = (contract.putPrice / spotPrice) * 100;
    return { callDiscount, putDiscount };
  };

  return (
    <div className="mb-6">
      <h5 className="font-medium mb-3 text-sm text-gray-700">{title}</h5>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-2 px-2">Strike</th>
              <th className="text-right py-2 px-2">ATM Dist.</th>
              <th className="text-right py-2 px-2">Call Price</th>
              <th className="text-right py-2 px-2">Put Price</th>
              {showDiscounts && (
                <>
                  <th className="text-right py-2 px-2">Call Discount</th>
                  <th className="text-right py-2 px-2">Put Discount</th>
                </>
              )}
              <th className="text-right py-2 px-2">Market IV</th>
              <th className="text-right py-2 px-2">Weight</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract, index) => {
              const discounts = showDiscounts ? calculateRawDiscount(contract) : null;
              return (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium">
                    ${contract.strike.toLocaleString()}
                  </td>
                  <td className="text-right py-2 px-2">
                    ${contract.atmDistance.toFixed(0)}
                  </td>
                  <td className="text-right py-2 px-2">
                    {contract.callPrice.toFixed(4)}
                  </td>
                  <td className="text-right py-2 px-2">
                    {contract.putPrice.toFixed(4)}
                  </td>
                  {showDiscounts && discounts && (
                    <>
                      <td className="text-right py-2 px-2 text-red-600 font-medium">
                        {discounts.callDiscount.toFixed(2)}%
                      </td>
                      <td className="text-right py-2 px-2 text-green-600 font-medium">
                        {discounts.putDiscount.toFixed(2)}%
                      </td>
                    </>
                  )}
                  <td className="text-right py-2 px-2 font-semibold text-indigo-600">
                    {contract.impliedVol.toFixed(1)}%
                  </td>
                  <td className="text-right py-2 px-2">
                    {contract.weight?.toFixed(3) || 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function DiscountResults({ 
  calculation, 
  spotPrice, 
  dualExpiryInfo, 
  token, 
  period 
}: DiscountResultsProps) {
  const [selectedDiscount, setSelectedDiscount] = useState<'call' | 'put'>('call');
  const [showDetails, setShowDetails] = useState(false);
  const [treasuryRateInfo, setTreasuryRateInfo] = useState<{
    displayText: string;
    source: string;
    rate: number;
  } | null>(null);

  const callDiscount = calculation.callDiscount || 0;
  const putDiscount = calculation.putDiscount || 0;
  const callTheoretical = calculation.theoreticalCallPrice || 0;
  const putTheoretical = calculation.theoreticalPutPrice || 0;

  // Fetch treasury rate info for display
  useEffect(() => {
    const fetchTreasuryInfo = async () => {
      try {
        const info = await getTreasuryRateInfo(period);
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
  }, [period]);
  
  // Calculate period-specific values for Put and Call
  const periodDaysMap = {
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '2Y': 730
  };
  const lockupDays = periodDaysMap[period as keyof typeof periodDaysMap] || 365;
  
  // Calculate annualized rates for both Put and Call
  const callAnnualizedRate = (callDiscount * 365) / lockupDays;
  const putAnnualizedRate = (putDiscount * 365) / lockupDays;
  
  // Calculate fair values for both Put and Call
  const callFairValue = spotPrice - callTheoretical;
  const putFairValue = spotPrice - putTheoretical;

  return (
    <div className="space-y-6">
      {/* Calculation header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          📊 {token} {period} Lockup Discount Analysis
        </h2>
        <p className="text-sm text-gray-600">
          {dualExpiryInfo ? 'Dual-Expiry Variance Extrapolation' : 'Multi-ATM Weighted Average'}
          {calculation.totalContracts && (
            <span className="ml-1">({calculation.totalContracts} ATM contracts)</span>
          )}
        </p>
      </div>

      {/* Baseline info (if dual-expiry data exists) */}
      {dualExpiryInfo && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <InformationCircleIcon className="w-5 h-5 mr-2" />
            Baseline Information
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700 font-medium">Strategy</span>
              <p className="text-blue-900">
                {dualExpiryInfo.strategy === 'interpolation' ? 'Interpolation' :
                 dualExpiryInfo.strategy === 'extrapolation' ? 'Extrapolation' : 'Bounded Extrapolation'}
              </p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Target Tenor</span>
              <p className="text-blue-900">{(dualExpiryInfo.targetTimeToExpiry * 365).toFixed(0)} days</p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Short Expiry</span>
              <p className="text-blue-900">{dualExpiryInfo.shortTermExpiry}</p>
              <p className="text-blue-700 text-xs">IV: {dualExpiryInfo.shortTermIV.toFixed(1)}%</p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Long Expiry</span>
              <p className="text-blue-900">{dualExpiryInfo.longTermExpiry}</p>
              <p className="text-blue-700 text-xs">IV: {dualExpiryInfo.longTermIV.toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-200">
            <span className="text-blue-700 font-medium text-sm">Extrapolated IV: </span>
            <span className="text-blue-900 font-bold text-lg">{calculation.impliedVolatility?.toFixed(1)}%</span>
          </div>
          {treasuryRateInfo && (
            <div className="mt-2">
              <span className="text-blue-700 font-medium text-sm">Risk-free rate: </span>
              <span className="text-blue-900 font-semibold">{treasuryRateInfo.displayText}</span>
              {treasuryRateInfo.source === 'FALLBACK' && (
                <span className="ml-1 text-orange-600 text-xs">⚠️ Fallback</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Risk-free rate (when single-expiry method is used) */}
      {!dualExpiryInfo && treasuryRateInfo && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <InformationCircleIcon className="w-5 h-5 mr-2 text-gray-600" />
              <span className="text-gray-700 font-medium text-sm">Reference Rate</span>
            </div>
            <div className="text-right">
              <span className="text-gray-900 font-semibold">{treasuryRateInfo.displayText}</span>
              {treasuryRateInfo.source === 'FALLBACK' && (
                <span className="ml-2 text-orange-600 text-xs">⚠️ Fallback</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Call vs Put discount cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <DiscountCard
          title="Call Discount Rate"
          subtitle="Opportunity Cost"
          value={callDiscount}
          description="Cost of missing upside during lockup. Useful in bullish scenarios."
          theoreticalPrice={callTheoretical}
          icon={<ArrowTrendingUpIcon className="w-6 h-6 text-red-600" />}
          colorClass="bg-gradient-to-br from-red-500 to-red-600"
          isSelected={selectedDiscount === 'call'}
          onClick={() => setSelectedDiscount('call')}
        />

        <DiscountCard
          title="Put Discount Rate"
          subtitle="Hedging Cost"
          value={putDiscount}
          description="Insurance cost to protect against downside. Useful for risk-averse investors."
          theoreticalPrice={putTheoretical}
          icon={<ShieldCheckIcon className="w-6 h-6 text-green-600" />}
          colorClass="bg-gradient-to-br from-green-500 to-green-600"
          isSelected={selectedDiscount === 'put'}
          onClick={() => setSelectedDiscount('put')}
        />
      </div>

      {/* Selected discount detailed analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2 text-gray-600" />
          {selectedDiscount === 'call' ? 'Call Discount Rate' : 'Put Discount Rate'} — Detailed Analysis
        </h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatPercentage(selectedDiscount === 'call' ? callDiscount : putDiscount)}
            </div>
            <div className="text-sm text-gray-600">
              {selectedDiscount === 'call' ? 'Call' : 'Put'} Discount
            </div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatPercentage(selectedDiscount === 'call' ? callAnnualizedRate : putAnnualizedRate)}
            </div>
            <div className="text-sm text-gray-600">Annualized Rate</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(selectedDiscount === 'call' ? callFairValue : putFairValue)}
            </div>
            <div className="text-sm text-gray-600">Fair Value</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(selectedDiscount === 'call' ? callTheoretical : putTheoretical)}
            </div>
            <div className="text-sm text-gray-600">
              Theoretical {selectedDiscount === 'call' ? 'Call' : 'Put'} Price
            </div>
          </div>
        </div>

        {/* Investment note */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <h4 className="font-medium text-blue-900 mb-2">💡 Investment Note</h4>
          <p className="text-sm text-blue-800">
            {selectedDiscount === 'call' ? (
              <>
                <strong>Opportunity cost view</strong>: {formatPercentage(callDiscount)} represents potential upside missed during lockup.
                If you expect {token} to rise more than this over {period}, lockup may be suboptimal.
                Compare with staking APY or other DeFi yields.
              </>
            ) : (
              <>
                <strong>Risk control view</strong>: {formatPercentage(putDiscount)} represents insurance cost against downside.
                If you worry about sharp drawdowns in {token}, this can be a reasonable hedging expense.
                Useful for risk-averse investors as a protection reference.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Data transparency */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-lg font-semibold text-gray-900">
              📋 Raw Market Data
            </h3>
            <span className="text-sm text-gray-500">
              {showDetails ? 'Hide details' : 'Show details'}
            </span>
          </button>
        </div>

        {showDetails && (
          <div className="p-4">
            {dualExpiryInfo && calculation.rawShortTermContracts && calculation.rawLongTermContracts ? (
              <>
                <ContractTable
                  contracts={calculation.rawShortTermContracts}
                  title={`Short Expiry: ${dualExpiryInfo.shortTermExpiry}`}
                  spotPrice={spotPrice}
                  showDiscounts={true}
                />
                <ContractTable
                  contracts={calculation.rawLongTermContracts}
                  title={`Long Expiry: ${dualExpiryInfo.longTermExpiry}`}
                  spotPrice={spotPrice}
                  showDiscounts={true}
                />
              </>
            ) : calculation.atmCalculations ? (
              <div>
                <h5 className="font-medium mb-3 text-sm text-gray-700">ATM Contracts</h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-2 px-2">Strike</th>
                        <th className="text-left py-2 px-2">Expiry</th>
                        <th className="text-right py-2 px-2">ATM Dist.</th>
                        <th className="text-right py-2 px-2">Call Disc.</th>
                        <th className="text-right py-2 px-2">Put Disc.</th>
                        <th className="text-right py-2 px-2">Implied Vol</th>
                        <th className="text-right py-2 px-2">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculation.atmCalculations.map((calc, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-2 font-medium">${calc.strike.toLocaleString()}</td>
                          <td className="py-2 px-2">{calc.expiry}</td>
                          <td className="text-right py-2 px-2">${calc.atmDistance.toFixed(0)}</td>
                          <td className="text-right py-2 px-2 text-red-600 font-medium">
                            {calc.callDiscount.toFixed(2)}%
                          </td>
                          <td className="text-right py-2 px-2 text-green-600 font-medium">
                            {calc.putDiscount.toFixed(2)}%
                          </td>
                          <td className="text-right py-2 px-2 font-semibold text-blue-600">
                            {calc.impliedVolatility.toFixed(1)}%
                          </td>
                          <td className="text-right py-2 px-2">{calc.weight.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No detailed contract data</p>
            )}

            {/* Market parameters summary */}
            {calculation.impliedVolatility !== undefined && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h5 className="font-medium mb-3 text-sm text-gray-700">Weighted Market Parameters</h5>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Implied Volatility:</span>
                    <span className="ml-2 font-medium">{calculation.impliedVolatility.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Theoretical Call Price:</span>
                    <span className="ml-2 font-medium">{formatCurrency(callTheoretical)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Theoretical Put Price:</span>
                    <span className="ml-2 font-medium">{formatCurrency(putTheoretical)}</span>
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
