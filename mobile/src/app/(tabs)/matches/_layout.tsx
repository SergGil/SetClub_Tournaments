import { Stack } from 'expo-router';

export default function MatchesStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Матчі' }} />
      <Stack.Screen name="new" options={{ title: 'Новий матч', presentation: 'modal' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Матч' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Редагувати матч', presentation: 'modal' }} />
      <Stack.Screen name="[id]/score" options={{ title: 'Рахунок', presentation: 'modal' }} />
    </Stack>
  );
}
