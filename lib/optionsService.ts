import { Token, OptionData, LockupPeriod, DualExpiryData, ExtrapolationStrategy } from '@/types';

const DERIBIT_API = 'https://www.deribit.com/api/v2';
const CLIENT_ID = 'E34lksyJ';
const CLIENT_SECRET = 'jzn_lJXmLNV6pKZp1y1bYRqXoTa_l5cCSOIDd1P_VQ4';

// Access token cache
let accessToken: string | null = null;
let tokenExpiry: number = 0;

// API response cache to avoid repeated calls
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30 * 1000; // 30秒緩存

// 獲取Deribit access token
async function getAccessToken(): Promise<string> {
  // 如果token仍然有效，直接返回
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await fetch(`${DERIBIT_API}/public/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'public/auth',
        params: {
          grant_type: 'client_credentials',
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Deribit auth error: ${data.error.message}`);
    }

    accessToken = data.result.access_token;
    // 設定過期時間為當前時間 + (expires_in - 60秒緩衝) * 1000
    tokenExpiry = Date.now() + (data.result.expires_in - 60) * 1000;
    
    console.log('Deribit authentication successful');
    return accessToken!; // 使用non-null assertion因為我們剛剛賦值了
  } catch (error) {
    console.error('Error getting Deribit access token:', error);
    throw error;
  }
}

// Deribit API調用函數
async function callDeribitAPI(method: string, params: any = {}): Promise<any> {
  const token = await getAccessToken();
  
  const response = await fetch(`${DERIBIT_API}/private/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: `private/${method}`,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`Deribit API call failed: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Deribit API error: ${data.error.message}`);
  }

  return data.result;
}

// 公開API調用函數
async function callDeribitPublicAPI(method: string, params: any = {}): Promise<any> {
  const response = await fetch(`${DERIBIT_API}/public/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: `public/${method}`,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`Deribit public API call failed: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Deribit public API error: ${data.error.message}`);
  }

  return data.result;
}

// 將鎖倉期轉換為選擇權到期月份
function lockupPeriodToExpiry(period: LockupPeriod): string {
  const now = new Date();
  const targetDate = new Date(now);
  
  switch (period) {
    case '3M':
      targetDate.setMonth(now.getMonth() + 3);
      break;
    case '6M':
      targetDate.setMonth(now.getMonth() + 6);
      break;
    case '1Y':
      targetDate.setFullYear(now.getFullYear() + 1);
      break;
    case '2Y':
      targetDate.setFullYear(now.getFullYear() + 2);
      break;
  }
  
  // 格式化為 DDMMMYY (例: 28MAR25)
  const day = targetDate.getDate().toString().padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[targetDate.getMonth()];
  const year = targetDate.getFullYear().toString().slice(-2);
  
  return `${day}${month}${year}`;
}

// 獲取可用的選擇權合約
export async function fetchAvailableInstruments(token: Token): Promise<string[]> {
  try {
    // 檢查緩存
    const cacheKey = `instruments_${token}`;
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    
    const result = await callDeribitPublicAPI('get_instruments', {
      currency: token,
      kind: 'option',
      expired: false
    });
    
    const instruments = result.map((instrument: any) => instrument.instrument_name);
    
    // 緩存結果
    apiCache.set(cacheKey, { data: instruments, timestamp: Date.now() });
    
    return instruments;
  } catch (error) {
    console.error('Error fetching available instruments:', error);
    throw error;
  }
}

// 獲取特定合約的價格數據
export async function fetchInstrumentPrice(instrumentName: string): Promise<any> {
  try {
    // 檢查緩存
    const cacheKey = `price_${instrumentName}`;
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    
    const result = await callDeribitPublicAPI('get_book_summary_by_instrument', {
      instrument_name: instrumentName
    });
    
    // 緩存結果
    apiCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    // 調試：檢查API響應結構
    if (instrumentName.includes('60000-C')) {
      console.log(`Raw API response for ${instrumentName}:`, JSON.stringify(result, null, 2));
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching instrument price:', error);
    throw error;
  }
}

// 解析選擇權合約名稱
function parseInstrumentName(instrumentName: string): {
  currency: string;
  expiry: string;
  strike: number;
  type: 'C' | 'P';
} | null {
  // 格式: BTC-28MAR25-70000-C
  const parts = instrumentName.split('-');
  if (parts.length !== 4) return null;
  
  return {
    currency: parts[0],
    expiry: parts[1],
    strike: parseInt(parts[2]),
    type: parts[3] as 'C' | 'P'
  };
}

// 計算兩個日期之間的天數差
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.abs((date1.getTime() - date2.getTime()) / oneDay);
}

