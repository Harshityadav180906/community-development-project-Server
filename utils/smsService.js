/**
 * BhojanSetu SMS Notification Gateway Service
 * Simulates real-time telecom SMS dispatch to recipient NGOs and donors
 */

/**
 * Normalizes an Indian phone number to '+91 XXXXX XXXXX' format
 * Avoids duplicate '+91 +91' prefixes
 */
const formatPhoneNumber = (rawPhone = '') => {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return '+91 99887 76655';
  }
  // Remove all non-digits except initial '+'
  let cleaned = rawPhone.trim();
  // Strip duplicate +91 if present
  cleaned = cleaned.replace(/^(\+?91\s*)+/g, '');
  cleaned = cleaned.replace(/[^\d]/g, '');

  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return `+91 ${cleaned}`;
};

/**
 * Dispatches an SMS notification containing the food handover OTP
 * @param {Object} params
 * @param {string} params.phone - Recipient phone number
 * @param {string} params.otp - 4-digit handover verification code
 * @param {string} params.orderTitle - Title of the surplus food listing
 * @param {string} [params.recipientName] - Name of recipient or NGO
 * @returns {Promise<Object>} SMS delivery dispatch result
 */
const sendOtpSms = async ({ phone, otp, orderTitle, recipientName = 'NGO Partner' }) => {
  const formattedPhone = formatPhoneNumber(phone);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const message = `[BhojanSetu Alert] Your Food Handover OTP for order "${orderTitle}" is ${otp}. Please provide this 4-digit code to the delivery rider upon arrival. Sent at ${timeStr}.`;

  // Visual simulation log to server console
  console.log('\n======================================================');
  console.log('📲 [BHOJANSETU TELECOM SMS GATEWAY - OUTBOUND DISPATCH]');
  console.log(`📱 Recipient: ${recipientName} (${formattedPhone})`);
  console.log(`🍲 Order:     ${orderTitle}`);
  console.log(`🔑 OTP Code:  ${otp}`);
  console.log(`💬 Message:   ${message}`);
  console.log(`🕒 Timestamp: ${now.toISOString()} (${timeStr})`);
  console.log(`📡 Status:    DELIVERED (Network Signal 100% OK)`);
  console.log('======================================================\n');

  return {
    success: true,
    phone: formattedPhone,
    otp,
    message,
    sentAt: now,
    status: 'Delivered',
  };
};

module.exports = {
  formatPhoneNumber,
  sendOtpSms,
};
