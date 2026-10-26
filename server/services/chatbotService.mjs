import { genAI, GEMINI_MODEL } from '../config/gemini.mjs';
import { pool } from '../config/db.mjs';

// ============================================
// SYSTEM INSTRUCTION FOR GOOGLE GEMINI
// Defines bot identity, capabilities, and guidelines.
// ============================================
const SYSTEM_INSTRUCTION = `
You are the CP Truck Virtual Assistant — an intelligent, polite, and helpful customer support chatbot for CP Truck (an intelligent dispatch and package delivery system).

About CP Truck:
- Allows customers to request a dispatch rider to pick up and deliver packages.
- Operates intra-state dispatch deliveries exclusively within Enugu State, Nigeria (covering Enugu metropolis, Nsukka, UNN campus, 9th Mile, Agbani, Udi, etc.). Both pickup and destination addresses must be within Enugu State.
- Features real-time package tracking with a unique Tracking ID (format: CPT-YYYYMMDD-XXXX).
- Provides machine learning & Google Maps-based delivery time predictions.
- Secures online transactions with fraud risk assessment and Paystack payments.
- Once a delivery request is approved by an administrator and paid for, a rider is assigned and live tracking begins.
- Delivery status progresses: pending_pickup -> picked_up -> in_transit -> delivered.

Instructions:
1. Be warm, professional, concise, and helpful.
2. If a customer provides a tracking ID or asks about the status of an order/package, call the 'get_tracking_status' tool to look up real-time information.
3. Never invent fake tracking status, ETA, or rider details.
4. If a question is outside the scope of dispatch delivery (e.g. general programming, entertainment), politely redirect the user back to CP Truck delivery services.
5. All payments are done securely through the platform; never ask customers for credit card or bank details.
`.trim();

// ============================================
// GEMINI TOOL DECLARATION (Function Calling)
// ============================================
const trackingToolDeclaration = {
  functionDeclarations: [
    {
      name: 'get_tracking_status',
      description: "Looks up the current status, estimated delivery time, and assigned rider details for a customer's package using its tracking ID.",
      parameters: {
        type: 'OBJECT',
        properties: {
          tracking_id: {
            type: 'STRING',
            description: 'The package tracking ID, e.g. CPT-20261024-4F2A',
          },
        },
        required: ['tracking_id'],
      },
    },
  ],
};

// ============================================
// DATABASE LOOKUP FOR TRACKING
// Security check: Ensures customer can only view their own package.
// ============================================
export const executeGetTrackingStatus = async (customerId, trackingId) => {
  if (!trackingId) {
    return { error: 'Please provide a valid tracking ID.' };
  }

  const cleanTrackingId = trackingId.trim().toUpperCase();

  const [rows] = await pool.query(
    `SELECT t.tracking_id, t.current_status, dr.predicted_delivery_time,
            dr.pickup_address, dr.destination_address, dr.customer_id,
            dr.package_description,
            u.full_name AS rider_name, u.phone AS rider_phone
     FROM tracking t
     JOIN dispatch_requests dr ON t.request_id = dr.id
     LEFT JOIN users u ON t.rider_id = u.id
     WHERE UPPER(t.tracking_id) = ?`,
    [cleanTrackingId]
  );

  if (rows.length === 0) {
    return { error: `No package found matching tracking ID: ${cleanTrackingId}` };
  }

  const result = rows[0];

  if (result.customer_id !== customerId) {
    return { error: 'This tracking ID is associated with a different customer account.' };
  }

  delete result.customer_id;
  return result;
};

