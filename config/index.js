
module.exports = {
  mongodb_uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/otpbot',
  
  // Telegram Bot Configuration
  telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN || '7878818658:AAGqSM0SmlOfgZCuhHYPdyheuTcyXmYgThc',
  creator_telegram_id: process.env.CREATOR_TELEGRAM_ID || '8171834446',
  
  // Asterisk AMI Configuration
  asterisk: {
    host: process.env.ASTERISK_HOST || 'localhost',
    port: process.env.ASTERISK_PORT || 5038,
    username: process.env.ASTERISK_USERNAME || 'admin',
    password: process.env.ASTERISK_PASSWORD || 'amp111'
  },
  
  // SIP Configuration for MagnusBilling
  sip: {
    host: process.env.SIP_HOST || 'your-magnusbilling-server.com',
    domain: process.env.SIP_DOMAIN || 'your-magnusbilling-server.com',
    port: process.env.SIP_PORT || 5060,
    username: process.env.SIP_USERNAME || 'your-sip-username',
    password: process.env.SIP_PASSWORD || 'your-sip-password',
    trunk: process.env.SIP_TRUNK || 'magnusbilling-trunk'
  },
  
  // Server Configuration
  port: process.env.PORT || 5000,
  host: process.env.HOST || '0.0.0.0',
  
  // Available agents
  agents: ['default', 'support', 'sales']
};
