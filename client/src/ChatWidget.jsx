import { useEffect, useRef, useState } from "react";
import "./ChatWidget.css";

const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// The server only reads the last 12 messages, so we never send more than that.
const MAX_HISTORY_SENT = 12;

const GREETING =
  "Hi! I'm the Maasin Tour Guide assistant. Ask me about tourist spots, fees, or opening hours. You can write in English, Bisaya, or Filipino.";

const SUGGESTIONS = [
  "What are the best waterfalls to visit?",
  "Asa ang maayo nga mag-swimming?",
  "Which spots are good for history lovers?",
];

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "model", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-MAX_HISTORY_SENT) }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      setMessages([...next, { role: "model", text: data.reply }]);
    } catch (error) {
      setMessages([
        ...next,
        {
          role: "model",
          text:
            error.message === "Failed to fetch"
              ? "I can't reach the server right now. Please try again later."
              : error.message,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    send(input);
  }

  const showSuggestions = messages.length === 1 && !loading;

  return (
    <div className="chat-widget">
      {open && (
        <section className="chat-panel" aria-label="Maasin Tour Guide chat">
          <header className="chat-header">
            <div>
              <strong>Maasin Assistant</strong>
              <small>Ask about spots, fees and hours</small>
            </div>
            <button
              type="button"
              className="chat-close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`chat-bubble ${
                  message.role === "user" ? "chat-user" : "chat-bot"
                }${message.error ? " chat-error" : ""}`}
              >
                {message.text}
              </div>
            ))}

            {loading && (
              <div className="chat-bubble chat-bot chat-typing" aria-label="Typing">
                <span />
                <span />
                <span />
              </div>
            )}

            {showSuggestions && (
              <div className="chat-suggestions">
                {SUGGESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => send(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            <div ref={endRef} />
          </div>

          <p className="chat-privacy">
            Your messages are sent to Google Gemini to generate answers. Please
            don't share personal details.
          </p>

          <form className="chat-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type your question..."
              maxLength={500}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="chat-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
      >
        {open ? "×" : "💬"}
      </button>
    </div>
  );
}

export default ChatWidget;