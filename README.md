# BTC/ETH 鎖倉Token折扣率計算器

一個專業的加密貨幣鎖倉token折扣率計算工具，使用**雙到期日方差外推法**結合Black-Scholes期權定價模型，提供精確的機會成本與保險成本分析。

## 核心功能

- **智能雙到期日選擇**：自動選擇最適合的兩個期權到期日進行方差外推
- **三種外推策略**：內插法、外推法、有界外推法，適應不同市場條件
- **多幣種支援**：Bitcoin (BTC) 和 Ethereum (ETH)
- **多期限選擇**：3個月、6個月、1年、2年鎖倉期限
- **方差線性外推**：使用先進的波動率期限結構建模技術
- **ATM多合約加權**：使用前5個最接近ATM的選擇權合約進行流動性加權
- **Black-Scholes定價**：基於外推隱含波動率的理論期權定價
- **實時市場數據**：CoinGecko現貨價格 + Deribit選擇權鏈數據
- **數據透明度**：完整顯示短期和長期合約的原始市場數據
- **計算基準展示**：詳細顯示外推策略、基礎數據和計算過程

## 什麼是鎖倉Token折扣率？

鎖倉token是指在特定期間內無法自由交易的加密貨幣。由於流動性限制，這類token通常以折扣價格交易。折扣率反映了：

1. **流動性風險補償**：投資者因無法即時變現而要求的回報
2. **時間價值成本**：資金被鎖定期間的機會成本
3. **市場波動風險**：鎖倉期間價格變動的不確定性

## 核心計算方法：雙到期日方差外推法

### 🎯 方法優勢

傳統單一到期日方法的問題：
- 市場上可能沒有與鎖倉期限完全匹配的期權合約
- 特別是長期鎖倉（1年、2年），市場流動性不足
- 單一期權合約可能存在定價偏差

**雙到期日方差外推法的解決方案**：
1. 選擇兩個最適合的市場期權到期日
2. 使用方差線性外推計算目標期限的隱含波動率
3. 提供更準確的長期鎖倉折扣率估算

### 📊 三種智能外推策略

系統根據目標鎖倉期限與可用期權到期日的關係，自動選擇最佳策略：

#### 1. **內插法 (Interpolation)**
**適用場景**：目標鎖倉期限在兩個可用期權到期日之間

```
例如：目標6個月鎖倉
├── 短期期權：3個月到期 (90天)
├── 目標期限：6個月鎖倉 (180天) ← 在中間
└── 長期期權：9個月到期 (270天)

策略：使用3個月和9個月期權進行內插計算
```

#### 2. **外推法 (Extrapolation)**
**適用場景**：目標鎖倉期限超出所有可用期權到期日

```
例如：目標2年鎖倉
├── 短期期權：3月到期 (最遠可用期權)
├── 長期期權：6月到期 (最遠可用期權)
└── 目標期限：2年鎖倉 ← 超出市場期權範圍

策略：使用最後兩個期權進行外推計算
特殊處理：超過1年期限時，額外應用5%年增長率調整
```

#### 3. **有界外推法 (Bounded Extrapolation)**
**適用場景**：目標鎖倉期限短於最短可用期權到期日

```
例如：目標3個月鎖倉
├── 目標期限：3個月鎖倉 ← 短於最短期權
├── 短期期權：6月到期 (最近可用期權)
└── 長期期權：9月到期 (次近可用期權)

策略：使用前兩個期權進行有界外推
```

## 詳細計算步驟

### 步驟1：智能雙到期日選擇

**代碼實現邏輯**：
```typescript
function findOptimalExpiryPair(expiryDates: Map<string, Date>, targetDate: Date) {
  const sortedExpiries = Array.from(expiryDates.entries())
    .sort(([, dateA], [, dateB]) => dateA.getTime() - dateB.getTime());
    
  // 情況1：內插 - 目標在兩個期限之間
  for (let i = 0; i < sortedExpiries.length - 1; i++) {
    const [shortExp, shortDate] = sortedExpiries[i];
    const [longExp, longDate] = sortedExpiries[i + 1];
    
    if (targetDate >= shortDate && targetDate <= longDate) {
      return { shortExpiry: shortExp, longExpiry: longExp, strategy: 'INTERPOLATION' };
    }
  }
  
  // 情況2：外推 - 目標超出所有期限
  if (targetDate > lastExpiryDate) {
    return { 
      shortExpiry: secondLastExpiry, 
      longExpiry: lastExpiry, 
      strategy: 'EXTRAPOLATION' 
    };
  }
  
  // 情況3：有界外推 - 目標短於最短期限
  return { 
    shortExpiry: firstExpiry, 
    longExpiry: secondExpiry, 
    strategy: 'BOUNDED_EXTRAPOLATION' 
  };
}
```

