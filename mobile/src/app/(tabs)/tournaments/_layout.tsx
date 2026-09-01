import { Stack } from 'expo-router';

export default function TournamentsStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Турніри' }} />
      <Stack.Screen name="new" options={{ title: 'Новий турнір', presentation: 'modal' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Турнір' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Редагувати', presentation: 'modal' }} />
      <Stack.Screen name="[id]/add-participants" options={{ title: 'Додати учасників', presentation: 'modal' }} />
      <Stack.Screen name="[id]/teams" options={{ title: 'Команди' }} />
      <Stack.Screen name="[id]/team-form" options={{ title: 'Команда', presentation: 'modal' }} />
      <Stack.Screen name="[id]/tie-form" options={{ title: 'Нова зустріч', presentation: 'modal' }} />
      <Stack.Screen name="[id]/rubber-form" options={{ title: 'Новий раббер', presentation: 'modal' }} />
    </Stack>
  );
}
