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
          {isGM ? "Send Royal Decree" : "Compose Message"}
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
 * Send Gold Modal
 */
export function SendGoldModal({
  isOpen,
  onClose,
  onSend,
  recipients,
  currentGold,
  senderName,
}) {
  const [to, setTo] = useState(Object.keys(recipients)[0] || "");
  const [amount, setAmount] = useState(1);
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  function handleAmountChange(delta) {
    setAmount((prev) => Math.max(1, Math.min(currentGold, prev + delta)));
  }

  async function handleSend() {
    if (amount <= 0 || amount > currentGold) return;
    if (!to) return;
    
    setSending(true);
    try {
      await onSend({ to: Number(to), amount });
      setAmount(1);
      onClose();
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setAmount(1);
    onClose();
  }

  const recipientName = recipients[to] || "Unknown";

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
          maxWidth: "400px",
          width: "90%",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Send Gold</h3>

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
            Amount:
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button 
              onClick={() => handleAmountChange(-10)} 
              disabled={amount <= 1}
              style={{ padding: "6px 10px" }}
            >
              -10
            </button>
            <button 
              onClick={() => handleAmountChange(-1)} 
              disabled={amount <= 1}
              style={{ padding: "6px 10px" }}
            >
              -1
            </button>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Math.min(currentGold, parseInt(e.target.value) || 1)))}
              style={{
                width: "80px",
                textAlign: "center",
                fontSize: "18px",
                fontWeight: "bold",
              }}
              min={1}
              max={currentGold}
            />
            <button 
              onClick={() => handleAmountChange(1)} 
              disabled={amount >= currentGold}
              style={{ padding: "6px 10px" }}
            >
              +1
            </button>
            <button 
              onClick={() => handleAmountChange(10)} 
              disabled={amount >= currentGold}
              style={{ padding: "6px 10px" }}
            >
              +10
            </button>
          </div>
        </div>

        {/* Preview */}
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
          <p style={{ margin: 0, color: "#f4efe4" }}>
            Sending <strong style={{ color: "#FFD700" }}>{amount}g</strong> to <strong>{recipientName}</strong>
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#a89a7a" }}>
            Treasury: {currentGold}g -&gt; {currentGold - amount}g
          </p>
        </div>

        <p style={{ fontSize: "12px", color: "#a89a7a", margin: "0 0 16px" }}>
          Gold will be deducted immediately. Recipient must claim from their mailbox.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={handleClose} disabled={sending}>Cancel</button>
          <button
            className="green"
            onClick={handleSend}
            disabled={sending || amount <= 0 || amount > currentGold || !to}
          >
            {sending ? "Sending..." : "Send Gold"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Message List Component
 */
export function MessageList({ messages, onSelect, onMarkRead, emptyIcon = "", emptyText = "No messages." }) {
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
      {messages.map((msg) => {
        const isGoldTransfer = msg.type === "gold_transfer";
        const isUnclaimed = isGoldTransfer && !msg.claimed;
        
        return (
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
              background: isUnclaimed ? "#1a1a10" : msg.read ? "#1a1410" : "#1f1a14",
              border: `1px solid ${isUnclaimed ? "#6a6a34" : msg.read ? "#3a2f24" : "#5e4934"}`,
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
                  {isGoldTransfer ? (
                    <>Gold Transfer: <span style={{ color: "#FFD700" }}>{msg.goldAmount}g</span> from {msg.fromFactionName}</>
                  ) : msg.type === "mission" ? (
                    <>Mission Report: From {msg.fromFactionName || "Unknown"}</>
                  ) : (
                    <>Message: From {msg.fromFactionName || "Unknown"}</>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "#a89a7a" }}>
                  {msg.createdAt?.toDate?.().toLocaleDateString() || "Unknown date"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {isUnclaimed && (
                  <span
                    style={{
                      background: "#FFD700",
                      color: "#000",
                      fontSize: "10px",
                      fontWeight: "bold",
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    CLAIM
                  </span>
                )}
                {!msg.read && !isUnclaimed && (
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
          </div>
        );
      })}
    </div>
  );
}

/**
 * Message Detail Modal
 */
export function MessageDetailModal({ message, onClose, onDelete, onClaimGold, isGM = false }) {
  const [claiming, setClaiming] = useState(false);
  
  if (!message) return null;

  const isGoldTransfer = message.type === "gold_transfer";
  const canClaim = isGoldTransfer && !message.claimed;
  const canDelete = !canClaim; // Cannot delete unclaimed gold transfers

  async function handleClaim() {
    if (!onClaimGold || claiming) return;
    setClaiming(true);
    try {
      await onClaimGold(message.id);
    } finally {
      setClaiming(false);
    }
  }

  // Helper to render event message body with formatting
  function renderEventBody(body) {
    return body.split('\n').map((line, i) => {
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={i} style={{ margin: i === 0 ? 0 : "8px 0 0 0", color: "#f4efe4" }}>
            {parts.map((part, j) => 
              j % 2 === 1 ? <strong key={j} style={{ color: "#d1b26b" }}>{part}</strong> : part
            )}
          </p>
        );
      }
      if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
        return (
          <p key={i} style={{ margin: "8px 0 0 0", fontStyle: "italic", color: "#c9b896" }}>
            {line.slice(1, -1)}
          </p>
        );
      }
      if (line.trim() === '') {
        return <div key={i} style={{ height: "8px" }} />;
      }
      return (
        <p key={i} style={{ margin: "8px 0 0 0", color: "#f4efe4" }}>
          {line}
        </p>
      );
    });
  }

  function getTitle() {
    if (isGoldTransfer) return "Gold Transfer";
    if (message.type === "mission") return "Mission Report";
    if (message.type === "event") return "Event";
    return "Royal Message";
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
          border: isGoldTransfer ? "2px solid #6a6a34" : "2px solid #5e4934",
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
            <h3 style={{ margin: 0 }}>{getTitle()}</h3>
            {message.type !== "event" && (
              <div style={{ fontSize: "12px", color: "#a89a7a", marginTop: "4px" }}>
                From: {message.fromFactionName || "System"} - {message.createdAt?.toDate?.().toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            background: isGoldTransfer ? "#0a0a06" : "#0a0806",
            border: isGoldTransfer ? "1px solid #4a4a24" : "1px solid #3a2f24",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "16px",
          }}
        >
          {isGoldTransfer ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>
                {message.claimed ? ">" : "<"}
              </div>
              <p style={{ fontSize: "18px", margin: 0, color: "#f4efe4" }}>
                {message.fromFactionName} has sent you
              </p>
              <p style={{ fontSize: "32px", fontWeight: "bold", margin: "12px 0", color: "#FFD700" }}>
                {message.goldAmount} gold
              </p>
              {message.claimed ? (
                <p style={{ color: "#4ade80", margin: 0 }}>
                  Gold has been added to your treasury
                </p>
              ) : (
                <p style={{ color: "#a89a7a", margin: 0 }}>
                  Click below to add this gold to your treasury
                </p>
              )}
            </div>
          ) : message.type === "event" ? (
            <div>{renderEventBody(message.body)}</div>
          ) : message.type === "mission" ? (
            <div>
              <div
                style={{
                  color: message.success ? "#4ade80" : "#ef4444",
                  fontWeight: "bold",
                  marginBottom: "12px",
                  fontSize: "16px",
                }}
              >
                {message.success ? "Mission Successful" : "Mission Failed"}
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
          {canClaim && onClaimGold && (
            <button
              className="green"
              onClick={handleClaim}
              disabled={claiming}
              style={{ 
                background: "#3a3a10",
                borderColor: "#6a6a34",
              }}
            >
              {claiming ? "Claiming..." : "Claim Gold"}
            </button>
          )}
          {onDelete && canDelete && (
            <button
              onClick={() => onDelete(message.id)}
              style={{
                background: "#3a2020",
                borderColor: "#5a3030",
              }}
            >
              Delete
            </button>
          )}
          {onDelete && !canDelete && (
            <button
              disabled
              title="Cannot delete until gold is claimed"
              style={{
                background: "#2a2020",
                borderColor: "#3a2525",
                opacity: 0.5,
                cursor: "not-allowed",
              }}
            >
              Delete
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
  onClaimGold,
  maxLength,
  isGM = false,
  canCompose = true,
}) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  const unreadCount = messages.filter((m) => !m.read).length;
  const unclaimedGold = messages.filter((m) => m.type === "gold_transfer" && !m.claimed).length;

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
            {unclaimedGold > 0 && (
              <span
                style={{
                  marginLeft: "8px",
                  background: "#FFD700",
                  color: "#000",
                  fontSize: "12px",
                  fontWeight: "bold",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                {unclaimedGold} gold
              </span>
            )}
          </h3>
          <button className="green" onClick={() => setComposeOpen(true)}>
            {isGM ? " Send Decree" : "Compose"}
          </button>
        </div>
      )}

      {/* Message List */}
      <MessageList
        messages={messages}
        onSelect={setSelectedMessage}
        onMarkRead={onMarkRead}
        emptyIcon={isGM ? "" : ""}
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
        onClaimGold={onClaimGold}
        isGM={isGM}
      />
    </div>
  );
}