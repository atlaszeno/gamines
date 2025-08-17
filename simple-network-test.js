
const net = require('net');

const servers = [
  { host: '162.33.178.85', port: 5060, name: 'MagnusBilling SIP' },
  { host: '8.8.8.8', port: 53, name: 'Google DNS (control test)' },
  { host: '1.1.1.1', port: 53, name: 'Cloudflare DNS (control test)' }
];

async function testConnection(server) {
  return new Promise((resolve) => {
    console.log(`Testing ${server.name} (${server.host}:${server.port})...`);
    
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      console.log(`❌ ${server.name}: TIMEOUT`);
      resolve(false);
    }, 5000);

    socket.connect(server.port, server.host, () => {
      clearTimeout(timeout);
      console.log(`✅ ${server.name}: CONNECTED`);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`❌ ${server.name}: ${err.code || err.message}`);
      resolve(false);
    });
  });
}

async function runTests() {
  console.log('🔍 Testing network connectivity to various servers...\n');
  
  for (const server of servers) {
    await testConnection(server);
    console.log('');
  }
  
  console.log('Note: If Google/Cloudflare work but MagnusBilling fails,');
  console.log('the issue is likely with the SIP server or firewall rules.');
}

runTests();
