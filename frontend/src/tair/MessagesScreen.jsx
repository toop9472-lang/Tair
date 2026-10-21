// طير — Messages (chat threads list) + Chat thread view
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle, Send, Clock, ArrowRight,
} from "lucide-react";
import { T, S } from "./tairTheme";
import { tairApi } from "./tairApi";
import { TopBar, EmptyState } from "./TairUI";
import { StickerTray, TairSticker, parseSticker, stickerPreview } from "./TairStickers";
import messagesHeader from "../assets/tair-design/headers/messages.jpg";
import { TAIR_PAGE_STYLE, TairAppHeader } from "./TairAppChrome";

function timeAgo(iso) {
  if (!iso) return "الآن";
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  if (diff < 86400 * 7) return `قبل ${Math.floor(diff / 86400)} يوم`;
  return new Date(iso).toLocaleDateString("ar-SA");
}

export default function MessagesScreen({ user, onOpenThread, onOpenNotifications, unreadCount = 0 }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const uid = user.id || user.user_id;

  useEffect(() => {
    setLoading(true);
    tairApi
      .chatThreads(uid)
      .then(setThreads)
      .catch(() => setThreads([]))
      .finally(() => setLoading(false));
  }, [uid]);

  return (
    <div style={{ ...S.screen, ...TAIR_PAGE_STYLE }} data-testid="messages-screen">
      <TairAppHeader image={messagesHeader} onBell={onOpenNotifications} unreadCount={unreadCount} />
      <div style={styles.subBar}>
        <div style={styles.subBarText}>محادثاتك مع البائعين والمشترين</div>
      </div>

      <div style={S.container}>
        {loading ? (
          <div style={S.loadingText}>جاري التحميل…</div>
        ) : threads.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={36} strokeWidth={1.5} />}
            title="لا توجد محادثات بعد"
            desc="ابدأ محادثة من صفحة أي إعلان عبر زر (تواصل مع البائع)"
          />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {threads.map((t) => (
              <ThreadRow
                key={t.thread_id}
                thread={t}
                uid={uid}
                onClick={() => onOpenThread(t.thread_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadRow({ thread, uid, onClick }) {
  const peerName = thread.peer_name || `مستخدم ${(thread.participants?.find((p) => p !== uid) || "").slice(-4)}`;
  const peerAvatar = thread.peer_avatar;
  const peerColor = thread.peer_identity_color || T.primary;
  const peerVerified = !!thread.peer_verified;
  const initial = (peerName || "؟").charAt(0);
  const isUnread = Array.isArray(thread.unread_by) && thread.unread_by.includes(uid);

  return (
    <div
      onClick={onClick}
      style={{
        ...styles.threadRow,
        background: isUnread ? peerColor + "10" : T.surface,
        borderColor: isUnread ? peerColor + "44" : T.border,
      }}
      data-testid={`thread-${thread.thread_id}`}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{ ...styles.threadAvatar, background: peerColor + "22", color: peerColor }}>
          {peerAvatar ? (
            <img
              src={peerAvatar}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : initial}
        </div>
        {peerVerified && (
          <div style={{
            position: "absolute", bottom: -2, insetInlineStart: -2,
            width: 18, height: 18, borderRadius: 9,
            background: "#0ea5e9",
            border: "2px solid #fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 10, fontWeight: 900,
          }}>✓</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
        <div style={styles.threadTop}>
          <div style={{
            fontSize: 14,
            fontWeight: isUnread ? 900 : 800,
            color: T.text,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {peerName}
          </div>
          <span style={{ ...styles.timeAgo, color: isUnread ? peerColor : T.textFaint }}>
            {timeAgo(thread.updated_at)}
          </span>
        </div>
        {thread.listing_title && (
          <div style={{
            fontSize: 11, color: peerColor, fontWeight: 800,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            marginTop: 2, textAlign: "right",
          }}>
            بخصوص: {thread.listing_title}
          </div>
        )}
        <div style={{
          fontSize: 12,
          color: isUnread ? T.text : T.textMuted,
          fontWeight: isUnread ? 700 : 500,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          textAlign: "right", marginTop: 2,
        }}>
          {stickerPreview(thread.last_message) || "لا رسائل بعد"}
        </div>
      </div>
      {isUnread && <span style={{ ...styles.unreadDot, background: peerColor }} />}
    </div>
  );
}

// ============ Individual Chat Thread ============
export function ChatThreadScreen({ user, threadId, onBack }) {
  const uid = user.id || user.user_id;
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const scrollRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await tairApi.chatThreads(uid);
      const found = t.find((x) => x.thread_id === threadId);
      setThread(found);
      const msgs = await tairApi.chatMessages(threadId, uid);
      setMessages(msgs);
      tairApi.chatMarkRead(threadId, uid).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [threadId, uid]);

  useEffect(() => { load(); }, [load]);

  // WebSocket for real-time messages
  useEffect(() => {
    if (!uid) return;
    const base = process.env.REACT_APP_BACKEND_URL || "";
    const wsUrl = base.replace(/^http/, "ws") + `/api/chat/ws?user_id=${encodeURIComponent(uid)}`;
    let ws;
    let reconnectTimer;
    let closed = false;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type === "message" && data.thread_id === threadId) {
              setMessages((m) => {
                if (m.some((x) => x.msg_id === data.message.msg_id)) return m;
                return [...m, data.message];
              });
              tairApi.chatMarkRead(threadId, uid).catch(() => {});
            } else if (data.type === "typing" && data.thread_id === threadId && data.user_id !== uid) {
              setPeerTyping(true);
              clearTimeout(typingTimerRef.current);
              typingTimerRef.current = setTimeout(() => setPeerTyping(false), 3000);
            }
          } catch (e) { /* ignore */ }
        };
        ws.onclose = () => {
          if (!closed) reconnectTimer = setTimeout(connect, 3000);
        };
        ws.onerror = () => {};
      } catch (e) { /* ignore */ }
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      clearTimeout(typingTimerRef.current);
      try { ws && ws.close(); } catch (e) { /* ignore */ }
    };
  }, [uid, threadId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const notifyTyping = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ action: "typing", thread_id: threadId })); } catch (e) { /* ignore */ }
    }
  };

  const send = async (raw) => {
    const text = (typeof raw === "string" ? raw : body).trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const authorName = user?.name && user.name !== "زائر" ? user.name : null;
      const newMsg = await tairApi.chatSend(threadId, text, uid, authorName);
      if (typeof raw !== "string") setBody("");
      // Append locally (WS may or may not push back to sender)
      setMessages((m) => {
        if (m.some((x) => x.msg_id === newMsg.msg_id)) return m;
        return [...m, newMsg];
      });
    } catch (e) {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const peer = thread?.participants?.find((p) => p !== uid) || "";
  const peerName = thread?.peer_name || `مستخدم ${peer.slice(-4)}`;
  const title = thread?.listing_title ? `${peerName} · ${thread.listing_title}` : peerName;

  return (
    <div style={{ ...S.screen, paddingBottom: 230 }} data-testid="chat-thread-screen">
      <TopBar title={title} subtitle={thread?.listing_title ? `الإعلان: ${thread.listing_title}` : undefined} onBack={onBack} />

      {loading ? (
        <div style={S.loadingText}>جاري التحميل…</div>
      ) : (
        <div ref={scrollRef} style={styles.msgsWrap}>
          {thread?.listing_title && (
            <div style={styles.contextCard}>
              <div style={styles.contextThumb}>
                {thread.listing_image ? (
                  <img src={thread.listing_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : null}
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700 }}>الإعلان</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{thread.listing_title}</div>
              </div>
            </div>
          )}

          {messages.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
              ابدأ المحادثة برسالتك الأولى
            </div>
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.msg_id}
                msg={m}
                mine={m.sender_id === uid}
              />
            ))
          )}
          {peerTyping && (
            <div style={{ padding: "4px 8px", color: T.textMuted, fontSize: 12, fontWeight: 700, textAlign: "right" }} data-testid="typing-indicator">
              يكتب الآن…
            </div>
          )}
        </div>
      )}

      {/* Composer */}
      <div style={styles.composer}>
        <div style={styles.composerStack}>
          <StickerTray onPick={(token) => send(token)} disabled={sending} />
        <div style={styles.composerInner}>
          <input
            style={styles.composerInput}
            value={body}
            onChange={(e) => { setBody(e.target.value); notifyTyping(); }}
            placeholder="اكتب رسالة…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) send(); }}
            data-testid="chat-input"
          />
          <button
            onClick={send}
            disabled={sending || !body.trim()}
            style={{ ...styles.sendBtn, opacity: (sending || !body.trim()) ? 0.4 : 1 }}
            data-testid="chat-send"
            aria-label="إرسال"
          >
            <Send size={18} strokeWidth={2.4} />
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, mine }) {
  const sticker = parseSticker(msg.body);
  const when = new Date(msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  if (sticker) {
    return (
      <div style={{ display: "flex", justifyContent: mine ? "flex-start" : "flex-end", marginBottom: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-start" : "flex-end", gap: 2 }}>
          <TairSticker id={sticker.id} size={88} />
          <div style={{ fontSize: 11, fontWeight: 800, color: "#8A6A2E" }}>{sticker.label}</div>
          <div style={{ fontSize: 10, color: T.textFaint, fontWeight: 600 }}>{when}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{
      display: "flex",
      justifyContent: mine ? "flex-start" : "flex-end",
      marginBottom: 6,
    }}>
      <div style={{
        ...styles.bubble,
        background: mine ? T.primary : T.surface,
        color: mine ? T.textInverse : T.text,
        borderColor: mine ? T.primary : T.border,
        borderTopRightRadius: mine ? 16 : 4,
        borderTopLeftRadius: mine ? 4 : 16,
      }}>
        <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{msg.body}</div>
        <div style={{
          fontSize: 10,
          marginTop: 3,
          color: mine ? "rgba(255,255,255,0.75)" : T.textFaint,
          textAlign: mine ? "left" : "right",
          fontWeight: 600,
        }}>
          {when}
        </div>
      </div>
    </div>
  );
}

const styles = {
  subBar: {
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    borderBottom: `1px solid ${T.border}`,
    padding: "12px 20px",
  },
  subBarText: {
    fontSize: 13,
    color: T.textMuted,
    fontWeight: 700,
    textAlign: "right",
  },
  subtitle: {
    margin: "3px 0 0",
    fontSize: 12,
    color: T.textMuted,
    fontWeight: 600,
    textAlign: "right",
  },
  threadRow: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 12,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd,
    cursor: "pointer",
    boxShadow: T.shadowXs,
  },
  threadAvatar: {
    width: 52,
    height: 52,
    borderRadius: T.radius,
    background: "#f0fdfa",
    color: T.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 800,
    overflow: "hidden",
    flexShrink: 0,
  },
  threadTop: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  timeAgo: {
    fontSize: 10,
    color: T.textFaint,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    background: T.primary,
    flexShrink: 0,
  },

  msgsWrap: {
    padding: "12px 16px 12px",
    maxWidth: 900,
    margin: "0 auto",
    overflowY: "auto",
  },
  contextCard: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 10,
    background: "#f0fdfa",
    border: `1px solid ${T.primary}22`,
    borderRadius: T.radius,
    marginBottom: 14,
  },
  contextThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: T.bgAlt,
    overflow: "hidden",
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "78%",
    padding: "10px 14px",
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "solid",
    boxShadow: T.shadowXs,
  },

  composer: {
    position: "fixed",
    bottom: 78,
    left: 0,
    right: 0,
    background: T.surface,
    borderTop: `1px solid ${T.border}`,
    padding: "8px 12px 10px",
    zIndex: 40,
  },
  composerStack: {
    maxWidth: 900,
    margin: "0 auto",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  composerInner: {
    maxWidth: 900,
    margin: "0 auto",
    display: "flex",
    flexDirection: "row-reverse",
    gap: 8,
    alignItems: "center",
  },
  composerInput: {
    flex: 1,
    padding: "12px 16px",
    border: `1.5px solid ${T.border}`,
    borderRadius: T.radiusPill,
    fontSize: 14,
    background: T.bgAlt,
    color: T.text,
    fontFamily: "inherit",
    textAlign: "right",
    outline: "none",
  },
  sendBtn: {
    background: T.primary,
    color: T.textInverse,
    border: "none",
    width: 42,
    height: 42,
    borderRadius: 21,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
