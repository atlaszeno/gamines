// Make sure phone number is in the correct format (eg. (703) 239-4244 => 17032394244)

exports.sanitize_phoneNumber = (phoneNumber) => {
  if (typeof phoneNumber !== "string") return "";

  // Remove all non-numeric characters (including parentheses, spaces, hyphens, etc.)
  let cleaned = phoneNumber.trim().replace(/\D/g, "");

  // Check if the number starts with a '+' and remove it
  if (phoneNumber.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  // If it's a 10-digit number, add the country code '1'
  if (cleaned.length === 10) {
    cleaned = "1" + cleaned;
  }

  // If it's an 11-digit number and starts with '1', it's valid
  if (cleaned.length !== 11 || !cleaned.startsWith("1")) {
    return ""; // Invalid number
  }

  return cleaned;
};
function sanitize_phoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove all non-numeric characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it starts with +1, keep it
  if (cleaned.startsWith('+1')) {
    return cleaned;
  }
  
  // If it starts with 1 and is 11 digits, add +
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return '+' + cleaned;
  }
  
  // If it's 10 digits, assume US number and add +1
  if (cleaned.length === 10) {
    return '+1' + cleaned;
  }
  
  return cleaned;
}

module.exports = {
  sanitize_phoneNumber
};
const validator = require('validator');

class SanitizationHelper {
  static sanitizePhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Validate length (should be 10-15 digits)
    if (cleaned.length < 10 || cleaned.length > 15) {
      return null;
    }
    
    return cleaned;
  }

  static sanitizeEmail(email) {
    if (!email) return null;
    
    const cleaned = email.trim().toLowerCase();
    
    if (!validator.isEmail(cleaned)) {
      return null;
    }
    
    return cleaned;
  }

  static sanitizeText(text, maxLength = 1000) {
    if (!text) return '';
    
    return text.trim().substring(0, maxLength);
  }

  static sanitizeAlphanumeric(input) {
    if (!input) return '';
    
    return input.replace(/[^a-zA-Z0-9]/g, '');
  }

  static validateDTMFCode(code) {
    if (!code) return false;
    
    // Should be exactly 6 digits
    return /^\d{6}$/.test(code);
  }

  static sanitizeCallerId(callerId) {
    if (!callerId) return 'Unknown';
    
    return callerId.trim().substring(0, 50);
  }

  static validateAudioFile(filename) {
    if (!filename) return false;
    
    const allowedExtensions = ['.wav', '.mp3', '.ogg', '.m4a'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    return allowedExtensions.includes(extension);
  }

  static sanitizeFilename(filename) {
    if (!filename) return 'unknown';
    
    // Remove path traversal attempts and special characters
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 255);
  }
}

module.exports = SanitizationHelper;
