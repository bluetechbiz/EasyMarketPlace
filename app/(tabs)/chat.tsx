import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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

// --- TYPES ---
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
  const lowercaseContent = content.toLowerCase();
  return imageExtensions.some(ext => lowercaseContent.includes(ext)) ? 'image' : 'text';
};

const MessageBubble = memo(({ item, onRetry }: { item: Message; onRetry: (msg: Message) => void }) => {
  const isError = item.status === 'error';
  const isImage = item.type === 'image';

  return (
    <View style={[styles.bubbleWrapper, item.isMe ? styles.alignEnd : styles.alignStart]}>
      <View style={[
        styles.messageBubble,
        item.isMe ? styles.myMessage : styles.theirMessage,
        isImage && styles.imageBubble,
      ]}>
        {isImage ? (
          <Image source={{ uri: item.text }} style={styles.chatImage} />
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
              color={isError ? COLORS.error : (isImage ? '#fff' : 'rgba(255,255,255,0.8)')}
              style={styles.tickIcon}
            />
          )}
        </View>
      </View>
      {isError && (
        <TouchableOpacity onPress={() => onRetry(item)} style={styles.retryButton}>
          <Text style={styles.retryText}>Failed. Tap to retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default function ChatScreen() {
  const params = useLocalSearchParams<ChatScreenParams>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchMessages = useCallback(async (convId: string, userId: string, lastDate?: string) => {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (lastDate) query = query.lt('created_at', lastDate);

    const { data, error } = await query;
    if (!error && data) {
      if (data.length < 20) setHasMore(false);
      const formatted: Message[] = data.map(m => ({
        id: m.id,
        text: m.content,
        isMe: m.sender_id === userId,
        status: 'sent',
        created_at: m.created_at,
        type: getMessageType(m.content),
      }));
      setMessages(prev => lastDate ? [...prev, ...formatted] : formatted);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const initChat = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.back();
        setCurrentUserId(user.id);

        // Standardized Lookup: Checks both roles (Buyer/Seller) for this specific Item
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('listing_id', params.itemId)
          .or(`and(buyer_id.eq.${user.id},seller_id.eq.${params.sellerId}),and(buyer_id.eq.${params.sellerId},seller_id.eq.${user.id})`)
          .maybeSingle();

        let convId = existing?.id;
        if (!convId) {
          const { data: newConv, error: createError } = await supabase
            .from('conversations')
            .insert({ listing_id: params.itemId, buyer_id: user.id, seller_id: params.sellerId })
            .select('id').single();
          
          if (createError) throw createError;
          convId = newConv?.id;
        }

        if (convId) {
          setConversationId(convId);
          await fetchMessages(convId, user.id);
        }
      } catch (error) {
        console.error("Chat Init Error:", error);
        setIsLoading(false);
      }
    };
    initChat();
  }, [params.itemId, params.sellerId]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase.channel(`chat:${conversationId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `conversation_id=eq.${conversationId}` 
      }, (payload) => {
        if (payload.new.sender_id !== currentUserId) {
          const newMsg: Message = {
            id: payload.new.id,
            text: payload.new.content,
            isMe: false,
            status: 'sent',
            created_at: payload.new.created_at,
            type: getMessageType(payload.new.content),
          };
          setMessages(prev => [newMsg, ...prev]);
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, currentUserId]);

  const sendMessage = useCallback(async (content?: string, isImage = false) => {
    const textToSend = content || inputText.trim();
    if (!textToSend || !conversationId || !currentUserId) return;

    if (!isImage) setInputText('');
    const tempId = Date.now().toString();
    const optimistic: Message = {
      id: tempId,
      text: textToSend,
      isMe: true,
      status: 'sending',
      created_at: new Date().toISOString(),
      type: isImage ? 'image' : 'text',
    };

    setMessages(prev => [optimistic, ...prev]);

    const { data, error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: textToSend,
    }).select().single();

    if (error) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
    } else {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, status: 'sent' } : m));
    }
  }, [inputText, conversationId, currentUserId]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.5 
    });

    if (!result.canceled && result.assets[0]) {
      setIsSending(true);
      try {
        const uri = result.assets[0].uri;
        const response = await fetch(uri);
        const blob = await response.blob();
        const path = `${currentUserId}/${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
          await sendMessage(urlData.publicUrl, true);
        }
      } catch (err) {
        Alert.alert('Error', 'Could not upload image');
      } finally {
        setIsSending(false);
      }
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
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineStatus}>Active Now</Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.productCard} 
          onPress={() => router.push({ pathname: '/details', params: { id: params.itemId } })}
        >
          <Image source={{ uri: params.productImage }} style={styles.productImage} />
          <View style={styles.productDetails}>
            <Text style={styles.productName} numberOfLines={1}>{params.productName}</Text>
            <Text style={styles.productPrice}>{params.price}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textGray} />
        </TouchableOpacity>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.loadingContainer}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          keyExtractor={item => item.id}
          onEndReached={() => {
            if (!hasMore || messages.length === 0) return;
            fetchMessages(conversationId!, currentUserId!, messages[messages.length - 1]?.created_at);
          }}
          renderItem={({ item }) => (
            <MessageBubble 
              item={item} 
              onRetry={() => sendMessage(item.text, item.type === 'image')} 
            />
          )}
          contentContainerStyle={styles.messagesList}
        />
      )}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity onPress={handlePickImage} style={styles.attachButton} disabled={isSending}>
            {isSending ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="add-circle" size={32} color={COLORS.primary} />}
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <TextInput 
              style={styles.input} 
              value={inputText} 
              onChangeText={setInputText} 
              placeholder="Type a message..." 
              multiline 
            />
            <TouchableOpacity 
              onPress={() => sendMessage()} 
              disabled={!inputText.trim() || isSending} 
              style={[styles.sendButton, { backgroundColor: inputText.trim() ? COLORS.primary : '#f1f5f9' }]}
            >
              <Ionicons name="arrow-up" size={24} color={inputText.trim() ? 'white' : '#cbd5e1'} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  safeHeader: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  backBtn: { padding: 4 },
  headerInfo: { marginLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginRight: 5 },
  onlineStatus: { fontSize: 12, color: COLORS.textGray },
  productCard: { flexDirection: 'row', alignItems: 'center', padding: 10, marginHorizontal: 16, marginBottom: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  productImage: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#e2e8f0' },
  productDetails: { marginLeft: 12, flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.textDark },
  productPrice: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  messagesList: { paddingHorizontal: 16, paddingVertical: 20 },
  bubbleWrapper: { marginVertical: 6 },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: '82%', padding: 12, borderRadius: 20 },
  myMessage: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  theirMessage: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  messageText: { fontSize: 16, lineHeight: 22 },
  imageBubble: { padding: 0, overflow: 'hidden', borderRadius: 16 },
  chatImage: { width: 240, height: 180, borderRadius: 16 },
  statusContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  timeText: { fontSize: 10, opacity: 0.7 },
  tickIcon: { marginLeft: 3 },
  inputContainer: { backgroundColor: COLORS.white, paddingHorizontal: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', alignItems: 'flex-end' },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 24, paddingLeft: 12, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, maxHeight: 100, fontSize: 16, paddingVertical: 8, color: COLORS.textDark },
  attachButton: { marginRight: 8, marginBottom: 6 },
  sendButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  retryButton: { marginTop: 4 },
  retryText: { color: COLORS.error, fontSize: 11, fontWeight: '700' },
  imageStatusOverlay: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }
});