// modal.tsx (production-ready)
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PostModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PostModal({ visible, onClose }: PostModalProps) {
  const { addListing } = useAppContext();

  const [images, setImages] = useState<string[]>([]);              // signed URLs for preview
  const [storagePaths, setStoragePaths] = useState<string[]>([]); // paths to save in DB
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  // Permission request
  useEffect(() => {
    if (visible) {
      (async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'We need access to your photos to upload listings.');
        }
      })();
    }
  }, [visible]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images, // correct modern syntax
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });

      if (!result.canceled && result.assets) {
        setUploading(true);

        const newPaths: string[] = [];
        const newPreviews: string[] = [];

        for (const asset of result.assets) {
          const signedUrl = await uploadImage(asset.uri);
          if (signedUrl) {
            newPreviews.push(signedUrl);
            // Extract storage path from signed URL (or construct it)
            const pathMatch = signedUrl.match(/\/storage\/v1\/object\/signed\/[^/]+\/([^?]+)/);
            if (pathMatch) newPaths.push(pathMatch[1]);
          }
        }

        if (newPreviews.length > 0) {
          setImages(prev => [...prev, ...newPreviews].slice(0, 5));
          setStoragePaths(prev => [...prev, ...newPaths].slice(0, 5));
        }

        setUploading(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open photo library.');
      setUploading(false);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `listings/${fileName}`; // or `user_${userId}/${fileName}` if you have user ID

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments') // ← CHANGE TO YOUR ACTUAL BUCKET NAME IF DIFFERENT
        .upload(filePath, decode(base64), {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Generate signed URL for preview (expires in 1 hour)
      const { data: signed, error: signError } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(filePath, 3600);

      if (signError) throw signError;

      return signed.signedUrl;
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert('Upload Failed', 'Could not upload image. Try again.');
      return null;
    }
  };

  const handlePublish = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Title is required.');
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price))) {
      Alert.alert('Required', 'Valid price is required.');
      return;
    }

    const newItem = {
      title: title.trim(),
      price: parseFloat(price),
      location: 'Unknown', // update later with real location
      category: category.trim() || 'Other',
      description: description.trim(),
      image_uri: storagePaths[0] || null, // save first path (add images[] later if needed)
    };

    addListing(newItem);

    // Reset form
    setTitle('');
    setPrice('');
    setCategory('');
    setDescription('');
    setImages([]);
    setStoragePaths([]);

    Alert.alert('Success', 'Item listed!');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Post New Item</Text>
              <TouchableOpacity onPress={handlePublish} disabled={uploading}>
                <Text style={[styles.publish, uploading && { opacity: 0.5 }]}>Publish</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              <Text style={styles.label}>Photos ({images.length}/5)</Text>

              <TouchableOpacity style={styles.photoPlaceholder} onPress={pickImage} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color="#22c55e" />
                ) : (
                  <Text style={styles.photoText}>
                    {images.length < 5 ? 'Tap to add photos' : 'Maximum reached'}
                  </Text>
                )}
              </TouchableOpacity>

              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewContainer}>
                  {images.map((uri, index) => (
                    <Image key={index} source={{ uri }} style={styles.previewImage} />
                  ))}
                </ScrollView>
              )}

              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="What are you selling?"
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>Price (€) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor="#9ca3af"
                value={price}
                onChangeText={setPrice}
              />

              <Text style={styles.label}>Category</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Electronics, Furniture"
                placeholderTextColor="#9ca3af"
                value={category}
                onChangeText={setCategory}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe condition, size, etc."
                multiline
                numberOfLines={4}
                placeholderTextColor="#9ca3af"
                value={description}
                onChangeText={setDescription}
              />

              <TouchableOpacity style={styles.submitButton} onPress={handlePublish} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitText}>List Item Now</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  safeArea: { flex: 1 },
  container: { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cancel: { fontSize: 16, color: '#ef4444' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  publish: { fontSize: 16, fontWeight: '700', color: '#22c55e' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '700', color: '#475569', marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  photoPlaceholder: {
    height: 100,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  photoText: { color: '#64748b', fontSize: 14, fontWeight: '500' },
  previewContainer: { flexDirection: 'row', marginTop: 12 },
  previewImage: { width: 90, height: 90, borderRadius: 10, marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#0f172a',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  submitButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  submitText: { color: 'white', fontSize: 17, fontWeight: '800' },
});