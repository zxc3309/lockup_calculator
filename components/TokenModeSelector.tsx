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
        Select Calculation Mode
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
                📊 BTC/ETH (Options Market Data)
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Uses live Deribit options, dual-expiry variance extrapolation, high accuracy
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
                💎 Other Tokens (Historical Volatility)
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Based on historical price volatility and target price; fits VC use cases
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
                <strong>💡 Investment logic:</strong>
                This mode suits investors with a clear long-term view. By setting a target price,
                we price an out-of-the-money Call option to reflect how bullish the view is.
                Higher target vs spot implies a lower discount rate.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
