import { LockupPeriod, DiscountCalculation, OptionData, ATMCalculation, DualExpiryData, ExtrapolationStrategy } from '@/types';

// 將鎖倉期轉換為天數
export function lockupPeriodToDays(period: LockupPeriod): number {
  const periodMap: Record<LockupPeriod, number> = {
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '2Y': 730,
  };
  return periodMap[period];
}

// 標準正態分佈累積函數 N(x)
function cumulativeNormalDistribution(x: number): number {
  // 使用近似公式計算標準正態分佈累積函數
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// Black-Scholes Call期權價格
function blackScholesCall(
  S: number,     // 現貨價格
  K: number,     // 履約價格
  T: number,     // 到期時間（年）
  r: number,     // 無風險利率
  sigma: number  // 波動率
): number {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return S * cumulativeNormalDistribution(d1) - K * Math.exp(-r * T) * cumulativeNormalDistribution(d2);
}

// Black-Scholes Put期權價格
function blackScholesPut(
  S: number,     // 現貨價格
  K: number,     // 履約價格
  T: number,     // 到期時間（年）
  r: number,     // 無風險利率
  sigma: number  // 波動率
): number {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return K * Math.exp(-r * T) * cumulativeNormalDistribution(-d2) - S * cumulativeNormalDistribution(-d1);
}

// 方差線性內插/外推
function varianceExtrapolation(
  impliedVol1: number, // 短期波動率
  time1: number,       // 短期時間（年）
  impliedVol2: number, // 長期波動率  
  time2: number,       // 長期時間（年）
  targetTime: number   // 目標時間（年）
): number {
  // 計算方差
  const variance1 = impliedVol1 * impliedVol1 * time1;
  const variance2 = impliedVol2 * impliedVol2 * time2;
  
  // 線性外推方差
  const targetVariance = variance1 + (variance2 - variance1) * (targetTime - time1) / (time2 - time1);
  
  // 還原波動率
  return Math.sqrt(targetVariance / targetTime);
}


// 使用Put-Call Parity計算隱含遠期價格
export function calculateImpliedForward(
  callPrice: number,
  putPrice: number,
  strike: number,
  riskFreeRate: number = 0.05,
  timeToExpiry: number
): number {
  // Put-Call Parity: Forward = Strike + e^(r×T) × (Call - Put)
  const discountFactor = Math.exp(riskFreeRate * timeToExpiry);
  const impliedForward = strike + discountFactor * (callPrice - putPrice);
  return impliedForward;
}

// 數據驗證函數
export function validateOptionsData(optionsData: OptionData[], spotPrice: number): string[] {
  const warnings: string[] = [];
  
  if (optionsData.length === 0) {
    warnings.push('未找到任何選擇權合約數據');
    return warnings;
  }
  
  // 檢查價格合理性
  optionsData.forEach((option, index) => {
    if (option.callPrice <= 0 || option.putPrice <= 0) {
      warnings.push(`合約 ${index + 1} 的選擇權價格無效 (Call: ${option.callPrice}, Put: ${option.putPrice})`);
    }
    
    if (option.strike <= 0) {
      warnings.push(`合約 ${index + 1} 的執行價格無效: ${option.strike}`);
    }
    
    // 檢查Call-Put價格關係合理性
    const intrinsicValue = Math.max(0, spotPrice - option.strike);
    if (option.callPrice < intrinsicValue * 0.5) {
      warnings.push(`合約 ${index + 1} 的Call價格可能過低`);
    }
  });
  
  // 檢查ATM選擇權的可用性
  const hasATM = optionsData.some(o => Math.abs(o.strike - spotPrice) / spotPrice < 0.1);
  if (!hasATM) {
    warnings.push('沒有接近平價的選擇權合約，計算結果可能不準確');
  }
  
  // 檢查數據新鮮度
  const now = new Date();
  optionsData.forEach((option, index) => {
    if (option.expiry) {
      const expiryDate = new Date(option.expiry);
      if (expiryDate < now) {
        warnings.push(`合約 ${index + 1} 已過期`);
      }
    }
  });
  
  return warnings;
}

// 新的基於隱含波動率和Black-Scholes的折扣率計算
export function calculateDiscountFromOptions(
  optionsData: OptionData[],
  spotPrice: number,
  lockupDays: number,
  riskFreeRate: number = 0.02
): DiscountCalculation {
  if (optionsData.length === 0) {
    throw new Error('No options data available');
  }
  
  // 數據驗證
  const validationWarnings = validateOptionsData(optionsData, spotPrice);
  if (validationWarnings.length > 0) {
    console.warn('Options data validation warnings:', validationWarnings);
  }
  
  const timeToExpiry = lockupDays / 365;
  
  // 計算流動性評分
  const calculateLiquidityScore = (option: OptionData): number => {
    const spread = (option.callAsk || 0) - (option.callBid || 0) + (option.putAsk || 0) - (option.putBid || 0);
    const avgPrice = (option.callPrice + option.putPrice) / 2;
    const spreadRatio = spread / avgPrice;
    // 流動性評分 = 1 / (1 + 價差率)，價差越小分數越高
    return 1 / (1 + spreadRatio);
  };
  
  // 選擇前5個最接近ATM的合約
  const sortedByATM = optionsData
    .map(option => ({
      ...option,
      atmDistance: Math.abs(option.strike - spotPrice),
      liquidityScore: calculateLiquidityScore(option)
    }))
    .sort((a, b) => a.atmDistance - b.atmDistance)
    .slice(0, 5); // 取前5個最接近的
  
  console.log(`Spot Price: $${spotPrice.toFixed(0)}`);
  console.log(`Top 5 ATM Options:`);
  sortedByATM.forEach((option, i) => {
    console.log(`  ${i+1}. Strike=${option.strike}, Distance=${option.atmDistance.toFixed(0)}, Liquidity=${option.liquidityScore.toFixed(3)}, IV=${option.impliedVol.toFixed(1)}%`);
  });
  
  if (sortedByATM.length === 0) {
    throw new Error('No suitable ATM options found');
  }
  
  // 對每個ATM合約進行Black-Scholes計算
  const calculations = sortedByATM.map(option => {
    let impliedVolatility = option.impliedVol / 100;
    
    // 如果波動率為0，使用歷史平均值估算
    if (impliedVolatility === 0) {
      impliedVolatility = 0.8; // BTC/ETH典型波動率80%
      console.warn(`Using default volatility for strike ${option.strike}: ${impliedVolatility * 100}%`);
    }
    
    // 對於中長期（> 3個月），使用方差外推
    if (timeToExpiry > 0.25) {
      const shortTermVol = impliedVolatility;
      const shortTermTime = 0.25; // 3個月
      const longTermVol = impliedVolatility * 1.1; // 假設長期波動率稍高
      const longTermTime = 1.0; // 1年
      
      if (timeToExpiry <= 1.0) {
        impliedVolatility = varianceExtrapolation(
          shortTermVol, shortTermTime,
          longTermVol, longTermTime,
          timeToExpiry
        );
      }
    }
    
    // 計算理論Call和Put價格
    const theoreticalCallPrice = blackScholesCall(spotPrice, option.strike, timeToExpiry, riskFreeRate, impliedVolatility);
    const theoreticalPutPrice = blackScholesPut(spotPrice, option.strike, timeToExpiry, riskFreeRate, impliedVolatility);
    
    // 計算Call和Put折扣率
    const callDiscount = (theoreticalCallPrice / spotPrice) * 100;
    const putDiscount = (theoreticalPutPrice / spotPrice) * 100;
    
    console.log(`Strike ${option.strike}: Call=${callDiscount.toFixed(2)}%, Put=${putDiscount.toFixed(2)}%, Weight=${option.liquidityScore.toFixed(3)}`);
    
    return {
      strike: option.strike,
      callDiscount,
      putDiscount,
      theoreticalCallPrice,
      theoreticalPutPrice,
      impliedVolatility: impliedVolatility * 100,
      weight: option.liquidityScore,
      atmDistance: option.atmDistance,
      expiry: option.expiry
    };
  });
  
  // 計算權重總和
  const totalWeight = calculations.reduce((sum, calc) => sum + calc.weight, 0);
  
  // 加權平均計算
  const weightedCallDiscount = calculations.reduce((sum, calc) => 
    sum + (calc.callDiscount * calc.weight), 0) / totalWeight;
  const weightedPutDiscount = calculations.reduce((sum, calc) => 
    sum + (calc.putDiscount * calc.weight), 0) / totalWeight;
  const weightedCallPrice = calculations.reduce((sum, calc) => 
    sum + (calc.theoreticalCallPrice * calc.weight), 0) / totalWeight;
  const weightedPutPrice = calculations.reduce((sum, calc) => 
    sum + (calc.theoreticalPutPrice * calc.weight), 0) / totalWeight;
  const weightedVolatility = calculations.reduce((sum, calc) => 
    sum + (calc.impliedVolatility * calc.weight), 0) / totalWeight;
  
  console.log(`\nWeighted Average Results:`);
  console.log(`Call Discount: ${weightedCallDiscount.toFixed(2)}%`);
  console.log(`Put Discount: ${weightedPutDiscount.toFixed(2)}%`);
  console.log(`Implied Volatility: ${weightedVolatility.toFixed(1)}%`);
  
  // 使用加權平均的Call折扣作為主要指標
  const primaryDiscount = weightedCallDiscount;
  const annualizedRate = (primaryDiscount * 365) / lockupDays;
  
  // 計算合理價格（現貨價格減去加權平均Call期權價值）
  const fairValue = spotPrice - weightedCallPrice;
  
  return {
    annualizedRate,
    fairValue,
    discount: primaryDiscount,
    method: 'black-scholes-weighted',
    // 使用加權平均結果
    callDiscount: weightedCallDiscount,
    putDiscount: weightedPutDiscount,
    impliedVolatility: weightedVolatility,
    theoreticalCallPrice: weightedCallPrice,
    theoreticalPutPrice: weightedPutPrice,
    // 新增多合約詳細信息
    atmCalculations: calculations,
    totalContracts: sortedByATM.length
  };
}

// 新的雙到期日折扣率計算函數
export function calculateDiscountFromDualExpiry(
  dualExpiryData: DualExpiryData,
  spotPrice: number,
  lockupDays: number,
  riskFreeRate: number = 0.02
): DiscountCalculation {
  const targetTimeToExpiry = dualExpiryData.targetTimeToExpiry;
  
  console.log(`=== 雙到期日折扣率計算 ===`);
  console.log(`短期: ${dualExpiryData.shortTerm.expiry} (${dualExpiryData.shortTerm.timeToExpiry.toFixed(3)}年, IV=${dualExpiryData.shortTerm.impliedVol.toFixed(1)}%)`);
  console.log(`長期: ${dualExpiryData.longTerm.expiry} (${dualExpiryData.longTerm.timeToExpiry.toFixed(3)}年, IV=${dualExpiryData.longTerm.impliedVol.toFixed(1)}%)`);
  console.log(`目標: ${targetTimeToExpiry.toFixed(3)}年, 策略: ${dualExpiryData.strategy}`);
  
  // 找到兩個到期日共同的ATM strikes
  const shortTermStrikes = new Set(dualExpiryData.shortTerm.optionsData.map(o => o.strike));
  const commonStrikes = dualExpiryData.longTerm.optionsData.filter(o => shortTermStrikes.has(o.strike));
  
  if (commonStrikes.length === 0) {
    throw new Error('雙到期日數據中沒有共同的執行價格');
  }
  
  // 選擇前5個最接近ATM的共同strikes
  const sortedCommonStrikes = commonStrikes
    .map(option => ({
      ...option,
      atmDistance: Math.abs(option.strike - spotPrice)
    }))
    .sort((a, b) => a.atmDistance - b.atmDistance)
    .slice(0, 5);
    
  console.log(`找到 ${sortedCommonStrikes.length} 個共同的ATM執行價格`);
  
  // 對每個共同strike進行雙到期日計算
  const calculations = sortedCommonStrikes.map(longTermOption => {
    const shortTermOption = dualExpiryData.shortTerm.optionsData.find(o => o.strike === longTermOption.strike);
    if (!shortTermOption) return null;
    
    // 計算外推隱含波動率
    const extrapolatedIV = calculateExtrapolatedVolatility(
      dualExpiryData.shortTerm.impliedVol / 100,
      dualExpiryData.shortTerm.timeToExpiry,
      dualExpiryData.longTerm.impliedVol / 100,
      dualExpiryData.longTerm.timeToExpiry,
      targetTimeToExpiry,
      dualExpiryData.strategy
    );
    
    console.log(`Strike ${longTermOption.strike}: 短期IV=${(dualExpiryData.shortTerm.impliedVol).toFixed(1)}%, 長期IV=${(dualExpiryData.longTerm.impliedVol).toFixed(1)}%, 外推IV=${(extrapolatedIV * 100).toFixed(1)}%`);
    
    // 計算理論價格
    const theoreticalCallPrice = blackScholesCall(spotPrice, longTermOption.strike, targetTimeToExpiry, riskFreeRate, extrapolatedIV);
    const theoreticalPutPrice = blackScholesPut(spotPrice, longTermOption.strike, targetTimeToExpiry, riskFreeRate, extrapolatedIV);
    
    // 計算折扣率
    const callDiscount = (theoreticalCallPrice / spotPrice) * 100;
    const putDiscount = (theoreticalPutPrice / spotPrice) * 100;
    
    // 計算流動性權重（使用長期合約的數據）
    const spread = (longTermOption.callAsk || 0) - (longTermOption.callBid || 0) + (longTermOption.putAsk || 0) - (longTermOption.putBid || 0);
    const avgPrice = (longTermOption.callPrice + longTermOption.putPrice) / 2;
    const spreadRatio = spread / avgPrice;
    const liquidityScore = 1 / (1 + spreadRatio);
    
    return {
      strike: longTermOption.strike,
      callDiscount,
      putDiscount,
      theoreticalCallPrice,
      theoreticalPutPrice,
      impliedVolatility: extrapolatedIV * 100,
      weight: liquidityScore,
      atmDistance: longTermOption.atmDistance,
      expiry: `${dualExpiryData.shortTerm.expiry}+${dualExpiryData.longTerm.expiry}`,
      // 雙到期日相關資訊
      shortTermIV: dualExpiryData.shortTerm.impliedVol,
      longTermIV: dualExpiryData.longTerm.impliedVol,
      shortTermExpiry: dualExpiryData.shortTerm.expiry,
      longTermExpiry: dualExpiryData.longTerm.expiry,
      extrapolationStrategy: dualExpiryData.strategy
    } as ATMCalculation;
  }).filter(calc => calc !== null) as ATMCalculation[];
  
  if (calculations.length === 0) {
    throw new Error('無法計算任何ATM合約的雙到期日折扣率');
  }
  
  // 計算加權平均
  const totalWeight = calculations.reduce((sum, calc) => sum + calc.weight, 0);
  
  const weightedCallDiscount = calculations.reduce((sum, calc) => 
    sum + (calc.callDiscount * calc.weight), 0) / totalWeight;
  const weightedPutDiscount = calculations.reduce((sum, calc) => 
    sum + (calc.putDiscount * calc.weight), 0) / totalWeight;
  const weightedVolatility = calculations.reduce((sum, calc) => 
    sum + (calc.impliedVolatility * calc.weight), 0) / totalWeight;
  const weightedCallPrice = calculations.reduce((sum, calc) => 
    sum + (calc.theoreticalCallPrice * calc.weight), 0) / totalWeight;
  const weightedPutPrice = calculations.reduce((sum, calc) => 
    sum + (calc.theoreticalPutPrice * calc.weight), 0) / totalWeight;
    
  // 計算最終結果
  const annualizedRate = (weightedCallDiscount * 365) / lockupDays;
  const fairValue = spotPrice - weightedCallPrice;
  
  console.log(`=== 雙到期日計算結果 ===`);
  console.log(`加權Call折扣: ${weightedCallDiscount.toFixed(2)}%`);
  console.log(`加權Put折扣: ${weightedPutDiscount.toFixed(2)}%`);
  console.log(`年化折扣率: ${annualizedRate.toFixed(2)}%`);
  console.log(`合理購買價格: $${fairValue.toLocaleString()}`);
  
  return {
    method: `雙到期日方差外推法 (${dualExpiryData.strategy})`,
    discount: weightedCallDiscount,
    annualizedRate,
    fairValue,
    callDiscount: weightedCallDiscount,
    putDiscount: weightedPutDiscount,
    impliedVolatility: weightedVolatility,
    theoreticalCallPrice: weightedCallPrice,
    theoreticalPutPrice: weightedPutPrice,
    atmCalculations: calculations,
    totalContracts: calculations.length
  };
}

// 計算外推隱含波動率
function calculateExtrapolatedVolatility(
  shortTermVol: number,
  shortTermTime: number,
  longTermVol: number,
  longTermTime: number,
  targetTime: number,
  strategy: ExtrapolationStrategy
): number {
  console.log(`=== 波動率外推計算 ===`);
  console.log(`短期: ${shortTermTime.toFixed(3)}年, IV=${shortTermVol.toFixed(1)}%`);
  console.log(`長期: ${longTermTime.toFixed(3)}年, IV=${longTermVol.toFixed(1)}%`);
  console.log(`目標: ${targetTime.toFixed(3)}年, 策略: ${strategy}`);
  
  // 使用方差線性外推
  const shortTermVariance = shortTermVol * shortTermVol * shortTermTime;
  const longTermVariance = longTermVol * longTermVol * longTermTime;
  
  console.log(`短期方差: ${shortTermVariance.toFixed(4)}, 長期方差: ${longTermVariance.toFixed(4)}`);
  
  let targetVariance: number;
  
  switch (strategy) {
    case ExtrapolationStrategy.INTERPOLATION:
      // 內插：目標時間在兩個期限之間
      targetVariance = shortTermVariance + 
        (longTermVariance - shortTermVariance) * 
        (targetTime - shortTermTime) / (longTermTime - shortTermTime);
      console.log(`內插計算: ${targetVariance.toFixed(4)}`);
      break;
      
    case ExtrapolationStrategy.EXTRAPOLATION:
      // 外推：目標時間超出所有期限
      const slope = (longTermVariance - shortTermVariance) / (longTermTime - shortTermTime);
      targetVariance = longTermVariance + slope * (targetTime - longTermTime);
      console.log(`外推斜率: ${slope.toFixed(4)}, 外推距離: ${(targetTime - longTermTime).toFixed(3)}年`);
      console.log(`外推計算: ${longTermVariance.toFixed(4)} + ${slope.toFixed(4)} × ${(targetTime - longTermTime).toFixed(3)} = ${targetVariance.toFixed(4)}`);
      
      // 對於長期外推，應用理論上的波動率期限結構調整
      // 通常情況下，長期隱含波動率會趨向於歷史長期平均值
      if (targetTime > 1.0) {
        // 對於超過1年的期限，適當增強波動率外推
        const timeScalingFactor = Math.sqrt(targetTime / longTermTime);
        const baseVolatility = Math.sqrt(longTermVariance / longTermTime);
        const enhancedVolatility = baseVolatility * (1 + 0.05 * Math.log(targetTime)); // 每年增加約5%的波動率增長
        targetVariance = enhancedVolatility * enhancedVolatility * targetTime;
        console.log(`長期外推增強: 基礎波動率${baseVolatility.toFixed(3)} → 增強波動率${enhancedVolatility.toFixed(3)}`);
      }
      break;
      
    case ExtrapolationStrategy.BOUNDED_EXTRAPOLATION:
      // 有界外推：使用線性外推但限制合理範圍
      const boundedSlope = (longTermVariance - shortTermVariance) / (longTermTime - shortTermTime);
      targetVariance = shortTermVariance + boundedSlope * (targetTime - shortTermTime);
      console.log(`有界外推計算: ${targetVariance.toFixed(4)}`);
      break;
      
    default:
      targetVariance = shortTermVariance;
  }
  
  // 確保方差為正值
  targetVariance = Math.max(targetVariance, 0.01 * targetTime); // 最小1%年化方差
  
  // 計算目標隱含波動率
  const targetVolatility = Math.sqrt(targetVariance / targetTime);
  
  console.log(`最終波動率: ${targetVolatility.toFixed(3)} (${(targetVolatility * 100).toFixed(1)}%)`);
  
  // 合理性檢查：限制在20%-200%之間
  const finalVolatility = Math.min(Math.max(targetVolatility, 0.2), 2.0);
  if (finalVolatility !== targetVolatility) {
    console.log(`波動率限制調整: ${targetVolatility.toFixed(3)} → ${finalVolatility.toFixed(3)}`);
  }
  
  return finalVolatility;
}