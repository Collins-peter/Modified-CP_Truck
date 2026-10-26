import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { sendChatMessage, getChatSessions, getSessionMessages } from '../../services/chatService';
import { customerNavItems } from './navItems';
import styles from './Chat.module.css';

const INITIAL_GREETING = {
  sender: 'bot',
  message:
    "Hello! I am your CP Truck Virtual Assistant, powered by Google API. I can help you track your packages, check estimated delivery times, explain booking procedures, or answer your delivery questions. How can I assist you today?",
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

const SUGGESTIONS = [
  'Track package CPT-20261024-9A4B',
  'How do I request a pickup?',
  'How are delivery fees calculated?',
  'Where is my rider?',
];

const Chat = () => {
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Optionally load previous active chat session
  useEffect(() => {
    const fetchLatestSession = async () => {
      try {
        const { sessions } = await getChatSessions();
        if (sessions && sessions.length > 0) {
          const latest = sessions[0];
          setSessionId(latest.id);
          const { messages: history } = await getSessionMessages(latest.id);
          if (history && history.length > 0) {
            setMessages(
              history.map((m) => ({
                sender: m.sender,
                message: m.message,
                time: new Date(m.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              }))
            );
          }
        }
      } catch (err) {
        // Fall back to default greeting gracefully
      }
    };

    fetchLatestSession();
  }, []);

  const handleSend = async (textToSend) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || loading) return;

    const userMessage = {
      sender: 'customer',
      message: messageContent,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const data = await sendChatMessage(messageContent, sessionId);
      if (data.session_id) {
        setSessionId(data.session_id);
      }

      const botMessage = {
        sender: 'bot',
        message: data.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      const errorMessage = {
        sender: 'bot',
        message:
          '⚠️ Sorry, I encountered an issue connecting to the assistant. Please verify your connection or try again.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <DashboardLayout navItems={customerNavItems}>
      <div className={styles.chatContainer}>
        {/* Header */}
        <div className={styles.chatHeader}>
          <div>
            <div className={styles.headerTitle}>
              <span>🤖 CP Truck Assistant</span>
              <span className={styles.geminiBadge}>Google AI</span>
            </div>
            <p style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '2px' }}>
              Instant delivery inquiries, tracking lookup & FAQ support
            </p>
          </div>
          <div className={styles.statusIndicator}>
            <span className={styles.onlineDot} />
            <span>Online</span>
          </div>
        </div>

        {/* Message Thread */}
        <div className={styles.messagesList}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`${styles.messageRow} ${
                msg.sender === 'customer' ? styles.messageRowUser : styles.messageRowBot
              }`}
            >
              <div
                className={`${styles.avatar} ${
                  msg.sender === 'customer' ? styles.avatarUser : styles.avatarBot
                }`}
              >
                {msg.sender === 'customer' ? '👤' : '🚚'}
              </div>
              <div>
                <div
                  className={`${styles.bubble} ${
                    msg.sender === 'customer' ? styles.bubbleUser : styles.bubbleBot
                  }`}
                >
                  {msg.message}
                </div>
                <div className={styles.messageTime}>{msg.time}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className={`${styles.messageRow} ${styles.messageRowBot}`}>
              <div className={`${styles.avatar} ${styles.avatarBot}`}>🚚</div>
              <div className={`${styles.bubble} ${styles.bubbleBot}`}>
                <div className={styles.typingIndicator}>
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Queries */}
        <div className={styles.suggestions}>
          <span className={styles.suggestionLabel}>Suggested:</span>
          {SUGGESTIONS.map((suggestion, i) => (
            <button
              key={i}
              type="button"
              className={styles.chip}
              onClick={() => handleSend(suggestion)}
              disabled={loading}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className={styles.inputArea}>
          <input
            type="text"
            className={styles.inputField}
            placeholder="Ask anything or enter tracking ID (e.g. CPT-20261024-9A4B)..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="button"
            className={`btn btn-primary ${styles.sendBtn}`}
            onClick={() => handleSend()}
            disabled={loading || !inputText.trim()}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Chat;
