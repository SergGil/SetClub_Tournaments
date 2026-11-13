import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { type ColorValue, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

// Since RN 0.88 the tab bar hands icons a ColorValue (which also admits null/number), while
// Ionicons only takes string | OpaqueColorValue. The tab bar only ever passes our string tints.
function tabIcon(name: React.ComponentProps<typeof Ionicons>['name']) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={typeof color === 'string' ? color : undefined} />;
  };
}

export default function TabsLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="tournaments"
        options={{
          title: 'Турніри',
          tabBarIcon: tabIcon('trophy-outline'),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Матчі',
          tabBarIcon: tabIcon('tennisball-outline'),
        }}
      />
      <Tabs.Screen
        name="rating"
        options={{
          title: 'Рейтинг',
          tabBarIcon: tabIcon('podium-outline'),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'Новини',
          tabBarIcon: tabIcon('newspaper-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профіль',
          tabBarIcon: tabIcon('person-circle-outline'),
        }}
      />
    </Tabs>
  );
}
