import { Ionicons, MaterialIcons } from '@expo/vector-icons'; // or your icon lib
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Import your screens
import ChatScreen from '../screens/ChatScreen';
import ExploreScreen from '../screens/ExploreScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import WishlistScreen from '../screens/WishlistScreen';

// Custom FAB Component (your green + button)
const PostFAB = ({ onPress }) => (
  <TouchableOpacity style={styles.fab} onPress={onPress}>
    <Text style={styles.fabText}>+</Text>
  </TouchableOpacity>
);

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#00CC00', // your green
          tabBarInactiveTintColor: '#757575',
          tabBarShowLabel: true, // always show labels
          tabBarLabelStyle: {
            fontSize: 11,
            marginBottom: 4,
            fontWeight: '500',
          },
          tabBarIconStyle: { marginBottom: -2 },
          // Custom active indicator (pill/underline)
          tabBarItemStyle: { paddingVertical: 6 },
        })}
        tabBar={(props) => <CustomTabBar {...props} />}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Explore"
          component={ExploreScreen}
          options={{
            tabBarLabel: 'Explore',
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialIcons name={focused ? 'grid-view' : 'grid-on'} size={size} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={{
            tabBarLabel: 'Chat',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={size} color={color} />
            ),
            // Optional: add badge later
            // tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          }}
        />

        <Tab.Screen
          name="Wishlist"
          component={WishlistScreen}
          options={{
            tabBarLabel: 'Wishlist',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>

      {/* Your green FAB - show on most tabs, hide on Chat/Profile if needed */}
      <PostFAB onPress={() => {
        // Navigate to Post Item screen or open modal
        console.log('Post new item!');
        // e.g. navigation.navigate('PostItem');
      }} />
    </View>
  );
};

// Custom TabBar for better polish (underline pill on active)
const CustomTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            style={styles.tabItem}
          >
            {options.tabBarIcon({ focused: isFocused, color: isFocused ? '#00CC00' : '#757575', size: 24 })}
            <Text style={[styles.tabLabel, { color: isFocused ? '#00CC00' : '#757575' }]}>
              {label}
            </Text>
            {isFocused && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 8, // safe area
    paddingTop: 8,
    elevation: 8, // shadow on Android
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: 60,
    backgroundColor: '#00CC00',
    borderRadius: 2,
  },
  fab: {
    position: 'absolute',
    bottom: 90, // above tab bar - adjust based on tab height
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00CC00',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
});

export default BottomTabNavigator;