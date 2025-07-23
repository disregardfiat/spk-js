#!/usr/bin/env node

const fs = require('fs');
const Hash = require('ipfs-only-hash');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testFileUpload(filePath) {
  console.log(`\nTesting file upload simulation for: ${filePath}`);
  
  // Read file exactly as spk-js does
  const fileBuffer = await fs.promises.readFile(filePath);
  console.log(`File size: ${fileBuffer.length} bytes`);
  
  // Calculate CID exactly as spk-js does
  const cid = await Hash.of(fileBuffer);
  console.log(`Calculated CID: ${cid}`);
  
  // Show what the server would receive
  console.log(`\nServer should receive:`);
  console.log(`- File with ${fileBuffer.length} bytes`);
  console.log(`- First 20 bytes:`, Array.from(fileBuffer.slice(0, 20)));
  console.log(`- Expected CID: ${cid}`);
  
  // Test FormData encoding
  const form = new FormData();
  form.append('chunk', fileBuffer);
  
  // Get the form boundary and headers
  const headers = form.getHeaders();
  console.log(`\nFormData headers:`, headers);
  
  // Show form details
  console.log(`FormData will encode the buffer with multipart boundaries`);
  console.log(`This adds headers that change the content!`);
}

// Test with provided file or create test file
const testFilePath = process.argv[2];
if (!testFilePath) {
  console.log('Usage: node test-upload-cid.js <filepath>');
  process.exit(1);
}

testFileUpload(testFilePath).catch(console.error);