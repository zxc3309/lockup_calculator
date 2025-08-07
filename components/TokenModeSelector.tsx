'use client';

import React from 'react';
import { TokenCalculationMode } from '@/types';

interface TokenModeSelectorProps {
  selectedMode: TokenCalculationMode;
  onModeChange: (mode: TokenCalculationMode) => void;
}

export default function TokenModeSelector({ selectedMode, onModeChange }: TokenModeSelectorProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-3">
        選擇計算模式
      </label>
      <div className="space-y-3">
        <div 
          className={`
            border-2 rounded-lg p-4 cursor-pointer transition-all duration-200
            ${selectedMode === 'market-data' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
          onClick={() => onModeChange('market-data')}
        >
          <div className="flex items-center">
            <input
              type="radio"
              id="market-data"
              name="calculation-mode"
              value="market-data"
              checked={selectedMode === 'market-data'}
              onChange={() => onModeChange('market-data')}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="market-data" className="ml-3 cursor-pointer">
              <div className="text-sm font-medium text-gray-900">
                📊 BTC/ETH (期權市場數據)
              </div>
              <div className="text-xs text-gray-600 mt-1">
                使用Deribit真實期權價格，雙到期日方差外推法，高精度計算
              </div>
            </label>
          </div>
        </div>

        <div 
          className={`
            border-2 rounded-lg p-4 cursor-pointer transition-all duration-200
            ${selectedMode === 'historical-volatility' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
          onClick={() => onModeChange('historical-volatility')}
        >
          <div className="flex items-center">
            <input
              type="radio"
              id="historical-volatility"
              name="calculation-mode"
              value="historical-volatility"
              checked={selectedMode === 'historical-volatility'}
              onChange={() => onModeChange('historical-volatility')}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="historical-volatility" className="ml-3 cursor-pointer">
              <div className="text-sm font-medium text-gray-900">
                💎 其他代幣 (歷史波動率)
              </div>
              <div className="text-xs text-gray-600 mt-1">
                基於歷史價格波動率和目標價格預期，適合VC投資場景
              </div>
            </label>
          </div>
        </div>
      </div>
      
      {selectedMode === 'historical-volatility' && (
        <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-md">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>💡 投資邏輯說明：</strong>
                此模式適合對代幣長期價值有明確預期的投資者。通過設定目標價格，
                系統將計算高執行價格Call期權的理論價值，反映您的看好程度。
                目標價格越高於現價，折扣率越低。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}