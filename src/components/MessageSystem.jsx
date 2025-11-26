// components/MessageSystem.jsx - Shared messaging components

import { useState } from "react";

/**
 * Compose Message Modal
 */
export function ComposeModal({
  isOpen,
  onClose,
  onSend,
  recipients,
  defaultRecipient,
  senderName,
  maxLength,
  isGM = false,
}) {
  const [to, setTo] = useState(defaultRecipient || Object.keys(recipients)[0] || "");
  const [body, setBody] = useState("");

  if (!isOpen) return null;

  function handleSend() {
    if (!body.trim()) return;
    if (maxLength && body.trim().length > maxLength) {
      alert(`Message is too long. Maximum ${maxLength} characters.`);
      return;
    }
    onSend({ to, body: body.trim() });
    setBody("");
    onClose();
  }

  function handleClose() {
    setBody("");
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#1a1410",
          border: "2px solid #5e4934",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          {isGM ? "📜 Send Royal Decree" : "✉️ Compose Message"}
        </h3>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "13px" }}>
            Send To:
          </label>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: "100%" }}
          >
            {Object.entries(recipients).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "13px" }}>
            Message:
            {maxLength && (
              <span
                style={{
                  float: "right",
                  color: body.length > maxLength ? "#ff6b6b" : "#a89a7a",
                }}
              >
                {body.length}/{maxLength}
              </span>
            )}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            style={{
              width: "100%",
              minHeight: "100px",
              resize: "vertical",
            }}
          />
        </div>

        {/* Preview */}
        {body.trim() && (
          <div
            style={{
              background: "#0a0806",
              border: "1px solid #3a2f24",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#a89a7a", marginBottom: "8px" }}>
              Preview:
            </div>
            <p
              style={{
                fontStyle: "italic",
                margin: 0,
                color: "#f4efe4",
                lineHeight: "1.6",
              }}
            >
              My Lord, {body.trim()}
              <br />
              <br />
              Signed, {senderName}
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={handleClose}>Cancel</button>
          <button
            className="green"
            onClick={handleSend}
            disabled={!body.trim() || (maxLength && body.trim().length > maxLength)}
          >
            {isGM ? "Send Message" : "Send Raven"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Message List Component
 */
export function MessageList({ messages, onSelect, onMarkRead, emptyIcon = "📭", emptyText = "No messages." }) {
  if (messages.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          color: "#a89a7a",
          padding: "40px",
          background: "#1a1410",
          borderRadius: "8px",
          border: "1px solid #3a2f24",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>{emptyIcon}</div>
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          onClick={() => {
            onSelect(msg);
            if (!msg.read && onMarkRead) {
              onMarkRead(msg.id);
            }
          }}
          style={{
            padding: "16px",
            background: msg.read ? "#1a1410" : "#1f1a14",
            border: `1px solid ${msg.read ? "#3a2f24" : "#5e4934"}`,
            borderRadius: "8px",
            cursor: "pointer",
            transition: "border-color 0.2s",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: msg.read ? "normal" : "bold",
                  color: msg.read ? "#c7bca5" : "#f4efe4",
                  marginBottom: "4px",
                }}
              >
                {msg.type === "mission" ? "📋 Mission Report" : "✉️ Message"}:{" "}
                From {msg.fromFactionName || "Unknown"}
              </div>
              <div style={{ fontSize: "12px", color: "#a89a7a" }}>
                {msg.createdAt?.toDate?.().toLocaleDateString() || "Unknown date"}
              </div>
            </div>
            {!msg.read && (
              <span
                style={{
                  background: "#d4a32c",
                  color: "#000",
                  fontSize: "10px",
                  fontWeight: "bold",
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                NEW
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Message Detail Modal
 */
export function MessageDetailModal({ message, onClose, onDelete, isGM = false }) {
  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#1a1410",
          border: "2px solid #5e4934",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "16px",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>
              {message.type === "mission" ? "📋 Mission Report" : "✉️ Royal Message"}
            </h3>
            <div style={{ fontSize: "12px", color: "#a89a7a", marginTop: "4px" }}>
              From: {message.fromFactionName || "System"} •{" "}
              {message.createdAt?.toDate?.().toLocaleDateString()}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#0a0806",
            border: "1px solid #3a2f24",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "16px",
          }}
        >
          {message.type === "mission" ? (
            <div>
              <div
                style={{
                  color: message.success ? "#4ade80" : "#ef4444",
                  fontWeight: "bold",
                  marginBottom: "12px",
                  fontSize: "16px",
                }}
              >
                {message.success ? "✓ Mission Successful" : "✗ Mission Failed"}
              </div>
              <p
                style={{
                  fontStyle: "italic",
                  margin: 0,
                  color: "#f4efe4",
                  lineHeight: "1.6",
                }}
              >
                My Lord,
                <br />
                <br />
                {message.body}
                <br />
                <br />
                <span style={{ color: "#a89a7a" }}>- Your humble spymaster</span>
              </p>
            </div>
          ) : (
            <p
              style={{
                fontStyle: "italic",
                margin: 0,
                color: "#f4efe4",
                lineHeight: "1.6",
              }}
            >
              My Lord,
              <br />
              <br />
              {message.body}
              <br />
              <br />
              Signed,
              <br />
              {message.fromFactionName}
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          {onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              style={{
                background: "#3a2020",
                borderColor: "#5a3030",
              }}
            >
              🗑 Delete
            </button>
          )}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Complete Mailbox Component
 * Combines compose button, message list, and detail modal
 */
export function Mailbox({
  messages,
  recipients,
  senderName,
  myFactionId,
  onSend,
  onMarkRead,
  onDelete,
  maxLength,
  isGM = false,
  canCompose = true,
}) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <div>
      {/* Header with compose button */}
      {canCompose && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ margin: 0 }}>
            {isGM ? "Messages from Players" : "Messages"}
            {unreadCount > 0 && (
              <span
                style={{
                  marginLeft: "8px",
                  background: "#d4a32c",
                  color: "#000",
                  fontSize: "12px",
                  fontWeight: "bold",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                {unreadCount} new
              </span>
            )}
          </h3>
          <button className="green" onClick={() => setComposeOpen(true)}>
            {isGM ? "📜 Send Decree" : "✉️ Compose"}
          </button>
        </div>
      )}

      {/* Message List */}
      <MessageList
        messages={messages}
        onSelect={setSelectedMessage}
        onMarkRead={onMarkRead}
        emptyIcon={isGM ? "📭" : "📪"}
        emptyText={isGM ? "No messages from players yet." : "Your mailbox is empty."}
      />

      {/* Compose Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSend={onSend}
        recipients={recipients}
        senderName={senderName}
        maxLength={maxLength}
        isGM={isGM}
      />

      {/* Detail Modal */}
      <MessageDetailModal
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
        onDelete={onDelete}
        isGM={isGM}
      />
    </div>
  );
}