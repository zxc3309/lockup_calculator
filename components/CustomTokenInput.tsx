'use client';

import React, { useState, useEffect } from 'react';
import { LockupPeriod, CustomTokenInput as CustomTokenInputType } from '@/types';

interface CustomTokenInputProps {
  onInputChange: (input: CustomTokenInputType & { volatilityMethod?: 'historical' | 'btc-implied' }) => void;
  loading?: boolean;
}

export default function CustomTokenInput({ onInputChange, loading = false }: CustomTokenInputProps) {
  const [symbol, setSymbol] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [period, setPeriod] = useState<LockupPeriod>('1Y');
  const [volatilityMethod, setVolatilityMethod] = useState<'historical' | 'btc-implied'>('historical');
  const [volatilityDays, setVolatilityDays] = useState<60 | 90 | 180>(90);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  // Common token mappings for user convenience
  const getTokenId = (input: string): string => {
    const commonMappings: { [key: string]: string } = {
      'btc': 'bitcoin',
      'eth': 'ethereum', 
      'sol': 'solana',
      'ada': 'cardano',
      'dot': 'polkadot',
      'link': 'chainlink',
      'uni': 'uniswap',
      'ltc': 'litecoin',
      'bch': 'bitcoin-cash',
      'xlm': 'stellar',
      'matic': 'matic-network',
      'avax': 'avalanche-2',
      'atom': 'cosmos',
      'algo': 'algorand',
      'xtz': 'tezos'
    };
    
    return commonMappings[input.toLowerCase()] || input.toLowerCase();
  };

  // Auto-fetch current price when symbol changes
  useEffect(() => {
    const fetchCurrentPrice = async () => {
      if (!symbol || symbol.length < 2) {
        setCurrentPrice(null);
        setPriceError(null);
        return;
      }

      setPriceLoading(true);
      setPriceError(null);
      
      try {
        const tokenId = getTokenId(symbol);
        // Use our custom API endpoint for price fetching to leverage multi-API support
        const response = await fetch(`/api/custom-token/price?tokenId=${tokenId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch price');
        }

        const result = await response.json();
        
        if (result.success && result.price) {
          setCurrentPrice(result.price);
        } else {
          throw new Error(result.error || 'Token price not found');
        }
      } catch (error) {
        console.error('Price fetch error:', error);
        setPriceError(error instanceof Error ? error.message : 'Error occurred while fetching price');
        setCurrentPrice(null);
      } finally {
        setPriceLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchCurrentPrice, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [symbol]);

  // Update parent component when inputs change
  useEffect(() => {
    if (symbol && targetPrice && !isNaN(parseFloat(targetPrice))) {
      const tokenId = getTokenId(symbol);
      onInputChange({
        symbol: tokenId,
        targetPrice: parseFloat(targetPrice),
        period,
        volatilityMethod,
        volatilityDays
      });
    }
  }, [symbol, targetPrice, period, volatilityMethod, volatilityDays, onInputChange]);

  const targetPriceNum = parseFloat(targetPrice);
  const multiplier = currentPrice && targetPriceNum ? (targetPriceNum / currentPrice) : null;

  return (
    <div className="space-y-4">
      {/* Token Symbol Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Token Symbol
        </label>
        <div className="relative">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toLowerCase())}
            placeholder="e.g., btc, eth, sol, ada, dot"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />
          {priceLoading && (
            <div className="absolute right-3 top-2">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
        
        {/* Current Price Display */}
        {currentPrice && (
          <div className="mt-2 text-sm text-gray-600">
            ✅ Current Price: <span className="font-medium text-green-600">${currentPrice.toLocaleString('en-US')}</span>
          </div>
        )}

        {priceError && (
          <div className="mt-2 text-sm text-red-600">
            ❌ {priceError}
          </div>
        )}
        
        <div className="mt-1 text-xs text-gray-500">
          Shortcodes supported: btc, eth, sol, ada, dot, link, uni, ltc, matic, avax
        </div>
      </div>

      {/* Lockup Period Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lockup Period
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(['3M', '6M', '1Y', '2Y'] as LockupPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              disabled={loading}
              className={`px-3 py-2 rounded-md font-medium text-sm transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Volatility Calculation Method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Volatility Method
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="volatilityMethod"
              value="historical"
              checked={volatilityMethod === 'historical'}
              onChange={(e) => setVolatilityMethod(e.target.value as 'historical' | 'btc-implied')}
              disabled={loading}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-900">
              📈 Historical Volatility
              <span className="text-gray-500 ml-1">(based on past data)</span>
            </span>
          </label>
          
          <label className="flex items-center">
            <input
              type="radio"
              name="volatilityMethod"
              value="btc-implied"
              checked={volatilityMethod === 'btc-implied'}
              onChange={(e) => setVolatilityMethod(e.target.value as 'historical' | 'btc-implied')}
              disabled={loading}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-900">
              🚀 BTC-Implied Volatility (derived)
              <span className="text-gray-500 ml-1">(BTC options market × Beta)</span>
            </span>
          </label>
        </div>
        
        <div className="mt-2 text-xs text-gray-500">
          {volatilityMethod === 'historical' ? (
            '💡 Uses historical price volatility to reflect past behavior'
          ) : (
            '💡 Incorporates BTC options market expectations; derives altcoin IV via beta'
          )}
        </div>
        
        {/* Historical Volatility Days Selection - Only show when historical method is selected */}
        {volatilityMethod === 'historical' && (
          <div className="mt-3 pl-6">
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Historical Window
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([60, 90, 180] as const).map((days) => (
                <button
                  key={days}
                  onClick={() => setVolatilityDays(days)}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                    volatilityDays === days
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
            <div className="mt-1.5 text-xs text-gray-500">
              {volatilityDays === 60 && 'Shorter window—more reactive to recent moves'}
              {volatilityDays === 90 && 'Standard window—balances short/mid-term trends'}
              {volatilityDays === 180 && 'Longer window—smoother historical trend'}
            </div>
          </div>
        )}
      </div>

      {/* Target Price Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Target Price Expectation
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2 text-gray-500">$</span>
          <input
            type="number"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="Your expected fair price at unlock"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
            step="0.01"
            min="0"
          />
        </div>
        
        {/* Target Price Analysis */}
        {currentPrice && targetPriceNum && multiplier && (
          <div className="mt-2 space-y-1">
            <div className="text-sm">
              <span className="text-gray-600">Target multiple: </span>
              <span className={`font-medium ${
                multiplier >= 2 ? 'text-green-600' : 
                multiplier >= 1.5 ? 'text-blue-600' : 
                multiplier >= 1 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {multiplier.toFixed(2)}x
              </span>
              <span className="text-gray-500 ml-2">
                ({multiplier >= 1 ? '+' : ''}{((multiplier - 1) * 100).toFixed(1)}%)
              </span>
            </div>
            
            <div className="text-xs text-gray-500">
              💡 Higher multiple → lower discount (stronger bullish view)
            </div>
          </div>
        )}
        
        <div className="mt-1 text-xs text-gray-500">
          Based on your long-term view of the token
        </div>
      </div>

      {/* Validation Status */}
      {symbol && targetPrice && currentPrice && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-800">
                ✅ Ready. You can calculate the discount now.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