### 步驟2：共同ATM執行價格篩選

從兩個到期日的期權合約中，找出共同的執行價格：

1. **獲取兩組期權數據**
   - 短期到期日的所有ATM期權
   - 長期到期日的所有ATM期權

2. **尋找共同執行價格**
   ```typescript
   const shortTermStrikes = new Set(shortTermOptions.map(o => o.strike));
   const commonStrikes = longTermOptions.filter(o => shortTermStrikes.has(o.strike));
   ```

3. **選擇前5個最接近ATM的共同執行價格**
   ```typescript
   const sortedCommonStrikes = commonStrikes
     .map(option => ({
       ...option,
       atmDistance: Math.abs(option.strike - spotPrice)
     }))
     .sort((a, b) => a.atmDistance - b.atmDistance)
     .slice(0, 5);
   ```

### 步驟3：方差線性外推計算

這是整個算法的核心，將兩個期權的隱含波動率外推到目標鎖倉期限：

#### 數學原理
```
方差 = 波動率² × 時間
σ₁² × T₁ = 短期方差
σ₂² × T₂ = 長期方差

目標方差 = f(短期方差, 長期方差, 目標時間)
目標波動率 = √(目標方差 / 目標時間)
```

#### 三種策略的具體公式

**1. 內插法**
```
targetVariance = shortVariance + (longVariance - shortVariance) × 
                 (targetTime - shortTime) / (longTime - shortTime)
```

**2. 外推法**
```
slope = (longVariance - shortVariance) / (longTime - shortTime)
targetVariance = longVariance + slope × (targetTime - longTime)

// 長期增強（目標時間 > 1年）
if (targetTime > 1.0) {
  baseVolatility = √(longVariance / longTime)
  enhancedVolatility = baseVolatility × (1 + 0.05 × ln(targetTime))
  targetVariance = enhancedVolatility² × targetTime
}
```

**3. 有界外推法**
```
boundedSlope = (longVariance - shortVariance) / (longTime - shortTime)
targetVariance = shortVariance + boundedSlope × (targetTime - shortTime)
```

#### 代碼實現
```typescript
function calculateExtrapolatedVolatility(
  shortTermVol: number, shortTermTime: number,
  longTermVol: number, longTermTime: number,
  targetTime: number, strategy: ExtrapolationStrategy
): number {
  const shortTermVariance = shortTermVol * shortTermVol * shortTermTime;
  const longTermVariance = longTermVol * longTermVol * longTermTime;
  
  let targetVariance: number;
  
  switch (strategy) {
    case 'INTERPOLATION':
      targetVariance = shortTermVariance + 
        (longTermVariance - shortTermVariance) * 
        (targetTime - shortTermTime) / (longTermTime - shortTermTime);
      break;
      
    case 'EXTRAPOLATION':
      const slope = (longTermVariance - shortTermVariance) / (longTermTime - shortTermTime);
      targetVariance = longTermVariance + slope * (targetTime - longTermTime);
      
      // 長期外推增強
      if (targetTime > 1.0) {
        const baseVolatility = Math.sqrt(longTermVariance / longTermTime);
        const enhancedVolatility = baseVolatility * (1 + 0.05 * Math.log(targetTime));
        targetVariance = enhancedVolatility * enhancedVolatility * targetTime;
      }
      break;
      
    case 'BOUNDED_EXTRAPOLATION':
      const boundedSlope = (longTermVariance - shortTermVariance) / (longTermTime - shortTermTime);
      targetVariance = shortTermVariance + boundedSlope * (targetTime - shortTermTime);
      break;
  }
  
  return Math.sqrt(targetVariance / targetTime);
}
```

### 步驟4：Black-Scholes理論定價

使用外推得到的隱含波動率，為每個共同執行價格計算理論Call和Put價格：

#### Black-Scholes公式
```
Call價格 = S×N(d₁) - K×e^(-r×T)×N(d₂)
Put價格 = K×e^(-r×T)×N(-d₂) - S×N(-d₁)

其中：
d₁ = [ln(S/K) + (r + σ²/2)×T] / (σ×√T)
d₂ = d₁ - σ×√T

S = 現貨價格, K = 執行價格, T = 目標時間
r = 無風險利率(2%), σ = 外推隱含波動率, N(x) = 標準正態分佈累積函數
```

