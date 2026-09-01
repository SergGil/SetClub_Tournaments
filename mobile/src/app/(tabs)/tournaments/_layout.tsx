import { Stack } from 'expo-router';

export default function TournamentsStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Турніри' }} />
      <Stack.Screen name="new" options={{ title: 'Новий турнір', presentation: 'modal' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Турнір' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Редагувати', presentation: 'modal' }} />
      <Stack.Screen name="[id]/add-participants" options={{ title: 'Додати учасників', presentation: 'modal' }} />
    </Stack>
  );
}
