
const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true
  },
  rawLine: {
    type: String,
    default: ''
  },
  used: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Call', callSchema);
