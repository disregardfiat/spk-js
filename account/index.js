import { config } from './../config.js'
import { api } from './../api/index.js'

class Account {
    constructor() {
        this.balance = 0
        this.claim = 0
        this.drop = 0
        this.poweredUp = 0
        this.granted = {}
        this.granting = {}
        this.heldCollateral = 0
        this.contracts = []
        this.channels = {}
        this.file_contracts = {}
        this.storage = {}
        this.pubKey = "NA"
        this.up = {}
        this.down = {}
        this.power_downs = {}
        this.gov_downs = {}
        this.gov = 0
        this.spk = 0
        this.spk_block = 0
        this.spk_power = 0
        this.spk_vote = {}
        this.stats = {}
        this.broca = "0,0"
        this.broca_now = 0
        this.tick = 0
        this.node = 0
        this.head_block = 0
        this.behind = 0
        if (config.account) {
            var promises = []
            promises.push(api.getAccount(config.account))
            promises.push(api.getStats())
            Promise.all(promises).then(res => {
                for (var key in res[0]) {
                    if (this[key] != null) this[key] = res[0][key]
                }
                this.spk = api.reward_spk(res[0], res[1])
                this.broca_now = api.broca_calc(this.broca, res[1].broca_refill, this.spk_power, this.head_block)
            })
        }
    }
    sendLarynx(amount, to, memo = "", test = false) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            api.checkAccount(to).then(res => {
                if (!res) throw new Error("Invalid account")
                if (this.balance < amount) throw new Error("Insufficient funds")
                var tx = {
                    from: config.account,
                    to: to,
                    amount: amount,
                    memo: memo
                }
                var op = [config.account, [[
                    "custom_json",
                    {
                        "required_auths": [
                            config.account
                        ],
                        "required_posting_auths": [],
                        "id": `spkcc_${test ? 'T' : ''}send`,
                        "json": JSON.stringify(tx)
                    }
                ]], "active"]
                config.broadcast(op).then(res => {
                    resolve(res)
                }).catch(err => {
                    reject(err)
                })
            }).catch(err => {
                reject(err)
            })
        })
    }
    sendSpk(amount, to, memo = "", test = false) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            api.checkAccount(to).then(res => {
                if (!res) throw new Error("Invalid account")
                if (this.spk < amount) throw new Error("Insufficient funds")
                var tx = {
                    from: config.account,
                    to: to,
                    amount: amount,
                    memo: memo
                }
                var op = [config.account, [[
                    "custom_json",
                    {
                        "required_auths": [
                            config.account
                        ],
                        "required_posting_auths": [],
                        "id": `spkcc_${test ? 'T' : ''}spk_send`,
                        "json": JSON.stringify(tx)
                    }
                ]], "active"]
                config.broadcast(op).then(res => {
                    resolve(res)
                }).catch(err => {
                    reject(err)
                })
            }).catch(err => {
                reject(err)
            })
        })
    }
    remove(item) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            var items = [], promises = []
            if (typeof item == "string") {
                items.push(item)
            } else if (item.length) {
                items = item
            }
            for (var i = 0; i < items.length; i++) {
                promises.push(api.getFileContract(items[i]))
            }
            Promise.all(promises).then(res => {
                var hasItems = []
                for (var i = 0; i < items.length; i++) {
                    for (var num in res[i].result?.n) {
                        if (res[i].result?.n[num] == config.account) {
                            hasItems.push(items[i])
                            break
                        }
                    }
                }
                var tx = {
                    items: hasItems
                }
                var op = [config.account, [[
                    "custom_json",
                    {
                        "required_auths": [
                            config.account
                        ],
                        "required_posting_auths": [],
                        "id": `spkcc_remove`,
                        "json": JSON.stringify(tx)
                    }
                ]], "active"]
                config.broadcast(op).then(res => {
                    resolve(res)
                }).catch(err => {
                    reject(err)
                })
            })
        })
    }
    registerAuthority(pubKey) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            if (pubKey) {
                if (typeof pubKey != "string" && pubKey.substr(0, 3) != "STM" && pubKey.length != 53) {
                    throw new Error("Invalid public key")
                    reject()
                } else {
                    finish(pubKey, resolve, reject)
                }
            } else {
                api.checkAccount(config.account).then(res => {
                    finish(res.posting.key_auths[0][0], resolve, reject)
                })
            }
            function finish(pubKey, resolve, reject) {
                var tx = {
                    pubKey
                }
                var op = [config.account, [[
                    "custom_json",
                    {
                        "required_auths": [
                            config.account
                        ],
                        "required_posting_auths": [],
                        "id": `spkcc_register_authority`,
                        "json": JSON.stringify(tx)
                    }
                ]], "active"]
                config.broadcast(op).then(res => {
                    resolve(res)
                }).catch(err => {
                    reject(err)
                })
            }
        })
    }
    Throw(reject = null) {
        if (config.broadcast == null) {
            throw new Error("Broadcast function not set")
            if (reject) reject()
        }
        if (!config.account) {
            throw new Error("Account not set")
            if (reject) reject()
        }
    }
    claim(gov = false) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            if (!this.claim) throw new Error("No claim available")
            if (gov) {
                gov = this.spknode?.lastGood ? true : false
            }
            var tx = {
                gov
            }
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": `spkcc_shares_claim`,
                    "json": JSON.stringify(tx)
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }

    channelOpen(broca, uploader, broker, benAmount = "", benAccount = "") {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            // ensure broker is registered... 
            api.checkAccount(uploader).then(res => {
                if (!res) throw new Error("Invalid account")
                var slots = '', contract = 0
                if (benAccount && benAmount) {
                    slots = `${benAccount},${benAmount}`
                    contract = 1
                }
                var op = [config.account, [[
                    "custom_json",
                    {
                        "required_auths": [
                            config.account
                        ],
                        "required_posting_auths": [],
                        "id": "spkcc_channel_open",
                        "json": `{\"broca\":\"${parseInt(broca)}\",\"broker\":\"${broker}\",\"to\":\"${uploader}\",\"contract\":\"${contract}\",\"slots\":\"${slots}\"}`
                    }
                ]], "active"]
                config.broadcast(op).then(res => {
                    resolve(res)
                }).catch(err => {
                    reject(err)
                })
            })
        })
    }
    extend(cid, fileOwner, broca, power = 0) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            // check account balance
            // check cid
            if (power) power = 1
            else power = 0
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_extend",
                    "json": `{\"broca\":${parseInt(broca)},\"id\":\"${cid}\",\"file_owner\":\"${fileOwner}\",\"power\":0}`
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    dexBuy(amount, rate = 0, type = " HIVE", hours = 720) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            // check account balance
            if (rate) rate = parseFloat(rate).toFixed(6)
            else rate = null
            var op = [config.account, [[
                "transfer",
                {
                    "to": "spk-cc",
                    "from": config.account,
                    "amount": parseFloat(amount / 1000).toFixed(3) + " " + type == "HBD" ? "HBD" : "HIVE",
                    "memo": JSON.stringify({
                        rate, hours
                    })
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    dexSell(amount, rate = 0, type = "HIVE", hours = 720) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            // check account balance
            if (rate) rate = parseInt(rate * amount)
            if (type != "HIVE") type = "hbd"
            else type = "hive"
            if (!hours) hours = 720
            else if (hours < 720) hours = parseInt(hours)
            if (hours < 1) hours = 720
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_dex_sell",
                    "json": `{\"larynx\":${amount},\"${type}\":${rate},\"hours\":${hours}}`
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    dexCancel(txid) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            if (!txid) return reject("No txid")
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_dex_clear",
                    "json": `{\"txid\":\"${txid}\"}`
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    registerService(type = "IPFS", id, api, amount = 2000) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            //check balance
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_register_service",
                    "json": `{\"amount\":${parseInt(amount)},\"type\":\"${type}\",\"id\":\"${id}\",\"api\":\"${api}\"}`
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    registerServiceType(type, amount, name) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            //check balance and cost
            // check new name
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_register_service_type",
                    "json": "{\"amount\":${parseInt(amount)},\"type\":\"${type}\",\"Long_Name\":\"${name}\"}"
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    powerGrant() {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            //check balance
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_power_down",
                    "json": `{\"amount\":${parseInt(amount)}}`
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    powerDown(amount = 0) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            //check balance
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_power_down",
                    "json": `{\"amount\":${parseInt(amount)}}`
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    powerUp(amount = 0) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            //check balance
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_power_up",
                    "json": `{\"amount\":${parseInt(amount)}}`
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    govUp(amount = 0) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            //check balance
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_gov_up",
                    "json": `{\"amount\":${parseInt(amount)}}`
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    govDown(amount = 0) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            //check balance
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_gov_down",
                    "json": `{\"amount\":${parseInt(amount)}}`
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    spkUp(amount = 0) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            //check balance
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_spk_up",
                    "json": `{\"amount\":${parseInt(amount)}}`
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    spkDown(amount = 0) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            //check balance
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_spk_down",
                    "json": `{\"amount\":${parseInt(amount)}}`
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    spkVote(votes = {}) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            // compare votes to allowed keys
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": "spkcc_spk_vote",
                    "json": JSON.stringify(votes)
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    store(item) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            var items = [], promises = []
            if (typeof item == "string") {
                items.push(item)
            } else if (item.length) {
                items = item
            }
            if (!items.length) throw new Error("No items to store")
            for (var i = 0; i < items.length; i++) {
                promises.push(api.getFileContract(items[i]))
            }
            Promise.all(promises).then(res => {
                var hasItems = []
                for (var i = 0; i < items.length; i++) {
                    for (var num in res[i].result?.n) {
                        if (res[i].result?.n[num] == config.account) {
                            hasItems.push(items[i])
                            break
                        }
                    }
                }
                for (var i = 0; i < hasItems.length; i++) {
                    var index = items.indexOf(hasItems[i])
                    if (index > -1) {
                        items.splice(index, 1)
                    }
                }
                var tx = {
                    items: items
                }
                if (!items.length) throw new Error("Already storing all items")
                var op = [config.account, [[
                    "custom_json",
                    {
                        "required_auths": [
                            config.account
                        ],
                        "required_posting_auths": [],
                        "id": `spkcc_store`,
                        "json": JSON.stringify(tx)
                    }
                ]], "active"]
                config.broadcast(op).then(res => {
                    resolve(res)
                }).catch(err => {
                    reject(err)
                })
            })
        })
    }
    valVote(votes = []) {
        return new Promise((resolve, reject) => {
            this.Throw(reject)
            if (!votes.length) throw new Error("No votes")
            if (votes.length > 30) throw new Error("Too many votes")
            for (var i = 0; i < votes.length; i++) {
                if (votes[i].length != 2) throw new Error("Invalid vote")
            }
            var tx = {
                votes: votes.join('')
            }
            if (!items.length) throw new Error("Already storing all items")
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": `spkcc_val_vote`,
                    "json": JSON.stringify(tx)
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    validatorBurn(amount) {
        return new Promise((resolve, reject) => {
            this.Throw()
            if (this.balance < amount) throw new Error("Insufficient funds")
            if (amount < this.stats.IPFSRate) throw new Error("Amount must be greater than IPFSRate")
            if (!this.spknode.lastGood) throw new Error("Account doesn't have operating SPK Node")
            var tx = {
                amount: amount
            }
            var op = [config.account, [[
                "custom_json",
                {
                    "required_auths": [
                        config.account
                    ],
                    "required_posting_auths": [],
                    "id": `spkcc_validator_burn`,
                    "json": JSON.stringify(tx)
                }
            ]], "active"]
            config.broadcast(op).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
            })
        })
    }
    setAccount(account) {
        return new Promise((resolve, reject) => {
            config.account = account
            var promises = []
            promises.push(api.getAccount(config.account))
            promises.push(api.getStats())
            Promise.all(promises).then(res => {
                for (var key in res[0]) {
                    if (this[key] != null) this[key] = res[0][key]
                }
                this.spknode = res[0].spknode
                this.stats = res[1].result
                this.spk_now = this.spk + (typeof api.reward_spk(res[0], this.stats) == "number" ? api.reward_spk(res[0], this.stats) : 0)
                this.broca_now = api.broca_calc(this.broca, this.stats.broca_refill, this.spk_power, this.head_block)
                resolve({
                    balance: this.balance,
                    claim: this.claim,
                    drop: this.drop,
                    poweredUp: this.poweredUp,
                    granted: this.granted,
                    granting: this.granting,
                    heldCollateral: this.heldCollateral,
                    contracts: this.contracts,
                    channels: this.channels,
                    file_contracts: this.file_contracts,
                    storage: this.storage,
                    pubKey: this.pubKey,
                    up: this.up,
                    down: this.down,
                    power_downs: this.power_downs,
                    gov_downs: this.gov_downs,
                    gov: this.gov,
                    spk: this.spk_now,
                    spk_block: this.spk_block,
                    spk_power: this.spk_power,
                    spk_vote: this.spk_vote,
                    stats: res[1].result,
                    broca: this.broca,
                    broca_now: this.broca_now,
                    tick: this.tick,
                    node: this.node,
                    spknode: this.spknode,
                    head_block: this.head_block,
                    behind: this.behind,
                })
            })
                .catch(err => {
                    reject(err)
                })
        })
    }
}

const account = new Account();

export { account }