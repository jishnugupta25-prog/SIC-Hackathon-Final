// From twilio blueprint - SMS functionality
import twilio from 'twilio';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
    throw new Error('Twilio not connected');
  }
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });
}

export async function getTwilioFromPhoneNumber() {
  try {
    const client = await getTwilioClient();
    // Get all available phone numbers
    const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 10 });
    console.log(`Found ${phoneNumbers.length} Twilio phone numbers`);
    
    if (phoneNumbers.length > 0) {
      // Find a number that's in the account and suitable for sending
      for (const num of phoneNumbers) {
        console.log(`Available Twilio number: ${num.phoneNumber}`);
        return num.phoneNumber;
      }
    }
    
    // Fallback to configured phone number
    const credentials = await getCredentials();
    if (credentials.phoneNumber) {
      console.log(`Using configured Twilio number: ${credentials.phoneNumber}`);
      return credentials.phoneNumber;
    }
    
    throw new Error('No Twilio phone numbers available');
  } catch (error) {
    console.error("Error getting Twilio phone number:", error);
    throw error;
  }
}

export function formatPhoneNumber(phoneNumber: string): string {
  // Remove any spaces, dashes, or special characters
  let cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
  
  // If it starts with +, it's already in international format
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If it starts with 0, replace with country code (assume India +91 if not specified)
  if (cleaned.startsWith('0')) {
    return '+91' + cleaned.substring(1);
  }
  
  // If it's just digits and doesn't start with +, assume India
  if (/^\d+$/.test(cleaned)) {
    // If it's 10 digits, it's an Indian number without country code
    if (cleaned.length === 10) {
      return '+91' + cleaned;
    }
    // If it's already 12 digits (91 + 10), format it
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return '+' + cleaned;
    }
  }
  
  // If no country code detected and it's a 10-digit Indian number, add +91
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }
  
  // Otherwise, add + if not present
  if (!cleaned.startsWith('+')) {
    return '+' + cleaned;
  }
  
  return cleaned;
}

export async function sendSosMessage(to: string, userName: string, location: { latitude: number; longitude: number }) {
  try {
    const client = await getTwilioClient();
    
    // Ensure phone number is in correct international format
    const formattedTo = formatPhoneNumber(to);
    console.log(`Preparing to send SMS to: ${formattedTo}`);
    
    let from;
    try {
      from = await getTwilioFromPhoneNumber();
      console.log(`Got Twilio from number: ${from}`);
    } catch (phoneError) {
      console.error("Error getting from number:", phoneError);
      throw new Error('Unable to get Twilio sender number. Please configure a phone number in Twilio account.');
    }
    
    // Prevent sending to same number
    if (formattedTo === from) {
      console.error(`BLOCKED: Cannot send SMS from ${from} to same number ${formattedTo}`);
      throw new Error('Cannot send SOS to same phone number. Please add a different emergency contact number.');
    }
    
    const message = `EMERGENCY ALERT: User ${userName} needs urgent help! Location: https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    
    console.log(`[SMS] From: ${from}, To: ${formattedTo}`);
    console.log(`[SMS] Message: ${message}`);
    
    const result = await client.messages.create({
      body: message,
      from: from,
      to: formattedTo,
    });
    
    console.log(`✓ SMS sent successfully. SID: ${result.sid}`);
    return { success: true, messageSid: result.sid };
  } catch (error) {
    console.error('Twilio SMS error:', error);
    throw error;
  }
}
