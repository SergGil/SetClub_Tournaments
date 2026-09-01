import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { uploadPhotoToR2 } from '@/lib/photo-upload';

import type { NewsPostFormInput, NewsPostSubmitInput } from './types';

type Props = {
  initialValues?: NewsPostFormInput & { photoUrl?: string | null };
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  fieldErrors?: Record<string, string>;
  onSubmit: (values: NewsPostSubmitInput) => void;
};

/** Mirrors newsPostFormSchema (src/lib/validation/news.ts). Photo is uploaded (presign -> PUT -> key) as soon as it's picked, before the post itself is submitted - same order the web's NewsPhotoField uses. */
export function NewsForm({ initialValues, submitLabel, submitting, error, fieldErrors, onSubmit }: Props) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [body, setBody] = useState(initialValues?.body ?? '');
  const [photoUrl, setPhotoUrl] = useState(initialValues?.photoUrl ?? null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const theme = useTheme();

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Немає доступу', 'Дозвольте доступ до фото в налаштуваннях застосунку.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      // iOS Photos often stores originals as HEIC, which the server's presign route rejects -
      // "Compatible" makes the picker hand back a JPEG instead (see mobile/src/lib/photo-upload.ts).
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setIsUploadingPhoto(true);
    try {
      const { key } = await uploadPhotoToR2('/api/news/photo-presign', {}, {
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
      });
      setPhotoKey(key);
      setRemovePhoto(false);
      setPhotoUrl(asset.uri);
    } catch (err) {
      Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося завантажити фото');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  function clearPhoto() {
    setPhotoUrl(null);
    setPhotoKey(null);
    setRemovePhoto(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.form}>
      <ThemedText type="smallBold">Заголовок</ThemedText>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholderTextColor={theme.textSecondary}
      />
      {fieldErrors?.title && <ThemedText themeColor="textSecondary">{fieldErrors.title}</ThemedText>}

      <ThemedText type="smallBold">Текст</ThemedText>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        style={[styles.input, styles.multiline, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholderTextColor={theme.textSecondary}
      />
      {fieldErrors?.body && <ThemedText themeColor="textSecondary">{fieldErrors.body}</ThemedText>}

      <ThemedText type="smallBold">Фото (необов&apos;язково)</ThemedText>
      {photoUrl && <Image source={{ uri: photoUrl }} style={styles.photoPreview} contentFit="cover" />}
      <ThemedView style={styles.photoRow}>
        <Pressable
          style={[styles.photoButton, { backgroundColor: theme.backgroundElement }]}
          disabled={isUploadingPhoto}
          onPress={pickPhoto}>
          {isUploadingPhoto ? <ActivityIndicator /> : <ThemedText type="small">{photoUrl ? 'Замінити' : 'Обрати фото'}</ThemedText>}
        </Pressable>
        {photoUrl && (
          <Pressable style={[styles.photoButton, { backgroundColor: theme.backgroundElement }]} onPress={clearPhoto}>
            <ThemedText type="small">Прибрати</ThemedText>
          </Pressable>
        )}
      </ThemedView>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable
        style={styles.submit}
        disabled={submitting || isUploadingPhoto}
        onPress={() => onSubmit({ title, body, photoKey, removePhoto })}>
        {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">{submitLabel}</ThemedText>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  input: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  multiline: { minHeight: 180, textAlignVertical: 'top' },
  photoPreview: { width: '100%', height: 160, borderRadius: Spacing.two },
  photoRow: { flexDirection: 'row', gap: Spacing.two },
  photoButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  error: { color: '#d33' },
  submit: {
    marginTop: Spacing.three,
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
