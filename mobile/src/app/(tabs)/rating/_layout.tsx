import { Stack } from 'expo-router';

export default function RatingStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Рейтинг' }} />
      <Stack.Screen name="compare" options={{ title: 'Порівняння гравців' }} />
    </Stack>
  );
}
