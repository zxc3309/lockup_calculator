// 完整的ATM多合約加權Black-Scholes計算測試
console.log('🧪 完整的ATM多合約折扣率計算測試\n');

// 標準正態分佈累積函數
function cumulativeNormalDistribution(x) {
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
function blackScholesCall(S, K, T, r, sigma) {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return S * cumulativeNormalDistribution(d1) - K * Math.exp(-r * T) * cumulativeNormalDistribution(d2);
}

// Black-Scholes Put期權價格
function blackScholesPut(S, K, T, r, sigma) {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return K * Math.exp(-r * T) * cumulativeNormalDistribution(-d2) - S * cumulativeNormalDistribution(-d1);
}

// 測試參數
const spotPrice = 113760;
const lockupDays = 180; // 6個月
const timeToExpiry = lockupDays / 365;
const riskFreeRate = 0.02;

// ATM選擇權數據（前5個最接近的）
const atmOptions = [
  { strike: 114000, impliedVol: 46.2, weight: 0.956, distance: 240 },
  { strike: 115000, impliedVol: 46.1, weight: 0.977, distance: 1240 },
  { strike: 112000, impliedVol: 46.5, weight: 0.973, distance: 1760 },
  { strike: 116000, impliedVol: 46.0, weight: 0.965, distance: 2240 },
  { strike: 110000, impliedVol: 46.8, weight: 0.977, distance: 3760 },
];

console.log(`📊 計算參數:`);
console.log(`   現貨價格: $${spotPrice.toLocaleString()}`);
console.log(`   鎖倉期限: ${lockupDays}天 (${timeToExpiry.toFixed(3)}年)`);
console.log(`   無風險利率: ${(riskFreeRate * 100).toFixed(1)}%`);
console.log(`   ATM合約數量: ${atmOptions.length}個\n`);

// 對每個ATM合約進行計算
console.log('🔄 各合約計算結果:');
console.log('執行價      隱含波動率  Call折扣   Put折扣    權重');
console.log('──────────────────────────────────────────────────');

const calculations = atmOptions.map(option => {
  const impliedVol = option.impliedVol / 100; // 轉換為小數
  
  // 計算理論價格
  const theoreticalCallPrice = blackScholesCall(spotPrice, option.strike, timeToExpiry, riskFreeRate, impliedVol);
  const theoreticalPutPrice = blackScholesPut(spotPrice, option.strike, timeToExpiry, riskFreeRate, impliedVol);
  
  // 計算折扣率
  const callDiscount = (theoreticalCallPrice / spotPrice) * 100;
  const putDiscount = (theoreticalPutPrice / spotPrice) * 100;
  
  console.log(`$${option.strike.toLocaleString().padEnd(8)} ${option.impliedVol.toFixed(1).padStart(10)}% ${callDiscount.toFixed(2).padStart(8)}% ${putDiscount.toFixed(2).padStart(8)}% ${option.weight.toFixed(3).padStart(8)}`);
  
  return {
    strike: option.strike,
    callDiscount,
    putDiscount,
    theoreticalCallPrice,
    theoreticalPutPrice,
    weight: option.weight
  };
});

// 計算加權平均
const totalWeight = calculations.reduce((sum, calc) => sum + calc.weight, 0);

const weightedCallDiscount = calculations.reduce((sum, calc) => 
  sum + (calc.callDiscount * calc.weight), 0) / totalWeight;
const weightedPutDiscount = calculations.reduce((sum, calc) => 
  sum + (calc.putDiscount * calc.weight), 0) / totalWeight;
const weightedCallPrice = calculations.reduce((sum, calc) => 
  sum + (calc.theoreticalCallPrice * calc.weight), 0) / totalWeight;

// 最終結果
const annualizedRate = (weightedCallDiscount * 365) / lockupDays;
const fairValue = spotPrice - weightedCallPrice;

console.log('\n🎯 加權平均結果:');
console.log(`   Call折扣 (機會成本): ${weightedCallDiscount.toFixed(2)}%`);
console.log(`   Put折扣 (保險成本): ${weightedPutDiscount.toFixed(2)}%`);
console.log(`   年化折扣率: ${annualizedRate.toFixed(2)}%`);
console.log(`   合理購買價格: $${fairValue.toLocaleString()}`);

console.log('\n📈 分析:');
console.log(`   ✓ 使用5個最接近ATM的合約進行加權計算`);
console.log(`   ✓ 最接近ATM的合約: $114,000 (距離$240)`);
console.log(`   ✓ Call折扣反映錯過上漲的機會成本`);
console.log(`   ✓ Put折扣反映防止下跌的保險成本`);
console.log(`   ✓ 流動性加權確保結果的可靠性`);

console.log('\n✅ 完整計算測試成功！');
console.log('現在可以在實際應用中測試這個新的ATM多合約計算方法。');