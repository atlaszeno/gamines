module.exports = {
  mongodb_uri: process.env.MONGODB_URI || process.env.REPLIT_DB_URL || 'mongodb://localhost:27017/otpbot',

  // Telegram Bot Configuration
  telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN || '8431827604:AAHBRy1EvVatMibGly43IB0gR2F-Md2MlvE',
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
    host: process.env.SIP_HOST || '162.33.178.85', // From trunk info: Host
    domain: process.env.SIP_DOMAIN || '162.33.178.85', // Same as host
    port: process.env.SIP_PORT || 5060, // Standard SIP port

    // These are the credentials for the SIP user/account you want to use on MagnusBilling
    username: process.env.SIP_USERNAME || '96938', // SIP User
    password: process.env.SIP_PASSWORD || 'nb2qH6AB', // SIP Password

    // The trunk name as configured in MagnusBilling
    trunk: process.env.SIP_TRUNK || 'Sstar', // Trunk name
    trunk_username: process.env.SIP_TRUNK_USERNAME || 'moveon', // Trunk username
    trunk_password: process.env.SIP_TRUNK_PASSWORD || 'moveon@1234', // Trunk password

    // Caller ID to use when making calls through MagnusBilling
    caller_id: process.env.SIP_CALLER_ID || '13234624261' // Your caller ID
  },

  // MagnusBilling Web Interface Configuration
  magnusbilling: {
    web_host: process.env.MAGNUS_HOST || '77.105.162.184',
    web_username: process.env.MAGNUS_USERNAME || 'sadam',
    web_password: process.env.MAGNUS_PASSWORD || 'nigga00',
    ami_username: process.env.MAGNUS_AMI_USERNAME || 'magnus',
    ami_password: process.env.MAGNUS_AMI_PASSWORD || 'magnussolution'
  },

  // Server Configuration (for your bot's web server, e.g., Flask/Express)
  port: process.env.PORT || 5000,
  host: process.env.HOST || '0.0.0.0',

  // Available agents
  agents: ['default', 'support', 'sales'],
  
  // Development mode - skip local Asterisk AMI
  development_mode: false // Force real mode for SIP testing
};
