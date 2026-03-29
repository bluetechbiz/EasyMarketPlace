import { nanoid } from 'nanoid/non-secure';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type User = { id: string; email?: string; user_metadata?: { display_name?: string } } | null;

export type Item = {
  id: string;
  title: string;
  price: number;
  location: string;
  category?: string;
  imageUri?: string | null;   // Primary thumbnail
  imageUris: string[];        // Full array for carousel
  userId?: string;
  createdAt?: string; 
  status?: 'active' | 'sold';
};

type AppContextType = {
  listings: Item[];
  loading: boolean;
  refreshListings: () => Promise<void>;
  addListing: (newItem: Omit<Item, 'id' | 'createdAt' | 'status' | 'imageUri' | 'imageUris'>, files: any[]) => Promise<void>;
  deleteListing: (id: string) => Promise<void>;
  currentUser: User;
  logout: () => Promise<void>;
  favorites: Item[];
  addFavorite: (item: Item) => Promise<void>; // Changed to Promise
  removeFavorite: (id: string) => Promise<void>; // Changed to Promise
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
      imageUri: uris.length > 0 ? uris[0] : null,
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
      if (user) await fetchFavorites(user.id); // Load favorites on start
      
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

  // --- REAL-TIME SYNC ---
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
    const { data } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setListings(data.map(mapItem));
  };

  // --- NEW: FETCH FAVORITES FROM DB ---
  const fetchFavorites = async (userId: string) => {
    const { data, error } = await supabase
      .from('favorites')
      .select('*, listings(*)') // Join with listings table
      .eq('user_id', userId);

    if (data && !error) {
      // Extract the nested listing data and map it
      const favListings = data
        .filter((f: any) => f.listings !== null)
        .map((f: any) => mapItem(f.listings));
      setFavorites(favListings);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setFavorites([]);
  };

  const uploadImages = async (files: any[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (const file of files) {
      try {
        const ext = file.uri.split('.').pop() || 'jpg';
        const filename = `${nanoid()}.${ext}`;
        const response = await fetch(file.uri);
        const blob = await response.blob();

        const { data, error } = await supabase.storage
          .from('listings')
          .upload(filename, blob, { contentType: `image/${ext}`, upsert: true });

        if (error) throw error;
        
        const { data: publicData } = supabase.storage.from('listings').getPublicUrl(data.path);
        uploadedUrls.push(publicData.publicUrl);
      } catch (err) {
        console.error("Upload error:", err);
      }
    }
    return uploadedUrls;
  };

  const addListing = async (newItem: Omit<Item, 'id' | 'createdAt' | 'status' | 'imageUri' | 'imageUris'>, files: any[]) => {
    if (!currentUser) return;
    try {
      let uris: string[] = [];
      if (files.length > 0) uris = await uploadImages(files);

      const { error } = await supabase.from('listings').insert([{
        ...newItem,
        user_id: currentUser.id,
        image_uris: uris,
        image_uri: uris.length > 0 ? uris[0] : null,
        status: 'active'
      }]);

      if (error) throw error;
    } catch (err: any) {
      console.error("Failed to add listing:", err.message);
      throw err;
    }
  };

  const deleteListing = async (id: string) => {
    await supabase.from('listings').delete().eq('id', id);
  };

  // --- UPDATED: PERSISTENT FAVORITES ---
  const addFavorite = async (item: Item) => {
    if (!currentUser) return;
    
    // Update Local UI instantly
    setFavorites(prev => [...prev, item]);

    const { error } = await supabase
      .from('favorites')
      .insert([{ user_id: currentUser.id, listing_id: item.id }]);

    if (error) {
      console.error("Error adding favorite:", error.message);
      // Rollback UI if DB fails
      setFavorites(prev => prev.filter(f => f.id !== item.id));
    }
  };

  const removeFavorite = async (id: string) => {
    if (!currentUser) return;

    // Update Local UI instantly
    setFavorites(prev => prev.filter(f => f.id !== id));

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('listing_id', id);

    if (error) {
      console.error("Error removing favorite:", error.message);
      // Optional: Logic to re-add to UI if delete fails
    }
  };

  return (
    <AppContext.Provider
      value={{
        listings,
        loading,
        refreshListings: fetchLiveListings,
        addListing,
        deleteListing,
        currentUser,
        logout,
        favorites,
        addFavorite,
        removeFavorite,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};