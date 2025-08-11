const Call = require("../models/call");
const { get_bot } = require("../telegram_bot/botInstance");
const { get_settings } = require("./settings");

let entries = [];
let unprocessedData = [];

const get_entry_by_number = (phoneNumber) => {
  return entries.find((entry) => entry.phoneNumber === phoneNumber) || null;
};

exports.add_entry_to_database = async (phoneNumber) => {
  const entry = get_entry_by_number(phoneNumber);
  const settings = get_settings();

  const existingCall = await Call.findOne({
    phoneNumber: `+${phoneNumber}`,
  });

  if (existingCall) {
    console.log(`Call entry for +${entry.phoneNumber} already exists.`);
    return;
  }

  if (!entry?.phoneNumber) {
    console.log("Failed to add entry: ", entry);
  }

  const newCall = new Call({
    phoneNumber: `+${entry?.phoneNumber}` || "",
    rawLine: entry.rawLine,
  });

  await newCall.save();

  const bot = get_bot();
  bot.sendMessage(
    settings.notifications_chat_id,
    `✅ ${entry.phoneNumber} pressed 1. Do /line to retrieve their info.`,
    { parse_mode: "HTML" }
  );
};

exports.add_entry_to_memory = (entry) => {
  if (!entries.some((e) => e.phoneNumber === entry.phoneNumber)) {
    entries.push(entry);
  }
};

exports.set_unprocessed_data = (data) => {
  unprocessedData = data;
};

exports.pop_unprocessed_line = () => {
  return unprocessedData.pop();
};
const fs = require('fs');
const path = require('path');

class EntriesManager {
  constructor() {
    this.entriesFile = path.join(__dirname, '../data/entries.json');
    this.ensureDataDir();
  }

  ensureDataDir() {
    const dataDir = path.dirname(this.entriesFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.entriesFile)) {
      fs.writeFileSync(this.entriesFile, JSON.stringify([], null, 2));
    }
  }

  getEntries() {
    try {
      const data = fs.readFileSync(this.entriesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading entries:', error);
      return [];
    }
  }

  addEntry(entry) {
    try {
      const entries = this.getEntries();
      const newEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...entry
      };
      entries.push(newEntry);
      fs.writeFileSync(this.entriesFile, JSON.stringify(entries, null, 2));
      return newEntry;
    } catch (error) {
      console.error('Error adding entry:', error);
      throw error;
    }
  }

  updateEntry(id, updates) {
    try {
      const entries = this.getEntries();
      const index = entries.findIndex(entry => entry.id === id);
      if (index === -1) {
        throw new Error('Entry not found');
      }
      entries[index] = { ...entries[index], ...updates };
      fs.writeFileSync(this.entriesFile, JSON.stringify(entries, null, 2));
      return entries[index];
    } catch (error) {
      console.error('Error updating entry:', error);
      throw error;
    }
  }

  deleteEntry(id) {
    try {
      const entries = this.getEntries();
      const filteredEntries = entries.filter(entry => entry.id !== id);
      fs.writeFileSync(this.entriesFile, JSON.stringify(filteredEntries, null, 2));
      return true;
    } catch (error) {
      console.error('Error deleting entry:', error);
      throw error;
    }
  }

  searchEntries(query) {
    try {
      const entries = this.getEntries();
      return entries.filter(entry => 
        JSON.stringify(entry).toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching entries:', error);
      return [];
    }
  }
}

module.exports = EntriesManager;
