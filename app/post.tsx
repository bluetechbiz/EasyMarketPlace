import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    LayoutAnimation,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import { supabase } from '../src/lib/supabase';

if (
    Platform.OS === 'android' && 
    UIManager.setLayoutAnimationEnabledExperimental && 
    !(global as any).nativeFabricUIManager
) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

interface PostModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function PostModal({ visible, onClose }: PostModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [uploadingIndexes, setUploadingIndexes] = useState<number[]>([]);
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState(''); 
    const [images, setImages] = useState<string[]>([]); 
    const [base64Array, setBase64Array] = useState<string[]>([]); 
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

    const resetForm = () => {
        setTitle(''); setPrice(''); setDescription(''); setLocation(''); setImages([]); setBase64Array([]);
    };

    const pickImage = async () => {
        if (images.length >= 3) {
            Alert.alert("Limit Reached", "Max 3 photos allowed.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9], 
            quality: 1, 
        });

        if (!result.canceled && result.assets?.[0]) {
            try {
                const manipulated = await ImageManipulator.manipulateAsync(
                    result.assets[0].uri,
                    [{ resize: { width: 1200 } }], 
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );
                
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setImages(prev => [...prev, manipulated.uri]);
                if (manipulated.base64) {
                    setBase64Array(prev => [...prev, manipulated.base64]);
                }
            } catch (e) {
                Alert.alert("Error", "Failed to process image.");
            }
        }
    };

    const removeImage = (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setImages(images.filter((_, i) => i !== index));
        setBase64Array(base64Array.filter((_, i) => i !== index));
    };

    const uploadAllImages = async () => {
        const promises = base64Array.map(async (base64, index) => {
            setUploadingIndexes(prev => [...prev, index]);
            const fileName = `listing_${Date.now()}_${index}.jpg`;
            
            const { error } = await supabase.storage
                .from('listing-images')
                .upload(fileName, decode(base64), { contentType: 'image/jpeg', upsert: true });

            if (error) {
                setUploadingIndexes(prev => prev.filter(i => i !== index));
                throw error;
            }

            const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(fileName);
            setUploadingIndexes(prev => prev.filter(i => i !== index));
            return urlData.publicUrl;
        });
        return Promise.all(promises);
    };

    const handlePost = useCallback(async () => {
        if (!title.trim() || images.length === 0 || !location.trim()) {
            Alert.alert('Required', 'Title, Location, and at least 1 Photo are required.');
            return;
        }

        setIsLoading(true);
        try {
            // 1. Identify the Goods Owner
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error("Session expired. Please log in again.");

            // 2. Upload images to storage
            const publicImageUrls = await uploadAllImages();

            // 3. Insert into database with SELLER_ID link
            const { error: dbError } = await supabase
                .from('listings')
                .insert([{
                    title: title.trim(),
                    price: parseFloat(price) || 0,
                    description: description.trim(),
                    image_uris: publicImageUrls, 
                    image_uri: publicImageUrls[0], 
                    category,
                    location: location.trim(), 
                    // ✅ Updated from user_id to seller_id to match your Marketplace SQL
                    seller_id: user.id,          
                }]);

            if (dbError) throw dbError;

            resetForm();
            onClose();
            Alert.alert("Success 🎉", "Listing is live! Buyers can now see your goods.");
        } catch (error: any) {
            Alert.alert("Post Failed", error.message || "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, [title, price, images, base64Array, category, description, location, onClose]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                {isLoading && (
                    <View style={styles.loadingOverlay}>
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#10b981" />
                            <Text style={styles.loadingText}>Publishing...</Text>
                        </View>
                    </View>
                )}

                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} disabled={isLoading}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>New Listing</Text>
                    <TouchableOpacity 
                        onPress={handlePost} 
                        style={[styles.postBtn, (isLoading || images.length === 0) && {opacity: 0.5}]}
                        disabled={isLoading || images.length === 0}
                    >
                        <Text style={styles.postBtnText}>Post</Text>
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                        <Text style={styles.label}>Photos ({images.length}/3)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                            {images.map((uri, index) => (
                                <View key={uri} style={styles.imageContainer}>
                                    <Image source={{ uri }} style={styles.galleryImage} />
                                    {uploadingIndexes.includes(index) && (
                                        <View style={styles.perImageOverlay}>
                                            <ActivityIndicator color="white" size="small" />
                                        </View>
                                    )}
                                    <TouchableOpacity style={styles.removeBadge} onPress={() => removeImage(index)}>
                                        <Ionicons name="close" size={18} color="white" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {images.length < 3 && (
                                <TouchableOpacity style={styles.addMoreBtn} onPress={pickImage}>
                                    <Ionicons name="camera" size={40} color="#10b981" />
                                    <Text style={styles.addMoreText}>Add Photo</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>

                        <View style={styles.form}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput style={styles.input} placeholder="Item name" value={title} onChangeText={setTitle} />
                            
                            <View style={{flexDirection: 'row', gap: 10}}>
                                <View style={{flex: 1}}>
                                    <Text style={styles.label}>Price (€)</Text>
                                    <TextInput style={styles.input} placeholder="0.00" value={price} onChangeText={setPrice} keyboardType="numeric" />
                                </View>
                                <View style={{flex: 1.5}}>
                                    <Text style={styles.label}>Location</Text>
                                    <View style={styles.locationWrapper}>
                                        <Ionicons name="location-sharp" size={18} color="#10b981" style={{ marginRight: 8 }} />
                                        <TextInput style={{ flex: 1, height: 50, fontSize: 16 }} placeholder="City, Country" value={location} onChangeText={setLocation} />
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.label}>Category</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                                {dbCategories.map((cat) => (
                                    <TouchableOpacity
                                        key={cat.name}
                                        onPress={() => {
                                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                            setCategory(cat.name);
                                        }}
                                        style={[styles.catChip, category === cat.name && styles.catChipActive]}
                                    >
                                        <Text style={[styles.catChipText, category === cat.name && styles.catChipTextActive]}>{cat.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.label}>Description</Text>
                            <TextInput style={[styles.input, styles.textArea]} placeholder="Describe the item..." value={description} onChangeText={setDescription} multiline />
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999, justifyContent: 'center', alignItems: 'center' },
    loadingBox: { backgroundColor: 'white', padding: 30, borderRadius: 20, alignItems: 'center' },
    loadingText: { marginTop: 15, fontWeight: '700', color: '#1e293b' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingTop: Platform.OS === 'ios' ? 20 : 40 },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    cancelText: { color: '#64748b', fontSize: 16 },
    postBtn: { backgroundColor: '#10b981', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 25 },
    postBtnText: { color: 'white', fontWeight: '800' },
    scrollContent: { padding: 15 },
    galleryScroll: { marginBottom: 20 },
    imageContainer: { marginRight: 12, position: 'relative' },
    galleryImage: { width: width * 0.85, height: (width * 0.85) * (9/16), borderRadius: 16, backgroundColor: '#f1f5f9' },
    perImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    removeBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(239, 68, 68, 0.9)', borderRadius: 15, padding: 6 },
    addMoreBtn: { width: 180, height: (width * 0.85) * (9/16), backgroundColor: '#f8fafc', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
    addMoreText: { marginTop: 8, fontWeight: '700', color: '#64748b' },
    label: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 10 },
    input: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 16 },
    locationWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    textArea: { height: 100, textAlignVertical: 'top' },
    catScroll: { marginBottom: 15 },
    catChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    catChipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
    catChipText: { color: '#64748b', fontWeight: '600' },
    catChipTextActive: { color: 'white' }
});