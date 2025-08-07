// Simple in-memory cache with TTL for API responses

interface CacheItem<T> {
  data: T;
  expiry: number;
  provider?: string;
}

class ApiCache {
  private cache = new Map<string, CacheItem<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL
  
  set<T>(key: string, data: T, ttlMs?: number, provider?: string): void {
    const expiry = Date.now() + (ttlMs || this.defaultTTL);
    this.cache.set(key, { data, expiry, provider });
  }
  
  get<T>(key: string): { data: T; provider?: string } | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return { data: item.data, provider: item.provider };
  }
  
  has(key: string): boolean {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Get cache statistics
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const [key, item] of this.cache) {
      if (now > item.expiry) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries
    };
  }
  
  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, item] of this.cache) {
      if (now > item.expiry) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`🧹 Cache cleanup: removed ${expiredKeys.length} expired entries`);
    }
  }
}

// Create a singleton instance
const apiCache = new ApiCache();

// Periodically clean up expired entries (every 10 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    apiCache.cleanup();
  }, 10 * 60 * 1000);
}

export { apiCache };

// Cache key generators
export const cacheKeys = {
  currentPrice: (tokenId: string) => `price:${tokenId}`,
  historicalPrices: (tokenId: string, days: number) => `history:${tokenId}:${days}d`,
  volatility: (tokenId: string, days: number) => `volatility:${tokenId}:${days}d`
};

// Cache TTL constants (in milliseconds)
export const cacheTTL = {
  currentPrice: 2 * 60 * 1000,     // 2 minutes for current prices
  historicalPrices: 60 * 60 * 1000, // 1 hour for historical data
  volatility: 60 * 60 * 1000        // 1 hour for volatility calculations
};