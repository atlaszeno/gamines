const EventEmitter = require('events');
const config = require('./config');

class MagnusBillingSIPClient extends EventEmitter {
  constructor() {
    super();
    this.isConnected = false;
    this.activeCall = null;
    this.callId = null;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing MagnusBilling SIP client (Mock Mode)');
      console.log(`📡 Connecting to MagnusBilling server: ${config.sip.host}:${config.sip.port}`);
      console.log(`👤 Using SIP credentials: ${config.sip.username}`);
      console.log(`🏷️  Using Caller ID: ${config.sip.caller_id}`);

      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.isConnected = true;
      console.log('✅ Connected to MagnusBilling SIP server (Mock)');
      console.log(`✅ Trunk configured: ${config.sip.trunk} (${config.sip.trunk_username})`);
      this.emit('connected');

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize MagnusBilling SIP client:', error);
      throw error;
    }
  }

  async makeCall(phoneNumber) {
    if (!this.isConnected) {
      throw new Error('SIP client not connected');
    }

    try {
      console.log(`📞 Making call to ${phoneNumber} via MagnusBilling`);

      // Generate a unique call ID
      this.callId = `magnus-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Simulate call progression
      this.emit('callInitiated', phoneNumber, this.callId);

      // Simulate call connecting
      setTimeout(() => {
        console.log('📱 Call connecting...');
        this.emit('callConnecting', phoneNumber, this.callId);
      }, 1000);

      // Simulate call answered
      setTimeout(() => {
        console.log('✅ Call answered');
        this.activeCall = {
          phoneNumber,
          callId: this.callId,
          startTime: new Date()
        };
        this.emit('callAnswered', phoneNumber, this.callId);
      }, 3000);

      return {
        callId: this.callId,
        phoneNumber: phoneNumber,
        status: 'initiated'
      };

    } catch (error) {
      console.error('❌ Error making call:', error);
      throw error;
    }
  }

  async sendDTMF(digit) {
    if (!this.activeCall) {
      throw new Error('No active call session');
    }

    try {
      console.log(`🔢 Sending DTMF: ${digit} to ${this.activeCall.phoneNumber}`);

      // Simulate DTMF sending delay
      await new Promise(resolve => setTimeout(resolve, 200));

      this.emit('dtmfSent', digit, this.activeCall.callId);
      return true;
    } catch (error) {
      console.error('❌ Error sending DTMF:', error);
      throw error;
    }
  }

  async playAudio(audioFile) {
    if (!this.activeCall) {
      throw new Error('No active call session');
    }

    try {
      console.log(`🎵 Playing audio: ${audioFile} on call ${this.activeCall.callId}`);

      // Simulate audio playing
      this.emit('audioStarted', audioFile, this.activeCall.callId);

      // Simulate audio completion (assume 5 seconds for demo)
      setTimeout(() => {
        this.emit('audioFinished', audioFile, this.activeCall.callId);
      }, 5000);

      return true;
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      throw error;
    }
  }

  async endCall() {
    if (!this.activeCall) {
      throw new Error('No active call session');
    }

    try {
      const callData = { ...this.activeCall };
      console.log(`📴 Ending call with ${this.activeCall.phoneNumber}`);

      this.emit('callEnded', callData.phoneNumber, callData.callId);
      this.activeCall = null;
      this.callId = null;

      return true;
    } catch (error) {
      console.error('❌ Error ending call:', error);
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
      duration: Date.now() - this.activeCall.startTime.getTime()
    };
  }

  isCallActive() {
    return this.activeCall !== null;
  }

  async disconnect() {
    if (this.activeCall) {
      await this.endCall();
    }

    this.isConnected = false;
    console.log('🔌 Disconnected from MagnusBilling');
    this.emit('disconnected');
  }
}

module.exports = { MagnusBillingSIPClient };