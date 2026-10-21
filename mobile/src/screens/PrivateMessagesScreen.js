// طير — Private Messages Screen (redesigned)
// Modern chat inbox + conversation view with proper avatars and identity color.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import TairHeader from '../components/TairHeader';
import { StickerTray, TairSticker, parseSticker, stickerPreview } from '../components/TairStickers';
import { TAIR, TAIR_ELEVATION } from '../constants/tairTheme';
import api from '../services/api';
import { ErrorState, ListSkeleton } from '../components/TairUI';

const { width } = Dimensions.get('window');

// ---------- helpers ----------
const initialsOf = (name = '') => {
  const t = (name || '').trim();
  if (!t) return '؟';
  return t.charAt(0);
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)}د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)}س`;
  if (diff < 86400 * 7) return `قبل ${Math.floor(diff / 86400)}ي`;
  return new Date(iso).toLocaleDateString('ar-SA');
};

const formatClock = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

// ---------- Avatar ----------
const Avatar = ({ uri, name, size = 48, color = TAIR.emerald, verified = false, style }) => {
  const wrap = { width: size, height: size, borderRadius: size / 2 };
  const badgeSize = Math.max(14, Math.round(size * 0.32));
  return (
    <View style={[wrap, styles.avatarWrap, style]}>
      {uri ? (
        <Image source={{ uri }} style={[wrap, { borderRadius: size / 2 }]} />
      ) : (
        <LinearGradient
          colors={[color, color + 'CC']}
          style={[wrap, styles.avatarFallback]}
        >
          <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.42) }]}>
            {initialsOf(name)}
          </Text>
        </LinearGradient>
      )}
      {verified ? (
        <View style={[styles.verifiedDot, {
          width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2,
          bottom: -2, insetInlineStart: -2,
        }]}>
          <Ionicons name="checkmark" size={Math.round(badgeSize * 0.7)} color="#fff" />
        </View>
      ) : null}
    </View>
  );
};

// ---------- Inbox item ----------
const InboxItem = ({ item, onPress }) => {
  const color = TAIR.emerald;
  const isUnread = (item.unread_count || 0) > 0;
  return (
    <TouchableOpacity
      style={[styles.inboxItem, isUnread && { backgroundColor: color + '08' }]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <Avatar
        uri={item.from_user_avatar}
        name={item.from_user_name}
        size={54}
        color={color}
        verified={item.is_verified}
      />

      <View style={styles.inboxInfo}>
        <View style={styles.inboxTopRow}>
          <Text style={[styles.inboxName, isUnread && { fontWeight: '900' }]} numberOfLines={1}>
            {item.from_user_name}
          </Text>
          <Text style={[styles.inboxTime, isUnread && { color }]}>
            {timeAgo(item.last_time)}
          </Text>
        </View>
        <View style={styles.inboxBottomRow}>
          <Text
            style={[
              styles.inboxPreview,
              isUnread && { color: '#0F241C', fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {stickerPreview(item.last_message)}
          </Text>
          {isUnread ? (
            <View style={[styles.unreadPill, { backgroundColor: color }]}>
              <Text style={styles.unreadPillText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
            </View>
          ) : item.last_is_own ? (
            <Ionicons name="checkmark-done" size={14} color="#8A7B66" />
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ---------- Message bubble ----------
const MessageItem = ({ message, isOwn, showAvatar, peerAvatar, peerName, peerColor, onReport }) => {
  const sticker = parseSticker(message.message);
  return (
    <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
      {!isOwn && showAvatar ? (
        <Avatar
          uri={peerAvatar}
          name={peerName}
          size={30}
          color={peerColor}
          style={{ marginRight: 8, marginLeft: 0 }}
        />
      ) : (
        !isOwn ? <View style={{ width: 38 }} /> : null
      )}

      <TouchableOpacity
        style={[
          styles.bubble,
          sticker ? styles.bubbleSticker : (isOwn ? styles.bubbleOwn : styles.bubblePeer),
        ]}
        onLongPress={() => !isOwn && onReport && onReport(message)}
        activeOpacity={0.9}
      >
        {sticker ? (
          <View style={styles.stickerMsg}>
            <TairSticker id={sticker.id} size={112} animated interactive />
            <Text style={[styles.stickerCaption, isOwn && styles.stickerCaptionOwn]}>{sticker.label}</Text>
          </View>
        ) : (
          <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>
            {message.message}
          </Text>
        )}
        <View style={styles.bubbleFooter}>
          <Text style={[styles.bubbleTime, isOwn && !sticker && styles.bubbleTimeOwn]}>
            {formatClock(message.created_at)}
          </Text>
          {isOwn ? (
            <Ionicons
              name={message.read ? 'checkmark-done' : 'checkmark'}
              size={13}
              color={isOwn && !sticker
                ? (message.read ? '#E0C580' : 'rgba(247,241,232,0.55)')
                : (message.read ? TAIR.emerald : TAIR.faint)}
            />
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
};

// ---------- Conversation view ----------
const ConversationView = ({ user, friend, onBack, onReport, onOpenUserProfile }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const pollInterval = useRef(null);

  const peerId = friend.id || friend.from_user_id || friend.user_id;
  const peerName = friend.name || friend.from_user_name || 'مستخدم';
  const peerAvatar = friend.avatar || friend.from_user_avatar;
  const peerColor = TAIR.emerald;
  const peerVerified = !!(friend.is_verified || friend.is_verified_shop || friend.is_verified_carrier);

  useEffect(() => {
    loadMessages();
    pollInterval.current = setInterval(() => loadMessages(false), 3000);
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  const loadMessages = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const myId = user?.user_id || user?.id;
      if (!myId || !peerId) { setLoading(false); return; }
      const res = await api.fetch(`/api/social/messages/conversation/${myId}/${peerId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setLoadError(null);
      } else if (showLoading) {
        setLoadError("تعذّر فتح المحادثة");
      }
    } catch (e) {
      if (showLoading) setLoadError(e?.message || "تعذّر فتح المحادثة");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (overrideText) => {
    const text = (overrideText ?? newMessage).trim();
    if (!text) return;
    const myId = user?.user_id || user?.id;
    if (!myId || !peerId) {
      Alert.alert('خطأ', 'تعذّر تحديد المستقبل — أعد فتح المحادثة');
      return;
    }
    setSending(true);
    try {
      const res = await api.fetch('/api/social/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          from_user_id: myId,
          to_user_id: peerId,
          from_user_name: user?.name || 'مستخدم',
          message: text,
        }),
      });
      if (res.ok) {
        if (!overrideText) setNewMessage('');
        loadMessages(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('خطأ', err.detail || 'تعذّر الإرسال');
      }
    } catch {
      Alert.alert('خطأ', 'حدث خطأ في الاتصال');
    } finally {
      setSending(false);
    }
  };

  const handleReport = (message) => {
    Alert.alert('الإبلاغ عن الرسالة', 'هل تريد الإبلاغ؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إبلاغ',
        style: 'destructive',
        onPress: () => onReport && onReport(message, friend),
      },
    ]);
  };

  const myId = user?.user_id || user?.id;

  return (
    <View style={styles.conversationContainer}>
      {/* Header with Tair emerald identity */}
      <View style={[styles.chatHeader, { backgroundColor: TAIR.emerald }]}>
        <TouchableOpacity onPress={onBack} style={styles.chatBackBtn}>
          <Ionicons name="chevron-forward" size={22} color={TAIR.gold} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chatPeer}
          activeOpacity={0.7}
          onPress={() => peerId && onOpenUserProfile && onOpenUserProfile(peerId)}
        >
          <Avatar uri={peerAvatar} name={peerName} size={40} color={TAIR.gold + '33'} verified={peerVerified} />
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={[styles.chatPeerName, { color: TAIR.gold }]} numberOfLines={1}>{peerName}</Text>
            <Text style={[styles.chatPeerHint, { color: '#E0C580' }]}>اضغط لعرض الملف الشخصي</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chatMoreBtn}
          onPress={() => Alert.alert('إبلاغ', 'اضغط مطولاً على أي رسالة للإبلاغ عنها')}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={TAIR.gold} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.messagesArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {loading ? (
          <ListSkeleton count={4} />
        ) : loadError && messages.length === 0 ? (
          <ErrorState title="تعذّر فتح المحادثة" subtitle="تحقق من الاتصال ثم أعد المحاولة." onRetry={() => loadMessages(true)} />
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconBubble, { backgroundColor: peerColor + '18' }]}>
              <Ionicons name="chatbubbles-outline" size={44} color={peerColor} />
            </View>
            <Text style={styles.emptyChatTitle}>ابدأ المحادثة</Text>
            <Text style={styles.emptyChatSub}>ألقِ التحية على {peerName}</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const isOwn = item.from_user_id === myId;
              const prev = messages[index - 1];
              const showAvatar = !isOwn && (!prev || prev.from_user_id !== item.from_user_id);
              return (
                <MessageItem
                  message={item}
                  isOwn={isOwn}
                  showAvatar={showAvatar}
                  peerAvatar={peerAvatar}
                  peerName={peerName}
                  peerColor={peerColor}
                  onReport={handleReport}
                />
              );
            }}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={styles.stickerBar}>
          <StickerTray onPick={(token) => sendMessage(token)} disabled={sending} />
        </View>

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="اكتب رسالتك…"
            placeholderTextColor="#8A7B66"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!newMessage.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={() => sendMessage()}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="paper-plane" size={18} color={TAIR.gold} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

