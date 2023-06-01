# spk-js
Library for interacting with SPK Network

Place .dist/spk-js.min.js in your HTML

`<script type="module" src="/spk-js.min.js"></script>`

### Account

Used for account management. The `setAccount` method is required for all other functionality.

#### Set Account

spkJs.account.setAccount("disregardfiat")

Initialize the suite with the account of the pages key holder

#### Channel Open

spkJs.account.channelOpen(broca, uploader, broker, benAmount = "", benAccount = "")

BROCA = 10000 
Account to Upload File = disregardfiat
broker: IPFS Service Provider = dlux-io
Requested Benificary Amount = 10.00
Benificiary Account = dlux-io

#### DEX Buy

spkJs.account.dexBuy(amount, rate = 0, type = "HIVE", hours = 720)

amount in milliHive or milliHBD
rate for limit orders, 0 for market
type: HIVE or HBD
hours: 720 max, 1 min

Examples: 

Market Order 1 Hive
spkJs.account.dexBuy(1000)

Market Order 1 HBD
spkJs.account.dexBuy(1000,0,"HBD")

Limit Order 1 Hive @ .0144

spkJs.account.dexBuy(1000, 0.0144)

#### DEX Cancel

spkJs.account.dexCancel(txid)

Cancel an open order. Refunds happen in 1 to 9 minutes for Hive, and instantly for LARYNX.

#### DEX Sell

spkJs.account.dexSell(amount, rate = 0, type = "HIVE", hours = 720)

Much like above. amount in milliHive or HBD

Examples: 

Market Sell Order 1 Larynx for Hive
spkJs.account.dexSell(1000)

Market Sell Order 1 Larynx for HBD
spkJs.account.dexSell(1000,0,"HBD")

Limit Order Sell 1 Larynx @ .0144

spkJs.account.dexSell(1000, 0.0144)

#### Extend

spkJs.account.extend(cid, fileOwner, broca, power = 0)

cid => contract ID : markegiles:0:74019097
fileOwner => markegiles
broca => amount to send to contract
power => 0 || 1
  1 will buy an extra slot for the decentralization.

#### Gov Down

spkJs.account.govDown(amount)

Amount in milliLarynx Gov to transform

#### Gov Up

spkJs.account.govUp(amount)

Amount in milliLarynx to transform

#### Power Down

spkJs.account.powerDown(amount)

Amount in milliLarynx Power to transform

#### Power Grant

spkJs.account.powerGrant()

#### Power Up

spkJs.account.powerUp(amount)

Amount in milliLarynx to transform

#### Register Authority

Registers a Hive Pubkey to the SPK Layer 2.
It is not recommended to include a pubKey here, the accounts first posting key auth will be used in it's absence.

spkJs.account.registerAuthority(pubKey = "")

#### Register Service

spkJs.account.registerService(type = "IPFS", id, api, amount = 2000)

amount in MiliLarynx Liquid
id => peerID of IPFS
api => https://ipfs.dlux.io
type => "IPFS"

You can also register service types, but this form will trigger Proof of Access storage.

#### Register Service Type

spkJs.account.registerServiceType(type, amount, name)

Used for registering API types. There is a cost associated.

type: IPFS
amount: 2000
name: InterplanetaryFileSystem

#### Remove

Removes your storage node from a file contract.

spkJs.account.remove(item~s)

Takes a contract ID, or an array of contract IDs.
Will generate a broadcast of items the account is storing to be removed.


#### Send LARYNX

Send Larynx tokens to another Hive account

spkJs.account.sendLarynx(amount, to, memo = "", test = false)

Amount is in integer units. 1.000 Larynx is 1000
Function checks for current Larynx amount, will error on insufficient funds.
Function checks for hive account recieving, will error on unregistered account.
Memo is not required 
true test will insert a T in the custom json string and only the test network will accept the transaction

#### Send SPK

Send SPK tokens to another Hive account

spkJs.account.sendSpk(amount, to, memo = "", test = false)

