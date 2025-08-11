
const axios = require('axios');
const readline = require('readline');

class InteractiveDTMFController {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.currentCallId = null;
    this.rl = null;
  }

  start() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n🎮 Interactive DTMF Controller');
    console.log('================================');
    console.log('Commands:');
    console.log('  call [phone] - Make a new call');
    console.log('  press1       - Simulate caller pressing "1"');
    console.log('  enter696969  - Simulate caller entering code "696969"');
    console.log('  status       - Show current call status');
    console.log('  end          - End current call');
    console.log('  exit         - Exit controller');
    console.log('================================\n');

    this.rl.on('line', async (input) => {
      await this.processCommand(input.trim());
      this.rl.prompt();
    });

    this.rl.prompt();
  }

  async processCommand(command) {
    try {
      if (command === 'exit') {
        console.log('👋 Goodbye!');
        this.rl.close();
        process.exit(0);
        return;
      }

      if (command.startsWith('call ')) {
        const phone = command.split(' ')[1];
        await this.makeCall(phone);
        return;
      }

      if (command === 'press1') {
        await this.sendDTMF('1');
        return;
      }

      if (command === 'enter696969') {
        await this.sendDTMFCode('696969');
        return;
      }

      if (command === 'status') {
        await this.getCallStatus();
        return;
      }

      if (command === 'end') {
        await this.endCall();
        return;
      }

      console.log('❌ Unknown command. Type "exit" to quit.');
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  async makeCall(phone) {
    if (!phone) {
      console.log('❌ Please provide a phone number');
      return;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/make-call`, {
        phoneNumber: phone,
        name: 'DTMF Test'
      });

      if (response.data.success) {
        this.currentCallId = response.data.callId;
        console.log(`✅ Call initiated: ${this.currentCallId}`);
        console.log('📞 Phone:', phone);
      } else {
        console.log('❌ Failed to initiate call');
      }
    } catch (error) {
      console.error('❌ Error making call:', error.message);
    }
  }

  async sendDTMF(digit) {
    if (!this.currentCallId) {
      console.log('❌ No active call. Use "call [phone]" first.');
      return;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/send-manual-dtmf`, {
        callId: this.currentCallId,
        digit: digit
      });

      if (response.data.success) {
        console.log(`✅ DTMF "${digit}" sent successfully`);
      } else {
        console.log('❌ Failed to send DTMF');
      }
    } catch (error) {
      console.error('❌ Error sending DTMF:', error.message);
    }
  }

  async sendDTMFCode(code) {
    if (!this.currentCallId) {
      console.log('❌ No active call. Use "call [phone]" first.');
      return;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/send-dtmf-code`, {
        callId: this.currentCallId,
        code: code
      });

      if (response.data.success) {
        console.log(`✅ DTMF code "${code}" sent successfully`);
      } else {
        console.log('❌ Failed to send DTMF code');
      }
    } catch (error) {
      console.error('❌ Error sending DTMF code:', error.message);
    }
  }

  async getCallStatus() {
    if (!this.currentCallId) {
      console.log('❌ No active call');
      return;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/api/call-status/${this.currentCallId}`);
      
      if (response.data.success) {
        const status = response.data.status;
        console.log('\n📊 Call Status:');
        console.log(`   ID: ${status.id}`);
        console.log(`   Phone: ${status.phoneNumber}`);
        console.log(`   Name: ${status.name}`);
        console.log(`   Status: ${status.status}`);
        console.log(`   Started: ${new Date(status.timestamp).toLocaleString()}`);
        if (status.dtmfCode) {
          console.log(`   DTMF Code: ${status.dtmfCode}`);
        }
        console.log('');
      } else {
        console.log('❌ Failed to get call status');
      }
    } catch (error) {
      console.error('❌ Error getting call status:', error.message);
    }
  }

  async endCall() {
    if (!this.currentCallId) {
      console.log('❌ No active call');
      return;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/end-call`, {
        callId: this.currentCallId
      });

      if (response.data.success) {
        console.log('✅ Call ended successfully');
        this.currentCallId = null;
      } else {
        console.log('❌ Failed to end call');
      }
    } catch (error) {
      console.error('❌ Error ending call:', error.message);
    }
  }
}

// Start the controller if this file is run directly
if (require.main === module) {
  const controller = new InteractiveDTMFController();
  controller.start();
}

module.exports = InteractiveDTMFController;