// 解析到期日字符串為Date對象
function parseExpiryDate(expiry: string): Date | null {
  try {
    // 格式: 28MAR25
    const day = parseInt(expiry.substring(0, 2));
    const monthStr = expiry.substring(2, 5);
    const year = 2000 + parseInt(expiry.substring(5, 7));
    
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months.indexOf(monthStr);
    
    if (month === -1) return null;
    
    return new Date(year, month, day);
  } catch {
    return null;
  }
}

// 價格選擇類型
export type PriceType = 'mark' | 'mid' | 'last';

// 智能雙到期日選擇函數
function findOptimalExpiryPair(
  expiryDates: Map<string, Date>, 
  targetDate: Date
): {
  shortExpiry: string;
  longExpiry: string;
  strategy: ExtrapolationStrategy;
} | null {
  const sortedExpiries = Array.from(expiryDates.entries())
    .sort(([, dateA], [, dateB]) => dateA.getTime() - dateB.getTime());
    
  if (sortedExpiries.length < 2) {
    console.warn('需要至少2個到期日進行雙到期日計算');
    return null;
  }
  
  console.log(`=== 雙到期日選擇邏輯 ===`);
  console.log(`目標日期: ${targetDate.toDateString()}`);
  console.log(`可用到期日: ${sortedExpiries.map(([exp, date]) => `${exp}(${date.toDateString()})`).join(', ')}`);
  
  // 獲取第一個和最後一個到期日用於邊界判斷
  const [firstExp, firstDate] = sortedExpiries[0];
  const [lastExp, lastDate] = sortedExpiries[sortedExpiries.length - 1];
  
  console.log(`邊界檢查: 首個=${firstExp}(${firstDate.toDateString()}), 末個=${lastExp}(${lastDate.toDateString()})`);
  
  // 情況1：目標日期在某兩個到期日之間（內插）
  for (let i = 0; i < sortedExpiries.length - 1; i++) {
    const [shortExp, shortDate] = sortedExpiries[i];
    const [longExp, longDate] = sortedExpiries[i + 1];
    
    console.log(`檢查內插: ${targetDate.toDateString()} 是否在 ${shortDate.toDateString()} 和 ${longDate.toDateString()} 之間`);
    
    if (targetDate >= shortDate && targetDate <= longDate) {
      console.log(`✅ 策略: INTERPOLATION between ${shortExp} and ${longExp}`);
      return {
        shortExpiry: shortExp,
        longExpiry: longExp,
        strategy: ExtrapolationStrategy.INTERPOLATION
      };
    }
  }
  
  // 情況2：目標日期超出所有可用期限（外推）
  if (targetDate > lastDate) {
    const lastTwoExpiries = sortedExpiries.slice(-2);
    const [shortExp, shortDate] = lastTwoExpiries[0];
    const [longExp, longDate] = lastTwoExpiries[1];
    
    console.log(`✅ 策略: EXTRAPOLATION using ${shortExp} and ${longExp} (目標超出所有可用期限)`);
    console.log(`使用最後兩個到期日進行外推: ${shortExp}(${shortDate.toDateString()}) -> ${longExp}(${longDate.toDateString()}) -> 目標(${targetDate.toDateString()})`);
    return {
      shortExpiry: shortExp,
      longExpiry: longExp,
      strategy: ExtrapolationStrategy.EXTRAPOLATION
    };
  }
  
  // 情況3：目標日期短於最短期限（使用前兩個期限進行有界外推）
  if (targetDate < firstDate) {
    const firstTwoExpiries = sortedExpiries.slice(0, 2);
    const [shortExp2, shortDate2] = firstTwoExpiries[0];
    const [longExp2, longDate2] = firstTwoExpiries[1];
    
    console.log(`✅ 策略: BOUNDED_EXTRAPOLATION using ${shortExp2} and ${longExp2} (目標短於最短期限)`);
    console.log(`使用前兩個到期日進行有界外推: 目標(${targetDate.toDateString()}) <- ${shortExp2}(${shortDate2.toDateString()}) <- ${longExp2}(${longDate2.toDateString()})`);
    return {
      shortExpiry: shortExp2,
      longExpiry: longExp2,
      strategy: ExtrapolationStrategy.BOUNDED_EXTRAPOLATION
    };
  }
  
  // 備用情況：如果以上邏輯都沒有匹配，使用最接近的兩個期限
  console.warn(`⚠️  未找到理想的雙到期日組合，使用備用策略`);
  let closestIndex = 0;
  let minDifference = Math.abs(targetDate.getTime() - sortedExpiries[0][1].getTime());
  
  for (let i = 1; i < sortedExpiries.length; i++) {
    const difference = Math.abs(targetDate.getTime() - sortedExpiries[i][1].getTime());
    if (difference < minDifference) {
      minDifference = difference;
      closestIndex = i;
    }
  }
  
  // 選擇最接近的期限和其相鄰期限
  let shortIndex = Math.max(0, closestIndex - 1);
  let longIndex = Math.min(sortedExpiries.length - 1, closestIndex + 1);
  
  // 確保我們有兩個不同的期限
  if (shortIndex === longIndex) {
    if (shortIndex > 0) {
      shortIndex--;
    } else {
      longIndex++;
    }
  }
  
  const [shortExp, shortDate] = sortedExpiries[shortIndex];
  const [longExp, longDate] = sortedExpiries[longIndex];
  
  console.log(`🔄 備用策略: 使用最接近的兩個期限 ${shortExp} and ${longExp}`);
  return {
    shortExpiry: shortExp,
    longExpiry: longExp,
    strategy: ExtrapolationStrategy.INTERPOLATION // 默認使用內插策略
  };
}

