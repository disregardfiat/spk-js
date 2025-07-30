import { MarketAPI } from '../../../src/api/market';
import { HoneygraphClient } from '../../../src/api/honeygraph';

// Mock the HoneygraphClient
jest.mock('../../../src/api/honeygraph');

describe('MarketAPI', () => {
  let marketAPI: MarketAPI;
  let mockClient: jest.Mocked<HoneygraphClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new HoneygraphClient() as jest.Mocked<HoneygraphClient>;
    marketAPI = new MarketAPI(mockClient);
  });

  describe('getMarketDepth', () => {
    it('should get order book for a trading pair', async () => {
      const mockDepth = {
        pair: 'LARYNX:HIVE',
        buyOrders: [
          {
            id: 'order-123',
            account: 'alice',
            rate: 0.1,
            amount: 10000,
            total: 1000,
            timestamp: '2024-01-01T00:00:00Z'
          }
        ],
        sellOrders: [
          {
            id: 'order-456',
            account: 'bob',
            rate: 0.11,
            amount: 5000,
            total: 550,
            timestamp: '2024-01-01T00:00:00Z'
          }
        ],
        spread: 0.01,
        midPrice: 0.105,
        liquidity: {
          buy: 100000,
          sell: 80000
        }
      };

      mockClient.getMarketDepth.mockResolvedValueOnce(mockDepth);

      const result = await marketAPI.getMarketDepth('LARYNX:HIVE', 50);

      expect(mockClient.getMarketDepth).toHaveBeenCalledWith('LARYNX:HIVE', 50);
      expect(result).toEqual(mockDepth);
    });
  });

  describe('getMarketStats', () => {
    it('should get 24h market statistics', async () => {
      const mockStats = {
        pair: 'LARYNX:HIVE',
        volume24h: 1500000,
        volumeUSD24h: 150.0,
        high24h: 0.12,
        low24h: 0.09,
        change24h: 5.5,
        changePercent24h: 5.5,
        trades24h: 245,
        currentPrice: 0.105,
        marketCap: 10500000,
        circulatingSupply: 100000000
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockStats);

      const result = await marketAPI.getMarketStats('LARYNX:HIVE');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/market/LARYNX:HIVE/stats');
      expect(result).toEqual(mockStats);
    });
  });

  describe('getRecentTrades', () => {
    it('should get recent trades for a pair', async () => {
      const mockTrades = [
        {
          id: 'trade-789',
          pair: 'LARYNX:HIVE',
          type: 'BUY',
          rate: 0.105,
          amount: 1000,
          total: 105,
          buyer: 'alice',
          seller: 'bob',
          timestamp: '2024-01-01T12:00:00Z',
          block: 98000000
        }
      ];

      mockClient.get = jest.fn().mockResolvedValueOnce({ trades: mockTrades });

      const result = await marketAPI.getRecentTrades('LARYNX:HIVE', 20);

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/market/LARYNX:HIVE/trades', {
        limit: 20
      });
      expect(result).toEqual(mockTrades);
    });
  });

  describe('getRichList', () => {
    it('should get rich list for a token', async () => {
      const mockRichList = [
        {
          rank: 1,
          account: 'whale1',
          balance: 10000000,
          percentage: 10.0,
          change24h: 0
        },
        {
          rank: 2,
          account: 'whale2',
          balance: 8000000,
          percentage: 8.0,
          change24h: 50000
        }
      ];

      mockClient.getRichList.mockResolvedValueOnce(mockRichList);

      const result = await marketAPI.getRichList('larynx', 10);

      expect(mockClient.getRichList).toHaveBeenCalledWith('larynx', 10);
      expect(result).toEqual(mockRichList);
    });
  });

  describe('getUserOrders', () => {
    it('should get open orders for a user', async () => {
      const mockOrders = [
        {
          id: 'order-123',
          pair: 'LARYNX:HIVE',
          type: 'BUY',
          rate: 0.1,
          amount: 10000,
          filled: 0,
          remaining: 10000,
          status: 'OPEN',
          created: '2024-01-01T00:00:00Z'
        }
      ];

      mockClient.get = jest.fn().mockResolvedValueOnce({ orders: mockOrders });

      const result = await marketAPI.getUserOrders('alice', 'OPEN');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/market/user/alice/orders', {
        status: 'OPEN'
      });
      expect(result).toEqual(mockOrders);
    });
  });

  describe('getOrderHistory', () => {
    it('should get order history for a user', async () => {
      const mockHistory = [
        {
          id: 'order-old-1',
          pair: 'LARYNX:HIVE',
          type: 'SELL',
          rate: 0.11,
          amount: 5000,
          filled: 5000,
          status: 'FILLED',
          created: '2024-01-01T00:00:00Z',
          completed: '2024-01-01T00:05:00Z'
        }
      ];

      mockClient.get = jest.fn().mockResolvedValueOnce({ orders: mockHistory });

      const result = await marketAPI.getOrderHistory('alice', {
        pair: 'LARYNX:HIVE',
        limit: 50
      });

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/market/user/alice/history', {
        pair: 'LARYNX:HIVE',
        limit: 50
      });
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getMarketPairs', () => {
    it('should get all available trading pairs', async () => {
      const mockPairs = [
        {
          pair: 'LARYNX:HIVE',
          active: true,
          baseToken: 'LARYNX',
          quoteToken: 'HIVE',
          minOrderSize: 100,
          tickSize: 0.001,
          volume24h: 1500000
        },
        {
          pair: 'SPK:HIVE',
          active: true,
          baseToken: 'SPK',
          quoteToken: 'HIVE',
          minOrderSize: 100,
          tickSize: 0.001,
          volume24h: 800000
        }
      ];

      mockClient.get = jest.fn().mockResolvedValueOnce({ pairs: mockPairs });

      const result = await marketAPI.getMarketPairs();

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/market/pairs');
      expect(result).toEqual(mockPairs);
    });
  });

  describe('getOHLCV', () => {
    it('should get OHLCV candlestick data', async () => {
      const mockOHLCV = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          open: 0.10,
          high: 0.11,
          low: 0.095,
          close: 0.105,
          volume: 50000
        }
      ];

      mockClient.get = jest.fn().mockResolvedValueOnce({ candles: mockOHLCV });

      const result = await marketAPI.getOHLCV('LARYNX:HIVE', '1h', {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-02T00:00:00Z'
      });

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/market/LARYNX:HIVE/ohlcv', {
        interval: '1h',
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-02T00:00:00Z'
      });
      expect(result).toEqual(mockOHLCV);
    });
  });

  describe('getLiquidityPools', () => {
    it('should get liquidity pool information', async () => {
      const mockPools = [
        {
          id: 'pool-larynx-hive',
          pair: 'LARYNX:HIVE',
          totalLiquidity: 2000000,
          token1Reserve: 1000000,
          token2Reserve: 100000,
          lpTokenSupply: 316227,
          apy: 25.5,
          volume24h: 150000,
          fees24h: 450
        }
      ];

      mockClient.get = jest.fn().mockResolvedValueOnce({ pools: mockPools });

      const result = await marketAPI.getLiquidityPools();

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/market/liquidity-pools');
      expect(result).toEqual(mockPools);
    });
  });

  describe('getMarketSentiment', () => {
    it('should get market sentiment analysis', async () => {
      const mockSentiment = {
        overall: 'bullish',
        score: 72,
        indicators: {
          volumeTrend: 'increasing',
          priceTrend: 'upward',
          orderBookImbalance: 0.15,
          largeTransactions: 5
        },
        socialMetrics: {
          mentions24h: 145,
          sentimentScore: 0.68
        }
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockSentiment);

      const result = await marketAPI.getMarketSentiment('LARYNX');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/market/sentiment/LARYNX');
      expect(result).toEqual(mockSentiment);
    });
  });

  describe('getArbitrageOpportunities', () => {
    it('should find arbitrage opportunities', async () => {
      const mockOpportunities = [
        {
          type: 'triangular',
          path: ['LARYNX', 'HIVE', 'SPK', 'LARYNX'],
          profitPercent: 2.5,
          estimatedProfit: 250,
          requiredCapital: 10000,
          steps: [
            { from: 'LARYNX', to: 'HIVE', rate: 0.1 },
            { from: 'HIVE', to: 'SPK', rate: 0.05 },
            { from: 'SPK', to: 'LARYNX', rate: 2.05 }
          ]
        }
      ];

      mockClient.get = jest.fn().mockResolvedValueOnce({ opportunities: mockOpportunities });

      const result = await marketAPI.getArbitrageOpportunities();

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/market/arbitrage', { minProfit: 1 });
      expect(result).toEqual(mockOpportunities);
    });
  });
});