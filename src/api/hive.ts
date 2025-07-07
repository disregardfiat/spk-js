/**
 * Hive blockchain API client
 */

export interface HiveAccount {
  name: string;
  memo_key: string;
  posting?: any;
  [key: string]: any;
}

export class HiveAPI {
  private static nodes = [
    'https://api.hive.blog',
    'https://api.deathwing.me',
    'https://hive-api.arcange.eu',
    'https://api.openhive.network'
  ];

  private static currentNodeIndex = 0;

  /**
   * Get accounts from Hive blockchain
   */
  static async getAccounts(usernames: string[]): Promise<HiveAccount[]> {
    if (!usernames || usernames.length === 0) {
      return [];
    }

    const node = this.nodes[this.currentNodeIndex];
    
    try {
      const response = await fetch(`${node}/api/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'condenser_api.get_accounts',
          params: [usernames],
          id: 1
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'API error');
      }

      return data.result || [];
    } catch (error) {
      // Try next node on failure
      this.currentNodeIndex = (this.currentNodeIndex + 1) % this.nodes.length;
      
      // If we've tried all nodes, throw the error
      if (this.currentNodeIndex === 0) {
        throw error;
      }
      
      // Retry with next node
      return this.getAccounts(usernames);
    }
  }

  /**
   * Get a single account
   */
  static async getAccount(username: string): Promise<HiveAccount | null> {
    const accounts = await this.getAccounts([username]);
    return accounts.length > 0 ? accounts[0] : null;
  }
}