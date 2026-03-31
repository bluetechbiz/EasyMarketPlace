import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';

type User = { id: string; email?: string; user_metadata?: { display_name?: string } } | null;

export type Item = {
  id: string;
  title: string;
  price: number;
  location: string;
  category?: string;
  imageUri?: string | null;
  imageUris: string[];
  userId?: string;
  createdAt?: string; 
  status?: 'active' | 'sold';
};

type AppContextType = {
  listings: Item[];
  loading: boolean;
  refreshListings: () => Promise<void>;
  addListing: (newItem: any, imageUri: string) => Promise<void>;
  deleteListing: (id: string, imageUri?: string | null) => Promise<void>;
  currentUser: User;
  logout: () => Promise<void>;
  favorites: Item[];
  addFavorite: (item: Item) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Item[]>([]);
  const [favorites, setFavorites] = useState<Item[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const mapItem = (item: any): Item => {
    const uris = item.image_uris ?? (item.image_uri ? [item.image_uri] : []);
    return {
      id: item.id,
      title: item.title,
      price: item.price,
      location: item.location,
      category: item.category,
      imageUris: uris,
      imageUri: item.image_uri || (uris.length > 0 ? uris[0] : null),
      userId: item.user_id,
      createdAt: item.created_at,
      status: item.status,
    };
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      setCurrentUser(user);
      await fetchLiveListings();
      if (user) await fetchFavorites(user.id);
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) {
        await fetchFavorites(user.id);
      } else {
        setFavorites([]);
      }
    });

    initializeAuth();
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const subscription = supabase
      .channel('global_listings_sync')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'listings' }, 
        (payload) => {
          setListings(current => {
            if (payload.eventType === 'INSERT') {
              const newItem = mapItem(payload.new);
              if (current.some(i => i.id === newItem.id)) return current;
              return [newItem, ...current];
            }
            if (payload.eventType === 'UPDATE') {
              const updated = mapItem(payload.new);
              return current.map(i => i.id === updated.id ? updated : i);
            }
            if (payload.eventType === 'DELETE') {
              return current.filter(i => i.id !== payload.old.id);
            }
            return current;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, []);

  const fetchLiveListings = async () => {
    const { data } = await supabase.from('listings').select('*').order('created_at', { ascending: false });
    if (data) setListings(data.map(mapItem));
  };

  const fetchFavorites = async (userId: string) => {
    const { data, error } = await supabase.from('favorites').select('*, listings(*)').eq('user_id', userId);
    if (data && !error) {
      const favListings = data.filter((f: any) => f.listings !== null).map((f: any) => mapItem(f.listings));
      setFavorites(favListings);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setFavorites([]);
  };

  const addListing = async (newItem: any, publicImageUrl: string) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.from('listings').insert([{
        ...newItem,
        user_id: currentUser.id,
        image_uri: publicImageUrl,
        status: 'active'
      }]);
      if (error) throw error;
    } catch (err: any) {
      console.error("Failed to add listing:", err.message);
      throw err;
    }
  };

  // ✅ IMPROVED DELETE LOGIC
  const deleteListing = async (id: string, imageUri?: string | null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "You must be logged in to delete.");
        return;
      }

      // 1. Storage Cleanup
      if (imageUri && imageUri.includes('LISTING-IMAGES')) {
        const filePath = imageUri.split('LISTING-IMAGES/')[1];
        if (filePath) {
          await supabase.storage.from('LISTING-IMAGES').remove([filePath]);
        }
      }

      // 2. Database Delete
      const { error, count } = await supabase
        .from('listings')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('user_id', session.user.id); // Extra safety check

      if (error) throw error;
      
      if (count === 0) {
        throw new Error("No listing found or you don't have permission.");
      }

      // Success! Real-time sync handles the UI removal.
    } catch (err: any) {
      console.error("Delete failed details:", err);
      Alert.alert("Delete Failed", err.message || "Ensure you are the owner of this post.");
    }
  };

  const addFavorite = async (item: Item) => {
    if (!currentUser) return;
    setFavorites(prev => [...prev, item]);
    const { error } = await supabase.from('favorites').insert([{ user_id: currentUser.id, listing_id: item.id }]);
    if (error) {
      setFavorites(prev => prev.filter(f => f.id !== item.id));
      Alert.alert("Error", "Could not save to favorites.");
    }
  };

  const removeFavorite = async (id: string) => {
    if (!currentUser) return;
    setFavorites(prev => prev.filter(f => f.id !== id));
    const { error } = await supabase.from('favorites').delete().eq('user_id', currentUser.id).eq('listing_id', id);
    if (error) Alert.alert("Error", "Could not remove favorite.");
  };

  return (
    <AppContext.Provider value={{ listings, loading, refreshListings: fetchLiveListings, addListing, deleteListing, currentUser, logout, favorites, addFavorite, removeFavorite }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};