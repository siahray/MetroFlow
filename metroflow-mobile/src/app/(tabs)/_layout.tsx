import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePendingReports } from '../../offline';
import { Droplet, Map as MapIcon, Bell, User } from 'lucide-react-native';

import { colors } from '../../theme';
export default function TabsLayout() {
  const pending = usePendingReports();
  const insets = useSafeAreaInsets();
  return (
    <>
    {pending > 0 && (
      <View accessibilityRole="alert" style={{ backgroundColor: colors.amber100, paddingTop: insets.top + 6, paddingBottom: 6, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.amber800 }}>
          {pending} report{pending === 1 ? '' : 's'} waiting to sync
        </Text>
      </View>
    )}
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.slate100,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.sky600,
        tabBarInactiveTintColor: colors.slate400,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Droplet size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => <MapIcon size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'Report',
          tabBarIcon: ({ color, size }) => <Bell size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: 'Rescue',
          tabBarIcon: ({ color }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '900', color, letterSpacing: 0.8 }}>
                SOS
              </Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={20} color={color} />,
        }}
      />
    </Tabs>
    </>
  );
}
