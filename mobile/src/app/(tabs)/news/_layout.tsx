import { Stack } from 'expo-router';

export default function NewsStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Новини' }} />
      <Stack.Screen name="new" options={{ title: 'Нова новина', presentation: 'modal' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Новина' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Редагувати', presentation: 'modal' }} />
    </Stack>
  );
}
