
module.exports = {
  mongodb_uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/otpbot',
  
  // Telegram Bot Configuration
  telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN || '8030897383:AAEKEgRenaELYI7LGq2rrAWDbY4aCsz-a8Q',
  creator_telegram_id: process.env.CREATOR_TELEGRAM_ID || '8171834446',
  
  // Asterisk AMI Configuration
  asterisk: {
    host: process.env.ASTERISK_HOST || 'localhost',
    port: process.env.ASTERISK_PORT || 5038,
    username: process.env.ASTERISK_USERNAME || 'admin',
    password: process.env.ASTERISK_PASSWORD || 'amp111'
  },
  
  // SIP Configuration
  sip: {
    host: process.env.SIP_HOST || 'localhost',
    domain: process.env.SIP_DOMAIN || 'localhost',
    username: process.env.SIP_USERNAME || 'test',
    password: process.env.SIP_PASSWORD || 'test123'
  },
  
  // Server Configuration
  port: process.env.PORT || 5000,
  host: process.env.HOST || '0.0.0.0',
  
  // Available agents
  agents: ['default', 'support', 'sales'],
  
  // Development settings
  mock_asterisk: process.env.MOCK_ASTERISK !== 'false' // Default to true unless explicitly disabled
};
