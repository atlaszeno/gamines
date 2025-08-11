const TelegramBot = require("node-telegram-bot-api");
const config = require("../config");

let bot;
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
      console.log('Message sent successfully:', method);
      resolve(result);
    } catch (error) {
      if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 429) {
        const retryAfter = error.response.body?.parameters?.retry_after || 4;
        console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);

        // Put the message back at the front of the queue
        messageQueue.unshift({ method, args, resolve, reject });

        // Wait for the specified time
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      } else if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 403) {
        console.error('Bot was kicked from chat or forbidden:', error.message);
        reject(error);
      } else {
        console.error('Telegram error:', error.message);
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
  if (bot) {
    console.log('✅ Bot instance already exists, returning existing instance');
    return bot;
  }

  if (!config.telegram_bot_token) {
    console.error('❌ Telegram bot token not configured');
    throw new Error('Telegram bot token is required');
  }

  console.log('Starting Telegram bot with token:', config.telegram_bot_token.substring(0, 20) + '...');

  try {
    // Create bot instance without polling first
    bot = new TelegramBot(config.telegram_bot_token, { polling: false });

    // Check for existing webhooks and remove them
    try {
      const webhookInfo = await bot.getWebhookInfo();
      if (webhookInfo.url) {
        console.log('🔧 Removing existing webhook...');
        await bot.deleteWebhook();
        // Wait a bit after webhook deletion
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log('⚠️ Could not check/remove webhook:', error.message);
    }

    // Start polling with conflict resolution
    await bot.startPolling({
      interval: 1000,
      params: {
        timeout: 10
      }
    });

    console.log('Bot instance created, starting polling...');

    // Store original methods
    const originalSendMessage = bot.sendMessage.bind(bot);
    const originalAnswerCallbackQuery = bot.answerCallbackQuery.bind(bot);

    // Store original methods for queue processing
    bot._originalSendMessage = originalSendMessage;
    bot._originalAnswerCallbackQuery = originalAnswerCallbackQuery;

    // Override sendMessage to use rate limiting
    bot.sendMessage = (chatId, text, options = {}) => {
      console.log('Sending message to', chatId, ':', text.substring(0, 50));
      return queueBotMethod('sendMessage', chatId, text, options);
    };

    // Override answerCallbackQuery to use rate limiting
    bot.answerCallbackQuery = (callbackQueryId, options = {}) => {
      return queueBotMethod('answerCallbackQuery', callbackQueryId, options);
    };

    // Handle polling errors
    bot.on('polling_error', (error) => {
      console.error('Polling error:', error.message);
      if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 409) {
        console.log('Conflict error - another instance might be running');
        
        // Stop current polling and wait before restarting
        setTimeout(async () => {
          try {
            console.log('🔄 Attempting to resolve bot conflict...');
            
            // Stop polling first
            if (bot.isPolling()) {
              bot.stopPolling();
              console.log('⏹️ Stopped existing polling');
            }
            
            // Clear any existing webhooks
            try {
              await bot.deleteWebhook();
              console.log('🗑️ Cleared webhooks');
            } catch (webhookError) {
              console.log('⚠️ Could not clear webhook:', webhookError.message);
            }
            
            // Wait before restarting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Restart polling
            await bot.startPolling({
              interval: 1000,
              params: { timeout: 10 }
            });
            console.log('✅ Successfully restarted bot polling');
          } catch (restartError) {
            console.error('❌ Failed to restart polling:', restartError.message);
          }
        }, 5000);
      }
    });

    // Test bot connection
    bot.getMe().then(info => {
      console.log('Bot connected successfully:', info.username);
    }).catch(error => {
      console.error('Failed to connect bot:', error.message);
    });

    // Handle webhook errors
    bot.on('webhook_error', (error) => {
      console.error('Webhook error:', error.message);
    });

    // Add error handling for unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      if (reason && reason.code === 'ETELEGRAM') {
        console.error('Unhandled Telegram error:', reason.message);
        return;
      }
      console.error('Unhandled promise rejection:', reason);
    });

    // Add cleanup handlers
    process.on('SIGTERM', async () => {
      console.log('🛑 Received SIGTERM, cleaning up bot...');
      await cleanupBot();
    });

    process.on('SIGINT', async () => {
      console.log('🛑 Received SIGINT, cleaning up bot...');
      await cleanupBot();
    });

    console.log('✅ Telegram bot instance created');
  } catch (error) {
    console.error('❌ Failed to start bot instance:', error.message);
    bot = null;
    throw error;
  }

  return bot;
}

// Cleanup function to properly stop the bot
async function cleanupBot() {
  if (bot) {
    try {
      if (bot.isPolling()) {
        bot.stopPolling();
        console.log('⏹️ Bot polling stopped');
      }
      
      try {
        await bot.deleteWebhook();
        console.log('🗑️ Webhook deleted');
      } catch (error) {
        console.log('⚠️ Could not delete webhook:', error.message);
      }
      
      bot = null;
      console.log('✅ Bot cleanup completed');
    } catch (error) {
      console.error('❌ Error during bot cleanup:', error.message);
    }
  }
}

module.exports = {
  start_bot_instance,
  get_bot,
  cleanupBot
};