// 獲取選擇權鏈數據
export async function fetchOptionsChain(
  token: Token, 
  period: LockupPeriod,
  spotPrice: number,
  priceType: PriceType = 'mark'
): Promise<OptionData[]> {
  try {
    // 獲取所有可用合約
    const instruments = await fetchAvailableInstruments(token);
    console.log(`Total instruments available: ${instruments.length}`);
    
    // 計算目標到期日
    const now = new Date();
    const targetDate = new Date(now);
    
    switch (period) {
      case '3M':
        targetDate.setMonth(now.getMonth() + 3);
        break;
      case '6M':
        targetDate.setMonth(now.getMonth() + 6);
        break;
      case '1Y':
        targetDate.setFullYear(now.getFullYear() + 1);
        break;
      case '2Y':
        targetDate.setFullYear(now.getFullYear() + 2);
        break;
    }
    
    console.log(`Target date for ${period}: ${targetDate.toDateString()}`);
    
    // 分析所有合約並找到最接近的到期日
    const instrumentsByExpiry = new Map<string, string[]>();
    const expiryDates = new Map<string, Date>();
    
    for (const name of instruments) {
      const parsed = parseInstrumentName(name);
      if (!parsed) continue;
      
      // 只取strike價格在現價附近的合約 (±50%)
      const strikeDiff = Math.abs(parsed.strike - spotPrice) / spotPrice;
      if (strikeDiff > 0.5) continue;
      
      if (!instrumentsByExpiry.has(parsed.expiry)) {
        instrumentsByExpiry.set(parsed.expiry, []);
        const expiryDate = parseExpiryDate(parsed.expiry);
        if (expiryDate) {
          expiryDates.set(parsed.expiry, expiryDate);
        }
      }
      
      instrumentsByExpiry.get(parsed.expiry)!.push(name);
    }
    
    console.log(`Available expiry dates: ${Array.from(expiryDates.keys()).join(', ')}`);
    
    // 找到最接近目標日期的到期日
    let closestExpiry = '';
    let minDaysDiff = Infinity;
    
    for (const [expiry, date] of expiryDates) {
      const daysDiff = daysBetween(targetDate, date);
      if (daysDiff < minDaysDiff) {
        minDaysDiff = daysDiff;
        closestExpiry = expiry;
      }
    }
    
    if (!closestExpiry) {
      console.log('No suitable expiry dates found');
      return [];
    }
    
    const relevantInstruments = instrumentsByExpiry.get(closestExpiry) || [];
    console.log(`Using expiry ${closestExpiry} (${minDaysDiff.toFixed(0)} days from target)`);
    console.log(`Found ${relevantInstruments.length} relevant instruments for ${token} ${period}`);
    
    if (relevantInstruments.length === 0) {
      return [];
    }
    
    // 獲取價格數據 - 使用批量請求以避免API限制
    console.log(`Fetching prices for ${relevantInstruments.length} instruments...`);
    
    // 分批處理，每批最多5個請求，避免觸發API限制
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < relevantInstruments.length; i += batchSize) {
      batches.push(relevantInstruments.slice(i, i + batchSize));
    }
    
    const priceResults = [];
    for (const batch of batches) {
      const batchPromises = batch.map(name => 
        fetchInstrumentPrice(name)
          .then(data => ({ name, data }))
          .catch(error => {
            console.warn(`Failed to fetch price for ${name}:`, error.message);
            return null;
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      priceResults.push(...batchResults);
      
      // 在批次之間添加短暫延遲
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    const validResults = priceResults.filter(result => result !== null);
    console.log(`Successfully fetched prices for ${validResults.length} out of ${relevantInstruments.length} instruments`);
    
    // 組織成選擇權鏈格式
    const optionsMap = new Map<number, Partial<OptionData>>();
    
    for (const result of validResults) {
      const parsed = parseInstrumentName(result!.name);
      if (!parsed) continue;
      
      const strike = parsed.strike;
      if (!optionsMap.has(strike)) {
        optionsMap.set(strike, {
          strike,
          expiry: parsed.expiry,
          callPrice: 0,
          putPrice: 0,
          impliedVol: 0
        });
      }
      
      const option = optionsMap.get(strike)!;
      // Deribit API 返回數組，取第一個元素
      const priceData = Array.isArray(result!.data) ? result!.data[0] : result!.data;
      
      // 調試：打印原始價格數據
      if (optionsMap.size === 1) { // 只打印第一個合約的數據
        console.log(`Sample price data for ${result!.name}:`, priceData);
      }
      
      if (parsed.type === 'C') {
        // 詳細價格信息調試
        const markPrice = priceData.mark_price || 0;
        const midPrice = priceData.bid_price && priceData.ask_price ? 
                        (priceData.bid_price + priceData.ask_price) / 2 : 0;
        const lastPrice = priceData.last || 0;
        
        // 根據指定的價格類型選擇價格
        switch (priceType) {
          case 'mark':
            option.callPrice = markPrice || midPrice || lastPrice || 0;
            break;
          case 'mid':
            option.callPrice = midPrice || markPrice || lastPrice || 0;
            break;
          case 'last':
            option.callPrice = lastPrice || markPrice || midPrice || 0;
            break;
        }
        option.callBid = priceData.bid_price || 0;
        option.callAsk = priceData.ask_price || 0;
        
        console.log(`Call ${strike}: Mark=${markPrice.toFixed(6)}, Mid=${midPrice.toFixed(6)}, Last=${lastPrice.toFixed(6)}, Final=${option.callPrice?.toFixed(6) || '0'}`);
      } else {
        // 詳細價格信息調試
        const markPrice = priceData.mark_price || 0;
        const midPrice = priceData.bid_price && priceData.ask_price ? 
                        (priceData.bid_price + priceData.ask_price) / 2 : 0;
        const lastPrice = priceData.last || 0;
        
        // 根據指定的價格類型選擇價格
        switch (priceType) {
          case 'mark':
            option.putPrice = markPrice || midPrice || lastPrice || 0;
            break;
          case 'mid':
            option.putPrice = midPrice || markPrice || lastPrice || 0;
            break;
          case 'last':
            option.putPrice = lastPrice || markPrice || midPrice || 0;
            break;
        }
        option.putBid = priceData.bid_price || 0;
        option.putAsk = priceData.ask_price || 0;
        
        console.log(`Put ${strike}: Mark=${markPrice.toFixed(6)}, Mid=${midPrice.toFixed(6)}, Last=${lastPrice.toFixed(6)}, Final=${option.putPrice?.toFixed(6) || '0'}`);
      }
      
      // 使用implied volatility
      option.impliedVol = priceData.mark_iv || 0;
    }
    
    // 過濾出有完整call和put數據的合約
    const allOptions = Array.from(optionsMap.values());
    console.log(`Total option strikes processed: ${allOptions.length}`);
    
    // 調試：檢查每個選擇權的數據
    allOptions.forEach(option => {
      console.log(`Strike ${option.strike}: Call=${option.callPrice}, Put=${option.putPrice}`);
    });
    
    const completeOptions = allOptions
      .filter(option => option.callPrice! > 0 && option.putPrice! > 0) as OptionData[];
    
    console.log(`Complete option pairs found: ${completeOptions.length}`);
    
    if (completeOptions.length > 0) {
      console.log('Sample option data:', {
        strike: completeOptions[0].strike,
        callPrice: completeOptions[0].callPrice,
        putPrice: completeOptions[0].putPrice,
        expiry: completeOptions[0].expiry
      });
    }
    
    return completeOptions.sort((a, b) => a.strike - b.strike);
    
  } catch (error) {
    console.error('Error fetching options chain:', error);
    return [];
  }
}

// 新的雙到期日選擇權數據獲取函數
export async function fetchDualExpiryOptionsData(
  token: Token,
  period: LockupPeriod,
  spotPrice: number,
  priceType: PriceType = 'mark'
): Promise<DualExpiryData | null> {
  try {
    // 獲取所有可用合約
    const instruments = await fetchAvailableInstruments(token);
    console.log(`Total instruments available: ${instruments.length}`);
    
    // 計算目標到期日
    const now = new Date();
    const targetDate = new Date(now);
    
    switch (period) {
      case '3M':
        targetDate.setMonth(now.getMonth() + 3);
        break;
      case '6M':
        targetDate.setMonth(now.getMonth() + 6);
        break;
      case '1Y':
        targetDate.setFullYear(now.getFullYear() + 1);
        break;
      case '2Y':
        targetDate.setFullYear(now.getFullYear() + 2);
        break;
    }
    
    // 分析所有合約並建立到期日映射
    const instrumentsByExpiry = new Map<string, string[]>();
    const expiryDates = new Map<string, Date>();
    
    for (const name of instruments) {
      const parsed = parseInstrumentName(name);
      if (!parsed) continue;
      
      // 只取strike價格在現價附近的合約 (±50%)
      const strikeDiff = Math.abs(parsed.strike - spotPrice) / spotPrice;
      if (strikeDiff > 0.5) continue;
      
      if (!instrumentsByExpiry.has(parsed.expiry)) {
        instrumentsByExpiry.set(parsed.expiry, []);
        const expiryDate = parseExpiryDate(parsed.expiry);
        if (expiryDate) {
          expiryDates.set(parsed.expiry, expiryDate);
        }
      }
      
      instrumentsByExpiry.get(parsed.expiry)!.push(name);
    }
    
    // 使用智能雙到期日選擇
    const expiryPair = findOptimalExpiryPair(expiryDates, targetDate);
    if (!expiryPair) {
      console.error('無法找到適合的雙到期日組合');
      return null;
    }
    
    // 獲取兩個到期日的選擇權數據
    const shortTermInstruments = instrumentsByExpiry.get(expiryPair.shortExpiry) || [];
    const longTermInstruments = instrumentsByExpiry.get(expiryPair.longExpiry) || [];
    
    console.log(`Short term (${expiryPair.shortExpiry}): ${shortTermInstruments.length} instruments`);
    console.log(`Long term (${expiryPair.longExpiry}): ${longTermInstruments.length} instruments`);
    
    // 獲取短期選擇權數據
    const shortTermOptions = await fetchOptionsForExpiry(shortTermInstruments, expiryPair.shortExpiry, priceType);
    
    // 獲取長期選擇權數據  
    const longTermOptions = await fetchOptionsForExpiry(longTermInstruments, expiryPair.longExpiry, priceType);
    
    if (shortTermOptions.length === 0 || longTermOptions.length === 0) {
      console.error('無法獲取足夠的雙到期日選擇權數據');
      return null;
    }
    
    // 計算到期時間（年為單位）
    const shortTermTimeToExpiry = daysBetween(now, expiryDates.get(expiryPair.shortExpiry)!) / 365;
    const longTermTimeToExpiry = daysBetween(now, expiryDates.get(expiryPair.longExpiry)!) / 365;
    const targetTimeToExpiry = daysBetween(now, targetDate) / 365;
    
    // 計算平均隱含波動率
    const shortTermAvgIV = shortTermOptions.reduce((sum, opt) => sum + opt.impliedVol, 0) / shortTermOptions.length;
    const longTermAvgIV = longTermOptions.reduce((sum, opt) => sum + opt.impliedVol, 0) / longTermOptions.length;
    
    return {
      shortTerm: {
        expiry: expiryPair.shortExpiry,
        timeToExpiry: shortTermTimeToExpiry,
        impliedVol: shortTermAvgIV,
        optionsData: shortTermOptions
      },
      longTerm: {
        expiry: expiryPair.longExpiry,
        timeToExpiry: longTermTimeToExpiry,
        impliedVol: longTermAvgIV,
        optionsData: longTermOptions
      },
      strategy: expiryPair.strategy,
      targetTimeToExpiry: targetTimeToExpiry
    };
    
  } catch (error) {
    console.error('Error fetching dual expiry options data:', error);
    return null;
  }
}

// 輔助函數：獲取特定到期日的選擇權數據
async function fetchOptionsForExpiry(
  instruments: string[], 
  expiry: string,
  priceType: PriceType
): Promise<OptionData[]> {
  if (instruments.length === 0) return [];
  
  // 分批處理請求
  const batchSize = 5;
  const batches = [];
  for (let i = 0; i < instruments.length; i += batchSize) {
    batches.push(instruments.slice(i, i + batchSize));
  }
  
  const priceResults = [];
  for (const batch of batches) {
    const batchPromises = batch.map(name => 
      fetchInstrumentPrice(name)
        .then(data => ({ name, data }))
        .catch(error => {
          console.warn(`Failed to fetch price for ${name}:`, error.message);
          return null;
        })
    );
    
    const batchResults = await Promise.all(batchPromises);
    priceResults.push(...batchResults);
    
    // 在批次之間添加短暫延遲
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const validResults = priceResults.filter(result => result !== null);
  
  // 組織成選擇權鏈格式
  const optionsMap = new Map<number, Partial<OptionData>>();
  
  for (const result of validResults) {
    const parsed = parseInstrumentName(result!.name);
    if (!parsed) continue;
    
    const strike = parsed.strike;
    if (!optionsMap.has(strike)) {
      optionsMap.set(strike, {
        strike,
        expiry: parsed.expiry,
        callPrice: 0,
        putPrice: 0,
        impliedVol: 0
      });
    }
    
    const option = optionsMap.get(strike)!;
    const priceData = Array.isArray(result!.data) ? result!.data[0] : result!.data;
    
    if (parsed.type === 'C') {
      const markPrice = priceData.mark_price || 0;
      const midPrice = priceData.bid_price && priceData.ask_price ? 
                      (priceData.bid_price + priceData.ask_price) / 2 : 0;
      const lastPrice = priceData.last || 0;
      
      switch (priceType) {
        case 'mark':
          option.callPrice = markPrice || midPrice || lastPrice || 0;
          break;
        case 'mid':
          option.callPrice = midPrice || markPrice || lastPrice || 0;
          break;
        case 'last':
          option.callPrice = lastPrice || markPrice || midPrice || 0;
          break;
      }
      option.callBid = priceData.bid_price || 0;
      option.callAsk = priceData.ask_price || 0;
    } else {
      const markPrice = priceData.mark_price || 0;
      const midPrice = priceData.bid_price && priceData.ask_price ? 
                      (priceData.bid_price + priceData.ask_price) / 2 : 0;
      const lastPrice = priceData.last || 0;
      
      switch (priceType) {
        case 'mark':
          option.putPrice = markPrice || midPrice || lastPrice || 0;
          break;
        case 'mid':
          option.putPrice = midPrice || markPrice || lastPrice || 0;
          break;
        case 'last':
          option.putPrice = lastPrice || markPrice || midPrice || 0;
          break;
      }
      option.putBid = priceData.bid_price || 0;
      option.putAsk = priceData.ask_price || 0;
    }
    
    // 使用implied volatility
    option.impliedVol = priceData.mark_iv || 0;
  }
  
  // 過濾出有完整call和put數據的合約
  const completeOptions = Array.from(optionsMap.values())
    .filter(option => option.callPrice! > 0 && option.putPrice! > 0) as OptionData[];
    
  return completeOptions.sort((a, b) => a.strike - b.strike);
}