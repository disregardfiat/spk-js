# SPK Network Protocol API Analysis

## Overview
This document provides a comprehensive analysis of the protocol API endpoints for LARYNX, SPK, and BROCA tokens on the SPK testnet.

## Token Configurations

### LARYNX Token
- **API Endpoint**: `https://spktest.dlux.io/api/protocol`
- **Precision**: 3 decimal places
- **Custom JSON Prefix**: `spkccT_`
- **JSON Token ID**: `larynx`
- **Multi-sig Address**: `spk-cc-test`

### SPK Token
- **API Endpoint**: `https://spktest.dlux.io/spk/api/protocol`
- **Precision**: 3 decimal places
- **Custom JSON Prefix**: `spkccT_spk_`
- **JSON Token ID**: `spk`
- **Multi-sig Address**: `spk-cc-test`

### BROCA Token
- **API Endpoint**: `https://spktest.dlux.io/broca/api/protocol`
- **Precision**: 0 (no decimal places)
- **Custom JSON Prefix**: `spkccT_broca_`
- **JSON Token ID**: `broca`
- **Multi-sig Address**: `spk-cc-test`

## Common Protocol Information

### Version
All tokens are running protocol version: `v1.5.0-t3`

### Node Configuration
- **Test Node**: `spk-test`
- **API Domain**: `spktest.dlux.io`

## Transaction Structure

### Features Map Structure
Each token supports a `features` map that defines available operations:

```javascript
features: {
  [transaction_id]: {
    json: string,      // JSON template
    id: string,        // Transaction identifier
    type: string,      // Transaction type (e.g., "move")
    msg: string,       // Human-readable description
    dst: boolean,      // Requires destination?
    send: boolean,     // Is this a send operation?
    fee: boolean,      // Has fees?
    dec: string,       // Decimal field name
    auth: string       // Required auth level ("posting" or "active")
  }
}
```

### Common Transaction Types

#### 1. Claim Rewards
- **ID**: `claim` or `claim_<token>`
- **Auth**: `posting`
- **Type**: `move`
- **Fields**: None required

#### 2. Send Tokens
- **ID**: `send` or `send_<token>`
- **Auth**: `active`
- **Type**: `send`
- **Required Fields**:
  - `amount`: Integer (in token's smallest unit)
  - `to`: String (recipient account)
- **Optional Fields**:
  - `memo`: String

#### 3. Power Up
- **ID**: `power_up` or `power_up_<token>`
- **Auth**: `active`
- **Type**: `move`
- **Required Fields**:
  - `amount`: Integer

#### 4. Power Down
- **ID**: `power_down` or `power_down_<token>`
- **Auth**: `active`
- **Type**: `move`
- **Required Fields**:
  - `amount`: Integer

## Building Custom JSON Transactions

### Basic Structure
```javascript
{
  "required_auths": [],
  "required_posting_auths": ["username"], // or required_auths for active
  "id": "spkccT_<token>_<action>",
  "json": JSON.stringify({
    // Action-specific fields
  })
}
```

### Examples

#### LARYNX Send Transaction
```javascript
{
  "required_auths": ["sender"],
  "required_posting_auths": [],
  "id": "spkccT_send",
  "json": JSON.stringify({
    "to": "recipient",
    "amount": 1000, // 1.000 LARYNX
    "memo": "Payment for services"
  })
}
```

#### SPK Power Up Transaction
```javascript
{
  "required_auths": ["account"],
  "required_posting_auths": [],
  "id": "spkccT_spk_power_up",
  "json": JSON.stringify({
    "amount": 5000 // 5.000 SPK
  })
}
```

#### BROCA Claim Transaction
```javascript
{
  "required_auths": [],
  "required_posting_auths": ["account"],
  "id": "spkccT_broca_claim",
  "json": JSON.stringify({})
}
```

## Field Types and Validation

The protocol uses typed fields:
- **"I"**: Integer type
- **"S"**: String type
- **"AS"**: Account String (validates as valid Hive account)

## Precision Handling

When working with token amounts:
- **LARYNX**: Multiply by 1000 (3 decimals)
- **SPK**: Multiply by 1000 (3 decimals)
- **BROCA**: Use as-is (0 decimals)

Example:
- 1.234 LARYNX = 1234 in transaction
- 5.678 SPK = 5678 in transaction
- 100 BROCA = 100 in transaction

## API Health Check

All protocol endpoints return:
```javascript
{
  "json_token": "<token_name>",
  "features": { /* feature map */ },
  "node": "spk-test",
  // Other protocol-specific data
}
```

A successful response indicates the API is healthy and operational.

## Integration Notes

1. **Authentication**: Always use the correct auth level specified in the feature map
2. **Amount Handling**: Convert decimal amounts to integers based on token precision
3. **Transaction IDs**: Use the exact ID from the features map
4. **Field Validation**: Respect field types and requirements
5. **Multi-sig**: All transactions go through the `spk-cc-test` multi-sig account on testnet

## Testing Recommendations

1. Start with claim transactions (posting auth, no fields required)
2. Test send transactions with small amounts
3. Verify precision handling for each token
4. Check transaction status via block explorers or API queries