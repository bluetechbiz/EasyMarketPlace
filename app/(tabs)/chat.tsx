import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';

const { width } = Dimensions.get('window');

type MessageStatus = 'sending' | 'sent' | 'error';
type MessageType = 'text' | 'image';

interface Message {
  id: string;
  text: string;
  isMe: boolean;
  status: MessageStatus;
  created_at: string;
  type: MessageType;
}

interface ChatScreenParams {
  sellerName?: string;
  productName?: string;
  price?: string;
  productImage?: string;
  itemId: string;
  sellerId: string;
}

const COLORS = {
  primary: '#10b981',
  bg: '#f8fafc',
  white: '#ffffff',
  textDark: '#0f172a',
  textGray: '#64748b',
  error: '#ef4444',
};

const getMessageType = (content: string): MessageType => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  return imageExtensions.some(ext => content.toLowerCase().includes(ext)) ? 'image' : 'text';
};

const MessageBubble = memo(({ item }: { item: Message }) => {
  const isImage = item.type === 'image';
  const isError = item.status === 'error';

  return (
    <View style={[styles.bubbleWrapper, item.isMe ? styles.alignEnd : styles.alignStart]}>
      <View style={[
        styles.messageBubble,
        item.isMe ? styles.myMessage : styles.theirMessage,
        isImage && styles.imageBubble,
      ]}>
        {isImage ? (
          <Image source={{ uri: item.text }} style={styles.chatImage} contentFit="cover" transition={200} />
        ) : (
          <Text style={[styles.messageText, { color: item.isMe ? '#fff' : COLORS.textDark }]}>
            {item.text}
          </Text>
        )}
        <View style={[styles.statusContainer, isImage && styles.imageStatusOverlay]}>
          <Text style={[styles.timeText, { color: item.isMe || isImage ? '#fff' : COLORS.textGray }]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {item.isMe && (
            <Ionicons
              name={item.status === 'sending' ? 'time-outline' : isError ? 'alert-circle' : 'checkmark-done'}
              size={14}
              color={isError ? COLORS.error : '#fff'}
              style={styles.tickIcon}
            />
          )}
        </View>
      </View>
    </View>
  );
});

export default function ChatScreen() {
  const params = useLocalSearchParams<unknown>() as ChatScreenParams;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMessages = useCallback(async (convId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) {
        setMessages(data.map(m => ({
          id: m.id,
          text: m.content,
          isMe: m.sender_id === userId,
          status: 'sent' as MessageStatus,
          created_at: m.created_at,
          type: getMessageType(m.content),
        })));
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const task = InteractionManager.runAfterInteractions(async () => {
      if (!params.itemId || !params.sellerId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        setCurrentUserId(user.id);

        const { data: existing } = await supabase
          .from('conversations')
          .select('id, buyer_id, seller_id')
          .eq('listing_id', params.itemId);

        let convId = existing?.find(c => 
          (c.buyer_id === user.id && c.seller_id === params.sellerId) ||
          (c.buyer_id === params.sellerId && c.seller_id === user.id)
        )?.id;

        if (!convId) {
          const { data: newConv, error } = await supabase
            .from('conversations')
            .insert({ listing_id: params.itemId, buyer_id: user.id, seller_id: params.sellerId })
            .select('id')
            .single();
          if (error) throw error;
          convId = newConv?.id;
        }

        if (isMounted && convId) {
          setConversationId(convId);
          await fetchMessages(convId, user.id);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setIsLoading(false);
      }
    });

    return () => { isMounted = false; task.cancel?.(); };
  }, [params.itemId, params.sellerId, fetchMessages]);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    // FORCE REMOVAL of conflicting marketplace channel
    supabase.getChannels().forEach((ch: any) => {
      if (ch.topic?.includes('marketplace_realtime')) {
        console.log('🧹 Removing old conflicting channel:', ch.topic);
        supabase.removeChannel(ch);
      }
    });

    const channelName = `chat:${conversationId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as any;
        setMessages((prev) => {
          if (prev.some(m => m.id === newMsg.id)) return prev;

          const tempIndex = prev.findIndex(m => m.status === 'sending' && m.text === newMsg.content);
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = {
              id: newMsg.id,
              text: newMsg.content,
              isMe: newMsg.sender_id === currentUserId,
              status: 'sent',
              created_at: newMsg.created_at,
              type: getMessageType(newMsg.content),
            };
            return updated;
          }
          return [{ 
            id: newMsg.id, 
            text: newMsg.content, 
            isMe: newMsg.sender_id === currentUserId, 
            status: 'sent', 
            created_at: newMsg.created_at, 
            type: getMessageType(newMsg.content) 
          }, ...prev];
        });
        setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 80);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== currentUserId) {
          setIsTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2500);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, currentUserId]);

  const sendTypingIndicator = () => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId },
    });
  };

  const sendMessage = async (content?: string, isImage = false) => {
    const text = content || inputText.trim();
    if (!text || !conversationId || !currentUserId) return;
    if (!isImage) setInputText('');

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [{ id: tempId, text, isMe: true, status: 'sending', created_at: new Date().toISOString(), type: isImage ? 'image' : 'text' }, ...prev]);

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: text,
    });

    if (error) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.4 });
    if (result.canceled || !result.assets[0]) return;

    setIsSendingImage(true);
    try {
      const manip = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 800 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
      const blob = await (await fetch(manip.uri)).blob();
      const path = `chat/${conversationId}/${currentUserId}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, blob);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      await sendMessage(data.publicUrl, true);
    } catch (e: any) {
      Alert.alert("Upload Failed", e.message || "Unknown error");
    } finally {
      setIsSendingImage(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{params.sellerName || 'Chat'}</Text>
            <Text style={styles.onlineStatus}>Active</Text>
          </View>
        </View>
        {params.productImage && (
          <View style={styles.itemHeader}>
            <Image source={{ uri: params.productImage }} style={styles.itemThumb} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{params.productName}</Text>
              <Text style={styles.itemPrice}>{params.price}</Text>
            </View>
          </View>
        )}
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.loadingContainer}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          renderItem={({ item }) => <MessageBubble item={item} />}
          contentContainerStyle={styles.messagesList}
          keyExtractor={item => item.id}
          initialNumToRender={20}
        />
      )}

      {isTyping && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>{params.sellerName || 'Seller'} is typing...</Text>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom + 60 : 0}>
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity onPress={handlePickImage} style={styles.attachBtn} disabled={isSendingImage}>
            {isSendingImage ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="add-circle" size={32} color={COLORS.primary} />}
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={(text) => {
                setInputText(text);
                sendTypingIndicator();
              }}
              placeholder="Message..."
              multiline
            />
            <TouchableOpacity onPress={() => sendMessage()} style={styles.sendBtn} disabled={!inputText.trim()}>
              <Ionicons name="arrow-up-circle" size={32} color={inputText.trim() ? COLORS.primary : COLORS.textGray} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  safeHeader: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  backBtn: { padding: 4 },
  headerInfo: { marginLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  onlineStatus: { fontSize: 12, color: COLORS.primary },
  itemHeader: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  itemThumb: { width: 45, height: 45, borderRadius: 8, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.textDark },
  itemPrice: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  messagesList: { padding: 16 },
  bubbleWrapper: { marginVertical: 6 },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: '82%', padding: 12, borderRadius: 20 },
  myMessage: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  theirMessage: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 22 },
  imageBubble: { padding: 0, overflow: 'hidden', borderRadius: 16 },
  chatImage: { width: width * 0.65, height: 200 },
  statusContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  timeText: { fontSize: 10 },
  tickIcon: { marginLeft: 4 },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: COLORS.white, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  attachBtn: { marginRight: 8, marginBottom: 4 },
  inputWrapper: { flex: 1, flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 24, paddingHorizontal: 12, alignItems: 'center' },
  input: { flex: 1, minHeight: 40, maxHeight: 100, fontSize: 16, paddingVertical: 8 },
  sendBtn: { marginLeft: 4, marginBottom: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageStatusOverlay: { position: 'absolute', bottom: 5, right: 8, backgroundColor: 'rgba(0,0,0,0.4)', padding: 2, borderRadius: 4 },
  typingContainer: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: COLORS.bg },
  typingText: { fontSize: 13, color: COLORS.textGray, fontStyle: 'italic' },
});