module.exports = {
  mongodb_uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/otpbot',

  // Telegram Bot Configuration
  telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN || '7878818658:AAGqSM0SmlOfgZCuhHYPdyheuTcyXmYgThc',
  creator_telegram_id: process.env.CREATOR_TELEGRAM_ID || '8171834446',

  // Asterisk AMI Configuration (This is for your Asterisk server, not MagnusBilling's AMI)
  // Assuming your bot connects to a local/VPS Asterisk instance
  asterisk: {
    host: process.env.ASTERISK_HOST || '127.0.0.1', // Your Asterisk server IP (e.g., localhost if bot and Asterisk are on same VPS)
    port: process.env.ASTERISK_PORT || 5038,
    username: process.env.ASTERISK_USERNAME || 'admin', // Your Asterisk AMI username
    password: process.env.ASTERISK_PASSWORD || 'p1manager123' // Your Asterisk AMI password
  },

  // SIP Configuration for MagnusBilling (as your SIP provider/trunk)
  sip: {
    // This host/domain is the public IP/domain of your MagnusBilling server
    host: process.env.SIP_HOST || '77.105.162.184', // From your text: http://77.105.162.184/
    domain: process.env.SIP_DOMAIN || '77.105.162.184', // Often same as host for direct IP connections
    port: process.env.SIP_PORT || 5060, // Standard SIP port

    // These are the credentials for the SIP user/account you want to use on MagnusBilling
    // You provided "sip user: 96938" and "sip password: nb2qH6AB"
    username: process.env.SIP_USERNAME || '96938', // SIP User (from your text)
    password: process.env.SIP_PASSWORD || 'nb2qH6AB', // SIP Password (from your text)

    // The trunk name as configured in MagnusBilling (from screenshot 1, Name field)
    trunk: process.env.SIP_TRUNK || 'Simonstern', // From screenshot 1: Name "Simonstern"

    // Caller ID to use when making calls through MagnusBilling
    caller_id: process.env.SIP_CALLER_ID || '13234624261' // From your text
  },

  // Server Configuration (for your bot's web server, e.g., Flask/Express)
  port: process.env.PORT || 5000,
  host: process.env.HOST || '0.0.0.0',

  // Available agents
  agents: ['default', 'support', 'sales']
};
