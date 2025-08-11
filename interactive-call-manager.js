const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

// Import the MagnusBilling SIP client
const { MagnusBillingSIPClient } = require('./magnusbilling-sip-client');

class InteractiveCallManager extends EventEmitter {
  constructor() {
    super();
    this.activeCalls = new Map();
    this.sipClient = new MagnusBillingSIPClient();
    this.setupSIPEvents();
  }

  setupSIPEvents() {
    this.sipClient.on('connected', () => {
      console.log('✅ SIP client connected to MagnusBilling');
    });

    this.sipClient.on('callAnswered', (phoneNumber, callId) => {
      console.log(`📞 Call answered: ${phoneNumber} (${callId})`);
      this.emit('callAnswered', callId, phoneNumber);
    });

    this.sipClient.on('callEnded', (phoneNumber, callId) => {
      console.log(`📴 Call ended: ${phoneNumber} (${callId})`);
      this.emit('callEnded', callId);
      this.activeCalls.delete(callId);
    });

    this.sipClient.on('dtmfSent', (digit, callId) => {
      console.log(`🔢 DTMF sent: ${digit} for call ${callId}`);
    });
  }

  async initialize() {
    try {
      await this.sipClient.initialize();
      console.log('✅ Interactive Call Manager initialized with MagnusBilling');
    } catch (error) {
      console.error('❌ Failed to initialize call manager:', error);
      throw error;
    }
  }

  async initiateCall(phoneNumber, name = 'Unknown') {
    try {
      console.log(`🎯 Initiating call to ${phoneNumber} (Name: ${name})`);
      
      const callResult = await this.sipClient.makeCall(phoneNumber);
      const callId = callResult.callId;
      
      // Store call information
      this.activeCalls.set(callId, {
        id: callId,
        phoneNumber,
        name,
        status: 'initiated',
        startTime: new Date(),
        events: []
      });

      this.updateCallStatus(callId, `Call originated to ${phoneNumber} - dialing`);
      
      return callId;
    } catch (error) {
      console.error('❌ Error initiating call:', error);
      throw error;
    }
  }

  updateCallStatus(callId, message) {
    const call = this.activeCalls.get(callId);
    if (call) {
      call.status = message;
      call.events.push({
        timestamp: new Date(),
        message
      });
      console.log(`Update for call ID ${callId}: ${message}`);
      this.emit('callUpdated', callId, message);
    }
  }

  async sendDTMF(callId, digit) {
    try {
      await this.sipClient.sendDTMF(digit);
      console.log(`🔢 Sent DTMF ${digit} for call ${callId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending DTMF for call ${callId}:`, error);
      throw error;
    }
  }

  async endCall(callId) {
    try {
      await this.sipClient.endCall();
      this.activeCalls.delete(callId);
      console.log(`📴 Call ${callId} ended`);
      return true;
    } catch (error) {
      console.error(`❌ Error ending call ${callId}:`, error);
      throw error;
    }
  }

  getCallStatus(callId) {
    const call = this.activeCalls.get(callId);
    if (call) {
      return {
        ...call,
        sipStatus: this.sipClient.getCallStatus()
      };
    }
    return null;
  }

  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  async uploadAudioForCall(callId, audioPath) {
    try {
      console.log(`🎵 Uploading audio for call ${callId}: ${audioPath}`);
      // Audio upload logic would go here
      return true;
    } catch (error) {
      console.error(`❌ Error uploading audio for call ${callId}:`, error);
      throw error;
    }
  }

  async handleDTMF(callId, digit) {
    return await this.sendDTMF(callId, digit);
  }

  async handleButtonClick(callId, buttonId) {
    console.log(`🔘 Button ${buttonId} clicked for call ${callId}`);
    // Handle button logic here
    return true;
  }

  async sendManualDTMF(callId, digit) {
    return await this.sendDTMF(callId, digit);
  }

  async showDTMFOptions(callId) {
    console.log(`📋 Showing DTMF options for call ${callId}`);
    return true;
  }

  async sendDTMFCode(callId, code) {
    console.log(`🔢 Sending DTMF code ${code} for call ${callId}`);
    for (const digit of code) {
      await this.sendDTMF(callId, digit);
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait between digits
    }
    return true;
  }

  async setupTTSRecordings(callId, recordings) {
    const call = this.activeCalls.get(callId);
    if (call) {
      call.ttsRecordings = recordings;
      console.log(`🗣️ TTS recordings setup for call ${callId}`);
    }
    return true;
  }
}

class InteractiveCallManager extends EventEmitter {
  constructor() {
    super();
    this.activeCalls = new Map();
    this.initialized = false;
    this.sipClient = null; // To hold the SIP client instance
  }