Amount is in integer units. 1.000 SPK is 1000
Function checks for current SPK amount, will error on insufficient funds.
Function checks for hive account recieving, will error on unregistered account.
Memo is not required 
true test will insert a T in the custom json string and only the test network will accept the transaction

#### Claim

Function to claim reward Larynx. Will fail if there is no claim availible. The optional gov BOOL will claim half to the collateral state instead of the power state, which is only availible to SPK Node operators (and will fail to false if not running a node with the account)

spkJs.account.claim(gov = false)

#### SPK Down

spkJs.account.spkDown(amount)

Amount in milliSPK Power to transform

#### SPK Up

spkJs.account.spkUp(amount)

Amount in milliSPK to transform

#### SPK Vote

spkJs.account.spkVote(votes = {})

Implementation lacking. The api.getProtocol includes the allowed votable keys, the votes object should be checked against this as well as allowed as determined by the current values (getStats()).

Example: 

spkJs.account.spkVote({
    spk_cycle_length: "201000.000000",
    dex_fee: "0.006"
})


#### Validator Vote

Used for ranked choice validator voting. Each validator has a code used for voting, fill in up to 30 of these codes in an array and call this function. 

spkJs.account.valVote(votes = [])

#### Validator Register

This will register your SPK Node as a validator node, which will perform of chain actions such as requesting and verifying files stored on the network. Validator nodes can be voted on to increase the size of their lottery drawings / payout potential. Can also use to increase the fee burned to validator.

spkJs.account.validatorBurn(amount)

Amount in milliLarynx : INT
Amount must be >= stats.IPFSRate (spam filter)
Account must have registered SPK Network Node


### Options

### Set Custom API

spkJs.api.setSpkNode('https://spk-api.example.com')

spkJs.api.setHiveNode("https://api.hive.blog/")

### Raw API Calls

#### getStats

spkJs.api.getStats().then(r=>{
    console.log(r)
})

#### getAccount

spkJs.api.getAccount('disregardfiat').then(r=>{
    console.log(r)
})

#### getServicesByUser

spkJs.api.getServicesByUser('disregardfiat').then(r=>{
    console.log(r)
})

#### getServicesByType

spkJs.api.getServicesByType('IPFS').then(r=>{
    console.log(r)
})

#### getMirrors

spkJs.api.getMirrors().then(r=>{
    console.log(r)
})

#### getRunners

spkJs.api.getRunners().then(r=>{
    console.log(r)
})

#### getNodes

spkJs.api.getNodes().then(r=>{
    console.log(r)
})

#### getNodeReport

spkJs.api.getNodeReport('spk-test').then(r=>{
console.log(r)
})

#### getQueue

Depreciated
spkJs.api.getQueue().then(r=>{
    console.log(r)
})

#### getFeed

spkJs.api.getFeed().then(r=>{
    console.log(r)
})

#### getProtocol

spkJs.api.getProtocol().then(r=>{
    console.log(r)
})

#### getTxStatus

spkJs.api.getTxStatus('HiveTXID').then(r=>{
    console.log(r)
})

#### getFileContract

spkJs.api.getFileContract('contract:id').then(r=>{
    console.log(r)
})

#### getContractByFile

spkJs.api.getContractByFile('cid').then(r=>{
    console.log(r)
})

#### getDEX

spkJs.api.getDEX().then(r=>{
    console.log(r)
})

#### getTickers

spkJs.api.getTickers().then(r=>{
    console.log(r)
})

#### getOrderbook

spkJs.api.getOrderbook().then(r=>{
    console.log(r)
})

#### getDexHistory

spkJs.api.getDexHistory().then(r=>{
    console.log(r)
})

#### getPairs

spkJs.api.getPairs().then(r=>{
    console.log(r)
})

#### getOrderbookByPair

spkJs.api.getOrderbookByPair(pair).then(r=>{
    console.log(r)
})

#### getDexHistoryByPair

spkJs.api.getDexHistoryByPair(pair).then(r=>{
    console.log(r)
})

#### getRecentTrades

spkJs.api.getRecentTrades(pair).then(r=>{
    console.log(r)
})
