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
  expiry: string;  // 到期日 (e.g., "26DEC25")
  // 雙到期日計算相關資訊
  shortTermIV?: number;    // 短期隱含波動率
  longTermIV?: number;     // 長期隱含波動率
  shortTermExpiry?: string; // 短期到期日
  longTermExpiry?: string;  // 長期到期日
  extrapolationStrategy?: ExtrapolationStrategy; // 外推策略
}

export enum ExtrapolationStrategy {
  INTERPOLATION = 'interpolation',           // 內插：目標在兩個期限之間
  EXTRAPOLATION = 'extrapolation',          // 外推：目標超出所有期限
  BOUNDED_EXTRAPOLATION = 'bounded_extrapolation' // 有界外推：使用最佳兩個期限
}

export interface DualExpiryData {
  shortTerm: {
    expiry: string;
    timeToExpiry: number;  // 年為單位
    impliedVol: number;
    optionsData: OptionData[];
  };
  longTerm: {
    expiry: string;
    timeToExpiry: number;  // 年為單位
    impliedVol: number;
    optionsData: OptionData[];
  };
  strategy: ExtrapolationStrategy;
  targetTimeToExpiry: number;  // 目標鎖倉時間（年）
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