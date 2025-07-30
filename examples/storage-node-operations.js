const SPK = require('@spknetwork/spk-js').default;

async function storageNodeExample() {
  // Initialize SPK with your username
  const spk = new SPK('myusername');
  await spk.init();

  try {
    // 1. Register as a storage node (if not already registered)
    // Note: You need to use registerNode from the main SPK instance
    const ipfsId = 'QmYourIPFSNodeId'; // Get this from `ipfs id`
    const domain = 'https://your-node.example.com';
    const bidRate = 500; // Your bid rate in LARYNX
    
    console.log('Registering node...');
    const nodeReg = await spk.registerNode(ipfsId, domain, bidRate);
    console.log('Node registered:', nodeReg);

    // 2. Check node status
    const status = await spk.getNodeStatus();
    console.log('Node status:', status);

    // 3. Find available contracts to store (under-replicated files)
    const available = await spk.getAvailableContracts(10);
    console.log(`Found ${available.length} contracts available for storage`);

    // 4. Store files (become a storage provider)
    if (available.length > 0) {
      const contractsToStore = available.slice(0, 3).map(c => c.id);
      console.log('Storing contracts:', contractsToStore);
      
      const storeResult = await spk.storeFiles(contractsToStore);
      console.log('Store result:', storeResult);
    }

    // 5. Check what contracts you're storing
    const storedContracts = await spk.getStoredContracts();
    console.log(`Currently storing ${storedContracts.length} contracts`);
    
    storedContracts.forEach(contract => {
      console.log(`- Contract ${contract.id}: ${contract.size} bytes, expires at block ${contract.expiryBlock}`);
    });

    // 6. Calculate potential earnings
    if (storedContracts.length > 0) {
      const contract = storedContracts[0];
      const earnings = spk.calculateStorageEarnings({
        size: contract.size,
        providers: contract.providers,
        duration: 28800 * 30 // 30 days in blocks
      });
      
      console.log('Potential earnings:', earnings);
    }

    // 7. Extend a contract with BROCA
    const contractToExtend = storedContracts[0];
    if (contractToExtend) {
      const extendResult = await spk.extendContract(
        contractToExtend.id,
        contractToExtend.owner,
        1000, // 1000 BROCA
        0 // No power
      );
      console.log('Contract extended:', extendResult);
    }

    // 8. Remove files from storage (stop being a provider)
    // Be careful - this stops you from earning rewards for these files!
    /*
    const contractsToRemove = ['contract1', 'contract2'];
    const removeResult = await spk.removeFiles(contractsToRemove);
    console.log('Remove result:', removeResult);
    */

    // 9. Register a public key authority (for advanced users)
    const pubKey = 'STM...'; // Your public key (53 characters)
    const authResult = await spk.registerAuthority(pubKey);
    console.log('Authority registered:', authResult);

    // 10. Batch store multiple contracts efficiently
    const manyContracts = available.map(c => c.id);
    if (manyContracts.length > 10) {
      const batchResult = await spk.batchStore(manyContracts, 5); // Process in chunks of 5
      console.log('Batch store result:', batchResult);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
storageNodeExample().catch(console.error);