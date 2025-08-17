
const net = require('net');
const dns = require('dns');
const { exec } = require('child_process');
const config = require('./config');

async function testDNSResolution() {
  console.log('🔍 Testing DNS resolution...');
  return new Promise((resolve) => {
    dns.lookup(config.sip.host, (err, address) => {
      if (err) {
        console.log(`❌ DNS resolution failed: ${err.message}`);
        resolve(false);
      } else {
        console.log(`✅ DNS resolved: ${config.sip.host} → ${address}`);
        resolve(true);
      }
    });
  });
}

async function testPing() {
  console.log('🏓 Testing ping connectivity...');
  return new Promise((resolve) => {
    exec(`ping -c 3 ${config.sip.host}`, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ Ping failed: ${error.message}`);
        resolve(false);
      } else {
        console.log('✅ Ping successful');
        console.log(stdout.split('\n').slice(-3, -1).join('\n'));
        resolve(true);
      }
    });
  });
}

async function testTCPConnection() {
  console.log('🔌 Testing TCP connection...');
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    const timeout = setTimeout(() => {
      socket.destroy();
      console.log('❌ TCP connection timeout');
      resolve(false);
    }, 10000);

    socket.connect(config.sip.port, config.sip.host, () => {
      clearTimeout(timeout);
      console.log('✅ TCP connection successful');
      socket.destroy();
      resolve(true);
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`❌ TCP connection failed: ${err.message}`);
      if (err.code === 'EHOSTUNREACH') {
        console.log('   🔍 EHOSTUNREACH: No route to host');
        console.log('   📍 This usually means:');
        console.log('      - The server is behind a firewall');
        console.log('      - The IP address is incorrect');
        console.log('      - Network routing issues');
      } else if (err.code === 'ECONNREFUSED') {
        console.log('   🔍 ECONNREFUSED: Connection actively refused');
        console.log('   📍 This usually means:');
        console.log('      - Server is not listening on this port');
        console.log('      - Service is down');
      } else if (err.code === 'ETIMEDOUT') {
        console.log('   🔍 ETIMEDOUT: Connection timed out');
        console.log('   📍 This usually means:');
        console.log('      - Firewall blocking the connection');
        console.log('      - Server is overloaded');
      }
      resolve(false);
    });
  });
}

async function testUDPConnection() {
  console.log('📡 Testing UDP SIP connection (port 5060)...');
  return new Promise((resolve) => {
    const dgram = require('dgram');
    const client = dgram.createSocket('udp4');
    
    const timeout = setTimeout(() => {
      client.close();
      console.log('❌ UDP test timeout - no response from SIP server');
      resolve(false);
    }, 5000);

    // Send a basic SIP OPTIONS request
    const sipMessage = `OPTIONS sip:${config.sip.host} SIP/2.0\r\n` +
                      `Via: SIP/2.0/UDP 0.0.0.0:5060;branch=z9hG4bK-test\r\n` +
                      `From: <sip:test@0.0.0.0>;tag=test\r\n` +
                      `To: <sip:${config.sip.host}>\r\n` +
                      `Call-ID: test@0.0.0.0\r\n` +
                      `CSeq: 1 OPTIONS\r\n` +
                      `Content-Length: 0\r\n\r\n`;

    client.send(sipMessage, config.sip.port, config.sip.host, (err) => {
      if (err) {
        clearTimeout(timeout);
        console.log(`❌ UDP send failed: ${err.message}`);
        client.close();
        resolve(false);
      } else {
        console.log('📤 SIP OPTIONS request sent');
      }
    });

    client.on('message', (msg, rinfo) => {
      clearTimeout(timeout);
      console.log('✅ SIP server responded!');
      console.log(`📥 Response from ${rinfo.address}:${rinfo.port}`);
      console.log(`📄 Response: ${msg.toString().split('\r\n')[0]}`);
      client.close();
      resolve(true);
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`❌ UDP error: ${err.message}`);
      client.close();
      resolve(false);
    });
  });
}

async function checkNetworkEnvironment() {
  console.log('🌐 Checking network environment...');
  
  // Check if we're in a restricted environment
  console.log(`📍 Target server: ${config.sip.host}:${config.sip.port}`);
  console.log(`🔧 SIP Username: ${config.sip.username}`);
  
  // Check for common network restrictions
  exec('curl -s ipinfo.io/ip', (error, stdout) => {
    if (!error) {
      console.log(`🌍 Our public IP: ${stdout.trim()}`);
      console.log('📝 Note: Many SIP providers require IP whitelisting');
    }
  });
}

async function runDiagnostics() {
  console.log('🔍 Running comprehensive SIP connection diagnostics...');
  console.log('='=50);
  
  await checkNetworkEnvironment();
  console.log('');
  
  const dnsOk = await testDNSResolution();
  console.log('');
  
  const pingOk = await testPing();
  console.log('');
  
  const tcpOk = await testTCPConnection();
  console.log('');
  
  const udpOk = await testUDPConnection();
  console.log('');
  
  console.log('📊 DIAGNOSTIC SUMMARY:');
  console.log('='=50);
  console.log(`DNS Resolution: ${dnsOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Ping Test: ${pingOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`TCP Connection: ${tcpOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`UDP SIP Test: ${udpOk ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\n🔧 RECOMMENDATIONS:');
  if (!dnsOk) {
    console.log('• Check if the hostname/IP address is correct');
  }
  if (!pingOk) {
    console.log('• Server may be behind a firewall that blocks ICMP');
  }
  if (!tcpOk) {
    console.log('• TCP connection failed - check firewall rules');
    console.log('• Verify the server is actually running on this IP:port');
  }
  if (!udpOk) {
    console.log('• SIP server may not be responding to OPTIONS requests');
    console.log('• Check if SIP service is running on the server');
    console.log('• Verify UDP port 5060 is open');
  }
  
  if (tcpOk || udpOk) {
    console.log('✅ Some connectivity exists - check SIP credentials');
  } else {
    console.log('❌ No connectivity - likely network/firewall issue');
  }
}

// Run the diagnostics
runDiagnostics()
  .then(() => {
    console.log('\n✅ Diagnostics completed');
    process.exit(0);
  })
  .catch((error) => {
    console.log('❌ Diagnostics failed:', error.message);
    process.exit(1);
  });
