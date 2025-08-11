
const SIP = require('sip.js');
const config = require('./config');
const EventEmitter = require('events');

class MagnusBillingSIPClient extends EventEmitter {
  constructor() {
    super();
    this.userAgent = null;
    this.activeSession = null;
  }

  async initialize() {
    try {
      // Configure SIP.js for MagnusBilling
      const sipConfig = {
        uri: `sip:${config.sip.username}@${config.sip.domain}`,
        transportOptions: {
          wsServers: [`wss://${config.sip.host}:${config.sip.port || 5060}/ws`],
          // Fallback to TCP if WebSocket not available
          traceSip: true
        },
        authorizationUsername: config.sip.username,
        authorizationPassword: config.sip.password,
        displayName: config.sip.caller_id,
        logBuiltinEnabled: true,
        logLevel: 'debug'
      };

      this.userAgent = new SIP.UserAgent(sipConfig);

      // Handle registration events
      this.userAgent.delegate = {
        onConnect: () => {
          console.log('✅ Connected to MagnusBilling SIP server');
          this.emit('connected');
        },
        onDisconnect: (error) => {
          console.log('❌ Disconnected from MagnusBilling SIP server:', error);
          this.emit('disconnected', error);
        },
        onInvite: (invitation) => {
          console.log('📞 Incoming call from:', invitation.remoteIdentity.uri);
          this.handleIncomingCall(invitation);
        }
      };

      await this.userAgent.start();
      console.log('🚀 MagnusBilling SIP client initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize MagnusBilling SIP client:', error);
      throw error;
    }
  }

  async makeCall(phoneNumber) {
    if (!this.userAgent) {
      throw new Error('SIP client not initialized');
    }

    try {
      // Format the target URI for MagnusBilling
      const targetUri = `sip:${phoneNumber}@${config.sip.domain}`;
      
      console.log(`📞 Making call to ${phoneNumber} via MagnusBilling`);
      
      // Create invitation
      const invitation = this.userAgent.invite(targetUri, {
        requestDelegate: {
          onAccept: (response) => {
            console.log('✅ Call accepted:', response);
            this.emit('callAccepted', phoneNumber, response);
          },
          onReject: (response) => {
            console.log('❌ Call rejected:', response);
            this.emit('callRejected', phoneNumber, response);
          },
          onCancel: (response) => {
            console.log('🚫 Call cancelled:', response);
            this.emit('callCancelled', phoneNumber, response);
          }
        },
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        }
      });

      this.activeSession = invitation;
      
      // Handle session events
      invitation.stateChange.addListener((state) => {
        console.log(`📱 Call state changed: ${state}`);
        this.emit('callStateChanged', phoneNumber, state);
        
        if (state === SIP.SessionState.Established) {
          console.log(`🎉 Call established with ${phoneNumber}`);
          this.emit('callEstablished', phoneNumber);
        } else if (state === SIP.SessionState.Terminated) {
          console.log(`📴 Call terminated with ${phoneNumber}`);
          this.emit('callTerminated', phoneNumber);
          this.activeSession = null;
        }
      });

      return {
        callId: invitation.id,
        session: invitation,
        phoneNumber: phoneNumber
      };
      
    } catch (error) {
      console.error('❌ Error making call:', error);
      throw error;
    }
  }

  async sendDTMF(digit) {
    if (!this.activeSession) {
      throw new Error('No active call session');
    }

    try {
      // Send DTMF tones
      await this.activeSession.sessionDescriptionHandler.sendDtmf(digit);
      console.log(`🔢 Sent DTMF: ${digit}`);
      this.emit('dtmfSent', digit);
      return true;
    } catch (error) {
      console.error('❌ Error sending DTMF:', error);
      throw error;
    }
  }

  async endCall() {
    if (!this.activeSession) {
      throw new Error('No active call session');
    }

    try {
      await this.activeSession.bye();
      console.log('📴 Call ended');
      this.emit('callEnded');
      this.activeSession = null;
      return true;
    } catch (error) {
      console.error('❌ Error ending call:', error);
      throw error;
    }
  }

  handleIncomingCall(invitation) {
    console.log('📞 Handling incoming call');
    
    // Auto-accept incoming calls (you can modify this logic)
    invitation.accept({
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
          video: false
        }
      }
    });

    this.activeSession = invitation;
    this.emit('incomingCall', invitation);
  }

  isConnected() {
    return this.userAgent && this.userAgent.isConnected();
  }

  async disconnect() {
    if (this.userAgent) {
      await this.userAgent.stop();
      this.userAgent = null;
      console.log('🔌 Disconnected from MagnusBilling');
    }
  }
}

module.exports = { MagnusBillingSIPClient };
