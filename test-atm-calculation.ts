#!/usr/bin/env ts-node

import { calculateDiscountFromOptions, lockupPeriodToDays } from './lib/calculator.js';
import { OptionData } from './types/index.js';

// 模擬真實的Deribit選擇權數據（基於之前的日誌）
const mockOptionsData: OptionData[] = [
  // 遠離ATM的合約
  { strike: 60000, callPrice: 0.49083453, putPrice: 0.00317877, expiry: '26DEC25', impliedVol: 57.77, callBid: 0.4895, callAsk: 0.4925, putBid: 0.0029, putAsk: 0.0034 },
  { strike: 70000, callPrice: 0.40827397, putPrice: 0.00600898, expiry: '26DEC25', impliedVol: 55.2, callBid: 0.4075, callAsk: 0.41, putBid: 0.0055, putAsk: 0.0065 },
  { strike: 80000, callPrice: 0.32920869, putPrice: 0.01233442, expiry: '26DEC25', impliedVol: 52.5, callBid: 0.328, callAsk: 0.33, putBid: 0.012, putAsk: 0.0125 },
  { strike: 90000, callPrice: 0.25579621, putPrice: 0.02431265, expiry: '26DEC25', impliedVol: 50.1, callBid: 0.2545, callAsk: 0.257, putBid: 0.024, putAsk: 0.025 },
  { strike: 100000, callPrice: 0.19127435, putPrice: 0.04518151, expiry: '26DEC25', impliedVol: 48.3, callBid: 0.19, callAsk: 0.1925, putBid: 0.0445, putAsk: 0.0455 },
  { strike: 105000, callPrice: 0.16309533, putPrice: 0.05969784, expiry: '26DEC25', impliedVol: 47.5, callBid: 0.1615, callAsk: 0.1645, putBid: 0.059, putAsk: 0.06 },
  
  // ATM區域 - 接近現價 $113,760
  { strike: 110000, callPrice: 0.1379672, putPrice: 0.07726507, expiry: '26DEC25', impliedVol: 46.8, callBid: 0.137, callAsk: 0.1385, putBid: 0.0765, putAsk: 0.0775 },
  { strike: 112000, callPrice: 0.12654, putPrice: 0.08892, expiry: '26DEC25', impliedVol: 46.5, callBid: 0.126, callAsk: 0.127, putBid: 0.088, putAsk: 0.090 },
  { strike: 114000, callPrice: 0.11589, putPrice: 0.10123, expiry: '26DEC25', impliedVol: 46.2, callBid: 0.115, callAsk: 0.117, putBid: 0.100, putAsk: 0.103 },
  { strike: 115000, callPrice: 0.11582964, putPrice: 0.09782287, expiry: '26DEC25', impliedVol: 46.1, callBid: 0.115, callAsk: 0.116, putBid: 0.097, putAsk: 0.0985 },
  { strike: 116000, callPrice: 0.10845, putPrice: 0.11432, expiry: '26DEC25', impliedVol: 46.0, callBid: 0.108, callAsk: 0.109, putBid: 0.113, putAsk: 0.116 },
  { strike: 118000, callPrice: 0.09456, putPrice: 0.13298, expiry: '26DEC25', impliedVol: 45.8, callBid: 0.094, callAsk: 0.095, putBid: 0.132, putAsk: 0.134 },
  
  { strike: 120000, callPrice: 0.0968556, putPrice: 0.12154419, expiry: '26DEC25', impliedVol: 45.7, callBid: 0.096, callAsk: 0.097, putBid: 0.1205, putAsk: 0.122 },
  { strike: 125000, callPrice: 0.0803656, putPrice: 0.14774955, expiry: '26DEC25', impliedVol: 45.2, callBid: 0.0795, callAsk: 0.0805, putBid: 0.147, putAsk: 0.149 },
  { strike: 130000, callPrice: 0.06683064, putPrice: 0.17690994, expiry: '26DEC25', impliedVol: 44.8, callBid: 0.0665, callAsk: 0.067, putBid: 0.176, putAsk: 0.178 },
  
  // 遠離ATM的合約
  { strike: 140000, callPrice: 0.04555653, putPrice: 0.24102656, expiry: '26DEC25', impliedVol: 44.2, callBid: 0.045, callAsk: 0.046, putBid: 0.239, putAsk: 0.244 },
  { strike: 150000, callPrice: 0.03114054, putPrice: 0.31200128, expiry: '26DEC25', impliedVol: 43.8, callBid: 0.0305, callAsk: 0.0315, putBid: 0.2845, putAsk: 0.356 },
  { strike: 160000, callPrice: 0.02163687, putPrice: 0.38788833, expiry: '26DEC25', impliedVol: 43.5, callBid: 0.021, callAsk: 0.022, putBid: 0.385, putAsk: 0.3915 },
];

async function testATMCalculation() {
  console.log('🧪 測試 ATM 選擇權折扣率計算\n');
  
  const spotPrice = 113760; // BTC現價
  const lockupDays = lockupPeriodToDays('6M'); // 6個月鎖倉
  const riskFreeRate = 0.02; // 2%無風險利率
  
  console.log(`📊 測試參數:`);
  console.log(`   現貨價格: $${spotPrice.toLocaleString()}`);
  console.log(`   鎖倉期限: ${lockupDays}天 (6個月)`);
  console.log(`   無風險利率: ${(riskFreeRate * 100).toFixed(1)}%`);
  console.log(`   總選擇權合約: ${mockOptionsData.length}個\n`);
  
  try {
    console.log('🔄 開始計算...\n');
    
    const result = calculateDiscountFromOptions(
      mockOptionsData,
      spotPrice,
      lockupDays,
      riskFreeRate
    );
    
    console.log('\n🎯 計算結果:');
    console.log(`   主要折扣率 (Call): ${result.discount.toFixed(2)}%`);
    console.log(`   年化折扣率: ${result.annualizedRate.toFixed(2)}%`);
    console.log(`   合理購買價格: $${result.fairValue.toLocaleString()}`);
    console.log(`   計算方法: ${result.method}`);
    
    if (result.callDiscount && result.putDiscount) {
      console.log('\n📈 Call vs Put 分析:');
      console.log(`   Call折扣 (機會成本): ${result.callDiscount.toFixed(2)}%`);
      console.log(`   Put折扣 (保險成本): ${result.putDiscount.toFixed(2)}%`);
    }
    
    if (result.impliedVolatility) {
      console.log(`\n⚡ 市場參數:`);
      console.log(`   加權平均隱含波動率: ${result.impliedVolatility.toFixed(1)}%`);
    }
    
    if (result.atmCalculations && result.totalContracts) {
      console.log(`\n📋 ATM合約明細 (使用${result.totalContracts}個合約):`);
      console.log('執行價      距離    Call折扣  Put折扣   權重');
      console.log('──────────────────────────────────────────');
      result.atmCalculations.forEach(calc => {
        console.log(
          `$${calc.strike.toLocaleString().padEnd(8)} ` +
          `$${calc.atmDistance.toFixed(0).padStart(5)} ` +
          `${calc.callDiscount.toFixed(2).padStart(7)}% ` +
          `${calc.putDiscount.toFixed(2).padStart(7)}% ` +
          `${calc.weight.toFixed(3).padStart(7)}`
        );
      });
    }
    
    console.log('\n✅ 測試完成！');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }
}

// 運行測試
if (require.main === module) {
  testATMCalculation();
}

export { testATMCalculation, mockOptionsData };