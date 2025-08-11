
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

      this.initialized = true;
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
      if (!this.initialized) {
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
