import Slider from '@react-native-community/slider';
import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x400.png?text=No+Image+Available';

interface ProductData {
    title: string;
    rawPrice: number;
    description: string;
    images: string[];
    originalUrl: string;
}

export default function ImportScreen() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [profitMargin, setProfitMargin] = useState(30); 
    const [productData, setProductData] = useState<ProductData | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    // ✅ Math Logic
    const displayPrice = useMemo(() => {
        if (!productData) return "0.00";
        const multiplier = 1 + (profitMargin / 100);
        return (productData.rawPrice * multiplier).toFixed(2);
    }, [productData, profitMargin]);

    const profitEuro = useMemo(() => {
        if (!productData) return "0.00";
        return (parseFloat(displayPrice) - productData.rawPrice).toFixed(2);
    }, [displayPrice, productData]);

    const isHighMarkup = profitMargin > 80;

    // ✅ UPDATED: Pro-Copywriter Title Optimization
    const optimizeTitle = () => {
        if (!productData) return;
        
        let cleanTitle = productData.title
            // 1. Remove generic sales jargon
            .replace(/aliexpress|official|store|original|new|hot|sale|free shipping|shipping|1pc|pcs|piece|lot/gi, '')
            // 2. Remove technical clutter (V, W, L, ml, mah)
            .replace(/\d+V|\d+W|\d+L|\d+ml|\d+mah|220V|110V/gi, '')
            // 3. Remove years
            .replace(/\d{4}/g, '') 
            // 4. Remove symbols and extra spaces
            .replace(/[|{}()\[\]]/g, '')
            .replace(/\s\s+/g, ' '); 

        // 5. Convert to Title Case
        cleanTitle = cleanTitle.toLowerCase().split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');

        if (cleanTitle.trim().length < 5) {
            Alert.alert("Optimization skipped", "Title is already clean or too short.");
            return;
        }

        setProductData({ ...productData, title: cleanTitle.trim() });
    };

    const fetchAliExpressData = async () => {
        const cleanUrl = url.trim();
        if (loading || !cleanUrl) return;

        if (!cleanUrl.toLowerCase().includes('aliexpress.com')) {
            Alert.alert("Invalid URL", "Please paste a valid AliExpress link.");
            return;
        }

        const idMatch = cleanUrl.match(/item\/(\d+)\.html/) || cleanUrl.match(/(\d{10,16})/);
        const itemId = idMatch ? idMatch[1] || idMatch[0] : null;

        if (!itemId) {
            Alert.alert("Error", "Could not find a Product ID.");
            return;
        }

        setLoading(true);
        setProductData(null); 

        try {
            const { data, error } = await supabase.functions.invoke('aliexpress-fetch', {
                body: { itemId }
            });

            if (error) throw error;

            const item = data?.result?.item || data?.result;
            if (!item) throw new Error("No item data found.");

            let rawImages: string[] = [];
            if (Array.isArray(item.images)) {
                rawImages = item.images;
            } else if (item.main_image) {
                rawImages = [item.main_image];
            }

            const formattedImages = rawImages.map((img: string) => {
                if (!img || typeof img !== 'string') return PLACEHOLDER_IMAGE;
                let cleanImg = img.trim();
                if (cleanImg.startsWith('//')) return `https:${cleanImg}`;
                if (cleanImg.startsWith('http')) return cleanImg;
                return `https://${cleanImg}`;
            });

            const rawPrice = item.price?.sale_price || item.price?.value || "10.00";
            const numericPrice = parseFloat(rawPrice.toString().replace(/[^0-9.]/g, ''));

            setProductData({
                title: item.title || item.item_title || "AliExpress Product",
                rawPrice: isNaN(numericPrice) ? 10.0 : numericPrice,
                description: item.description || "Imported Dropshipping Item",
                images: formattedImages.length > 0 ? formattedImages : [PLACEHOLDER_IMAGE],
                originalUrl: cleanUrl
            });

            setTimeout(() => scrollViewRef.current?.scrollTo({ y: 350, animated: true }), 200);

        } catch (error: any) {
            Alert.alert("Import Failed", error.message);
        } finally {
            setLoading(false);
        }
    };

    const saveToSupabase = async () => {
        if (!productData || saving) return;
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Please log in first.");

            const { data: existing } = await supabase
                .from('listings')
                .select('id')
                .eq('source_url', productData.originalUrl)
                .maybeSingle();

            if (existing) {
                Alert.alert("Already Imported", "This product is already in your store.");
                return;
            }

            const primaryImage = productData.images?.[0] || PLACEHOLDER_IMAGE;
            const galleryImages = productData.images?.slice(0, 3) || [];

            const { error } = await supabase.from('listings').insert([{
                title: productData.title.trim(),
                price: parseFloat(displayPrice),
                description: productData.description,
                image_uri: primaryImage,
                image_uris: galleryImages,
                user_id: user.id, 
                is_dropshipping: true,
                source_url: productData.originalUrl,
                category: 'Dropshipping'
            }]);

            if (error) throw error;
            
            Alert.alert("Success!", "Product is now live.");
            setProductData(null);
            setUrl('');
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        } catch (error: any) {
            Alert.alert("Save Error", error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
            <Text style={styles.header}>Pro Importer</Text>
            
            <View style={styles.inputArea}>
                <TextInput
                    style={styles.input}
                    placeholder="Paste AliExpress Link"
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    placeholderTextColor="#94a3b8"
                />
                <TouchableOpacity 
                    style={[styles.fetchBtn, loading && styles.btnDisabled]} 
                    onPress={fetchAliExpressData} 
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Analyze Product</Text>}
                </TouchableOpacity>
            </View>

            {productData && (
                <View style={styles.card}>
                    <Image 
                        source={{ uri: productData.images?.[0] || PLACEHOLDER_IMAGE }} 
                        style={styles.image} 
                        contentFit="cover"
                        transition={500}
                    />
                    
                    <View style={styles.rowBetween}>
                        <Text style={styles.label}>Product Title</Text>
                        <TouchableOpacity onPress={optimizeTitle}>
                            <Text style={styles.aiText}>✨ AI Optimize</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput 
                        style={styles.titleInput} 
                        value={productData.title} 
                        onChangeText={(t) => setProductData({...productData, title: t})}
                        multiline
                    />

                    <View style={styles.profitSection}>
                        <View style={styles.rowBetween}>
                            <Text style={styles.label}>Profit Margin</Text>
                            <Text style={[styles.markupText, isHighMarkup && { color: '#ef4444' }]}>
                                {profitMargin}% {isHighMarkup ? '⚠️' : ''}
                            </Text>
                        </View>
                        
                        <Slider
                            style={{ width: '100%', height: 40 }}
                            minimumValue={5}
                            maximumValue={100} 
                            step={5}
                            value={profitMargin}
                            onValueChange={setProfitMargin}
                            minimumTrackTintColor={isHighMarkup ? "#ef4444" : "#6366f1"}
                            maximumTrackTintColor="#334155"
                            thumbTintColor={isHighMarkup ? "#ef4444" : "#818cf8"}
                        />

                        <View style={styles.revenueGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>SUPPLIER COST</Text>
                                <Text style={styles.statValue}>€{productData.rawPrice.toFixed(2)}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>YOUR PROFIT</Text>
                                <Text style={[styles.statValue, { color: '#22c55e' }]}>+€{profitEuro}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.priceFooter}>
                        <View>
                            <Text style={styles.label}>Final Store Price</Text>
                            <Text style={styles.finalPrice}>€{displayPrice}</Text>
                        </View>
                        <TouchableOpacity 
                            style={[styles.saveBtn, saving && styles.btnDisabled]} 
                            onPress={saveToSupabase} 
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Publish</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { fontSize: 32, fontWeight: '900', color: 'white', textAlign: 'center', marginTop: 60, marginBottom: 20 },
    inputArea: { backgroundColor: '#1e293b', margin: 15, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#334155', elevation: 5 },
    input: { backgroundColor: '#0f172a', color: 'white', padding: 15, borderRadius: 12, marginBottom: 15 },
    fetchBtn: { backgroundColor: '#6366f1', padding: 18, borderRadius: 12, alignItems: 'center' },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    card: { margin: 15, backgroundColor: '#1e293b', padding: 20, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
    image: { width: '100%', height: 280, borderRadius: 15, marginBottom: 15, backgroundColor: '#0f172a' },
    label: { color: '#94a3b8', fontSize: 11, marginBottom: 5, fontWeight: 'bold', textTransform: 'uppercase' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    aiText: { color: '#818cf8', fontWeight: 'bold', fontSize: 12 },
    titleInput: { color: 'white', fontSize: 16, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 10, marginBottom: 20 },
    profitSection: { backgroundColor: '#0f172a', padding: 15, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
    markupText: { color: '#818cf8', fontSize: 20, fontWeight: '900' },
    revenueGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1e293b' },
    statBox: { flex: 1 },
    statLabel: { color: '#64748b', fontSize: 9, fontWeight: 'bold' },
    statValue: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    priceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#334155' },
    finalPrice: { color: '#22c55e', fontSize: 30, fontWeight: '900' },
    saveBtn: { backgroundColor: '#22c55e', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 15 },
    saveBtnText: { color: 'white', fontWeight: '900', fontSize: 16 }
});