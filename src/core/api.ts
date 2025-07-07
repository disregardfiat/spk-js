/**
 * SPK Network API client
 */
export interface AuthHeaders {
  account: string;
  signature: string;
  timestamp: string;
}

export class SPKAPI {
  public node: string;
  public timeout: number;
  public maxRetries: number;

  constructor(node = 'https://spktest.dlux.io', timeout = 30000, maxRetries = 3) {
    this.node = node;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
  }

  async request(
    method: string,
    endpoint: string,
    data?: any,
    auth?: AuthHeaders,
    retries = 0
  ): Promise<any> {
    const url = `${this.node}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (auth) {
      options.headers = {
        ...options.headers,
        'x-account': auth.account,
        'x-signature': auth.signature,
        'x-timestamp': auth.timestamp,
      };
    }

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      if (retries < this.maxRetries) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
        return this.request(method, endpoint, data, auth, retries + 1);
      }

      throw error;
    }
  }

  async get(endpoint: string, params?: Record<string, any>): Promise<any> {
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      endpoint += `?${queryString}`;
    }
    return this.request('GET', endpoint);
  }

  async post(endpoint: string, data: any, auth?: AuthHeaders): Promise<any> {
    return this.request('POST', endpoint, data, auth);
  }

  async delete(endpoint: string, auth?: AuthHeaders): Promise<any> {
    return this.request('DELETE', endpoint, null, auth);
  }

  // Specialized endpoints
  async getAccount(username: string): Promise<any> {
    return this.get(`/@${username}`);
  }

  async getFileContract(contractId: string): Promise<any> {
    return this.get(`/api/fileContract/${contractId}`);
  }

  async getFileByCID(cid: string): Promise<any> {
    return this.get(`/api/file/${cid}`);
  }

  async getServices(type: string): Promise<any> {
    return this.get(`/services/${type}`);
  }

  async getStats(): Promise<any> {
    return this.get('/stats');
  }
}