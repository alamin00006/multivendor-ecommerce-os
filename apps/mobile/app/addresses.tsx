import {
  errorMessage,
  useAddressesQuery,
  useAreasQuery,
  useCreateAddressMutation,
  useDeleteAddressMutation,
  useDistrictsQuery,
  useDivisionsQuery,
} from '@marketbd/api-client';
import { AddressSchema, type GeoOption } from '@marketbd/shared';
import { router, Stack } from 'expo-router';
import { MapPin, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Badge, Button, Card, colors, Empty, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useRequireAuth } from '@/lib/use-require-auth';

const inputClass = 'h-12 rounded-lg border border-ink-200 bg-white px-3';

function Picker({ label, options, value, onChange, disabled }: { label: string; options: GeoOption[]; value: number; onChange: (id: number) => void; disabled?: boolean }) {
  const { pick } = useI18n();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <>
      <Pressable disabled={disabled} onPress={() => setOpen(true)} className={`${inputClass} justify-center ${disabled ? 'opacity-50' : ''}`}>
        <Text className={selected ? 'text-ink-900' : 'text-ink-400'}>{selected ? pick(selected.name, selected.nameBn) : label}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 pt-12">
          <Text className="px-4 pb-3 text-lg font-semibold">{label}</Text>
          <FlatList
            data={options}
            keyExtractor={(o) => String(o.id)}
            renderItem={({ item }) => (
              <Pressable onPress={() => { onChange(item.id); setOpen(false); }} className="border-b border-ink-100 px-4 py-3">
                <Text>{pick(item.name, item.nameBn)}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

function AddressForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ fullName: '', phone: '', divisionId: 0, districtId: 0, areaId: 0, addressLine: '', landmark: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { data: divisions = [] } = useDivisionsQuery();
  const { data: districts = [] } = useDistrictsQuery(form.divisionId, { skip: !form.divisionId });
  const { data: areas = [] } = useAreasQuery(form.districtId, { skip: !form.districtId });
  const [create, state] = useCreateAddressMutation();

  const submit = async () => {
    const payload = { ...form, label: 'HOME' as const, landmark: form.landmark || undefined, isDefault: false };
    const parsed = AddressSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    try {
      await create(payload).unwrap();
      onDone();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };
  const err = (k: string) => (errors[k] ? <Text className="text-xs text-red-600">{errors[k]}</Text> : null);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingTop: 48 }} keyboardShouldPersistTaps="handled">
      <Text className="text-lg font-semibold">{t.checkout.addAddress}</Text>
      <TextInput className={inputClass} placeholder={t.auth.name} value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} />
      {err('fullName')}
      <TextInput className={inputClass} placeholder="01XXXXXXXXX" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} />
      {err('phone')}
      <Picker label={t.account.division} options={divisions} value={form.divisionId} onChange={(id) => setForm({ ...form, divisionId: id, districtId: 0, areaId: 0 })} />
      {err('divisionId')}
      <Picker label={t.account.district} options={districts} value={form.districtId} disabled={!form.divisionId} onChange={(id) => setForm({ ...form, districtId: id, areaId: 0 })} />
      {err('districtId')}
      <Picker label={t.account.area} options={areas} value={form.areaId} disabled={!form.districtId} onChange={(id) => setForm({ ...form, areaId: id })} />
      {err('areaId')}
      <TextInput className={inputClass} placeholder={t.account.addressLine} value={form.addressLine} onChangeText={(v) => setForm({ ...form, addressLine: v })} />
      {err('addressLine')}
      <TextInput className={inputClass} placeholder={t.account.landmark} value={form.landmark} onChangeText={(v) => setForm({ ...form, landmark: v })} />
      <Button title={t.common.save} loading={state.isLoading} onPress={() => void submit()} />
      <Button title={t.common.cancel} variant="ghost" onPress={onDone} />
    </ScrollView>
  );
}

export default function AddressesScreen() {
  const { t, pick } = useI18n();
  const ready = useRequireAuth('/addresses');
  const { data, isLoading } = useAddressesQuery(undefined, { skip: !ready });
  const [remove] = useDeleteAddressMutation();
  const [adding, setAdding] = useState(false);
  if (!ready || isLoading) return <Loading />;
  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: t.account.addresses }} />
      <FlatList
        data={data ?? []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        ListEmptyComponent={<Empty icon={<MapPin size={48} color={colors.muted} />} title={t.account.noAddresses} />}
        renderItem={({ item: a }) => (
          <Card className="gap-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold">{a.fullName}</Text>
              {a.isDefault ? <Badge label={t.account.default} tone="primary" /> : null}
              <Pressable className="ml-auto p-1" onPress={() => void remove(a.id)} accessibilityLabel={t.common.delete}>
                <Trash2 size={16} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-sm text-ink-600">{a.phone}</Text>
            <Text className="text-sm text-ink-600">{a.addressLine}, {pick(a.area.name, a.area.nameBn)}, {pick(a.district.name, a.district.nameBn)}</Text>
          </Card>
        )}
        ListFooterComponent={<Button title={t.checkout.addAddress} variant="outline" onPress={() => setAdding(true)} className="mt-2" />}
      />
      <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}>
        <AddressForm
          onDone={() => {
            setAdding(false);
            if (router.canGoBack() && (data?.length ?? 0) === 0) router.back();
          }}
        />
      </Modal>
    </View>
  );
}
