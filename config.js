export var config = {
    account: '',
    node: 'https://hive-api.dlux.io',
    chain_id: 'beeab0de00000000000000000000000000000000000000000000000000000000',
    address_prefix: 'STM',
    spk_node: 'https://spktest.dlux.io',
    sign: function (op) {
      return new Promise((res, rej) => {
        console.log(op)
        window.hive_keychain.requestSignBuffer(
          op[0],
          `${op[0]}:${op[1]}`,
          op[2],
          (sig) => {
            if (sig.error) rej(sig);
            else res(sig.result);
          }
        );
      });
    },
    broadcast: function (op) {
      return new Promise((resolve, reject) => {
        if (window.hive_keychain) {
          if(typeof op[1] == "string") op[1] = JSON.parse(op[1])
          console.log(op)
          try {
            window.hive_keychain.requestBroadcast(
              op[0],
              op[1],
              op[2],
              function (response) {
                resolve(response);
              }
            );
          } catch (e) {
            reject(e);
          }
        } else {
          reject({ error: "Hive Keychain is not installed." }); //fallthrough?
        }
      });
    },
  }