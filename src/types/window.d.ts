interface HiveKeychainCallbacks {
  success: boolean;
  result?: string | string[];  // Can be array for multi-sig
  error?: string;
  message?: string;
}

interface HiveKeychain {
  requestEncryptMemo(
    account: string,
    recipient: string | string[],  // Support both single and multi-sig
    memo: string,
    callback: (response: HiveKeychainCallbacks) => void
  ): void;
  
  requestCustomJson(
    account: string,
    id: string,
    activeKey: string,
    json: string,
    displayName: string,
    callback: (response: HiveKeychainCallbacks) => void
  ): void;
  
  requestBroadcast(
    account: string,
    operations: any[],
    keyType: string,
    callback: (response: HiveKeychainCallbacks) => void
  ): void;
}

declare global {
  interface Window {
    hive_keychain?: HiveKeychain;
  }
}

export {};