// ---------- Screen root ----------
const PrivateMessagesScreen = ({ user, onClose, initialFriend, onOpenUserProfile, onOpenNotifications, onOpenAskExperts }) => {
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(initialFriend || null);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!initialFriend) loadInbox();
  }, []);

  const loadInbox = async () => {
    setLoading(true);
    try {
      const myId = user?.user_id || user?.id;
      if (!myId) { setLoading(false); return; }
      const res = await api.fetch(`/api/social/messages/inbox/${myId}`);
      if (res.ok) {
        const data = await res.json();
        setInbox(data.inbox || []);
        setTotalUnread(data.total_unread || 0);
        setLoadError(null);
      } else {
        setLoadError("تعذّر تحميل الرسائل");
      }
    } catch (e) {
      setLoadError(e?.message || "تعذّر تحميل الرسائل");
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async (message, friend) => {
    try {
      const res = await api.fetch('/api/social/report', {
        method: 'POST',
        body: JSON.stringify({
          reporter_id: user?.id,
          reported_user_id: friend.id || friend.from_user_id,
          report_type: 'inappropriate',
          content_type: 'private_message',
          content_id: message.id,
          reason: 'رسالة مخالفة',
        }),
      });
      if (res.ok) Alert.alert('تم', 'تم تقديم البلاغ');
    } catch {
      Alert.alert('خطأ', 'حدث خطأ');
    }
  };

  if (selectedConversation) {
    return (
      <ConversationView
        user={user}
        friend={selectedConversation}
        onBack={() => { setSelectedConversation(null); loadInbox(); }}
        onReport={handleReport}
        onOpenUserProfile={onOpenUserProfile}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Tair Inbox header */}
      <TairHeader variant="messages" userId={user?.user_id || user?.id} onBellPress={onOpenNotifications} />
      <View style={styles.inboxHeaderBar}>
        <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
          <Ionicons name="chevron-forward" size={22} color={TAIR.emerald} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={styles.inboxTitle}>الرسائل</Text>
          <Text style={styles.inboxSub}>
            {totalUnread > 0 ? `${totalUnread} رسالة غير مقروءة` : 'لا رسائل جديدة'}
          </Text>
        </View>
        {totalUnread > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ListSkeleton count={5} />
      ) : loadError && inbox.length === 0 ? (
        <ErrorState title="تعذّر فتح الرسائل" subtitle="تحقق من الاتصال ثم أعد المحاولة." onRetry={loadInbox} />
      ) : inbox.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBubble}>
            <Ionicons name="mail-outline" size={44} color={TAIR.emerald} />
          </View>
          <Text style={styles.emptyText}>لا توجد رسائل بعد</Text>
          <Text style={styles.emptySubtext}>ابدأ محادثة من أي متجر أو إعلان</Text>
        </View>
      ) : (
        <FlatList
          data={inbox}
          keyExtractor={(item) => item.from_user_id}
          renderItem={({ item }) => (
            <InboxItem item={item} onPress={setSelectedConversation} />
          )}
          contentContainerStyle={styles.inboxList}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TAIR.bg },

  // Tair inbox bar
  inboxHeaderBar: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: TAIR.card,
    borderBottomWidth: 1, borderBottomColor: TAIR.divider,
  },
  inboxTitle: { color: TAIR.emerald, fontSize: 18, fontWeight: "900" },
  inboxSub: { color: TAIR.textSoft, fontSize: 12, marginTop: 2 },

  // ---------- Inbox header ----------
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 52,
    paddingBottom: 18,
    gap: 12,
  },
  headerBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  headerSubtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '700', marginTop: 3, textAlign: 'right' },
  headerBadge: {
    backgroundColor: '#8B3A2F',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    minWidth: 30, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  // ---------- Avatar ----------
  avatarWrap: { position: 'relative', overflow: 'visible' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900' },
  verifiedDot: {
    position: 'absolute',
    backgroundColor: TAIR.goldDark,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },

  // ---------- Inbox list ----------
  inboxList: { padding: 16, paddingBottom: 140, gap: 10 },
  separator: { height: 0 },
  inboxItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: TAIR.card,
    padding: 12,
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: TAIR.divider,
    ...TAIR_ELEVATION.hair,
  },
  inboxInfo: { flex: 1, gap: 4 },
  inboxTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  inboxBottomRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  inboxName: {
    color: TAIR.ink, fontSize: 15, fontWeight: '800',
    flex: 1, textAlign: 'right',
  },
  inboxTime: { color: TAIR.faint, fontSize: 11, fontWeight: '700' },
  inboxPreview: {
    color: TAIR.muted, fontSize: 13, fontWeight: '600',
    flex: 1, textAlign: 'right',
  },
  unreadPill: {
    minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadPillText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  // ---------- Empty ----------
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30,
  },
  emptyIconBubble: {
    width: 84, height: 84, borderRadius: 28,
    backgroundColor: TAIR.card,
    borderWidth: 1, borderColor: TAIR.divider,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyText: { color: TAIR.emerald, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  emptySubtext: { color: TAIR.muted, fontSize: 13, textAlign: 'center' },

  // ---------- Conversation ----------
  conversationContainer: { flex: 1, backgroundColor: TAIR.bg, paddingBottom: Platform.OS === 'ios' ? 50 : 46 },
  chatHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 52, paddingBottom: 14,
    gap: 10,
  },
  chatBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  chatMoreBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  chatPeer: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  chatPeerName: {
    color: '#fff', fontSize: 15, fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
    textAlign: 'right',
  },
  chatPeerHint: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', textAlign: 'right' },

  messagesArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  messagesList: { padding: 12, paddingBottom: 20 },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  msgRowOwn: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: width * 0.72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleOwn: {
    backgroundColor: TAIR.emerald,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.45)",
  },
  bubblePeer: {
    backgroundColor: TAIR.card,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: TAIR.divider,
    ...TAIR_ELEVATION.hair,
  },
  bubbleSticker: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
  },
  stickerMsg: { alignItems: 'center' },
  stickerCaption: { marginTop: 3, color: TAIR.goldDark, fontSize: 11, fontWeight: '800' },
  stickerCaptionOwn: { color: TAIR.goldDark },
  bubbleText: { color: TAIR.ink, fontSize: 15, lineHeight: 22, textAlign: 'right' },
  bubbleTextOwn: { color: "#F7F1E8" },
  bubbleFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  bubbleTime: { color: '#8A7B66', fontSize: 10, fontWeight: '700' },
  bubbleTimeOwn: { color: 'rgba(247,241,232,0.72)' },

  emptyChatTitle: { color: '#0F241C', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  emptyChatSub: { color: '#6B5E4A', fontSize: 12, textAlign: 'center' },

  // ---------- Sticker bar ----------
  stickerBar: {
    backgroundColor: TAIR.card,
    borderTopWidth: 1,
    borderTopColor: TAIR.divider,
  },

  // ---------- Input ----------
  inputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    gap: 8,
    backgroundColor: TAIR.card,
    borderTopWidth: 1,
    borderTopColor: TAIR.divider,
  },
  textInput: {
    flex: 1,
    backgroundColor: TAIR.bg,
    borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    color: TAIR.text, fontSize: 14,
    maxHeight: 100,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: TAIR.divider,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: TAIR.emerald,
    borderWidth: 1,
    borderColor: TAIR.gold,
  },
  sendBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
});

export default PrivateMessagesScreen;
