
const AMI = require('asterisk-manager');
const EventEmitter = require('events');
const config = require('../config');

let ami = null;
let connected = false;
const dtmfEventEmitter = new EventEmitter();
const activeCalls = new Map();

// Initialize AMI connection
async function initializeAMI() {
  try {
    ami = new AMI(
      config.asterisk.port,
      config.asterisk.host,
      config.asterisk.username,
      config.asterisk.password,
      false
    );

    ami.keepConnected();

    ami.on('connect', () => {
      console.log('✅ Connected to Asterisk AMI');
      connected = true;
    });

    ami.on('disconnect', () => {
      console.log('❌ Disconnected from Asterisk AMI');
      connected = false;
    });

    ami.on('error', (error) => {
      console.error('❌ Asterisk AMI Error:', error);
    });

    // Handle various AMI events
    ami.on('managerevent', (event) => {
      handleAMIEvent(event);
    });

    return ami;
  } catch (error) {
    console.error('Failed to initialize AMI:', error);
    throw error;
  }
}

function handleAMIEvent(event) {
  const eventName = event.event;
  
  switch (eventName) {
    case 'Newstate':
      if (event.channelstate === '6' && event.channelstatedesc === 'Up') {
        const callId = extractCallId(event.channel);
        if (callId) {
          console.log(`📞 Call answered: ${callId}`);
          dtmfEventEmitter.emit('callAnswered', callId);
        }
      }
      break;
      
    case 'UserEvent':
      if (event.userevent === 'CallAnswered') {
        const callId = event.call_id || extractCallId(event.channel);
        if (callId) {
          console.log(`📞 User event - Call answered: ${callId}`);
          dtmfEventEmitter.emit('callAnswered', callId);
        }
      } else if (event.userevent === 'MenuOption') {
        const callId = event.call_id || extractCallId(event.channel);
        const option = event.option;
        if (callId && option) {
          console.log(`🔢 Menu option ${option} pressed for call ${callId}`);
          dtmfEventEmitter.emit('menuOption', callId, option);
        }
      } else if (event.userevent === 'DTMFCode') {
        const callId = event.call_id || extractCallId(event.channel);
        const code = event.code;
        if (callId && code) {
          console.log(`🔢 DTMF code ${code} received for call ${callId}`);
          dtmfEventEmitter.emit('dtmfCodeReceived', callId, code);
        }
      }
      break;
      
    case 'Hangup':
      const callId = extractCallId(event.channel);
      if (callId) {
        console.log(`📞 Call ended: ${callId}`);
        dtmfEventEmitter.emit('callEnded', callId, activeCalls.get(callId));
        activeCalls.delete(callId);
      }
      break;
  }
}

function extractCallId(channel) {
  if (!channel) return null;
  const match = channel.match(/SIP\/.*?-([a-f0-9]+)/);
  return match ? match[1] : null;
}

async function waitForConnection(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (connected) {
      resolve(ami);
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error('AMI connection timeout'));
    }, timeout);

    ami.on('connect', () => {
      clearTimeout(timer);
      resolve(ami);
    });
  });
}

function getCallById(callId) {
  return activeCalls.get(callId);
}

function setCallAwaitingDTMF(callId, awaiting = true) {
  const callData = activeCalls.get(callId);
  if (callData) {
    callData.awaitingDTMF = awaiting;
    if (awaiting) {
      callData.dtmfCode = '';
    }
    activeCalls.set(callId, callData);
  }
}

function isConnected() {
  return connected;
}

// Initialize AMI when this module is loaded
initializeAMI().catch(console.error);

module.exports = {
  initializeAMI,
  waitForConnection,
  dtmfEventEmitter,
  getAMI: () => ami,
  ami: ami,
  isConnected,
  getCallById,
  setCallAwaitingDTMF
};