#### 代碼實現
```typescript
function blackScholesCall(S: number, K: number, T: number, r: number, sigma: number): number {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return S * cumulativeNormalDistribution(d1) - 
         K * Math.exp(-r * T) * cumulativeNormalDistribution(d2);
}

function blackScholesPut(S: number, K: number, T: number, r: number, sigma: number): number {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  return K * Math.exp(-r * T) * cumulativeNormalDistribution(-d2) - 
         S * cumulativeNormalDistribution(-d1);
}
```

對每個共同執行價格，系統會：
1. 使用外推波動率計算該執行價格的Call理論價格
2. 使用外推波動率計算該執行價格的Put理論價格
3. 計算折扣率：`(理論價格 / 現貨價格) × 100%`

### 步驟5：流動性權重計算

為提高結果準確性，系統根據每個合約的流動性計算權重：

```typescript
// 計算價差率
const spread = (callAsk - callBid) + (putAsk - putBid);
const avgPrice = (callPrice + putPrice) / 2;
const spreadRatio = spread / avgPrice;

// 流動性評分：價差越小，流動性越好，權重越高
const liquidityScore = 1 / (1 + spreadRatio);
```

### 步驟6：加權平均最終結果

```typescript
// 計算總權重
const totalWeight = calculations.reduce((sum, calc) => sum + calc.weight, 0);

// 加權平均折扣率
const weightedCallDiscount = calculations.reduce((sum, calc) => 
  sum + (calc.callDiscount * calc.weight), 0) / totalWeight;

const weightedPutDiscount = calculations.reduce((sum, calc) => 
  sum + (calc.putDiscount * calc.weight), 0) / totalWeight;

// 年化折扣率
const annualizedRate = (weightedCallDiscount * 365) / lockupDays;

// 合理購買價格
const fairValue = spotPrice - weightedCallPrice;
```

## 實際計算範例

讓我們用真實數據展示BTC 1年鎖倉的完整計算過程：

### 📊 市場數據
- **現貨價格**：$114,770
- **鎖倉期限**：365天（1年）
- **無風險利率**：2.0%

### 🎯 步驟1：智能雙到期日選擇

**可用期權到期日**：31OCT25, 26DEC25, 27MAR26, 26JUN26
**目標鎖倉到期**：2026年8月（超出所有可用期權）

**策略選擇**：外推法 (EXTRAPOLATION)
**選定期權**：
- 短期：27MAR26 (0.632年)
- 長期：26JUN26 (0.883年)

### 🧮 步驟2：共同ATM執行價格篩選

找到5個共同執行價格：$115K, $110K, $120K, $105K, $125K

### 📈 步驟3：方差外推計算

**基礎數據**：
- 短期平均波動率：47.0%
- 長期平均波動率：47.0%
- 目標時間：1.000年

**外推計算**：
```
短期方差 = 0.470² × 0.632 = 0.1395
長期方差 = 0.470² × 0.883 = 0.1952
外推斜率 = (0.1952 - 0.1395) / (0.883 - 0.632) = 0.2219

基礎目標方差 = 0.1952 + 0.2219 × (1.000 - 0.883) = 0.2212
基礎波動率 = √(0.2212 / 1.000) = 47.0%

由於目標時間 = 1.000年，應用長期增強：
增強波動率 = 47.0% × (1 + 0.05 × ln(1.000)) = 47.0%
```

### ⚡ 步驟4：Black-Scholes計算

**$115,000執行價格範例**：
```
d₁ = [ln(114770/115000) + (0.02 + 0.47²/2) × 1.0] / (0.47 × √1.0) = 0.461
d₂ = 0.461 - 0.47 × √1.0 = -0.009

N(d₁) = N(0.461) = 0.677
N(d₂) = N(-0.009) = 0.496

Call理論價格 = 114770 × 0.677 - 115000 × e^(-0.02×1.0) × 0.496
            = 77,739 - 55,878 = $21,861

Put理論價格 = 115000 × e^(-0.02×1.0) × (1-0.496) - 114770 × (1-0.677)
           = 56,854 - 37,067 = $19,787
```

### 💰 步驟5：折扣率計算

**$115,000執行價格**：
- Call折扣率 = $21,861 / $114,770 × 100% = 19.04%
- Put折扣率 = $19,787 / $114,770 × 100% = 17.24%

**所有5個執行價格的加權平均**：
```
執行價格    Call折扣    Put折扣     權重
$115,000    19.04%     17.24%     0.972
$110,000    23.81%     15.02%     0.966  
$120,000    20.17%     19.69%     0.960
$105,000    25.95%     13.03%     0.966
$125,000    18.57%     22.24%     0.956

總權重 = 4.820
加權Call折扣 = 21.49%
加權Put折扣 = 17.41%
```

### 📊 最終結果

- **主要折扣率 (Call)**：21.49%
- **年化折扣率**：21.49% （1年期所以相同）
- **Put折扣率**：17.41%
- **合理購買價格**：$114,770 - $24,675 = $90,095

