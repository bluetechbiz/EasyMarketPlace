import Slider from '@react-native-community/slider';
import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x400.png?text=No+Image+Available';
const DEFAULT_FALLBACK_PRICE = 22.00;

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
    const [profitMargin, setProfitMargin] = useState(40); 
    const [productData, setProductData] = useState<ProductData | null>(null);
    
    const scrollViewRef = useRef<ScrollView>(null);

    // ✅ FIX 1: Default Stats Object (No more null checks needed in UI)
    const stats = useMemo(() => {
        const fallback = { displayPrice: "0.00", netProfit: 0, isWinning: false, isLoss: false };
        if (!productData) return fallback;
        
        const rawCost = productData.rawPrice ?? 0;
        const multiplier = 1 + (profitMargin / 100);
        const rawCalculated = rawCost * multiplier;
        
        const safeBase = Math.max(rawCalculated, 1);
        const roundedPrice = Math.ceil(safeBase) - 0.01;
        
        const stripeFee = (roundedPrice * 0.029) + 0.30;
        const netProfit = roundedPrice - rawCost - stripeFee;
        
        return {
            displayPrice: roundedPrice.toFixed(2),
            netProfit: netProfit,
            isWinning: netProfit > 6 && profitMargin > 45,
            isLoss: netProfit <= 0
        };
    }, [productData, profitMargin]);

    const optimizeTitle = () => {
        if (!productData) return;
        let cleanTitle = productData.title
            .replace(/aliexpress|official|store|original|new|hot|sale|free shipping|1pc|pcs|piece|lot/gi, '')
            .replace(/\d+V|\d+W|\d+mah|220V|110V/gi, '')
            .replace(/[|{}()[\]]/g, '')
            .replace(/\s\s+/g, ' '); 

        cleanTitle = cleanTitle.toLowerCase().split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');

        if (!cleanTitle.trim() || cleanTitle.trim().length < 5) {
            Alert.alert("Invalid Title", "Title is too short. Please edit manually.");
            return;
        }

        setProductData(prev => prev ? { ...prev, title: cleanTitle.trim() } : prev);
    };

    const fetchAliExpressData = async () => {
        const cleanUrl = url.trim();
        if (loading || !cleanUrl) return;

        const idMatch = cleanUrl.match(/item\/(\d+)/);
        const itemId = idMatch ? idMatch[1] : null;

        if (!itemId) {
            Alert.alert("Invalid URL", "Please use a standard AliExpress link.");
            return;
        }

        setLoading(true);
        setProductData(null); 

        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        try {
            const { data: existing } = await supabase
                .from('listings')
                .select('id')
                .eq('source_url', cleanUrl)
                .maybeSingle();

            if (existing) {
                Alert.alert("Duplicate", "Product already in store.");
                setLoading(false);
                return;
            }

            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("Request timed out.")), 15000);
            });

            const { data, error } = await Promise.race([
                supabase.functions.invoke('aliexpress-fetch', { body: { itemId } }),
                timeoutPromise
            ]) as any;

            if (error) throw error;

            const item = data?.result?.item || data?.result;
            if (!item) throw new Error("Data retrieval failed.");

            const p = item.price;
            const rawBase = p?.original_price || p?.market_price || p?.sale_price || p?.value || '';
            const cleaned = String(rawBase).replace(/[^0-9.]/g, '');
            const numericPrice = cleaned ? parseFloat(cleaned) : DEFAULT_FALLBACK_PRICE;
            
            const finalSupplierCost = numericPrice < 12 ? numericPrice * 1.5 : numericPrice;

            let rawImages: string[] = Array.isArray(item.images)
                ? item.images
                : item.main_image ? [item.main_image] : [];
            
            const formattedImages = rawImages.filter(Boolean).map((img: string) => 
                img.startsWith('//') ? `https:${img}` : img
            );

            setProductData({
                title: (item.title || "AliExpress Item").substring(0, 150),
                rawPrice: finalSupplierCost,
                description: (item.description || "No description.").substring(0, 500),
                images: formattedImages.length > 0 ? formattedImages.slice(0, 8) : [PLACEHOLDER_IMAGE],
                originalUrl: cleanUrl
            });

            setProfitMargin(finalSupplierCost < 15 ? 75 : 45);
            setTimeout(() => scrollViewRef.current?.scrollTo({ y: 300, animated: true }), 400);

        } catch (error: any) {
            Alert.alert("Import Failed", error.message);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            setLoading(false);
        }
    };

    const saveToSupabase = async () => {
        if (!productData || saving) return;

        if (stats.isLoss) {
            Alert.alert("Not Profitable", "Increase margin before publishing.");
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Please log in.");

            // ✅ FIX 2: Safe URL Object Handling
            let finalAffiliateUrl = productData.originalUrl;
            try {
                const urlObj = new URL(finalAffiliateUrl);
                urlObj.searchParams.set("trackingId", "ErnestApp01");
                finalAffiliateUrl = urlObj.toString();
            } catch (e) {
                // If URL constructor fails, manual append as fallback
                finalAffiliateUrl += (finalAffiliateUrl.includes('?') ? '&' : '?') + 'trackingId=ErnestApp01';
            }

            const { error } = await supabase.from('listings').insert([{
                title: productData.title.trim(),
                price: parseFloat(stats.displayPrice),
                description: productData.description,
                image_uri: productData.images[0],
                image_uris: productData.images, 
                user_id: user.id, 
                source_url: finalAffiliateUrl,
                category: 'Dropshipping'
            }]);

            if (error) throw error;
            
            Alert.alert("Success!", "Product published.");
            setProductData(null);
            setUrl('');
        } catch (error: any) {
            Alert.alert("Save Error", error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
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
                    {stats.isWinning && (
                        <View style={styles.badge}><Text style={styles.badgeText}>🔥 HIGH POTENTIAL</Text></View>
                    )}

                    {/* ✅ FIX 3: FlatList for better image virtualization performance */}
                    <FlatList 
                        data={productData.images}
                        keyExtractor={(_, index) => index.toString()}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <Image source={{ uri: item }} style={styles.galleryImg} contentFit="cover" />
                        )}
                        style={styles.gallery}
                    />
                    
                    <View style={styles.rowBetween}>
                        <Text style={styles.label}>Product Title</Text>
                        <TouchableOpacity onPress={optimizeTitle}>
                            <Text style={styles.aiText}>✨ AI Clean</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput 
                        style={styles.titleInput} 
                        value={productData.title} 
                        onChangeText={(t) => setProductData(prev => prev ? {...prev, title: t} : prev)}
                        multiline
                    />

                    <View style={styles.profitSection}>
                        <View style={styles.rowBetween}>
                            <Text style={styles.label}>Margin: {profitMargin}%</Text>
                            <Text style={styles.feeNote}>Incl. Stripe Fees</Text>
                        </View>
                        
                        <Slider
                            style={{ width: '100%', height: 40 }}
                            minimumValue={10}
                            maximumValue={120}
                            step={5}
                            value={profitMargin}
                            onSlidingComplete={setProfitMargin}
                            minimumTrackTintColor="#6366f1"
                        />

                        <View style={styles.revenueGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>COST</Text>
                                <Text style={styles.statValue}>€{productData.rawPrice.toFixed(2)}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>NET PROFIT</Text>
                                <Text style={[styles.statValue, { color: stats.isLoss ? '#ef4444' : '#22c55e' }]}>
                                    €{stats.netProfit.toFixed(2)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.priceFooter}>
                        <View>
                            <Text style={styles.label}>Store Price</Text>
                            <Text style={styles.finalPrice}>€{stats.displayPrice}</Text>
                        </View>
                        <TouchableOpacity 
                            style={[styles.saveBtn, (saving || stats.isLoss) && styles.btnDisabled]} 
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
    header: { fontSize: 28, fontWeight: '900', color: 'white', textAlign: 'center', marginTop: 50, marginBottom: 10 },
    inputArea: { backgroundColor: '#1e293b', margin: 15, padding: 15, borderRadius: 20 },
    input: { backgroundColor: '#0f172a', color: 'white', padding: 12, borderRadius: 10, marginBottom: 10 },
    fetchBtn: { backgroundColor: '#6366f1', padding: 15, borderRadius: 10, alignItems: 'center' },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: 'white', fontWeight: 'bold' },
    card: { margin: 15, backgroundColor: '#1e293b', padding: 15, borderRadius: 20 },
    gallery: { marginBottom: 15 },
    galleryImg: { width: 100, height: 100, borderRadius: 10, marginRight: 8 },
    badge: { backgroundColor: '#f59e0b', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
    badgeText: { color: 'black', fontSize: 10, fontWeight: 'bold' },
    label: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold' },
    feeNote: { color: '#64748b', fontSize: 9 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    aiText: { color: '#818cf8', fontWeight: 'bold', fontSize: 11 },
    titleInput: { color: 'white', fontSize: 15, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 5, marginBottom: 15 },
    profitSection: { backgroundColor: '#0f172a', padding: 12, borderRadius: 12, marginBottom: 15 },
    revenueGrid: { flexDirection: 'row', marginTop: 10 },
    statBox: { flex: 1 },
    statLabel: { color: '#64748b', fontSize: 8, fontWeight: 'bold' },
    statValue: { color: 'white', fontSize: 14, fontWeight: 'bold' },
    priceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    finalPrice: { color: '#22c55e', fontSize: 24, fontWeight: '900' },
    saveBtn: { backgroundColor: '#22c55e', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    saveBtnText: { color: 'white', fontWeight: 'bold' }
});