import { NextRequest, NextResponse } from 'next/server';
import { getCurrentPrice } from '@/lib/historicalVolatility';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('tokenId');
    
    // Validate inputs
    if (!tokenId) {
      return NextResponse.json(
        { success: false, error: 'Token ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`[Price API] 🚀 獲取 ${tokenId} 當前價格...`);
    
    // Get current price using multi-API approach
    const priceResult = await getCurrentPrice(tokenId);
    const duration = Date.now() - startTime;
    
    console.log(`[Price API] ✅ ${tokenId} 價格: $${priceResult.data.toLocaleString()} (來源: ${priceResult.provider.toUpperCase()}${priceResult.cached ? ', 緩存' : ''}, 耗時: ${duration}ms)`);
    
    return NextResponse.json({
      success: true,
      price: priceResult.data,
      provider: priceResult.provider,
      cached: priceResult.cached || false,
      tokenId,
      duration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Price API] ❌ Error:', errorMessage);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch price',
        details: errorMessage,
        duration
      },
      { status: 500 }
    );
  }
}