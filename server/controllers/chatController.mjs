import { pool } from '../config/db.mjs';
import { getBotReply } from '../services/chatbotService.mjs';

// How many prior messages to include as context for the model.
// Keeps token usage (and cost) bounded on long-running conversations.
const HISTORY_LIMIT = 20;

// ============================================
// SEND MESSAGE (Customer)
// Creates a new session if none is provided, saves the customer's
// message, gets a bot reply (with function-calling support), saves
// the bot's reply, and returns both.
// ============================================
export const sendMessage = async (req, res) => {
  const customerId = req.user.id;
  const { session_id, message } = req.body;

  try {
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'message is required.' });
    }

    let sessionId = session_id;

    // Create a new session if this is the first message
    if (!sessionId) {
      const [sessionResult] = await pool.query(
        'INSERT INTO chat_sessions (customer_id) VALUES (?)',
        [customerId]
      );
      sessionId = sessionResult.insertId;
    } else {
      // Confirm the session exists and belongs to this customer
      const [sessionRows] = await pool.query(
        'SELECT id FROM chat_sessions WHERE id = ? AND customer_id = ?',
        [sessionId, customerId]
      );
      if (sessionRows.length === 0) {
        return res.status(404).json({ message: 'Chat session not found.' });
      }
    }

    // Save the customer's message
    await pool.query(
      `INSERT INTO chat_messages (session_id, sender, message) VALUES (?, 'customer', ?)`,
      [sessionId, message]
    );

    // Pull recent history for conversational context
    const [historyRows] = await pool.query(
      `SELECT sender, message FROM chat_messages
       WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`,
      [sessionId, HISTORY_LIMIT]
    );

    // Reverse to chronological order and map to OpenAI's expected format
    const conversationHistory = historyRows
      .reverse()
      .map((row) => ({
        role: row.sender === 'customer' ? 'user' : 'assistant',
        content: row.message,
      }));

    const botReply = await getBotReply(customerId, conversationHistory);

    // Save the bot's reply
    await pool.query(
      `INSERT INTO chat_messages (session_id, sender, message) VALUES (?, 'bot', ?)`,
      [sessionId, botReply]
    );

    return res.status(200).json({
      session_id: sessionId,
      reply: botReply,
    });
  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({
      message: err.message || 'Server error while processing chat message.',
    });
  }
};

// ============================================
// GET MY CHAT SESSIONS (Customer)
// Lets the frontend show a list of past conversations.
// ============================================
export const getMySessions = async (req, res) => {
  const customerId = req.user.id;

  try {
    const [rows] = await pool.query(
      `SELECT cs.id, cs.started_at,
              (SELECT message FROM chat_messages WHERE session_id = cs.id ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM chat_sessions cs
       WHERE cs.customer_id = ?
       ORDER BY cs.started_at DESC`,
      [customerId]
    );

    return res.status(200).json({ sessions: rows });
  } catch (err) {
    console.error('Get my sessions error:', err);
    return res.status(500).json({ message: 'Server error while fetching chat sessions.' });
  }
};

// ============================================
// GET SESSION MESSAGES (Customer, own session only)
// Full message history for a single conversation.
// ============================================
export const getSessionMessages = async (req, res) => {
  const customerId = req.user.id;
  const { sessionId } = req.params;

  try {
    const [sessionRows] = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = ? AND customer_id = ?',
      [sessionId, customerId]
    );

    if (sessionRows.length === 0) {
      return res.status(404).json({ message: 'Chat session not found.' });
    }

    const [messages] = await pool.query(
      'SELECT sender, message, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );

    return res.status(200).json({ messages });
  } catch (err) {
    console.error('Get session messages error:', err);
    return res.status(500).json({ message: 'Server error while fetching messages.' });
  }
};