## ATM合約數據透明度

系統提供完整的原始市場數據展示：

### 短期到期日合約 (27MAR26)
```
執行價格 | Call價格  | Put價格   | 市場波動率 | 權重
$115,000 | $0.1642  | $0.1172  | 45.2%     | 0.972
$110,000 | $0.1857  | $0.0972  | 45.3%     | 0.966
$120,000 | $0.1449  | $0.1394  | 45.1%     | 0.960
```

### 長期到期日合約 (26JUN26)
```
執行價格 | Call價格  | Put價格   | 市場波動率 | 權重
$115,000 | $0.1996  | $0.1367  | 46.1%     | 0.972
$110,000 | $0.2201  | $0.1164  | 46.2%     | 0.966
$120,000 | $0.1809  | $0.1587  | 46.1%     | 0.960
```

**關鍵洞察**：
- 原始市場數據顯示波動率 ~45-46%
- 外推結果為 47.0%（包含期限結構調整）
- 用戶可清楚看到計算基礎與最終結果的差異

## Call vs. Put 折扣分析

### 📊 雙重視角評估

| 比較面向 | Call折扣（機會成本） | Put折扣（保險成本） |
|---------|------------------|------------------|
| **經濟含義** | 鎖倉期間錯過上漲潛在收益的代價 | 為防止下跌損失所需支付的保險費用 |
| **計算基礎** | Black-Scholes Call理論價格 | Black-Scholes Put理論價格 |
| **投資情境** | 看多策略，擔心錯過牛市行情 | 風險控制，擔心價格大幅下跌 |
| **應用場景** | Staking收益評估、流動性挖礦 | 風險對沖、保本產品設計 |

### 🎯 實務應用建議

**主要指標選擇**：
- **重視機會成本** → 關注 **Call折扣率** (21.49%)
  - 適合看多投資者，評估鎖倉是否划算
  - 與預期Staking收益比較

- **重視風險控制** → 參考 **Put折扣率** (17.41%)
  - 適合風險厭惡投資者，評估保護成本
  - 反映市場對下跌風險的定價

**綜合分析**：
- **Call > Put 折扣**：市場預期上漲概率大於下跌，鎖倉機會成本較高
- **雙指標並用**：提供更全面的風險-收益評估

## 技術架構

- **前端框架**：Next.js 14 (App Router)
- **開發語言**：TypeScript
- **樣式系統**：Tailwind CSS
- **數據源**：
  - CoinGecko API (現貨價格)
  - Deribit API (選擇權數據)
- **部署平台**：Railway

## 安裝與運行

### 本地開發
```bash
# 安裝依賴
npm install

# 啟動開發服務器
npm run dev

# 在瀏覽器打開 http://localhost:3000
```

### 建置部署
```bash
# 建置生產版本
npm run build

# 啟動生產服務器
npm start
```

## 使用指南

### 基本操作
1. **選擇幣種**：點擊BTC或ETH
2. **設定期限**：選擇3M/6M/1Y/2Y
3. **更新數據**：點擊「更新價格與數據」
4. **查看結果**：系統顯示：
   - 計算基準資訊（策略、外推波動率）
   - 主要折扣率和年化率
   - ATM合約明細（原始市場數據）

### 高級功能
- **調試模式**：查看詳細計算過程和API調用狀態
- **數據驗證**：檢查選擇權數據品質和警告

## 風險提示

### 數據來源限制
- **選擇權數據**：來自Deribit真實市場，流動性可能影響準確性
- **外推精度**：長期外推基於數學模型，實際市場可能存在差異

### 使用注意事項
- 本工具僅提供計算數據，不構成投資建議
- 計算結果基於當前市場數據，市場條件變化可能影響準確性
- 鎖倉投資存在流動性風險，請充分評估

## 總結

### 🎯 技術創新

**雙到期日方差外推法**：突破單一合約限制，使用兩個最佳市場期權進行智能外推，特別適合長期鎖倉場景。

**三種智能策略**：根據目標期限與市場期權的關係，自動選擇最適合的外推策略，確保計算準確性。

**數據透明度**：完整展示原始市場數據和計算過程，讓用戶理解每一步計算邏輯。

### 📊 實務應用價值

通過同時計算Call與Put折扣，從「上漲機會成本」與「下跌保險成本」兩個維度，全面評估BTC/ETH鎖倉方案的合理性，為投資決策提供科學依據。

---

*本工具使用雙到期日方差外推法結合Black-Scholes期權定價模型，為加密貨幣鎖倉token提供精確的折扣率計算，供專業投資者參考分析使用。*