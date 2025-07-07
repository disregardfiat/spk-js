// Example: Token Operations with SPK-JS

const SPK = require('../dist/spk-js.cjs.js');

async function main() {
  try {
    // Initialize SPK with test account
    const spk = new SPK.default('testuser', {
      node: 'https://spktest.dlux.io'
    });

    console.log('Initializing SPK account...');
    await spk.init();

    // Get extended balances
    console.log('\nFetching token balances...');
    const balances = await spk.getBalances();
    console.log('Balances:', {
      LARYNX: balances.larynx,
      SPK: balances.spk,
      BROCA: balances.broca,
      'Claimable LARYNX': balances.ClaimableLARYNX,
      'Claimable SPK': balances.ClaimableSPK,
      'LARYNX Power': balances.LP,
      'SPK Power': balances.SP,
      'BROCA Power': balances.BP,
      'BROCA (Storage)': balances.BRC
    });

    // Example: Send tokens using amount string format
    console.log('\nToken send examples (not executed):');
    
    // Send using amount string format
    console.log('- spk.send("50.000 BROCA", "recipient")');
    console.log('- spk.send("10.123 LARYNX", "recipient", "Payment for services")');
    console.log('- spk.send("5.500 SPK", "recipient")');
    
    // Send using specific methods (in millitokens)
    console.log('\nDirect send methods (millitokens):');
    console.log('- spk.sendLarynx(10000, "recipient") // 10.000 LARYNX');
    console.log('- spk.sendSpk(5000, "recipient") // 5.000 SPK');
    console.log('- spk.sendBroca(1000000, "recipient") // 1MB BROCA');

    // Power operations
    console.log('\nPower operations:');
    console.log('- spk.powerUp(1000) // Power up 1.000 LARYNX');
    console.log('- spk.powerDown(500) // Power down 0.500 LARYNX');
    console.log('- spk.brocaPowerUp(1000000) // Power up 1MB BROCA');
    console.log('- spk.spkPowerDown(2000) // Power down 2.000 SPK');

    // Claim operations
    console.log('\nClaim operations:');
    console.log('- spk.claim("LARYNX") // Claim LARYNX rewards');
    console.log('- spk.claim("SPK") // Claim SPK rewards');

    // Node registration
    console.log('\nNode registration:');
    console.log('- spk.registerNode("QmNodeId...", "https://mynode.com", 500, 100)');

    // Protocol information
    console.log('\nProtocol configurations:');
    const protocol = spk.protocol || (spk as any).protocol;
    if (protocol) {
      const larynxProtocol = protocol.getProtocol('LARYNX');
      const spkProtocol = protocol.getProtocol('SPK');
      const brocaProtocol = protocol.getProtocol('BROCA');

      console.log('LARYNX:', {
        precision: larynxProtocol?.precision,
        prefix: larynxProtocol?.jsonPrefix,
        multisig: larynxProtocol?.multisig
      });
      console.log('SPK:', {
        precision: spkProtocol?.precision,
        prefix: spkProtocol?.jsonPrefix,
        multisig: spkProtocol?.multisig
      });
      console.log('BROCA:', {
        precision: brocaProtocol?.precision,
        prefix: brocaProtocol?.jsonPrefix,
        multisig: brocaProtocol?.multisig
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
main();