#!/usr/bin/env node

const fs = require('fs');
const Hash = require('ipfs-only-hash');

// This mimics what the server does
async function serverCidCalculation(filePath) {
  // Server reads the uploaded file from disk
  const fileBuffer = await fs.promises.readFile(filePath);
  
  // Server uses ipfs-only-hash directly
  const calculatedCid = await Hash.of(fileBuffer);
  
  console.log(`Server would calculate CID: ${calculatedCid}`);
  console.log(`File size: ${fileBuffer.length} bytes`);
  console.log(`First 20 bytes:`, Array.from(fileBuffer.slice(0, 20)));
  
  return calculatedCid;
}

// Compare with what client calculates
async function clientCidCalculation(filePath) {
  // Client reads file
  const fileBuffer = await fs.promises.readFile(filePath);
  
  // Client calculates CID
  const cid = await Hash.of(fileBuffer);
  
  console.log(`Client calculated CID: ${cid}`);
  console.log(`File size: ${fileBuffer.length} bytes`);
  
  return cid;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: node verify-server-cid.js <filepath>');
    process.exit(1);
  }
  
  console.log(`\nVerifying CID for: ${filePath}\n`);
  
  const clientCid = await clientCidCalculation(filePath);
  console.log('');
  const serverCid = await serverCidCalculation(filePath);
  
  console.log(`\nCIDs match: ${clientCid === serverCid}`);
  if (clientCid !== serverCid) {
    console.log('ERROR: CID mismatch! The file content is different.');
  }
}

main().catch(console.error);