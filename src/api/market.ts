import { HoneygraphClient } from './honeygraph';

export interface Order {
  id: string;
  account: string;
  rate: number;
  amount: number;
  total: number;
  timestamp: string;
}

export interface MarketDepth {
  pair: string;
  buyOrders: Order[];
  sellOrders: Order[];
  spread: number;
  midPrice: number;
  liquidity: {
    buy: number;
    sell: number;
  };
}

export interface MarketStats {
  pair: string;
  volume24h: number;
  volumeUSD24h: number;
  high24h: number;
  low24h: number;
  change24h: number;
  changePercent24h: number;
  trades24h: number;
  currentPrice: number;
  marketCap: number;
  circulatingSupply: number;
}

export interface Trade {
  id: string;
  pair: string;
  type: 'BUY' | 'SELL';
  rate: number;
  amount: number;
  total: number;
  buyer: string;
  seller: string;
  timestamp: string;
  block: number;
}

export interface RichListEntry {
  rank: number;
  account: string;
  balance: number;
  percentage: number;
  change24h: number;
}

export interface UserOrder {
  id: string;
  pair: string;
  type: 'BUY' | 'SELL';
  rate: number;
  amount: number;
  filled: number;
  remaining: number;
  status: 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED';
  created: string;
  completed?: string;
}

export interface TradingPair {
  pair: string;
  active: boolean;
  baseToken: string;
  quoteToken: string;
  minOrderSize: number;
  tickSize: number;
  volume24h: number;
}

export interface OHLCV {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiquidityPool {
  id: string;
  pair: string;
  totalLiquidity: number;
  token1Reserve: number;
  token2Reserve: number;
  lpTokenSupply: number;
  apy: number;
  volume24h: number;
  fees24h: number;
}

export interface MarketSentiment {
  overall: 'bullish' | 'bearish' | 'neutral';
  score: number;
  indicators: {
    volumeTrend: string;
    priceTrend: string;
    orderBookImbalance: number;
    largeTransactions: number;
  };
  socialMetrics: {
    mentions24h: number;
    sentimentScore: number;
  };
}

export interface ArbitrageOpportunity {
  type: string;
  path: string[];
  profitPercent: number;
  estimatedProfit: number;
  requiredCapital: number;
  steps: Array<{
    from: string;
    to: string;
    rate: number;
  }>;
}

export class MarketAPI {
  private client: HoneygraphClient;

  constructor(client: HoneygraphClient) {
    this.client = client;
  }

  /**
   * Get order book depth for a trading pair
   */
  async getMarketDepth(pair: string, depth?: number): Promise<MarketDepth> {
    return this.client.getMarketDepth(pair, depth);
  }

  /**
   * Get 24h market statistics for a pair
   */
  async getMarketStats(pair: string): Promise<MarketStats> {
    return this.client.get(`/api/spk/market/${pair}/stats`);
  }

  /**
   * Get recent trades for a pair
   */
  async getRecentTrades(pair: string, limit: number = 50): Promise<Trade[]> {
    const result = await this.client.get(`/api/spk/market/${pair}/trades`, { limit });
    return result.trades || [];
  }

  /**
   * Get rich list for a token
   */
  async getRichList(token: string, limit: number = 100): Promise<RichListEntry[]> {
    return this.client.getRichList(token, limit);
  }

  /**
   * Get user's open orders
   */
  async getUserOrders(username: string, status: 'OPEN' | 'ALL' = 'OPEN'): Promise<UserOrder[]> {
    const result = await this.client.get(`/api/spk/market/user/${username}/orders`, { status });
    return result.orders || [];
  }

  /**
   * Get user's order history
   */
  async getOrderHistory(
    username: string,
    options?: {
      pair?: string;
      limit?: number;
      from?: string;
      to?: string;
    }
  ): Promise<UserOrder[]> {
    const result = await this.client.get(`/api/spk/market/user/${username}/history`, options);
    return result.orders || [];
  }

  /**
   * Get all available trading pairs
   */
  async getMarketPairs(): Promise<TradingPair[]> {
    const result = await this.client.get('/api/spk/market/pairs');
    return result.pairs || [];
  }

  /**
   * Get OHLCV candlestick data
   */
  async getOHLCV(
    pair: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    options?: {
      from?: string;
      to?: string;
      limit?: number;
    }
  ): Promise<OHLCV[]> {
    const params = { interval, ...options };
    const result = await this.client.get(`/api/spk/market/${pair}/ohlcv`, params);
    return result.candles || [];
  }

  /**
   * Get liquidity pool information
   */
  async getLiquidityPools(pair?: string): Promise<LiquidityPool[]> {
    const endpoint = pair
      ? `/api/spk/market/liquidity-pools/${pair}`
      : '/api/spk/market/liquidity-pools';
    const result = await this.client.get(endpoint);
    return result.pools || [];
  }

  /**
   * Get market sentiment analysis
   */
  async getMarketSentiment(token: string): Promise<MarketSentiment> {
    return this.client.get(`/api/spk/market/sentiment/${token}`);
  }

  /**
   * Find arbitrage opportunities
   */
  async getArbitrageOpportunities(minProfit: number = 1): Promise<ArbitrageOpportunity[]> {
    const result = await this.client.get('/api/spk/market/arbitrage', { minProfit });
    return result.opportunities || [];
  }

  /**
   * Get market maker statistics
   */
  async getMarketMakerStats(username: string): Promise<{
    totalVolume: number;
    totalFees: number;
    profitLoss: number;
    activePairs: string[];
    successRate: number;
  }> {
    return this.client.get(`/api/spk/market/maker/${username}/stats`);
  }

  /**
   * Get token price history
   */
  async getPriceHistory(
    token: string,
    days: number = 30
  ): Promise<
    Array<{
      timestamp: string;
      price: number;
      volume: number;
    }>
  > {
    const result = await this.client.get(`/api/spk/market/price-history/${token}`, { days });
    return result.history || [];
  }

  /**
   * Get market alerts
   */
  async getMarketAlerts(options?: {
    type?: 'price' | 'volume' | 'liquidity';
    severity?: 'low' | 'medium' | 'high';
  }): Promise<
    Array<{
      id: string;
      type: string;
      severity: string;
      message: string;
      timestamp: string;
      data: any;
    }>
  > {
    const result = await this.client.get('/api/spk/market/alerts', options);
    return result.alerts || [];
  }

  /**
   * Calculate slippage for a trade
   */
  async calculateSlippage(
    pair: string,
    amount: number,
    side: 'BUY' | 'SELL'
  ): Promise<{
    estimatedPrice: number;
    slippagePercent: number;
    priceImpact: number;
    totalCost: number;
  }> {
    return this.client.get('/api/spk/market/calculate-slippage', {
      pair,
      amount,
      side,
    });
  }
}
