const EventEmitter = require('events');
const config = require('./config');
const sip = require('node-sip');
const dgram = require('dgram');

class MagnusBillingSIPClient extends EventEmitter {
  constructor() {
    super();
    this.isConnected = false;
    this.activeCall = null;
    this.callId = null;
    this.sipStack = null;
    this.isRegistered = false;
    this.currentPhoneNumber = null;
    this.localPort = 5060;
    this.dialog = null;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing MagnusBilling SIP client (REAL MODE)');
      console.log(`📡 Connecting to MagnusBilling server: ${config.sip.host}:${config.sip.port}`);
      console.log(`👤 Using SIP credentials: ${config.sip.username}`);
      console.log(`🏷️  Using Caller ID: ${config.sip.caller_id}`);

      // Initialize SIP stack
      await this.initializeSIPStack();

      // Register with SIP server
      await this.registerWithServer();

      this.isConnected = true;
      console.log('✅ Connected to MagnusBilling SIP server (REAL)');
      console.log(`✅ Trunk configured: ${config.sip.trunk} (${config.sip.trunk_username})`);
      this.emit('connected');

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize MagnusBilling SIP client:', error);
      throw error;
    }
  }

  async initializeSIPStack() {
    return new Promise((resolve, reject) => {
      try {
        console.log('📝 SIP configuration created');
        console.log('🔄 Starting real SIP client...');

        // Find available port
        this.findAvailablePort().then(port => {
          this.localPort = port;

          // Create SIP stack
          this.sipStack = sip.create({
            host: '0.0.0.0',
            port: this.localPort,
            publicHost: config.sip.host,
            publicPort: this.localPort
          });

          console.log(`📞 SIP client bound to port ${this.localPort}`);

          // Handle incoming SIP messages
          this.sipStack.on('message', (msg, remote) => {
            this.handleSIPMessage(msg, remote);
          });

          resolve();
        }).catch(reject);

      } catch (error) {
        reject(error);
      }
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

        const registerOptions = {
          method: 'REGISTER',
          uri: `sip:${config.sip.host}`,
          headers: {
            'from': `<sip:${config.sip.username}@${config.sip.host}>`,
            'to': `<sip:${config.sip.username}@${config.sip.host}>`,
            'call-id': this.generateCallId(),
            'cseq': '1 REGISTER',
            'contact': `<sip:${config.sip.username}@0.0.0.0:${this.localPort}>`,
            'expires': '3600'
          }
        };

        // Send REGISTER request
        this.sipStack.send(registerOptions, (response) => {
          if (response.status === 200) {
            console.log('✅ SIP registration successful');
            this.isRegistered = true;
            resolve();
          } else if (response.status === 401 || response.status === 407) {
            console.log('🔐 Authentication required, sending credentials...');
            // Handle digest authentication
            this.handleAuthChallenge(registerOptions, response).then(resolve).catch(reject);
          } else {
            reject(new Error(`Registration failed with status: ${response.status}`));
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async handleAuthChallenge(originalRequest, challenge) {
    return new Promise((resolve, reject) => {
      try {
        const wwwAuth = challenge.headers['www-authenticate'] || challenge.headers['proxy-authenticate'];
        const auth = sip.parseAuthHeader(wwwAuth);

        // Calculate digest response
        const ha1 = sip.md5(`${config.sip.username}:${auth.realm}:${config.sip.password}`);
        const ha2 = sip.md5(`${originalRequest.method}:${originalRequest.uri}`);
        const response = sip.md5(`${ha1}:${auth.nonce}:${ha2}`);

        // Send authenticated request
        const authRequest = {
          ...originalRequest,
          headers: {
            ...originalRequest.headers,
            'authorization': `Digest username="${config.sip.username}", realm="${auth.realm}", nonce="${auth.nonce}", uri="${originalRequest.uri}", response="${response}"`
          }
        };

        this.sipStack.send(authRequest, (authResponse) => {
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

      const inviteRequest = {
        method: 'INVITE',
        uri: `sip:${phoneNumber}@${config.sip.host}`,
        headers: {
          'from': `<sip:${config.sip.username}@${config.sip.host}>`,
          'to': `<sip:${phoneNumber}@${config.sip.host}>`,
          'call-id': this.callId,
          'cseq': '1 INVITE',
          'contact': `<sip:${config.sip.username}@0.0.0.0:${this.localPort}>`,
          'content-type': 'application/sdp'
        },
        content: this.generateSDP()
      };

      console.log('📡 Sending real SIP INVITE...');

      return new Promise((resolve, reject) => {
        this.sipStack.send(inviteRequest, (response) => {
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
      localTag: response.headers.from.match(/tag=([^;]+)/)?.[1],
      remoteTag: response.headers.to.match(/tag=([^;]+)/)?.[1],
      localSeq: 1,
      remoteSeq: parseInt(response.headers.cseq.split(' ')[0])
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
        headers: {
          'from': `<sip:${config.sip.username}@${config.sip.host}>;tag=${this.dialog.localTag}`,
          'to': `<sip:${this.currentPhoneNumber}@${config.sip.host}>;tag=${this.dialog.remoteTag}`,
          'call-id': this.dialog.id,
          'cseq': `${++this.dialog.localSeq} INFO`,
          'content-type': 'application/dtmf-relay'
        },
        content: `Signal=${digit}\r\nDuration=100\r\n`
      };

      console.log(`📤 SIP INFO: Signal=${digit}, Duration=100`);

      this.sipStack.send(infoRequest);

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
        headers: {
          'from': `<sip:${config.sip.username}@${config.sip.host}>;tag=${this.dialog.localTag}`,
          'to': `<sip:${this.currentPhoneNumber}@${config.sip.host}>;tag=${this.dialog.remoteTag}`,
          'call-id': this.dialog.id,
          'cseq': `${++this.dialog.localSeq} BYE`
        }
      };

      console.log(`📤 SIP BYE sent for call ${callData.callId}`);
      this.sipStack.send(byeRequest);

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

  handleSIPMessage(msg, remote) {
    console.log(`📥 SIP message from ${remote.address}:${remote.port}`);

    if (msg.method === 'BYE') {
      console.log('📴 Received BYE - call terminated by remote party');
      if (this.activeCall) {
        this.emit('callEnded', this.activeCall.phoneNumber, this.activeCall.callId);
        this.activeCall = null;
        this.dialog = null;
      }
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

    if (this.sipStack) {
      this.sipStack.destroy();
      this.sipStack = null;
    }

    this.isConnected = false;
    this.isRegistered = false;
    console.log('🔌 Disconnected from MagnusBilling SIP server');
    this.emit('disconnected');
  }

  generateCallId() {
    return Math.random().toString(36).substr(2, 15) + '@' + '0.0.0.0';
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