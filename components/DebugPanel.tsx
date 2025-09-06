'use client';

import { useState } from 'react';
import { DebugInfo, CalculationStep, ApiCallStatus } from '@/types';

interface DebugPanelProps {
  debugInfo: DebugInfo | null;
  isVisible: boolean;
  onToggle: () => void;
}

export default function DebugPanel({ debugInfo, isVisible, onToggle }: DebugPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'steps' | 'data' | 'logs'>('overview');

  if (!debugInfo) {
    return (
      <div className="mt-4 p-4 bg-gray-100 rounded-md">
        <button
          onClick={onToggle}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          🔍 Debug Mode (no data)
        </button>
      </div>
    );
  }

  const formatDuration = (ms: number) => `${ms}ms`;
  const formatTimestamp = (timestamp: Date) => timestamp.toLocaleTimeString('en-US');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'processing':
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const renderApiStatus = (apiCall: ApiCallStatus | null, name: string) => {
    if (!apiCall) return <span className="text-gray-400">Not called</span>;

    return (
      <div className="flex items-center space-x-2">
        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(apiCall.status)}`}>
          {apiCall.status}
        </span>
        {apiCall.duration && <span className="text-xs text-gray-500">{formatDuration(apiCall.duration)}</span>}
        {apiCall.errorMessage && (
          <span className="text-xs text-red-600" title={apiCall.errorMessage}>❌</span>
        )}
      </div>
    );
  };

  const OverviewTab = () => (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">API Status</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Spot Price:</span>
            {renderApiStatus(debugInfo.dataFetchStatus.spotPrice, 'Spot Price')}
          </div>
          <div className="flex justify-between">
            <span>Options Data:</span>
            {renderApiStatus(debugInfo.dataFetchStatus.optionsData, 'Options Data')}
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-2">Parameters</h4>
        <div className="bg-gray-50 p-3 rounded text-sm font-mono">
          <div>Risk-free rate: {(debugInfo.parameters.riskFreeRate * 100).toFixed(2)}%</div>
          <div>Time to expiry: {debugInfo.parameters.timeToExpiry.toFixed(4)} yr</div>
          <div>Lockup days: {debugInfo.parameters.lockupDays} days</div>
        </div>
      </div>

      {debugInfo.warnings.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 text-yellow-600">⚠️ Warnings</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {debugInfo.warnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const StepsTab = () => (
    <div className="space-y-3">
      {debugInfo.calculationSteps.map((step, index) => (
        <div key={step.id} className="border-l-4 border-blue-200 pl-4">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">{step.name}</span>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded text-xs ${getStatusColor(step.status)}`}>
                {step.status}
              </span>
              {step.duration && <span className="text-xs text-gray-500">{formatDuration(step.duration)}</span>}
            </div>
          </div>
          
          {step.description && (
            <p className="text-sm text-gray-600 mb-2">{step.description}</p>
          )}
          
          {step.formula && (
            <div className="bg-gray-50 p-2 rounded text-sm font-mono mb-2">
              {step.formula}
            </div>
          )}
          
          {step.input && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600">Inputs</summary>
              <pre className="bg-gray-50 p-2 mt-1 rounded overflow-x-auto">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </details>
          )}
          
          {step.output && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600">Output</summary>
              <pre className="bg-gray-50 p-2 mt-1 rounded overflow-x-auto">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </details>
          )}
          
          {step.errorMessage && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              Error: {step.errorMessage}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const DataTab = () => (
    <div className="space-y-4">
      {debugInfo.rawData.spotPriceResponse && (
        <div>
          <h4 className="font-medium mb-2">Spot Price Response</h4>
          <details className="text-sm">
            <summary className="cursor-pointer text-blue-600">View raw data</summary>
            <pre className="bg-gray-50 p-3 mt-2 rounded overflow-x-auto max-h-40">
              {JSON.stringify(debugInfo.rawData.spotPriceResponse, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {debugInfo.rawData.optionsChainResponse && (
        <div>
          <h4 className="font-medium mb-2">Options Chain Response</h4>
          <details className="text-sm">
            <summary className="cursor-pointer text-blue-600">View raw data</summary>
            <pre className="bg-gray-50 p-3 mt-2 rounded overflow-x-auto max-h-40">
              {JSON.stringify(debugInfo.rawData.optionsChainResponse, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {debugInfo.rawData.selectedOptions && debugInfo.rawData.selectedOptions.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Filtered Option Contracts</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 py-1 text-left">Strike</th>
                  <th className="px-2 py-1 text-left">Call</th>
                  <th className="px-2 py-1 text-left">Put</th>
                  <th className="px-2 py-1 text-left">IV</th>
                </tr>
              </thead>
              <tbody>
                {debugInfo.rawData.selectedOptions.map((option, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-2 py-1">${option.strike.toLocaleString()}</td>
                    <td className="px-2 py-1">${option.callPrice.toFixed(2)}</td>
                    <td className="px-2 py-1">${option.putPrice.toFixed(2)}</td>
                    <td className="px-2 py-1">{(option.impliedVol * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-4">
      <div className="border border-gray-200 rounded-lg">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <button
            onClick={onToggle}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="font-medium text-gray-700">
              🔍 Debug Info ({formatTimestamp(debugInfo.timestamp)})
            </span>
            <span className="text-gray-500">
              {isVisible ? '▼' : '▶'}
            </span>
          </button>
        </div>

        {isVisible && (
          <div className="p-4">
            <div className="flex space-x-4 mb-4 border-b border-gray-200">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'steps', label: 'Steps' },
                { key: 'data', label: 'Raw Data' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`pb-2 px-1 text-sm font-medium border-b-2 ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {activeTab === 'overview' && <OverviewTab />}
              {activeTab === 'steps' && <StepsTab />}
              {activeTab === 'data' && <DataTab />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
