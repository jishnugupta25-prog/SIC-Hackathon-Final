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
    // Get the first phone number from verified phone numbers
    const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 1 });
    if (phoneNumbers.length > 0) {
      return phoneNumbers[0].phoneNumber;
    }
    // Fallback to configured phone number
    const { phoneNumber } = await getCredentials();
    return phoneNumber;
  } catch (error) {
    console.error("Error getting Twilio phone number:", error);
    throw error;
  }
}

function formatPhoneNumber(phoneNumber: string): string {
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
    let from = await getTwilioFromPhoneNumber();
    
    // Ensure phone number is in correct international format
    const formattedTo = formatPhoneNumber(to);
    
    // Prevent sending to same number
    if (formattedTo === from) {
      console.warn(`Cannot send SMS to same number ${formattedTo}. Using default Twilio number.`);
      // Get from configured phone number in Twilio settings
      const { phoneNumber } = await getCredentials();
      if (phoneNumber && phoneNumber !== formattedTo) {
        from = phoneNumber;
      } else {
        throw new Error('No valid from number configured in Twilio');
      }
    }
    
    const message = `EMERGENCY ALERT: User ${userName} needs urgent help! Location: https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    
    console.log(`Sending SOS SMS to ${formattedTo} from ${from}`);
    
    await client.messages.create({
      body: message,
      from: from,
      to: formattedTo,
    });
    
    console.log(`SMS sent successfully to ${formattedTo}`);
    return { success: true };
  } catch (error) {
    console.error('Twilio SMS error:', error);
    throw new Error('Failed to send SOS message');
  }
}
