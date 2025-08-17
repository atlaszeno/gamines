
const TelegramBot = require("node-telegram-bot-api");
const config = require("../config");

let bot = null;
let isStarting = false;
let instanceId = null;
const messageQueue = [];
let isProcessingQueue = false;

function get_bot() {
  return bot;
}

// Rate limiting function to prevent 429 errors
async function processMessageQueue() {
  if (isProcessingQueue || messageQueue.length === 0) return;

  isProcessingQueue = true;

  while (messageQueue.length > 0) {
    const { method, args, resolve, reject } = messageQueue.shift();

    try {
      let result;
      if (method === 'sendMessage') {
        result = await bot._originalSendMessage(...args);
      } else if (method === 'answerCallbackQuery') {
        result = await bot._originalAnswerCallbackQuery(...args);
      } else {
        result = await bot[method](...args);
      }
      console.log('✅ Message sent successfully:', method);
      resolve(result);
    } catch (error) {
      if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 429) {
        const retryAfter = error.response.body?.parameters?.retry_after || 4;
        console.log(`⏳ Rate limited. Retrying after ${retryAfter} seconds...`);

        // Put the message back at the front of the queue
        messageQueue.unshift({ method, args, resolve, reject });

        // Wait for the specified time
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      } else if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 403) {
        console.error('❌ Bot was kicked from chat or forbidden:', error.message);
        reject(error);
      } else {
        console.error('❌ Telegram error:', error.message);
        reject(error);
      }
    }

    // Small delay between messages to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  isProcessingQueue = false;
}

// Wrapper function for bot methods with rate limiting
function queueBotMethod(method, ...args) {
  return new Promise((resolve, reject) => {
    messageQueue.push({ method, args, resolve, reject });
    processMessageQueue();
  });
}

async function start_bot_instance() {
  // Prevent multiple simultaneous starts
  if (isStarting) {
    console.log('⏳ Bot is already starting, waiting...');
    // Wait for the current startup to complete
    while (isStarting) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return bot;
  }

  if (bot) {
    console.log('✅ Bot instance already exists, returning existing instance');
    return bot;
  }

  if (!config.telegram_bot_token) {
    console.error('❌ Telegram bot token not configured');
    throw new Error('Telegram bot token is required');
  }

  // Validate token format
  if (!config.telegram_bot_token.match(/^\d+:[A-Za-z0-9_-]+$/)) {
    console.error('❌ Invalid Telegram bot token format');
    throw new Error('Invalid bot token format');
  }

  isStarting = true;
  instanceId = Date.now().toString();

  try {
    console.log('🚀 Starting Telegram bot with token:', config.telegram_bot_token.substring(0, 20) + '...');
    console.log('🆔 Bot instance ID:', instanceId);

    // Create bot instance without polling first
    bot = new TelegramBot(config.telegram_bot_token, { polling: false });

    // Clear any existing webhooks first
    try {
      console.log('🔧 Clearing any existing webhooks...');
      const result = await bot.setWebHook('', { drop_pending_updates: true });
      console.log('✅ Webhooks cleared:', result);
      
      // Wait a moment to ensure webhook is fully cleared
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.log('⚠️ Could not clear webhook:', error.message);
    }

    // Store original methods for rate limiting
    const originalSendMessage = bot.sendMessage.bind(bot);
    const originalAnswerCallbackQuery = bot.answerCallbackQuery.bind(bot);

    bot._originalSendMessage = originalSendMessage;
    bot._originalAnswerCallbackQuery = originalAnswerCallbackQuery;

    // Override methods to use rate limiting
    bot.sendMessage = (chatId, text, options = {}) => {
      console.log('📤 Sending message to', chatId, ':', text.substring(0, 50));
      return queueBotMethod('sendMessage', chatId, text, options);
    };

    bot.answerCallbackQuery = (callbackQueryId, options = {}) => {
      return queueBotMethod('answerCallbackQuery', callbackQueryId, options);
    };

    // Start polling with proper error handling
    console.log('🔄 Starting bot polling...');
    bot.startPolling({
      interval: 1000,
      params: {
        timeout: 10,
        allowed_updates: ['message', 'callback_query']
      }
    });

    // Handle polling errors with better recovery
    bot.on('polling_error', async (error) => {
      console.error('❌ Polling error:', error.message);
      
      if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 401) {
        console.error('❌ Bot token is invalid or expired. Please update TELEGRAM_BOT_TOKEN in secrets.');
        bot.stopPolling();
        bot = null;
        isStarting = false;
        return;
      }
      
      if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 409) {
        console.log('🔧 Conflict detected - another bot instance is running');
        console.log('🛑 Terminating this instance to avoid conflicts');
        
        try {
          // Stop polling immediately
          bot.stopPolling();
          console.log('⏹️ Polling stopped');
          
          // Clear webhooks
          try {
            await bot.setWebHook('', { drop_pending_updates: true });
            console.log('🗑️ Webhooks cleared after conflict');
          } catch (webhookError) {
            console.log('⚠️ Could not clear webhook after conflict:', webhookError.message);
          }
          
          // Reset bot instance completely
          bot = null;
          isStarting = false;
          console.log('🔄 Bot instance reset due to conflict');
          
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup bot after conflict:', cleanupError.message);
          bot = null;
          isStarting = false;
        }
      }
    });

    // Test bot connection
    try {
      const botInfo = await bot.getMe();
      console.log('✅ Bot connected successfully:', botInfo.username);
      console.log('🆔 Bot ID:', botInfo.id);
    } catch (error) {
      console.error('❌ Failed to get bot info:', error.message);
      throw error;
    }

    // Handle webhook errors
    bot.on('webhook_error', (error) => {
      console.error('⚠️ Webhook error:', error.message);
    });

    console.log('✅ Telegram bot instance created and configured');
    
  } catch (error) {
    console.error('❌ Failed to start bot instance:', error.message);
    bot = null;
    throw error;
  } finally {
    isStarting = false;
  }

  return bot;
}

// Cleanup function to properly stop the bot
async function cleanupBot() {
  if (bot) {
    try {
      console.log('🧹 Cleaning up bot...');
      
      if (bot.isPolling()) {
        bot.stopPolling();
        console.log('⏹️ Bot polling stopped');
      }
      
      try {
        await bot.setWebHook('', { drop_pending_updates: true });
        console.log('🗑️ Webhook deleted and pending updates dropped');
      } catch (error) {
        console.log('⚠️ Could not delete webhook during cleanup:', error.message);
      }
      
      bot = null;
      console.log('✅ Bot cleanup completed');
    } catch (error) {
      console.error('❌ Error during bot cleanup:', error.message);
    }
  }
}

// Add process handlers for proper cleanup
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, cleaning up bot...');
  await cleanupBot();
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, cleaning up bot...');
  await cleanupBot();
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.code === 'ETELEGRAM') {
    console.error('⚠️ Unhandled Telegram error:', reason.message);
    return;
  }
  console.error('⚠️ Unhandled promise rejection:', reason);
});

module.exports = {
  start_bot_instance,
  get_bot,
  cleanupBot
};