// ============================================
// INTELLIGENT RULE & KB FALLBACK
// Ensures the chatbot works during demonstrations
// even when an API key is missing or quota is exceeded.
// ============================================
const handleFallbackReply = async (customerId, userMessage) => {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();

  // 1. Check for tracking ID pattern (e.g. CPT-20260908-1234 or CPT-...)
  const trackingMatch = text.match(/CPT-[A-Za-z0-9-]+/i);
  if (trackingMatch || lower.includes('track') || lower.includes('status')) {
    if (trackingMatch) {
      const trackingId = trackingMatch[0].toUpperCase();
      const status = await executeGetTrackingStatus(customerId, trackingId);
      if (status.error) {
        return `⚠️ ${status.error}\nPlease verify the tracking number and try again.`;
      }
      return `📦 **Package Status for ${status.tracking_id}**:\n` +
        `• **Status:** ${status.current_status.replace('_', ' ').toUpperCase()}\n` +
        `• **Package:** ${status.package_description || 'General Package'}\n` +
        `• **Route:** ${status.pickup_address} ➡️ ${status.destination_address}\n` +
        `• **Assigned Rider:** ${status.rider_name || 'Rider Assignment in Progress'} (${status.rider_phone || 'N/A'})\n` +
        `• **Predicted Delivery:** ${status.predicted_delivery_time ? new Date(status.predicted_delivery_time).toLocaleString() : 'Estimating...'}`;
    } else {
      // Check customer's most recent active shipment
      const [recent] = await pool.query(
        `SELECT t.tracking_id, t.current_status, dr.pickup_address, dr.destination_address
         FROM tracking t
         JOIN dispatch_requests dr ON t.request_id = dr.id
         WHERE dr.customer_id = ?
         ORDER BY t.created_at DESC LIMIT 1`,
        [customerId]
      );
      if (recent.length > 0) {
        return `You have an active shipment with Tracking ID **${recent[0].tracking_id}** (${recent[0].current_status.replace('_', ' ')}). You can ask "Track ${recent[0].tracking_id}" for full details!`;
      }
      return 'To check your package status, please provide your Tracking ID (e.g., CPT-20261024-XXXX). You can find it on your "Track Package" or "My Requests" page.';
    }
  }

  // 2. Pricing and delivery fee inquiries
  if (lower.includes('price') || lower.includes('fee') || lower.includes('cost') || lower.includes('pay') || lower.includes('rate')) {
    return '💳 **CP Truck Pricing & Payments:**\nDelivery fees are dynamically calculated based on travel distance and package specifications. Once you submit a request, our dispatch team reviews and sets the fee. You can then pay securely online via Paystack before rider assignment.';
  }

  // 3. How to request a delivery / how it works
  if (lower.includes('how to') || lower.includes('request') || lower.includes('send') || lower.includes('order') || lower.includes('book')) {
    return '🚚 **How to Send a Package:**\n1. Click **New Request** on your dashboard navigation.\n2. Enter your pickup address, destination, package details, and receiver info.\n3. Wait for admin approval and fee confirmation.\n4. Complete the online payment.\n5. A dispatch rider is automatically assigned and your tracking code is generated!';
  }

  // 4. Greetings and General Intro
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('good morning') || lower.includes('good afternoon')) {
    return '👋 Hello! I am your CP Truck intelligent assistant powered by Google API. I can assist you with tracking your deliveries, explaining booking procedures, or answering questions about our dispatch service. How may I help you today?';
  }

  // 5. Default helpful assistant response
  return 'Thank you for contacting CP Truck support! You can ask me to track your package by providing your Tracking ID (e.g., CPT-20261024-XXXX), inquire about delivery fees, or ask how to place a new dispatch order.';
};

// ============================================
// MAIN ENTRY POINT
// Uses Google Gemini API with function calling,
// seamlessly falling back to local KB if offline.
// ============================================
export const getBotReply = async (customerId, conversationHistory) => {
  const latestMessage = conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1].content : '';

  // If Gemini API client is not initialized, run intelligent fallback
  if (!genAI) {
    return handleFallbackReply(customerId, latestMessage);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [trackingToolDeclaration],
    });

    // Format conversation history for Gemini (roles: 'user' and 'model')
    // Exclude the last message, which we will send to start/continue the chat
    const geminiHistory = [];
    const priorMessages = conversationHistory.slice(0, -1);

    for (const msg of priorMessages) {
      geminiHistory.push({
        role: msg.role === 'customer' || msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    const chat = model.startChat({
      history: geminiHistory,
    });

    let result = await chat.sendMessage(latestMessage);
    let response = result.response;

    // Check if Gemini invoked the function call
    const functionCalls = response.functionCalls ? response.functionCalls() : null;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];

      if (call.name === 'get_tracking_status') {
        const trackingIdArg = call.args?.tracking_id;
        const toolResult = await executeGetTrackingStatus(customerId, trackingIdArg);

        // Send function response back to Gemini so it formats a conversational answer
        const followUp = await chat.sendMessage([
          {
            functionResponse: {
              name: 'get_tracking_status',
              response: toolResult,
            },
          },
        ]);

        return followUp.response.text();
      }
    }

    const replyText = response.text();
    return replyText || (await handleFallbackReply(customerId, latestMessage));
  } catch (err) {
    console.warn('Google Gemini API call encountered an error. Engaging intelligent fallback:', err.message);
    return handleFallbackReply(customerId, latestMessage);
  }
};
