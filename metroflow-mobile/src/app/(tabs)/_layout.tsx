import { Tabs } from 'expo-router';
import type { ReactNode } from 'react';
import { View, Text, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePendingReports } from '../../offline';
import { Droplet, Map as MapIcon, Bell, User } from 'lucide-react-native';

import { fontSize, space, useTheme } from '../../theme';

/** Icon plus the small active-tab dot shown under the focused tab. */
function TabIcon({ color, focused, children }: { color: ColorValue; focused: boolean; children: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: space[3] }}>
      {children}
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: focused ? color : 'transparent',
        }}
      />
    </View>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  const pending = usePendingReports();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.white,
          borderTopColor: c.slate100,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: space[6],
        },
        tabBarActiveTintColor: c.sky600,
        tabBarInactiveTintColor: c.slate400,
        tabBarLabelStyle: { fontSize: fontSize.micro, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused}>
              <Droplet size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused}>
              <MapIcon size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'Report',
          // Reports saved offline and not yet sent (FSD-FR-068).
          tabBarBadge: pending > 0 ? pending : undefined,
          tabBarBadgeStyle: { backgroundColor: c.amber800, color: c.white },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused}>
              <Bell size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: 'Rescue',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused}>
              <Text style={{ fontSize: fontSize.caption, fontWeight: '900', color, letterSpacing: 0.8 }}>
                SOS
              </Text>
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused}>
              <User size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}
