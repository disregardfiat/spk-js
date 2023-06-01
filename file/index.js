const Hash = require('ipfs-only-hash')
import { config } from './../config.js'
import { api } from './../api/index.js'

class file {
    constructor() {
        this.contract = {
            api: '',
            id: '',
            sigs: {},
            s: 0,
            t: 0
        }
        this.troleBroker = ''
        this.troleIndex = 0
        this.troleQty = 1
        this.troleFree = 0
        this.bytes = 16
        this.cids = []
        this.FileInfo = {}
        this.Files = []
    }
    
    selectTroleAPI(broker) {
      api.getServicesByUser(broker).then(res => {
        this.troleQty = res?.services?.s?.i.split('IPFS:')[1].split(',').length
        this.contract.api = res?.services?.IPFS[res?.services?.s?.i.split('IPFS:')[1].split(',')[this.troleIndex]].api
        fetch(`${this.contract.api}/upload-stats`).then(res => res.json()).then(res => {
          if(res?.node == broker) {
            this.troleFree = res?.free || 0
            this.troleBroker = broker
          }
        })
        //poll all trole nodes for free space, select largest... select lowest latency?
      })
    }
    selectContract(id) {
      api.getFileContract(id).then(res => {
        this.troleQty = res?.services?.s?.i.split('IPFS:')[1].split(',').length
        this.contract.api = res?.services?.IPFS[res?.services?.s?.i.split('IPFS:')[1].split(',')[this.troleIndex]].api
        fetch(`${this.contract.api}/upload-stats`).then(res => res.json()).then(res => {
          if(res?.node == broker) {
            this.troleFree = res?.free || 0
            this.troleBroker = broker
          }
        })
        //poll all trole nodes for free space, select largest... select lowest latency?
      })
    }
    signFiles() {
      var header = `${this.contract.id}`
      var body = ""
      var names = Object.keys(this.FileInfo)
      var cids = []
      for (var i = 0; i < names.length; i++) {
        body += `,${this.FileInfo[names[i]].hash}`
        cids.push(this.FileInfo[names[i]].hash)
      }
      this.contract.files = body
      return header + body
      // this.signText(header + body).then(res => {
      //   console.log({ res })
      //   this.contract.fosig = res.split(":")[3]
      //   this.upload(cids, this.contract)
      // })
    }
    upload(cids = ['QmYJ2QP58rXFLGDUnBzfPSybDy3BnKNsDXh6swQyH7qim3'], contract = { api: 'https://ipfs.dlux.io', id: '1668913215284', sigs: {}, s: 10485760, t: 0 }) {
      var files = []
      for (var name in this.FileInfo) {
        for (var i = 0; i < cids.length; i++) {
          if (this.FileInfo[name].hash == cids[i]) {
            this.Files[this.FileInfo[name].index].cid = cids[i]
            files.push(this.Files[this.FileInfo[name].index])
            break;
          }
        }
      }
      console.log({ cids }, files)
      const ENDPOINTS = {
        UPLOAD: `${this.contract.api}/upload`,
        UPLOAD_STATUS: `${this.contract.api}/upload-check`,
        UPLOAD_REQUEST: `${this.contract.api}/upload-authorize`
      };
      const defaultOptions = {
        url: ENDPOINTS.UPLOAD,
        startingByte: 0,
        contract: contract,
        cid: null,
        cids: `${cids.join(',')}`,
        onAbort: (e, f) => {
          console.log('options.onAbort')
          this.Files = []
          this.FileInfo = {}
          this.fileRequests = {}
        },
        onProgress: (e, f) => {
          console.log('options.onProgress', e, f, this.FileInfo, this.Files, this.Files[this.FileInfo[f.name].index])
          this.Files[this.FileInfo[f.name].index].actions.pause = true
          this.Files[this.FileInfo[f.name].index].actions.resume = false
          this.Files[this.FileInfo[f.name].index].actions.cancel = true
          this.Files[this.FileInfo[f.name].index].progress = e.loaded / e.total * 100
          this.FileInfo[f.name].status = 'uploading'
        },
        onError: (e, f) => {
          console.log('options.onError', e, f)
          this.FileInfo[f.name].status = '!!ERROR!!'
          this.Files[this.FileInfo[f.name].index].actions.pause = false
          this.Files[this.FileInfo[f.name].index].actions.resume = true
          this.Files[this.FileInfo[f.name].index].actions.cancel = true
        },
        onComplete: (e, f) => {
          console.log('options.onComplete', e, f)
          this.Files[this.FileInfo[f.name].index].actions.pause = false
          this.Files[this.FileInfo[f.name].index].actions.resume = false
          this.Files[this.FileInfo[f.name].index].actions.cancel = false
          this.FileInfo[f.name].progress = 1
          this.FileInfo[f.name].status = 'done'

        }
      };
      const uploadFileChunks = (file, options) => {
        const formData = new FormData();
        const req = new XMLHttpRequest();
        const chunk = file.slice(options.startingByte);

        formData.append('chunk', chunk);
        console.log(options)
        req.open('POST', options.url, true);
        req.setRequestHeader(
          'Content-Range', `bytes=${options.startingByte}-${options.startingByte + chunk.size}/${file.size}`
        );
        req.setRequestHeader('X-Cid', options.cid);
        req.setRequestHeader('X-Contract', options.contract.id);
        req.setRequestHeader('X-Sig', options.contract.fosig);
        req.setRequestHeader('X-Account', this.account);
        req.setRequestHeader('X-Files', options.cids);


        req.onload = (e) => {
          if (req.status === 200) {
            options.onComplete(e, file);
          } else {
            options.onError(e, file);
          }
        };

        req.upload.onprogress = (e) => {
          const loaded = options.startingByte + e.loaded;
          options.onProgress({
            ...e,
            loaded,
            total: file.size,
            percentage: loaded / file.size * 100
          }, file);
        };

        req.ontimeout = (e) => options.onError(e, file);

        req.onabort = (e) => options.onAbort(e, file);

        req.onerror = (e) => options.onError(e, file);

        this.fileRequests[options.cid].request = req;

        req.send(formData);
      };
      const uploadFile = (file, options, cid) => {
        console.log('Uploading', cid, options, file)
        return fetch(ENDPOINTS.UPLOAD_REQUEST, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Sig': options.contract.fosig,
            'X-Account': this.account,
            'X-Contract': options.contract.id,
            'X-Cid': cid,
            'X-Files': options.contract.files,
            'X-Chain': 'HIVE'
          }
        })
          .then(res => res.json())
          .then(res => {
            console.log('Chunking', options, file)
            options = { ...options, ...res };
            options.cid = cid
            this.fileRequests[cid] = { request: null, options }
            uploadFileChunks(file, options);
          })
          .catch(e => {
            console.log(e)
            options.onError({ ...e, file })
          })
      };
      const abortFileUpload = (file) => {
        const fileReq = fileRequests.get(file);

        if (fileReq && fileReq.request) {
          fileReq.request.abort();
          return true;
        }

        return false;
      };
      const retryFileUpload = (file) => {
        const fileReq = fileRequests.get(file);

        if (fileReq) {
          // try to get the status just in case it failed mid upload
          return fetch(
            `${ENDPOINTS.UPLOAD_STATUS}?fileName=${file.name}&fileId=${fileReq.options.fileId}`)
            .then(res => res.json())
            .then(res => {
              // if uploaded we continue
              uploadFileChunks(
                file,
                {
                  ...fileReq.options,
                  startingByte: Number(res.totalChunkUploaded)
                }
              );
            })
            .catch(() => {
              // if never uploaded we start
              uploadFileChunks(file, fileReq.options)
            })
        }
      };
      const clearFileUpload = (file) => {
        const fileReq = fileRequests.get(file);

        if (fileReq) {
          abortFileUpload(file)
          fileRequests.delete(file);

          return true;
        }

        return false;
      };
      const resumeFileUpload = (file) => {
        const fileReq = this.fileRequests[cid];

        if (fileReq) {
          return fetch(
            `${ENDPOINTS.UPLOAD_STATUS}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'sig': contract.fosig,
              'account': this.account,
              'contract': contract.id,
              'cid': cid
            }
          })
            .then(res => res.json())
            .then(res => {
              uploadFileChunks(
                file,
                {
                  ...fileReq.options,
                  startingByte: Number(res.totalChunkUploaded)
                }
              );
            })
            .catch(e => {
              fileReq.options.onError({ ...e, file })
            })
        }
      };
      [...files]
        .forEach(file => {
          let options = defaultOptions
          options.cid = file.cid
          uploadFile(file, options, file.cid)
        });
    }
}

export { file }