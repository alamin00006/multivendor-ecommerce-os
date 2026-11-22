import { errorMessage, useUploadImageMutation } from '@marketbd/api-client';
import type { UploadFolder } from '@marketbd/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { colors } from '@/components/ui';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Up to `max` photos from the gallery or camera, uploaded straight away (the API re-encodes them to WebP
 * and strips EXIF). `value` holds the uploaded URLs.
 */
export function PhotoPicker({ value, onChange, folder, max = 5 }: { value: string[]; onChange: (urls: string[]) => void; folder: UploadFolder; max?: number }) {
  const [upload] = useUploadImageMutation();
  const [busy, setBusy] = useState(false);

  const send = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setBusy(true);
    const added: string[] = [];
    try {
      for (const a of assets.slice(0, max - value.length)) {
        const type = a.mimeType && ALLOWED.includes(a.mimeType) ? a.mimeType : 'image/jpeg';
        const form = new FormData();
        // React Native's FormData accepts { uri, name, type } for files.
        form.append('file', { uri: a.uri, name: a.fileName ?? `photo.${type.split('/')[1]}`, type } as unknown as Blob);
        const res = await upload({ folder, file: form }).unwrap();
        added.push(res.url);
      }
    } catch (e) {
      Alert.alert('Upload failed', errorMessage(e));
    } finally {
      if (added.length) onChange([...value, ...added]);
      setBusy(false);
    }
  };

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert(camera ? 'Camera permission is needed' : 'Photo access is needed', 'You can allow it in your phone settings.');
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: !camera, selectionLimit: max - value.length };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets.length) await send(result.assets);
  };

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {value.map((u) => (
          <View key={u}>
            <Image source={{ uri: u }} style={{ width: 64, height: 64, borderRadius: 8 }} />
            <Pressable onPress={() => onChange(value.filter((x) => x !== u))} accessibilityLabel="Remove photo" hitSlop={6} className="absolute -right-1.5 -top-1.5 size-5 items-center justify-center rounded-full bg-ink-900">
              <X size={12} color="#fff" />
            </Pressable>
          </View>
        ))}
        {busy ? (
          <View className="size-16 items-center justify-center rounded-lg border border-dashed border-ink-300">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
      </View>
      {value.length < max && !busy ? (
        <View className="flex-row gap-2">
          <Pressable onPress={() => void pick(false)} className="flex-row items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2">
            <ImagePlus size={16} color={colors.primary} />
            <Text className="text-sm text-ink-700">Gallery</Text>
          </Pressable>
          <Pressable onPress={() => void pick(true)} className="flex-row items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2">
            <Camera size={16} color={colors.primary} />
            <Text className="text-sm text-ink-700">Camera</Text>
          </Pressable>
          <Text className="self-center text-xs text-ink-400">
            {value.length}/{max}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
