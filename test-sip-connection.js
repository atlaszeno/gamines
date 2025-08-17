
const net = require('net');
const config = require('./config');

async function testSIPConnection() {
  console.log('🔍 Testing SIP server connectivity...');
  console.log(`🎯 Target: ${config.sip.host}:${config.sip.port}`);
  
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    
    const timeout = setTimeout(() => {
      socket.destroy();
      console.log('❌ Connection timeout - SIP server unreachable');
      reject(new Error('Connection timeout'));
    }, 5000);

    socket.connect(config.sip.port, config.sip.host, () => {
      clearTimeout(timeout);
      console.log('✅ SIP server is reachable');
      socket.destroy();
      resolve();
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`❌ Connection failed: ${err.message}`);
      reject(err);
    });
  });
}

// Run the test
testSIPConnection()
  .then(() => {
    console.log('✅ SIP connectivity test passed');
    process.exit(0);
  })
  .catch((error) => {
    console.log('❌ SIP connectivity test failed:', error.message);
    console.log('\n🔧 Possible solutions:');
    console.log('   1. Check if the SIP server IP/port is correct');
    console.log('   2. Verify firewall settings allow outbound SIP traffic');
    console.log('   3. Contact your SIP provider about IP whitelisting');
    process.exit(1);
  });
