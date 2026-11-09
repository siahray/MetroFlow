import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePendingReports } from '../../offline';
import { Droplet, Map as MapIcon, Bell, User } from 'lucide-react-native';

import { fontSize, space, colors } from '../../theme';
export default function TabsLayout() {
  const pending = usePendingReports();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.slate100,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: space[6],
        },
        tabBarActiveTintColor: colors.sky600,
        tabBarInactiveTintColor: colors.slate400,
        tabBarLabelStyle: { fontSize: fontSize.micro, fontWeight: '700' },
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
          // Reports saved offline and not yet sent (FSD-FR-068).
          tabBarBadge: pending > 0 ? pending : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.amber800, color: colors.white },
          tabBarIcon: ({ color, size }) => <Bell size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: 'Rescue',
          tabBarIcon: ({ color }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: fontSize.caption, fontWeight: '900', color, letterSpacing: 0.8 }}>
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
  );
}
