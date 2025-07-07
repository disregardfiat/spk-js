/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
const express = require('express');
const cors = require('cors');
const Busboy = require('busboy');
const fs = require('fs-extra');
const IpfsOnlyHash = require('ipfs-only-hash');
const path = require('path');

class MockTroleServer {
  constructor(port = 3334) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.contracts = new Map();
    this.uploadedFiles = new Map();
    this.uploadsDir = path.join(__dirname, 'test-uploads');
    
    // Ensure uploads directory exists
    fs.ensureDirSync(this.uploadsDir);
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(cors());
  }
  
  setupRoutes() {
    // Contract creation endpoint
    this.app.post('/api/new_contract', (req, res) => {
      console.log('[Mock Trole] New contract request:', req.body);
      
      const contractId = `${req.body.username}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      res.json({
        id: contractId,
        t: req.body.username,
        s: req.body.s || 1000000, // Storage size
        e: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        r: 1000, // Block reference
        api: `http://localhost:${this.port}`
      });
    });
    
    // Upload authorization endpoint
    this.app.post('/upload-authorize', (req, res) => {
      console.log('[Mock Trole] Upload authorize request:', {
        headers: req.headers,
        body: req.body
      });
      
      // Extract required data
      const account = req.headers['x-account'];
      const sig = req.headers['x-sig'];
      const contract = req.headers['x-contract'];
      const cids = req.body.files;
      const meta = req.body.meta;
      
      // Basic validation
      if (!account || !sig || !contract || !cids || !meta) {
        return res.status(400).json({ message: 'Missing required data' });
      }
      
      // Store contract info (skip signature verification for testing)
      const contractData = {
        id: contract,
        account,
        cids: cids.split(',').filter(c => c), // Remove empty entries
        meta,
        sig,
        uploadedSizes: new Map()
      };
      
      this.contracts.set(contract, contractData);
      
      // Return authorized CIDs
      res.status(200).json({ 
        authorized: contractData.cids 
      });
    });
    
    // File upload endpoint
    this.app.post('/upload', (req, res) => {
      const contract = req.headers['x-contract'];
      const contentRange = req.headers['content-range'];
      const fileId = req.headers['x-cid'];
      
      console.log('[Mock Trole] Upload request:', {
        contract,
        contentRange,
        fileId
      });
      
      // Validate headers
      if (!contract || !contentRange || !fileId) {
        return res.status(400).json({ 
          message: 'Missing required headers' 
        });
      }
      
      // Parse content range
      const match = contentRange.match(/bytes=(\d+)-(\d+)\/(\d+)/);
      if (!match) {
        return res.status(400).json({ 
          message: 'Invalid Content-Range format' 
        });
      }
      
      const rangeStart = Number(match[1]);
      const rangeEnd = Number(match[2]);
      const fileSize = Number(match[3]);
      
      // Setup busboy for multipart parsing
      const busboy = Busboy({ headers: req.headers });
      const filePath = path.join(this.uploadsDir, `${fileId}-${contract}`);
      
      busboy.on('file', async (name, file) => {
        console.log(`[Mock Trole] Receiving file chunk: ${fileId}, bytes ${rangeStart}-${rangeEnd}`);
        
        try {
          // Check if file exists
          const fileExists = await fs.pathExists(filePath);
          
          if (!fileExists && rangeStart !== 0) {
            return res.status(401).json({ 
              message: 'No file with such credentials' 
            });
          }
          
          if (fileExists) {
            const stats = await fs.stat(filePath);
            if (stats.size !== rangeStart) {
              return res.status(403).json({
                message: 'Bad chunk provided',
                startByte: rangeStart,
                haveByte: stats.size
              });
            }
          }
          
          // Write chunk to file
          const writeStream = fs.createWriteStream(filePath, {
            flags: rangeStart === 0 ? 'w' : 'a'
          });
          
          file.pipe(writeStream);
          
          writeStream.on('finish', async () => {
            console.log(`[Mock Trole] Chunk written for ${fileId}`);
            
            // Check if file is complete
            const stats = await fs.stat(filePath);
            if (stats.size === fileSize) {
              // Verify CID
              const fileBuffer = await fs.readFile(filePath);
              const calculatedCid = await IpfsOnlyHash.of(fileBuffer);
              
              if (calculatedCid === fileId) {
                console.log(`[Mock Trole] File upload complete and verified: ${fileId}`);
                this.uploadedFiles.set(fileId, {
                  contract,
                  size: fileSize,
                  path: filePath,
                  verified: true
                });
                
                // Update contract
                const contractData = this.contracts.get(contract);
                if (contractData) {
                  contractData.uploadedSizes.set(fileId, fileSize);
                }
                
                res.status(200).json({ 
                  status: 200,
                  message: 'File verified and queued for IPFS upload' 
                });
              } else {
                console.log(`[Mock Trole] CID verification failed: expected ${fileId}, got ${calculatedCid}`);
                await fs.remove(filePath);
                res.status(412).json({ 
                  message: 'CID Verification Failed' 
                });
              }
            } else {
              // Chunk received, continue
              res.status(200).json({ 
                status: 200,
                message: 'Chunk received' 
              });
            }
          });
          
          writeStream.on('error', (err) => {
            console.error('[Mock Trole] Write error:', err);
            res.status(500).json({ 
              message: 'Failed to write chunk' 
            });
          });
          
        } catch (err) {
          console.error('[Mock Trole] Upload error:', err);
          res.status(500).json({ 
            message: 'Upload processing error' 
          });
        }
      });
      
      busboy.on('error', (err) => {
        console.error('[Mock Trole] Busboy error:', err);
        res.status(500).json({ 
          message: 'Upload parsing error' 
        });
      });
      
      req.pipe(busboy);
    });
    
    // Contract status endpoint
    this.app.get('/upload-contract', (req, res) => {
      const contractId = req.query.id;
      const contract = this.contracts.get(contractId);
      
      if (!contract) {
        return res.status(404).json({ 
          message: 'Contract not found' 
        });
      }
      
      res.json({
        id: contract.id,
        account: contract.account,
        cids: contract.cids,
        meta: contract.meta,
        uploaded: Array.from(contract.uploadedSizes.keys())
      });
    });
    
    // Upload stats endpoint
    this.app.get('/upload-stats', (req, res) => {
      res.json({
        contracts: this.contracts.size,
        files: this.uploadedFiles.size,
        node: 'mock-trole',
        api: `http://localhost:${this.port}`
      });
    });
  }
  
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`[Mock Trole] Server listening on port ${this.port}`);
        resolve();
      });
    });
  }
  
  async stop() {
    // Clean up uploaded files
    await fs.remove(this.uploadsDir);
    
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[Mock Trole] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
  
  getUploadedFiles() {
    return Array.from(this.uploadedFiles.entries()).map(([cid, data]) => ({
      cid,
      ...data
    }));
  }
  
  getContracts() {
    return Array.from(this.contracts.entries()).map(([id, data]) => ({
      id,
      ...data,
      uploadedSizes: Array.from(data.uploadedSizes.entries())
    }));
  }
}

module.exports = MockTroleServer;