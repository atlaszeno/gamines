
const mongoose = require('mongoose');

const allowedSchema = new mongoose.Schema({
  telegram_id: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Allowed', allowedSchema);
