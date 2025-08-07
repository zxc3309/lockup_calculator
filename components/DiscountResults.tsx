'use client';

import React, { useState } from 'react';
import { ArrowTrendingUpIcon, ShieldCheckIcon, InformationCircleIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { DiscountCalculation, RawATMContract } from '@/types';

interface DiscountResultsProps {
  calculation: DiscountCalculation;
  spotPrice: number;
  dualExpiryInfo?: any;
  token: string;
  period: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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
          理論價格: {formatCurrency(theoreticalPrice)}
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
              <th className="text-left py-2 px-2">執行價格</th>
              <th className="text-right py-2 px-2">ATM距離</th>
              <th className="text-right py-2 px-2">Call價格</th>
              <th className="text-right py-2 px-2">Put價格</th>
              {showDiscounts && (
                <>
                  <th className="text-right py-2 px-2">Call折扣</th>
                  <th className="text-right py-2 px-2">Put折扣</th>
                </>
              )}
              <th className="text-right py-2 px-2">市場IV</th>
              <th className="text-right py-2 px-2">權重</th>
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

  const callDiscount = calculation.callDiscount || 0;
  const putDiscount = calculation.putDiscount || 0;
  const callTheoretical = calculation.theoreticalCallPrice || 0;
  const putTheoretical = calculation.theoreticalPutPrice || 0;

  return (
    <div className="space-y-6">
      {/* 計算方法標題 */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          📊 {token} {period} 鎖倉折扣率分析
        </h2>
        <p className="text-sm text-gray-600">
          {dualExpiryInfo ? '雙到期日方差外推法' : '多合約ATM加權平均'}
          {calculation.totalContracts && (
            <span className="ml-1">({calculation.totalContracts}個ATM合約)</span>
          )}
        </p>
      </div>

      {/* 計算基準資訊 (如果有雙到期日數據) */}
      {dualExpiryInfo && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <InformationCircleIcon className="w-5 h-5 mr-2" />
            計算基準資訊
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700 font-medium">策略</span>
              <p className="text-blue-900">
                {dualExpiryInfo.strategy === 'interpolation' ? '內插法' :
                 dualExpiryInfo.strategy === 'extrapolation' ? '外推法' : '有界外推法'}
              </p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">目標期限</span>
              <p className="text-blue-900">{(dualExpiryInfo.targetTimeToExpiry * 365).toFixed(0)}天</p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">短期到期</span>
              <p className="text-blue-900">{dualExpiryInfo.shortTermExpiry}</p>
              <p className="text-blue-700 text-xs">IV: {dualExpiryInfo.shortTermIV.toFixed(1)}%</p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">長期到期</span>
              <p className="text-blue-900">{dualExpiryInfo.longTermExpiry}</p>
              <p className="text-blue-700 text-xs">IV: {dualExpiryInfo.longTermIV.toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-200">
            <span className="text-blue-700 font-medium text-sm">外推隱含波動率: </span>
            <span className="text-blue-900 font-bold text-lg">{calculation.impliedVolatility?.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Call vs Put 折扣卡片 */}
      <div className="grid md:grid-cols-2 gap-6">
        <DiscountCard
          title="Call 折扣率"
          subtitle="機會成本分析"
          value={callDiscount}
          description="鎖倉期間錯過上漲潛在收益的代價。適合評估牛市中鎖倉是否划算。"
          theoreticalPrice={callTheoretical}
          icon={<ArrowTrendingUpIcon className="w-6 h-6 text-red-600" />}
          colorClass="bg-gradient-to-br from-red-500 to-red-600"
          isSelected={selectedDiscount === 'call'}
          onClick={() => setSelectedDiscount('call')}
        />

        <DiscountCard
          title="Put 折扣率"
          subtitle="保險成本分析"
          value={putDiscount}
          description="防止價格下跌所需支付的保險費用。適合風險厭惡投資者參考。"
          theoreticalPrice={putTheoretical}
          icon={<ShieldCheckIcon className="w-6 h-6 text-green-600" />}
          colorClass="bg-gradient-to-br from-green-500 to-green-600"
          isSelected={selectedDiscount === 'put'}
          onClick={() => setSelectedDiscount('put')}
        />
      </div>

      {/* 選中折扣的詳細分析 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2 text-gray-600" />
          {selectedDiscount === 'call' ? 'Call折扣率' : 'Put折扣率'} 詳細分析
        </h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatPercentage(selectedDiscount === 'call' ? callDiscount : putDiscount)}
            </div>
            <div className="text-sm text-gray-600">
              {selectedDiscount === 'call' ? 'Call' : 'Put'} 折扣率
            </div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatPercentage(calculation.annualizedRate)}
            </div>
            <div className="text-sm text-gray-600">年化折扣率</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(calculation.fairValue)}
            </div>
            <div className="text-sm text-gray-600">合理購買價格</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(selectedDiscount === 'call' ? callTheoretical : putTheoretical)}
            </div>
            <div className="text-sm text-gray-600">
              理論{selectedDiscount === 'call' ? 'Call' : 'Put'}價格
            </div>
          </div>
        </div>

        {/* 投資建議 */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <h4 className="font-medium text-blue-900 mb-2">💡 投資建議</h4>
          <p className="text-sm text-blue-800">
            {selectedDiscount === 'call' ? (
              <>
                <strong>機會成本觀點</strong>: {formatPercentage(callDiscount)} 代表鎖倉期間可能錯過的上漲收益。
                如果您預期 {token} 在 {period} 內的上漲幅度超過此折扣率，則鎖倉可能不是最佳選擇。
                適合與 Staking 收益率或其他 DeFi 收益進行比較。
              </>
            ) : (
              <>
                <strong>風險控制觀點</strong>: {formatPercentage(putDiscount)} 代表為防止下跌而支付的保險成本。
                如果您擔心 {token} 價格大幅下跌，此成本可視為風險對沖的合理支出。
                適合風險厭惡的投資者作為保護策略參考。
              </>
            )}
          </p>
        </div>
      </div>

      {/* 數據透明度展示 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-lg font-semibold text-gray-900">
              📋 原始市場數據
            </h3>
            <span className="text-sm text-gray-500">
              {showDetails ? '隱藏詳情' : '顯示詳情'}
            </span>
          </button>
        </div>

        {showDetails && (
          <div className="p-4">
            {dualExpiryInfo && calculation.rawShortTermContracts && calculation.rawLongTermContracts ? (
              <>
                <ContractTable
                  contracts={calculation.rawShortTermContracts}
                  title={`短期到期日: ${dualExpiryInfo.shortTermExpiry}`}
                  spotPrice={spotPrice}
                  showDiscounts={true}
                />
                <ContractTable
                  contracts={calculation.rawLongTermContracts}
                  title={`長期到期日: ${dualExpiryInfo.longTermExpiry}`}
                  spotPrice={spotPrice}
                  showDiscounts={true}
                />
              </>
            ) : calculation.atmCalculations ? (
              <div>
                <h5 className="font-medium mb-3 text-sm text-gray-700">ATM合約明細</h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-2 px-2">執行價格</th>
                        <th className="text-left py-2 px-2">到期日</th>
                        <th className="text-right py-2 px-2">ATM距離</th>
                        <th className="text-right py-2 px-2">Call折扣</th>
                        <th className="text-right py-2 px-2">Put折扣</th>
                        <th className="text-right py-2 px-2">隱含波動率</th>
                        <th className="text-right py-2 px-2">權重</th>
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
              <p className="text-sm text-gray-500">暫無詳細合約數據</p>
            )}

            {/* 市場參數摘要 */}
            {calculation.impliedVolatility !== undefined && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h5 className="font-medium mb-3 text-sm text-gray-700">加權平均市場參數</h5>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">隱含波動率:</span>
                    <span className="ml-2 font-medium">{calculation.impliedVolatility.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600">理論Call價格:</span>
                    <span className="ml-2 font-medium">{formatCurrency(callTheoretical)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">理論Put價格:</span>
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