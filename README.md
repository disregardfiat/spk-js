# spk-js
Library for interacting with SPK Network

Place .dist/spk-js.min.js in your HTML

`<script type="module" src="/spk-js.min.js"></script>`

### Options

### Set Custom API

spkJs.api.setSpkNode('https://spk-api.example.com')

### API Calls

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

#### getRunners

spkJs.api.getRunners().then(r=>{
    console.log(r)
})

#### getQueue

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
