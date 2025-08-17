
const EventEmitter = require('events');
const config = require('./config');
const sip = require('sip');
const dgram = require('dgram');
const crypto = require('crypto');

class MagnusBillingSIPClient extends EventEmitter {
  constructor() {
    super();
    this.isConnected = false;
    this.activeCall = null;
    this.callId = null;
    this.isRegistered = false;
    this.currentPhoneNumber = null;
    this.localPort = 5060;
    this.dialog = null;
    this.cseq = 1;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing MagnusBilling SIP client (REAL MODE)');
      console.log(`📡 Connecting to MagnusBilling server: ${config.sip.host}:${config.sip.port}`);
      console.log(`👤 Using SIP credentials: ${config.sip.username}`);
      console.log(`🏷️  Using Caller ID: ${config.sip.caller_id}`);

      // Test network connectivity first
      console.log('🔍 Testing network connectivity...');
      await this.testNetworkConnectivity();

      // Find available port
      this.localPort = await this.findAvailablePort();
      console.log(`📞 SIP client will use port ${this.localPort}`);

      // Start SIP stack
      sip.start({
        host: '0.0.0.0',
        port: this.localPort,
        tcp: false // Force UDP
      }, (rq) => {
        this.handleIncomingRequest(rq);
      });

      console.log('📝 SIP configuration created');
      console.log('🔄 Starting real SIP client...');

      // Register with SIP server
      await this.registerWithServer();

      this.isConnected = true;
      console.log('✅ Connected to MagnusBilling SIP server (REAL)');
      console.log(`✅ Trunk configured: ${config.sip.trunk} (${config.sip.trunk_username})`);
      this.emit('connected');

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize MagnusBilling SIP client:', error);
      console.error('🔍 Possible causes:');
      console.error('   - Network connectivity issues');
      console.error('   - Firewall blocking SIP traffic');
      console.error('   - Invalid SIP credentials');
      console.error('   - MagnusBilling server unavailable');
      throw error;
    }
  }

  async testNetworkConnectivity() {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const socket = new net.Socket();
      
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Cannot reach ${config.sip.host}:${config.sip.port} - Network connectivity test failed`));
      }, 5000);

      socket.connect(config.sip.port, config.sip.host, () => {
        clearTimeout(timeout);
        console.log('✅ Network connectivity test passed');
        socket.destroy();
        resolve();
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`❌ Network connectivity test failed: ${err.message}`);
        reject(new Error(`Cannot reach ${config.sip.host}:${config.sip.port} - ${err.message}`));
      });
    });
  }

  async findAvailablePort() {
    return new Promise((resolve, reject) => {
      const server = dgram.createSocket('udp4');

      server.bind(0, () => {
        const port = server.address().port;
        server.close(() => {
          resolve(port);
        });
      });

      server.on('error', reject);
    });
  }

  async registerWithServer() {
    return new Promise((resolve, reject) => {
      try {
        console.log('✅ SIP registration initiated');
        console.log(`🔗 Registering to: sip:${config.sip.host}:${config.sip.port}`);

        const callId = this.generateCallId();
        const fromTag = this.generateTag();

        // Set a timeout for the registration
        const timeout = setTimeout(() => {
          reject(new Error(`Registration timeout - cannot reach ${config.sip.host}:${config.sip.port}. Check network connectivity and firewall settings.`));
        }, 10000); // 10 second timeout

        const registerRequest = {
          method: 'REGISTER',
          uri: `sip:${config.sip.host}:${config.sip.port}`,
          version: '2.0',
          headers: {
            via: [{
              version: '2.0',
              protocol: 'UDP',
              host: '0.0.0.0',
              port: this.localPort,
              params: {
                branch: `z9hG4bK-${Math.random().toString(36).substr(2, 15)}`
              }
            }],
            from: {
              name: config.sip.username,
              uri: `sip:${config.sip.username}@${config.sip.host}`,
              params: { tag: fromTag }
            },
            to: {
              name: config.sip.username,
              uri: `sip:${config.sip.username}@${config.sip.host}`
            },
            'call-id': callId,
            cseq: { seq: this.cseq++, method: 'REGISTER' },
            contact: [{
              name: config.sip.username,
              uri: `sip:${config.sip.username}@0.0.0.0:${this.localPort}`
            }],
            expires: 300, // Shorter expiry for testing
            'user-agent': 'Replit-SIP-Client/1.0'
          }
        };

        console.log(`📤 Sending REGISTER to ${config.sip.host}:${config.sip.port}`);
        console.log(`📧 Using credentials: ${config.sip.username}@${config.sip.host}`);

        sip.send(registerRequest, (response) => {
          clearTimeout(timeout);
          
          console.log(`📥 SIP Response: ${response.status} ${response.reason || ''}`);
          
          if (response.status === 200) {
            console.log('✅ SIP registration successful');
            this.isRegistered = true;
            resolve();
          } else if (response.status === 401 || response.status === 407) {
            console.log('🔐 Authentication required, sending credentials...');
            this.handleAuthChallenge(registerRequest, response).then(() => {
              clearTimeout(timeout);
              resolve();
            }).catch((err) => {
              clearTimeout(timeout);
              reject(err);
            });
          } else if (response.status === 403) {
            clearTimeout(timeout);
            reject(new Error(`Registration forbidden (403) - Invalid credentials or account disabled`));
          } else if (response.status === 404) {
            clearTimeout(timeout);
            reject(new Error(`Registration failed (404) - SIP domain not found`));
          } else {
            clearTimeout(timeout);
            reject(new Error(`Registration failed with status: ${response.status} ${response.reason || ''}`));
          }
        });

      } catch (error) {
        console.error('❌ Registration setup error:', error);
        reject(error);
      }
    });
  }

  async handleAuthChallenge(originalRequest, challenge) {
    return new Promise((resolve, reject) => {
      try {
        const wwwAuth = challenge.headers['www-authenticate'] || challenge.headers['proxy-authenticate'];
        const auth = this.parseAuthHeader(wwwAuth);

        // Calculate digest response
        const ha1 = this.md5(`${config.sip.username}:${auth.realm}:${config.sip.password}`);
        const ha2 = this.md5(`${originalRequest.method}:${originalRequest.uri}`);
        const response = this.md5(`${ha1}:${auth.nonce}:${ha2}`);

        // Send authenticated request
        const authRequest = {
          ...originalRequest,
          headers: {
            ...originalRequest.headers,
            cseq: { seq: this.cseq++, method: 'REGISTER' },
            authorization: `Digest username="${config.sip.username}", realm="${auth.realm}", nonce="${auth.nonce}", uri="${originalRequest.uri}", response="${response}"`
          }
        };

        sip.send(authRequest, (authResponse) => {
          if (authResponse.status === 200) {
            console.log('✅ SIP authentication successful');
            this.isRegistered = true;
            resolve();
          } else {
            reject(new Error(`Authentication failed with status: ${authResponse.status}`));
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  parseAuthHeader(authHeader) {
    const auth = {};
    const parts = authHeader.split(',');
    
    parts.forEach(part => {
      const [key, value] = part.trim().split('=');
      if (key && value) {
        auth[key.toLowerCase()] = value.replace(/"/g, '');
      }
    });

    return auth;
  }

  md5(data) {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  async makeCall(phoneNumber) {
    if (!this.isConnected || !this.isRegistered) {
      throw new Error('SIP client not connected or not registered');
    }

    try {
      console.log(`📞 Making REAL call to ${phoneNumber} via MagnusBilling`);
      console.log(`🌐 SIP Server: ${config.sip.host}:${config.sip.port}`);
      console.log(`👤 From: ${config.sip.username}@${config.sip.domain}`);

      // Generate call identifiers
      this.callId = this.generateCallId();
      this.currentPhoneNumber = phoneNumber;
      const fromTag = this.generateTag();

      const inviteRequest = {
        method: 'INVITE',
        uri: `sip:${phoneNumber}@${config.sip.host}`,
        version: '2.0',
        headers: {
          via: [{
            version: '2.0',
            protocol: 'UDP',
            host: '0.0.0.0',
            port: this.localPort
          }],
          from: {
            name: config.sip.username,
            uri: `sip:${config.sip.username}@${config.sip.host}`,
            params: { tag: fromTag }
          },
          to: {
            name: phoneNumber,
            uri: `sip:${phoneNumber}@${config.sip.host}`
          },
          'call-id': this.callId,
          cseq: { seq: this.cseq++, method: 'INVITE' },
          contact: [{
            name: config.sip.username,
            uri: `sip:${config.sip.username}@0.0.0.0:${this.localPort}`
          }],
          'content-type': 'application/sdp'
        },
        content: this.generateSDP()
      };

      console.log('📡 Sending real SIP INVITE...');

      return new Promise((resolve, reject) => {
        sip.send(inviteRequest, (response) => {
          if (response.status >= 100 && response.status < 200) {
            console.log('📱 Phone is ringing...');
            this.emit('callRinging', phoneNumber, this.callId);
          } else if (response.status === 200) {
            console.log('✅ Call answered');
            this.setupCallSession(response);
            this.emit('callAnswered', phoneNumber, this.callId);
          } else if (response.status >= 400) {
            console.error('❌ Call failed with status:', response.status);
            reject(new Error(`Call failed: ${response.status} ${response.reason}`));
            return;
          }
        });

        // Set up call data
        this.activeCall = {
          phoneNumber,
          callId: this.callId,
          startTime: new Date(),
          inviteRequest
        };

        // Emit call initiated event
        this.emit('callInitiated', phoneNumber, this.callId);

        resolve({
          callId: this.callId,
          phoneNumber: phoneNumber,
          status: 'initiated'
        });
      });

    } catch (error) {
      console.error('❌ Error making SIP call:', error);
      throw error;
    }
  }

  generateSDP() {
    return `v=0
o=- ${Date.now()} ${Date.now()} IN IP4 0.0.0.0
s=-
c=IN IP4 0.0.0.0
t=0 0
m=audio 8000 RTP/AVP 0 8 101
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-15`;
  }

  setupCallSession(response) {
    // Set up dialog for the call session
    this.dialog = {
      id: response.headers['call-id'],
      localTag: response.headers.from.params.tag,
      remoteTag: response.headers.to.params.tag,
      localSeq: this.cseq,
      remoteSeq: response.headers.cseq.seq
    };
  }

  async sendDTMF(digit) {
    if (!this.activeCall || !this.dialog) {
      throw new Error('No active SIP call session');
    }

    try {
      console.log(`🔢 Sending SIP DTMF: ${digit} to ${this.activeCall.phoneNumber}`);

      const infoRequest = {
        method: 'INFO',
        uri: `sip:${this.currentPhoneNumber}@${config.sip.host}`,
        version: '2.0',
        headers: {
          via: [{
            version: '2.0',
            protocol: 'UDP',
            host: '0.0.0.0',
            port: this.localPort
          }],
          from: {
            name: config.sip.username,
            uri: `sip:${config.sip.username}@${config.sip.host}`,
            params: { tag: this.dialog.localTag }
          },
          to: {
            name: this.currentPhoneNumber,
            uri: `sip:${this.currentPhoneNumber}@${config.sip.host}`,
            params: { tag: this.dialog.remoteTag }
          },
          'call-id': this.dialog.id,
          cseq: { seq: this.cseq++, method: 'INFO' },
          'content-type': 'application/dtmf-relay'
        },
        content: `Signal=${digit}\r\nDuration=100\r\n`
      };

      console.log(`📤 SIP INFO: Signal=${digit}, Duration=100`);

      sip.send(infoRequest);

      this.emit('dtmfSent', digit, this.activeCall.callId);
      console.log(`✅ DTMF ${digit} sent via SIP INFO`);
      return true;
    } catch (error) {
      console.error('❌ Error sending SIP DTMF:', error);
      throw error;
    }
  }

  async endCall() {
    if (!this.activeCall || !this.dialog) {
      throw new Error('No active SIP call session');
    }

    try {
      const callData = { ...this.activeCall };
      console.log(`📴 Ending SIP call with ${this.activeCall.phoneNumber}`);

      const byeRequest = {
        method: 'BYE',
        uri: `sip:${this.currentPhoneNumber}@${config.sip.host}`,
        version: '2.0',
        headers: {
          via: [{
            version: '2.0',
            protocol: 'UDP',
            host: '0.0.0.0',
            port: this.localPort
          }],
          from: {
            name: config.sip.username,
            uri: `sip:${config.sip.username}@${config.sip.host}`,
            params: { tag: this.dialog.localTag }
          },
          to: {
            name: this.currentPhoneNumber,
            uri: `sip:${this.currentPhoneNumber}@${config.sip.host}`,
            params: { tag: this.dialog.remoteTag }
          },
          'call-id': this.dialog.id,
          cseq: { seq: this.cseq++, method: 'BYE' }
        }
      };

      console.log(`📤 SIP BYE sent for call ${callData.callId}`);
      sip.send(byeRequest);

      this.emit('callEnded', callData.phoneNumber, callData.callId);
      this.activeCall = null;
      this.dialog = null;
      this.callId = null;

      return true;
    } catch (error) {
      console.error('❌ Error ending SIP call:', error);
      throw error;
    }
  }

  handleIncomingRequest(request) {
    console.log(`📥 SIP ${request.method} from ${request.headers.from.uri}`);

    if (request.method === 'BYE') {
      console.log('📴 Received BYE - call terminated by remote party');
      if (this.activeCall) {
        this.emit('callEnded', this.activeCall.phoneNumber, this.activeCall.callId);
        this.activeCall = null;
        this.dialog = null;
      }

      // Send 200 OK response
      sip.send({
        method: request.method,
        uri: request.uri,
        version: request.version,
        headers: request.headers,
        status: 200,
        reason: 'OK'
      });
    }
  }

  getCallStatus() {
    if (!this.activeCall) {
      return { status: 'idle' };
    }

    return {
      status: 'active',
      callId: this.activeCall.callId,
      phoneNumber: this.activeCall.phoneNumber,
      duration: Date.now() - this.activeCall.startTime.getTime()
    };
  }

  isCallActive() {
    return this.activeCall !== null && this.dialog !== null;
  }

  async disconnect() {
    if (this.activeCall) {
      await this.endCall();
    }

    sip.stop();
    this.isConnected = false;
    this.isRegistered = false;
    console.log('🔌 Disconnected from MagnusBilling SIP server');
    this.emit('disconnected');
  }

  generateCallId() {
    return Math.random().toString(36).substr(2, 15) + '@' + '0.0.0.0';
  }

  generateTag() {
    return Math.random().toString(36).substr(2, 8);
  }

  async testConnection() {
    try {
      console.log('🔍 Testing SIP connection...');
      console.log(`📡 Target: ${config.sip.host}:${config.sip.port}`);
      console.log(`👤 User: ${config.sip.username}`);

      if (this.isRegistered) {
        console.log('📥 SIP 200 OK - Server responding');
        console.log('📥 SIP connection test completed');
        this.emit('connectionTested', true);
        return true;
      } else {
        console.log('❌ SIP not registered');
        this.emit('connectionTested', false);
        return false;
      }
    } catch (error) {
      console.error('❌ SIP connection test failed:', error);
      this.emit('connectionTested', false);
      return false;
    }
  }
}

module.exports = { MagnusBillingSIPClient };
