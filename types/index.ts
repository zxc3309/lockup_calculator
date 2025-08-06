export type Token = 'BTC' | 'ETH';
export type LockupPeriod = '3M' | '6M' | '1Y' | '2Y';

export interface PriceData {
  token: Token;
  spot: number;
  timestamp: Date;
}

export interface ATMCalculation {
  strike: number;
  callDiscount: number;
  putDiscount: number;
  theoreticalCallPrice: number;
  theoreticalPutPrice: number;
  impliedVolatility: number;
  weight: number;
  atmDistance: number;
}

export interface DiscountCalculation {
  annualizedRate: number;      // 年化折扣率 (%)
  fairValue: number;           // 合理價格
  discount: number;            // 實際折扣 (%)
  method?: string;             // 計算方法
  // Black-Scholes相關字段
  callDiscount?: number;       // Call折扣率 (%)
  putDiscount?: number;        // Put折扣率 (%)
  impliedVolatility?: number;  // 隱含波動率 (%)
  theoreticalCallPrice?: number; // 理論Call價格
  theoreticalPutPrice?: number;  // 理論Put價格
  // 多合約ATM計算詳細信息
  atmCalculations?: ATMCalculation[];
  totalContracts?: number;
}

export interface OptionData {
  strike: number;
  callPrice: number;
  putPrice: number;
  expiry: string;
  impliedVol: number;
  callBid?: number;
  callAsk?: number;
  putBid?: number;
  putAsk?: number;
}


// 調試和狀態追蹤相關類型
export interface ApiCallStatus {
  endpoint: string;
  status: 'pending' | 'success' | 'error';
  startTime: number;
  endTime?: number;
  duration?: number;
  errorMessage?: string;
  responseSize?: number;
}

export interface DataFetchStatus {
  spotPrice: ApiCallStatus | null;
  optionsData: ApiCallStatus | null;
  overall: 'idle' | 'loading' | 'success' | 'partial' | 'error';
}

export interface CalculationStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  input?: any;
  output?: any;
  formula?: string;
  description?: string;
  duration?: number;
  errorMessage?: string;
}

export interface DebugInfo {
  dataFetchStatus: DataFetchStatus;
  calculationSteps: CalculationStep[];
  rawData: {
    spotPriceResponse?: any;
    optionsChainResponse?: any;
    selectedOptions?: OptionData[];
  };
  parameters: {
    riskFreeRate: number;
    timeToExpiry: number;
    lockupDays: number;
  };
  warnings: string[];
  timestamp: Date;
}


export interface MarketData {
  bitcoin: {
    usd: number;
  };
  ethereum: {
    usd: number;
  };
}