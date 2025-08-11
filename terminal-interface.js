
const axios = require('axios');

class TerminalInterface {
  constructor() {
    this.activeCallId = null;
    this.readline = require('readline');
    this.rl = null;
  }

  setActiveCallId(callId) {
    this.activeCallId = callId;
  }

  async promptForDTMFDigit1(callId) {
    console.log('\n🎯 DTMF SIMULATION PROMPT');
    console.log(`📞 Call ID: ${callId}`);
    console.log('🔢 The caller should press "1" to continue to the interactive menu.');
    console.log('💡 To simulate this, you can:');
    console.log('   1. Use the API: POST /api/send-manual-dtmf');
    console.log('   2. Or run: node interactive_dtmf.js');
    console.log('⏳ Waiting for DTMF input from caller...\n');
  }

  async promptForDTMFCode(callId) {
    console.log('\n🎯 DTMF CODE INPUT PROMPT');
    console.log(`📞 Call ID: ${callId}`);
    console.log('🔢 The caller should now enter a 6-digit code.');
    console.log('💡 To simulate this, you can:');
    console.log('   1. Use the API: POST /api/send-dtmf-code');
    console.log('   2. Or run: node interactive_dtmf.js');
    console.log('⏳ Waiting for 6-digit code from caller...\n');
  }

  async simulateDTMF(digit) {
    if (!this.activeCallId) {
      console.log('❌ No active call to send DTMF to');
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/send-manual-dtmf', {
        callId: this.activeCallId,
        digit: digit
      });
      console.log(`✅ DTMF ${digit} sent successfully`);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending DTMF:', error.message);
    }
  }

  async simulateDTMFCode(code) {
    if (!this.activeCallId) {
      console.log('❌ No active call to send DTMF code to');
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/send-dtmf-code', {
        callId: this.activeCallId,
        code: code
      });
      console.log(`✅ DTMF code ${code} sent successfully`);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending DTMF code:', error.message);
    }
  }

  startInteractiveMode() {
    if (this.rl) {
      this.rl.close();
    }

    this.rl = this.readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n🎮 DTMF SIMULATION MODE ACTIVE');
    console.log('Commands:');
    console.log('  1 - Send DTMF digit "1"');
    console.log('  code XXXXXX - Send 6-digit code');
    console.log('  call PHONE - Make test call');
    console.log('  exit - Exit interactive mode');
    console.log('');

    this.rl.on('line', async (input) => {
      const trimmed = input.trim().toLowerCase();
      
      if (trimmed === 'exit') {
        console.log('👋 Exiting interactive mode');
        this.rl.close();
        return;
      }
      
      if (trimmed === '1') {
        await this.simulateDTMF('1');
      } else if (trimmed.startsWith('code ')) {
        const code = trimmed.replace('code ', '').replace(/\s/g, '');
        if (code.length === 6 && /^\d+$/.test(code)) {
          await this.simulateDTMFCode(code);
        } else {
          console.log('❌ Please provide a valid 6-digit code');
        }
      } else if (trimmed.startsWith('call ')) {
        const phone = trimmed.replace('call ', '').replace(/\s/g, '');
        await this.makeTestCall(phone);
      } else {
        console.log('❌ Unknown command. Type "exit" to quit.');
      }
      
      console.log('> ');
    });

    this.rl.prompt();
  }

  async makeTestCall(phoneNumber) {
    try {
      const response = await axios.post('http://localhost:5000/api/make-call', {
        phoneNumber: phoneNumber,
        name: 'Test Call'
      });
      
      if (response.data.success) {
        this.setActiveCallId(response.data.callId);
        console.log(`✅ Test call initiated: ${response.data.callId}`);
      } else {
        console.log('❌ Failed to initiate test call');
      }
    } catch (error) {
      console.error('❌ Error making test call:', error.message);
    }
  }

  stop() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}

module.exports = { TerminalInterface };
