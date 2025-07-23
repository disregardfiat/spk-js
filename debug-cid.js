#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const Hash = require('ipfs-only-hash');

async function testFile(filePath) {
  console.log(`\nTesting file: ${filePath}`);
  
  // Method 1: CLI ipfs-only-hash
  try {
    const cliCid = execSync(`npx ipfs-only-hash "${filePath}"`).toString().trim();
    console.log(`CLI ipfs-only-hash: ${cliCid}`);
  } catch (e) {
    console.log(`CLI error: ${e.message}`);
  }
  
  // Method 2: Read file and use ipfs-only-hash from Node
  const fileBuffer = await fs.promises.readFile(filePath);
  console.log(`File size: ${fileBuffer.length} bytes`);
  
  // Test different ways of calling Hash.of
  const cidDefault = await Hash.of(fileBuffer);
  console.log(`Hash.of(buffer): ${cidDefault}`);
  
  const cidV0 = await Hash.of(fileBuffer, { cidVersion: 0 });
  console.log(`Hash.of(buffer, {cidVersion: 0}): ${cidV0}`);
  
  const cidV1 = await Hash.of(fileBuffer, { cidVersion: 1 });
  console.log(`Hash.of(buffer, {cidVersion: 1}): ${cidV1}`);
  
  // Test with different buffer types
  const uint8Array = new Uint8Array(fileBuffer);
  const cidUint8 = await Hash.of(uint8Array);
  console.log(`Hash.of(Uint8Array): ${cidUint8}`);
  
  // Test with stream
  const stream = fs.createReadStream(filePath);
  const cidStream = await Hash.of(stream);
  console.log(`Hash.of(stream): ${cidStream}`);
}

// Test with a sample file or passed argument
const testFilePath = process.argv[2] || '/tmp/test.txt';

// Create a test file if it doesn't exist
if (!fs.existsSync(testFilePath) && testFilePath === '/tmp/test.txt') {
  fs.writeFileSync(testFilePath, 'Hello, IPFS!');
  console.log('Created test file with content: "Hello, IPFS!"');
}

testFile(testFilePath).catch(console.error);