  async initialize() {
    if (this.initialized) return;

    console.log('🚀 Initializing Interactive Call Manager...');

    try {
      // Initialize MagnusBilling SIP client
      this.sipClient = new MagnusBillingSIPClient();
      await this.sipClient.initialize();

      // Set up SIP client event listeners
      this.sipClient.on('connected', () => {
        console.log('✅ SIP client connected to MagnusBilling');
      });

      this.sipClient.on('callEstablished', (phoneNumber) => {
        const callId = this.generateCallId();
        this.activeCalls.set(callId, {
          phoneNumber,
          status: 'established',
          startTime: new Date(),
          session: this.sipClient.activeSession
        });
        this.emit('callEstablished', callId, phoneNumber);
      });

      this.sipClient.on('callTerminated', (phoneNumber) => {
        // Find and remove the call from active calls
        for (const [callId, call] of this.activeCalls.entries()) {
          if (call.phoneNumber === phoneNumber) {
            this.activeCalls.delete(callId);
            this.emit('callTerminated', callId);
            break;
          }
        }
      });

      console.log('✅ SIP connection established');

      this.isInitialized = true;
      console.log('✅ Interactive Call Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Interactive Call Manager:', error);
      throw error;
    }
  }

  generateCallId() {
    return uuidv4();
  }

  addCallEvent(callId, type, message) {
    const callData = this.activeCalls.get(callId);
    if (callData) {
      if (!callData.events) callData.events = [];
      callData.events.push({
        timestamp: new Date(),
        type: type,
        message: message
      });
      this.activeCalls.set(callId, callData);
      this.emit('callUpdated', callId, message);
    }
  }

  async initiateCall(phoneNumber, name = 'Unknown') {
    try {
      if (!this.isInitialized) {
        throw new Error('Call manager not initialized');
      }

      console.log(`📞 Initiating call to ${phoneNumber} (${name}) via MagnusBilling`);

      // Make call through SIP client
      const callResult = await this.sipClient.makeCall(phoneNumber);
      const callId = callResult.callId;

      // Store call information
      const callInfo = {
        callId,
        phoneNumber,
        name,
        status: 'dialing',
        startTime: new Date(),
        session: callResult.session,
        events: []
      };

      this.activeCalls.set(callId, callInfo);

      console.log(`✅ Call initiated to ${phoneNumber}, Call ID: ${callId}`);
      this.addCallEvent(callId, 'call_initiated', `Call to ${phoneNumber} initiated via MagnusBilling`);

      return callId;

    } catch (error) {
      console.error('❌ Error initiating call:', error);
      throw error;
    }
  }

  handleCallAnswered(callId, type = 'unknown') {
    console.log(`Update for call ID ${callId}: Call answered - analyzing...`);
    this.updateCallStatus(callId, 'Call answered - analyzing...');

    // Simulate brief analysis delay
    setTimeout(() => {
      this.emit('humanDetected', callId);
    }, 2000);
  }

  handleHumanDetected(callId) {
    console.log(`Update for call ID ${callId}: Human detected - playing intro`);
    this.updateCallStatus(callId, 'Human detected - playing intro');

    // Simulate intro playback
    setTimeout(() => {
      console.log(`Update for call ID ${callId}: Playing interactive menu - waiting for DTMF`);
      this.updateCallStatus(callId, 'Playing interactive menu - waiting for DTMF');
    }, 3000);
  }

  handleShowTelegramMenu(callId) {
    console.log(`Update for call ID ${callId}: Telegram menu requested`);
    this.updateCallStatus(callId, 'Waiting for audio selection...');

    // Emit event to telegram bot
    this.emit('telegramMenuRequested', callId);
  }

  handleDTMFCode(callId, code) {
    console.log(`Update for call ID ${callId}: DTMF code received: ${code}`);
    const callData = this.activeCalls.get(callId);
    if (callData) {
      callData.dtmfCode = code;
      this.activeCalls.set(callId, callData);
      this.updateCallStatus(callId, `DTMF code received: ${code}`);

      // Emit event for further processing
      this.emit('dtmfProcessed', callId, code);
    }
  }

  handleCallEnded(callId) {
    console.log(`Update for call ID ${callId}: Call ended`);
    const callData = this.activeCalls.get(callId);
    if (callData) {
      callData.status = 'ended';
      callData.endTime = new Date();
      this.updateCallStatus(callId, 'Call ended');

      // Clean up after a delay
      setTimeout(() => {
        this.activeCalls.delete(callId);
      }, 300000); // Keep for 5 minutes for reference
    }
  }

  updateCallStatus(callId, message) {
    const callData = this.activeCalls.get(callId);
    if (callData) {
      callData.status = message;
      callData.lastUpdate = new Date();
      if (!callData.events) callData.events = [];
      callData.events.push({
        timestamp: new Date(),
        message: message
      });
      this.activeCalls.set(callId, callData);
      this.emit('callUpdated', callId, message);
    }
  }

