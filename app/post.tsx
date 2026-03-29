import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../src/lib/supabase';

interface PostModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function PostModal({ visible, onClose }: PostModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [base64Data, setBase64Data] = useState<string | null>(null);
    const [category, setCategory] = useState('');
    const [dbCategories, setDbCategories] = useState<{ name: string }[]>([]);

    useEffect(() => {
        const loadCategories = async () => {
            const { data } = await supabase.from('categories').select('name').order('name');
            if (data) {
                setDbCategories(data);
                if (data.length > 0) setCategory(data[0].name);
            }
        };
        if (visible) loadCategories();
    }, [visible]);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9], // Required per preference
            quality: 1, 
        });

        if (!result.canceled && result.assets?.[0]) {
            try {
                // Resize to 1024px width for memory efficiency
                const manipulated = await ImageManipulator.manipulateAsync(
                    result.assets[0].uri,
                    [{ resize: { width: 1024 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );
                setImage(manipulated.uri);
                setBase64Data(manipulated.base64 || null);
            } catch (e) {
                Alert.alert("Error", "Failed to process image.");
            }
        }
    };

    const uploadToStorage = async (uri: string) => {
        if (!base64Data) throw new Error("Image data missing.");
        const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${Date.now()}.${ext}`;
        const contentType = `image/${ext === 'png' ? 'png' : 'jpeg'}`;

        const { error } = await supabase.storage
            .from('listing-images')
            .upload(fileName, decode(base64Data), { contentType, upsert: true });

        if (error) throw error;
        const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(fileName);
        return urlData.publicUrl;
    };

    const handlePost = useCallback(async () => {
        const numericPrice = parseFloat(price);
        if (!title.trim() || !image) {
            Alert.alert('Required', 'Please add a photo and title.');
            return;
        }
        if (isNaN(numericPrice) || numericPrice <= 0) {
            Alert.alert('Invalid Price', 'Please enter a valid amount.');
            return;
        }

        setIsLoading(true); // Triggers the overlay

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Session expired.");

            const publicImageUrl = await uploadToStorage(image);

            const { error: dbError } = await supabase
                .from('listings')
                .insert([{
                    title: title.trim(),
                    price: numericPrice,
                    description: description.trim(),
                    image_uri: publicImageUrl,
                    category,
                    location: 'Milan, IT',
                    user_id: user.id,
                }]);

            if (dbError) throw dbError;

            setTitle(''); setPrice(''); setDescription(''); setImage(null); setBase64Data(null);
            onClose();
            Alert.alert("Success", "Listing is live!");
        } catch (error: any) {
            Alert.alert("Post Failed", error.message);
        } finally {
            setIsLoading(false);
        }
    }, [title, price, image, base64Data, category, description, onClose]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                {/* Full-Screen Loading Overlay */}
                {isLoading && (
                    <View style={styles.loadingOverlay}>
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#22c55e" />
                            <Text style={styles.loadingText}>Publishing Listing...</Text>
                        </View>
                    </View>
                )}

                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} disabled={isLoading}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>New Listing</Text>
                    <TouchableOpacity onPress={handlePost} disabled={isLoading || !image} style={[styles.postBtn, (isLoading || !image) && {opacity: 0.5}]}>
                        <Text style={styles.postBtnText}>Post</Text>
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                        <TouchableOpacity style={styles.imagePlaceholder} onPress={pickImage} disabled={isLoading}>
                            {image ? <Image source={{ uri: image }} style={styles.previewImage} /> : (
                                <View style={styles.uploadPrompt}>
                                    <Ionicons name="camera" size={32} color="#22c55e" />
                                    <Text style={styles.uploadText}>Add Photo (16:9)</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <View style={styles.form}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput style={styles.input} placeholder="Item name" value={title} onChangeText={setTitle} />
                            
                            <Text style={styles.label}>Price (€)</Text>
                            <TextInput style={styles.input} placeholder="0.00" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
                            
                            <Text style={styles.label}>Category</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                                {dbCategories.map((cat) => (
                                    <TouchableOpacity
                                        key={cat.name}
                                        onPress={() => setCategory(cat.name)}
                                        style={[styles.catChip, category === cat.name && styles.catChipActive]}
                                    >
                                        <Text style={[styles.catChipText, category === cat.name && styles.catChipTextActive]}>{cat.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.label}>Description</Text>
                            <TextInput style={[styles.input, styles.textArea]} placeholder="Details..." value={description} onChangeText={setDescription} multiline />
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingBox: {
        backgroundColor: 'white',
        padding: 30,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    loadingText: { marginTop: 15, fontWeight: '700', color: '#1e293b' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    cancelText: { color: '#64748b', fontSize: 16 },
    postBtn: { backgroundColor: '#22c55e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    postBtnText: { color: 'white', fontWeight: '800' },
    scrollContent: { padding: 20 },
    imagePlaceholder: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#f8fafc', borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    previewImage: { width: '100%', height: '100%' },
    uploadPrompt: { alignItems: 'center' },
    uploadText: { marginTop: 8, fontWeight: '600' },
    form: { marginTop: 20 },
    label: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 8 },
    input: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    textArea: { height: 100, textAlignVertical: 'top' },
    catScroll: { marginBottom: 20 },
    catChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    catChipActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
    catChipText: { color: '#64748b', fontWeight: '600' },
    catChipTextActive: { color: 'white' }
});