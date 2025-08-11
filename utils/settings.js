
let settings = {
  agent: 'default',
  notifications_chat_id: null
};

function get_settings() {
  return settings;
}

function set_settings(newSettings) {
  settings = { ...settings, ...newSettings };
  return settings;
}

module.exports = {
  get_settings,
  set_settings
};
const fs = require('fs');
const path = require('path');

class SettingsManager {
  constructor() {
    this.settingsFile = path.join(__dirname, '../data/settings.json');
    this.defaultSettings = {
      maxCallDuration: 300, // 5 minutes
      dtmfTimeout: 10, // 10 seconds
      enableLogging: true,
      maxConcurrentCalls: 10,
      audioFormats: ['wav', 'mp3'],
      ttsEngine: 'google',
      retryAttempts: 3,
      callbackEnabled: true,
      recordCalls: false,
      autoAnswer: false
    };
    this.ensureSettingsFile();
  }

  ensureSettingsFile() {
    const dataDir = path.dirname(this.settingsFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.settingsFile)) {
      this.saveSettings(this.defaultSettings);
    }
  }

  getSettings() {
    try {
      const data = fs.readFileSync(this.settingsFile, 'utf8');
      const settings = JSON.parse(data);
      // Merge with defaults to ensure all settings exist
      return { ...this.defaultSettings, ...settings };
    } catch (error) {
      console.error('Error reading settings:', error);
      return this.defaultSettings;
    }
  }

  getSetting(key) {
    const settings = this.getSettings();
    return settings[key];
  }

  setSetting(key, value) {
    try {
      const settings = this.getSettings();
      settings[key] = value;
      this.saveSettings(settings);
      return true;
    } catch (error) {
      console.error('Error setting value:', error);
      return false;
    }
  }

  updateSettings(newSettings) {
    try {
      const currentSettings = this.getSettings();
      const updatedSettings = { ...currentSettings, ...newSettings };
      this.saveSettings(updatedSettings);
      return updatedSettings;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  saveSettings(settings) {
    try {
      fs.writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  resetToDefaults() {
    try {
      this.saveSettings(this.defaultSettings);
      return this.defaultSettings;
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw error;
    }
  }

  validateSettings(settings) {
    const errors = [];
    
    if (settings.maxCallDuration && (settings.maxCallDuration < 30 || settings.maxCallDuration > 3600)) {
      errors.push('Max call duration must be between 30 and 3600 seconds');
    }
    
    if (settings.dtmfTimeout && (settings.dtmfTimeout < 5 || settings.dtmfTimeout > 60)) {
      errors.push('DTMF timeout must be between 5 and 60 seconds');
    }
    
    if (settings.maxConcurrentCalls && (settings.maxConcurrentCalls < 1 || settings.maxConcurrentCalls > 100)) {
      errors.push('Max concurrent calls must be between 1 and 100');
    }
    
    return errors;
  }
}

module.exports = SettingsManager;