  async uploadAudioForCall(callId, audioPath) {
    const callData = this.activeCalls.get(callId);
    if (!callData) {
      throw new Error('Call not found');
    }

    // Store audio path in call data
    callData.uploadedAudio = audioPath;
    this.activeCalls.set(callId, callData);

    // Play the audio to the caller
    await this.playAudioToCall(callId, audioPath);

    this.updateCallStatus(callId, 'Audio uploaded and playing');
    return { success: true, audioPath };
  }

  async playAudioToCall(callId, audioPath) {
    try {
      const callData = this.activeCalls.get(callId);
      if (!callData) {
        throw new Error('Call not found');
      }

      // Assuming MagnusBillingSIPClient has a method to play audio
      // This is a placeholder and needs to be implemented in MagnusBillingSIPClient
      await this.sipClient.playAudio(callData.session, audioPath);

      console.log(`Audio playback initiated for call ${callId}`);
      return { success: true };
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }

  async setupTTSRecordings(callId, recordings) {
    const callData = this.activeCalls.get(callId);
    if (!callData) {
      throw new Error('Call not found');
    }

    callData.ttsRecordings = recordings;
    this.activeCalls.set(callId, callData);

    return recordings;
  }

  async handleButtonClick(callId, buttonId) {
    const callData = this.activeCalls.get(callId);
    if (!callData) {
      throw new Error('Call not found');
    }

    let audioPath;
    switch (buttonId) {
      case 'email':
        audioPath = callData.ttsRecordings?.recording1?.audioPath;
        break;
      case 'otp':
        audioPath = callData.ttsRecordings?.recording2?.audioPath;
        break;
      case 'invalid':
        audioPath = callData.ttsRecordings?.recording3?.audioPath;
        break;
      default:
        throw new Error('Invalid button ID');
    }

    if (audioPath && fs.existsSync(audioPath)) {
      await this.playAudioToCall(callId, audioPath);
      this.updateCallStatus(callId, `Playing ${buttonId} audio`);
      return { success: true, message: `Playing ${buttonId} audio` };
    } else {
      throw new Error('Audio file not found for this option');
    }
  }

  async sendManualDTMF(callId, digit) {
    try {
      const call = this.activeCalls.get(callId);
      if (!call) {
        throw new Error(`Call ${callId} not found`);
      }

      console.log(`🔢 Sending manual DTMF ${digit} to call ${callId}`);

      // Send DTMF through SIP client
      await this.sipClient.sendDTMF(digit);

      console.log(`✅ DTMF ${digit} sent successfully`);
      this.addCallEvent(callId, 'dtmf_sent', `Manual DTMF ${digit} sent`);

      return { success: true, digit };

    } catch (error) {
      console.error('❌ Error sending manual DTMF:', error);
      throw error;
    }
  }

  async sendDTMFCode(callId, code) {
    // Emit DTMF code event manually
    this.emit('dtmfCodeReceived', callId, code);
    return { success: true, code };
  }

  async showDTMFOptions(callId) {
    this.updateCallStatus(callId, 'Showing DTMF options menu');
    return { success: true, message: 'DTMF options displayed' };
  }

  async handleDTMF(callId, digit) {
    const callData = this.activeCalls.get(callId);
    if (!callData) {
      throw new Error('Call not found');
    }

    console.log(`Handling DTMF ${digit} for call ${callId}`);

    if (digit === '1') {
      this.emit('showTelegramMenu', callId);
    } else if (digit === '9') {
      // Connect to live agent
      this.updateCallStatus(callId, 'Connecting to live agent...');
    } else {
      // Handle other DTMF digits
      this.updateCallStatus(callId, `DTMF ${digit} pressed`);
    }

    return { success: true, digit };
  }

  async endCall(callId) {
    try {
      const call = this.activeCalls.get(callId);
      if (!call) {
        throw new Error(`Call ${callId} not found`);
      }

      console.log(`📴 Ending call ${callId}`);

      // End call through SIP client
      await this.sipClient.endCall();

      console.log(`✅ Call ${callId} ended successfully`);
      this.addCallEvent(callId, 'call_ended', 'Call ended manually');

      // Update call status
      call.status = 'ended';
      call.endTime = new Date();

      // Remove from active calls after a delay to allow for cleanup
      setTimeout(() => {
        this.activeCalls.delete(callId);
      }, 5000);

      this.emit('callEnded', callId);
      return { success: true };

    } catch (error) {
      console.error('❌ Error ending call:', error);
      throw error;
    }
  }

  async getCallStatus(callId) {
    const callData = this.activeCalls.get(callId);
    if (!callData) {
      throw new Error('Call not found');
    }
    return callData;
  }

  async getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }
}

module.exports = { InteractiveCallManager };