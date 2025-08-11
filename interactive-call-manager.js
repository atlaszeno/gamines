
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

class InteractiveCallManager extends EventEmitter {
  constructor() {
    super();
    this.activeCalls = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log('🎯 Initializing Interactive Call Manager...');
    
    // Set up event handlers
    this.on('callAnswered', this.handleCallAnswered.bind(this));
    this.on('humanDetected', this.handleHumanDetected.bind(this));
    this.on('showTelegramMenu', this.handleShowTelegramMenu.bind(this));
    this.on('dtmfCodeReceived', this.handleDTMFCode.bind(this));
    this.on('callEnded', this.handleCallEnded.bind(this));
    
    this.initialized = true;
    console.log('✅ Interactive Call Manager initialized');
  }

  async initiateCall(phoneNumber, name = 'Unknown') {
    const callId = uuidv4();
    const timestamp = new Date();
    
    const callData = {
      id: callId,
      phoneNumber,
      name,
      status: 'dialing',
      timestamp,
      events: [],
      ttsRecordings: {}
    };
    
    this.activeCalls.set(callId, callData);
    
    console.log(`Initiating call to ${phoneNumber} (Name: ${name})`);
    
    try {
      // Get AMI instance
      const { getAMI } = require('./asterisk/instance');
      const ami = getAMI();
      
      if (!ami) {
        throw new Error('AMI not available');
      }
      
      // Create originate action
      const action = {
        action: 'Originate',
        channel: `SIP/${phoneNumber}@default`,
        context: 'interactive-call',
        exten: 's',
        priority: '1',
        callerid: `Interactive Call <1234567890>`,
        variable: `CALL_ID=${callId},TARGET_NUMBER=${phoneNumber},CALLER_NAME=${name}`,
        timeout: 30000
      };
      
      // Execute originate
      const result = await ami.action(action);
      console.log('AMI Originate result:', result);
      
      // Update call status
      this.updateCallStatus(callId, 'Call originated to ' + phoneNumber + ' - dialing');
      
      return callId;
    } catch (error) {
      console.error('Error initiating call:', error);
      this.updateCallStatus(callId, 'Failed to initiate call: ' + error.message);
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
      const { getAMI } = require('./asterisk/instance');
      const ami = getAMI();
      
      if (!ami) {
        throw new Error('AMI not available');
      }

      const callData = this.activeCalls.get(callId);
      if (!callData || !callData.channel) {
        throw new Error('Call channel not available');
      }

      // Convert audio path to Asterisk format (without extension)
      const audioFile = path.basename(audioPath, path.extname(audioPath));
      
      // Use Playback application
      const result = await ami.action({
        action: 'redirect',
        channel: callData.channel,
        context: 'interactive-call',
        exten: 'playback',
        priority: '1',
        variable: `AUDIO_FILE=${audioFile}`
      });

      console.log('Audio playback initiated:', result);
      return result;
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
    // Emit DTMF event manually for testing
    this.emit('menuOption', callId, digit);
    return { success: true, digit };
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
      const { getAMI } = require('./asterisk/instance');
      const ami = getAMI();
      
      const callData = this.activeCalls.get(callId);
      if (callData && callData.channel && ami) {
        await ami.action({
          action: 'hangup',
          channel: callData.channel
        });
      }
      
      this.handleCallEnded(callId);
      return { success: true };
    } catch (error) {
      console.error('Error ending call:', error);
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
