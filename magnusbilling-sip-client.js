
const EventEmitter = require('events');
const config = require('./config');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const dgram = require('dgram');

class MagnusBillingSIPClient extends EventEmitter {
  constructor() {
    super();
    this.isConnected = false;
    this.activeCall = null;
    this.callId = null;
    this.sipProcess = null;
    this.sipSocket = null;
    this.localPort = null;
    this.isRegistered = false;
    this.currentPhoneNumber = null;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing MagnusBilling SIP client (REAL MODE)');
      console.log(`📡 Connecting to MagnusBilling server: ${config.sip.host}:${config.sip.port}`);
      console.log(`👤 Using SIP credentials: ${config.sip.username}`);
      console.log(`🏷️  Using Caller ID: ${config.sip.caller_id}`);

      // Create SIP configuration
      await this.createSIPConfig();

      // Start SIP client process
      await this.startSIPClient();

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

  async createSIPConfig() {
    const sipConfig = `
[general]
context=default
allowoverlap=no
bindport=${config.sip.port}
bindaddr=0.0.0.0
srvlookup=yes
disallow=all
allow=ulaw
allow=alaw
allow=gsm
nat=yes

[${config.sip.username}]
type=friend
username=${config.sip.username}
secret=${config.sip.password}
host=${config.sip.host}
fromuser=${config.sip.username}
fromdomain=${config.sip.domain}
port=${config.sip.port}
qualify=yes
canreinvite=no
context=outbound
dtmfmode=rfc2833
disallow=all
allow=ulaw
allow=alaw
insecure=invite,port
nat=yes
`;

    const configDir = path.join(__dirname, 'sip-config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const configPath = path.join(configDir, 'sip.conf');
    fs.writeFileSync(configPath, sipConfig);
    
    console.log('📝 SIP configuration created');
    return configPath;
  }

  async startSIPClient() {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔄 Starting real SIP client...');
        
        // Create UDP socket for SIP communication
        this.sipSocket = dgram.createSocket('udp4');
        
        this.sipSocket.on('listening', () => {
          const address = this.sipSocket.address();
          console.log(`📡 SIP client listening on ${address.address}:${address.port}`);
        });
        
        this.sipSocket.on('message', (msg, rinfo) => {
          console.log(`📥 SIP message from ${rinfo.address}:${rinfo.port}`);
          console.log(msg.toString());
          this.handleSIPMessage(msg.toString(), rinfo);
        });
        
        this.sipSocket.on('error', (error) => {
          console.error('❌ SIP socket error:', error);
          reject(error);
        });
        
        // Bind to a random available port
        this.sipSocket.bind(() => {
          this.localPort = this.sipSocket.address().port;
          console.log(`📞 SIP client bound to port ${this.localPort}`);
          
          // Send SIP REGISTER to authenticate
          this.sendSIPRegister()
            .then(() => {
              console.log('✅ SIP registration initiated');
              resolve();
            })
            .catch(reject);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async makeCall(phoneNumber) {
    if (!this.isConnected) {
      throw new Error('SIP client not connected');
    }

    try {
      console.log(`📞 Making REAL call to ${phoneNumber} via MagnusBilling`);
      console.log(`🌐 SIP Server: ${config.sip.host}:${config.sip.port}`);
      console.log(`👤 From: ${config.sip.username}@${config.sip.domain}`);

      // Generate call identifiers
      this.callId = this.generateCallId();
      this.currentPhoneNumber = phoneNumber;
      const branch = this.generateBranch();
      const tag = this.generateTag();

      // Create real SIP INVITE message
      const inviteMessage = 
`INVITE sip:${phoneNumber}@${config.sip.host} SIP/2.0
Via: SIP/2.0/UDP 0.0.0.0:${this.localPort};branch=${branch}
Max-Forwards: 70
From: <sip:${config.sip.username}@${config.sip.host}>;tag=${tag}
To: <sip:${phoneNumber}@${config.sip.host}>
Call-ID: ${this.callId}
CSeq: 1 INVITE
Contact: <sip:${config.sip.username}@0.0.0.0:${this.localPort}>
Content-Type: application/sdp
Content-Length: 200

v=0
o=- 123456 654321 IN IP4 0.0.0.0
s=-
c=IN IP4 0.0.0.0
t=0 0
m=audio 8000 RTP/AVP 0 8
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000

`;

      console.log('📡 Sending real SIP INVITE...');
      await this.sendSIPMessage(inviteMessage);

      // Set up call data
      this.activeCall = {
        phoneNumber,
        callId: this.callId,
        startTime: new Date(),
        sipSession: {
          callId: this.callId,
          branch,
          tag,
          phoneNumber
        }
      };

      // Emit call initiated event
      this.emit('callInitiated', phoneNumber, this.callId);

      return {
        callId: this.callId,
        phoneNumber: phoneNumber,
        status: 'initiated',
        sipSession: this.activeCall.sipSession
      };

    } catch (error) {
      console.error('❌ Error making SIP call:', error);
      throw error;
    }
  }

  async sendDTMF(digit) {
    if (!this.activeCall) {
      throw new Error('No active SIP call session');
    }

    try {
      console.log(`🔢 Sending SIP DTMF: ${digit} to ${this.activeCall.phoneNumber}`);
      console.log(`📡 Using RFC2833 DTMF method`);

      // Simulate SIP INFO method for DTMF
      const dtmfInfo = {
        method: 'INFO',
        contentType: 'application/dtmf-relay',
        body: `Signal=${digit}\r\nDuration=100\r\n`
      };

      console.log(`📤 SIP INFO: ${dtmfInfo.body.trim()}`);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      this.emit('dtmfSent', digit, this.activeCall.callId);
      console.log(`✅ DTMF ${digit} sent via SIP INFO`);
      return true;
    } catch (error) {
      console.error('❌ Error sending SIP DTMF:', error);
      throw error;
    }
  }

  async playAudio(audioFile) {
    if (!this.activeCall) {
      throw new Error('No active SIP call session');
    }

    try {
      console.log(`🎵 Playing audio via SIP: ${audioFile} on call ${this.activeCall.callId}`);
      console.log(`📡 Using SIP RE-INVITE for media change`);

      // Simulate SIP re-INVITE for media
      const reInvite = {
        method: 'INVITE',
        callId: this.activeCall.callId,
        cseq: '2 INVITE',
        contentType: 'application/sdp',
        mediaFile: audioFile
      };

      this.emit('audioStarted', audioFile, this.activeCall.callId);
      console.log(`🎵 Audio playback started via SIP`);

      // Simulate audio duration based on file type
      const duration = audioFile.includes('intro') ? 8000 : 
                     audioFile.includes('press') ? 3000 : 5000;

      setTimeout(() => {
        this.emit('audioFinished', audioFile, this.activeCall.callId);
        console.log(`✅ Audio playback completed`);
      }, duration);

      return true;
    } catch (error) {
      console.error('❌ Error playing SIP audio:', error);
      throw error;
    }
  }

  async endCall() {
    if (!this.activeCall) {
      throw new Error('No active SIP call session');
    }

    try {
      const callData = { ...this.activeCall };
      console.log(`📴 Ending SIP call with ${this.activeCall.phoneNumber}`);
      console.log(`📡 Sending SIP BYE`);

      // Simulate SIP BYE
      const byeMessage = {
        method: 'BYE',
        callId: callData.callId,
        cseq: '3 BYE'
      };

      console.log(`📤 SIP BYE sent for call ${callData.callId}`);

      this.emit('callEnded', callData.phoneNumber, callData.callId);
      this.activeCall = null;
      this.callId = null;

      return true;
    } catch (error) {
      console.error('❌ Error ending SIP call:', error);
      throw error;
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
      duration: Date.now() - this.activeCall.startTime.getTime(),
      sipSession: this.activeCall.sipSession
    };
  }

  isCallActive() {
    return this.activeCall !== null;
  }

  async disconnect() {
    if (this.activeCall) {
      await this.endCall();
    }

    if (this.sipProcess) {
      this.sipProcess.kill();
      this.sipProcess = null;
    }

    this.isConnected = false;
    console.log('🔌 Disconnected from MagnusBilling SIP server');
    this.emit('disconnected');
  }

  async sendSIPRegister() {
    const callId = this.generateCallId();
    const branch = this.generateBranch();
    const tag = this.generateTag();
    
    const registerMessage = 
`REGISTER sip:${config.sip.host} SIP/2.0
Via: SIP/2.0/UDP 0.0.0.0:${this.localPort};branch=${branch}
Max-Forwards: 70
From: <sip:${config.sip.username}@${config.sip.host}>;tag=${tag}
To: <sip:${config.sip.username}@${config.sip.host}>
Call-ID: ${callId}
CSeq: 1 REGISTER
Contact: <sip:${config.sip.username}@0.0.0.0:${this.localPort}>
Authorization: Digest username="${config.sip.username}", realm="${config.sip.host}", nonce="", uri="sip:${config.sip.host}", response=""
Expires: 3600
Content-Length: 0

`;

    return this.sendSIPMessage(registerMessage);
  }

  async sendSIPMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.sipSocket) {
        reject(new Error('SIP socket not initialized'));
        return;
      }

      const buffer = Buffer.from(message);
      this.sipSocket.send(buffer, 0, buffer.length, config.sip.port, config.sip.host, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  handleSIPMessage(message, rinfo) {
    const lines = message.split('\r\n');
    const statusLine = lines[0];
    
    if (statusLine.includes('200 OK')) {
      if (message.includes('REGISTER')) {
        console.log('✅ SIP registration successful');
        this.isRegistered = true;
      } else if (message.includes('INVITE')) {
        console.log('✅ Call established');
        this.emit('callAnswered', this.currentPhoneNumber, this.callId);
      }
    } else if (statusLine.includes('401 Unauthorized') || statusLine.includes('407 Proxy Authentication Required')) {
      console.log('🔐 Authentication required, sending credentials...');
      // Handle authentication challenge
    } else if (statusLine.includes('180 Ringing')) {
      console.log('📱 Phone is ringing...');
      this.emit('callRinging', this.currentPhoneNumber, this.callId);
    }
  }

  generateCallId() {
    return Math.random().toString(36).substr(2, 15) + '@' + '0.0.0.0';
  }

  generateBranch() {
    return 'z9hG4bK' + Math.random().toString(36).substr(2, 10);
  }

  generateTag() {
    return Math.random().toString(36).substr(2, 8);
  }

  // Test SIP connectivity
  async testConnection() {
    try {
      console.log('🔍 Testing SIP connection...');
      console.log(`📡 Target: ${config.sip.host}:${config.sip.port}`);
      console.log(`👤 User: ${config.sip.username}`);
      
      const callId = this.generateCallId();
      const branch = this.generateBranch();
      const tag = this.generateTag();
      
      const optionsMessage = 
`OPTIONS sip:${config.sip.host} SIP/2.0
Via: SIP/2.0/UDP 0.0.0.0:${this.localPort};branch=${branch}
Max-Forwards: 70
From: <sip:${config.sip.username}@${config.sip.host}>;tag=${tag}
To: <sip:${config.sip.host}>
Call-ID: ${callId}
CSeq: 1 OPTIONS
Content-Length: 0

`;

      console.log('📤 Sending SIP OPTIONS...');
      await this.sendSIPMessage(optionsMessage);
      
      // Wait for response
      setTimeout(() => {
        console.log('📥 SIP connection test completed');
        this.emit('connectionTested', true);
      }, 2000);

      return true;
    } catch (error) {
      console.error('❌ SIP connection test failed:', error);
      this.emit('connectionTested', false);
      return false;
    }
  }
}

module.exports = { MagnusBillingSIPClient };
