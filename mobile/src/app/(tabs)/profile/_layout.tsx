import { Stack } from 'expo-router';

export default function ProfileStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Профіль' }} />
      <Stack.Screen name="players/index" options={{ title: 'Гравці' }} />
      <Stack.Screen name="players/new" options={{ title: 'Новий гравець', presentation: 'modal' }} />
      <Stack.Screen name="players/[id]/edit" options={{ title: 'Редагувати гравця', presentation: 'modal' }} />
      <Stack.Screen name="menu/index" options={{ title: 'Меню кав’ярні' }} />
      <Stack.Screen name="menu/section-form" options={{ title: 'Секція меню', presentation: 'modal' }} />
      <Stack.Screen name="menu/item-form" options={{ title: 'Напій', presentation: 'modal' }} />
      <Stack.Screen name="users" options={{ title: 'Користувачі' }} />
    </Stack>
  );
}
