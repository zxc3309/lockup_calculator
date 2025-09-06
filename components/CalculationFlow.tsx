'use client';

import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, CheckIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { CalculationStep } from '@/types';

interface CalculationFlowProps {
  steps: CalculationStep[];
  currentStep?: string;
  isVisible?: boolean;
  onToggle?: () => void;
}

const StepIcon = ({ status }: { status: CalculationStep['status'] }) => {
  switch (status) {
    case 'completed':
      return <CheckIcon className="w-5 h-5 text-green-600" />;
    case 'processing':
      return <ClockIcon className="w-5 h-5 text-blue-600 animate-pulse" />;
    case 'error':
      return <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />;
    default:
      return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
  }
};

const StepDetail = ({ step }: { step: CalculationStep }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg mb-4 bg-white shadow-sm">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <StepIcon status={step.status} />
            <div>
              <h3 className="font-medium text-gray-900">{step.name}</h3>
              <p className="text-sm text-gray-600">{step.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {step.duration && (
              <span className="text-xs text-gray-500">{step.duration}ms</span>
            )}
            {expanded ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {step.formula && (
            <div className="mt-3 p-3 bg-blue-50 rounded-md">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Formula</h4>
              <code className="text-sm text-blue-800 font-mono">{step.formula}</code>
            </div>
          )}

          {step.input && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Inputs</h4>
              <div className="bg-gray-50 p-3 rounded-md">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(step.input, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {step.output && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Output</h4>
              <div className="bg-green-50 p-3 rounded-md">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {typeof step.output === 'object' 
                    ? JSON.stringify(step.output, null, 2)
                    : String(step.output)
                  }
                </pre>
              </div>
            </div>
          )}

          {step.errorMessage && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-red-900 mb-2">Error</h4>
              <div className="bg-red-50 p-3 rounded-md">
                <p className="text-xs text-red-700">{step.errorMessage}</p>
              </div>
            </div>
          )}

          {step.timestamp && (
            <div className="mt-3 text-xs text-gray-500">
              Executed at: {step.timestamp.toLocaleString('en-US')}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default function CalculationFlow({ 
  steps, 
  currentStep, 
  isVisible = true, 
  onToggle 
}: CalculationFlowProps) {
  if (!isVisible) return null;

  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">🧮 Calculation Flow</h2>
          {onToggle && (
            <button
              onClick={onToggle}
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Collapse
            </button>
          )}
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        <div className="text-sm text-gray-600">
          Progress: {completedSteps}/{totalSteps} steps ({progressPercentage.toFixed(0)}%)
        </div>
      </div>

      <div className="p-4 max-h-96 overflow-y-auto">
        {steps.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ClockIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No steps yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {steps.map((step, index) => (
              <StepDetail key={step.id} step={step} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 預定義的計算步驟模板
export const CALCULATION_STEPS_TEMPLATE = {
  MARKET_DATA: {
    id: 'market-data',
    name: '📊 Market Data Fetch',
    description: 'Fetch spot price from CoinGecko and options chain from Deribit',
    status: 'pending' as const
  },
  
  DUAL_EXPIRY_SELECTION: {
    id: 'dual-expiry-selection',
    name: '🎯 Dual-Expiry Selection',
    description: 'Analyze available expiries and pick the best two',
    status: 'pending' as const,
    formula: 'Strategy = f(target_date, available_expiries)'
  },
  
  COMMON_STRIKES: {
    id: 'common-strikes',
    name: '⚖️ Common ATM Strikes',
    description: 'Find common strikes across expiries; pick top 5 nearest ATM',
    status: 'pending' as const,
    formula: 'ATM_distance = |Strike - Spot_Price|'
  },
  
  VARIANCE_EXTRAPOLATION: {
    id: 'variance-extrapolation',
    name: '📈 Variance Extrapolation',
    description: 'Linearly extrapolate variance between two expiries to target',
    status: 'pending' as const,
    formula: 'σ_target = √(Var_target / T_target)'
  },
  
  BLACK_SCHOLES: {
    id: 'black-scholes',
    name: '🧮 Black-Scholes Pricing',
    description: 'Use extrapolated IV to price theoretical Call/Put across strikes',
    status: 'pending' as const,
    formula: 'Call = S×N(d1) - K×e^(-r×T)×N(d2)'
  },
  
  DISCOUNT_CALCULATION: {
    id: 'discount-calculation',
    name: '💰 Discount Calculation',
    description: 'Compute Call/Put discounts and liquidity-weighted averages',
    status: 'pending' as const,
    formula: 'Discount = (Theoretical_Price / Spot_Price) × 100%'
  }
};
