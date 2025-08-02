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
