import { errorMessage, selectUser, useUpdateProfileMutation } from '@marketbd/api-client';
import { type AuthUser, BirthdaySchema, type Gender, NameSchema } from '@marketbd/shared';
import { Stack } from 'expo-router';
import { BadgeCheck, Mail, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Button, colors, Loading, RadioDot } from '@/components/ui';
import { useRequireAuth } from '@/lib/use-require-auth';

const GENDERS: { key: Gender; label: string }[] = [
  { key: 'MALE', label: 'Male' },
  { key: 'FEMALE', label: 'Female' },
  { key: 'OTHER', label: 'Other' },
];

const input = 'h-12 rounded-lg border border-ink-200 bg-white px-3 text-base text-ink-900';

function Contact({ icon, label, value, verified }: { icon: React.ReactNode; label: string; value: string | null; verified: boolean }) {
  return (
    <View className="flex-row items-center gap-3 border-b border-ink-100 py-3">
      {icon}
      <View className="flex-1">
        <Text className="text-xs text-ink-500">{label}</Text>
        <Text className="text-sm text-ink-900">{value ?? 'Not added'}</Text>
      </View>
      {value ? (
        verified ? (
          <View className="flex-row items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5">
            <BadgeCheck size={14} color={colors.primary} />
            <Text className="text-[11px] font-semibold text-primary-700">Verified</Text>
          </View>
        ) : (
          <Text className="text-[11px] text-ink-400">Not verified</Text>
        )
      ) : null}
    </View>
  );
}

/** My Profile: name, birthday and gender; email / phone shown with their verified state. */
export default function ProfileScreen() {
  const ready = useRequireAuth('/profile');
  const user = useSelector(selectUser);
  if (!ready || !user) return <Loading />;
  return <ProfileForm key={user.id} user={user} />;
}

function ProfileForm({ user }: { user: AuthUser }) {
  const [update, state] = useUpdateProfileMutation();
  const [name, setName] = useState(user.name);
  const [day, setDay] = useState(user.birthday?.slice(8, 10) ?? '');
  const [month, setMonth] = useState(user.birthday?.slice(5, 7) ?? '');
  const [year, setYear] = useState(user.birthday?.slice(0, 4) ?? '');
  const [gender, setGender] = useState<Gender | null>(user.gender);
  const [errors, setErrors] = useState<{ name?: string; birthday?: string }>({});

  const save = async () => {
    const next: typeof errors = {};
    const n = NameSchema.safeParse(name);
    if (!n.success) next.name = n.error.issues[0]?.message;
    const any = day || month || year;
    const birthday = any ? `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : null;
    if (birthday) {
      const b = BirthdaySchema.safeParse(birthday);
      if (!b.success) next.birthday = b.error.issues[0]?.message;
    }
    setErrors(next);
    if (next.name || next.birthday) return;
    try {
      await update({ name: name.trim(), birthday, gender }).unwrap();
      Alert.alert('Profile saved');
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };

  const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'My Profile' }} />
      <View className="rounded-xl bg-white p-4">
        <Text className="mb-1 text-base font-semibold text-ink-900">Contact</Text>
        <Contact icon={<Mail size={20} color={colors.primary} />} label="Email address" value={user.email} verified={user.emailVerified} />
        <Contact icon={<Phone size={20} color={colors.primary} />} label="Mobile" value={user.phone} verified={user.phoneVerified} />
      </View>

      <View className="gap-4 rounded-xl bg-white p-4">
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-ink-700">Full name</Text>
          <TextInput className={input} value={name} onChangeText={setName} autoCapitalize="words" accessibilityLabel="Full name" />
          {errors.name ? <Text className="text-xs text-red-600">{errors.name}</Text> : null}
        </View>

        <View className="gap-1.5">
          <Text className="text-sm font-medium text-ink-700">Birthday</Text>
          <View className="flex-row gap-2">
            <TextInput className={`${input} flex-1 text-center`} placeholder="DD" keyboardType="number-pad" value={day} onChangeText={(v) => setDay(digits(v, 2))} accessibilityLabel="Birth day" />
            <TextInput className={`${input} flex-1 text-center`} placeholder="MM" keyboardType="number-pad" value={month} onChangeText={(v) => setMonth(digits(v, 2))} accessibilityLabel="Birth month" />
            <TextInput className={`${input} flex-[1.4] text-center`} placeholder="YYYY" keyboardType="number-pad" value={year} onChangeText={(v) => setYear(digits(v, 4))} accessibilityLabel="Birth year" />
          </View>
          {errors.birthday ? <Text className="text-xs text-red-600">{errors.birthday}</Text> : <Text className="text-xs text-ink-400">Optional. We may send you a birthday treat.</Text>}
        </View>

        <View className="gap-1.5">
          <Text className="text-sm font-medium text-ink-700">Gender</Text>
          <View className="flex-row gap-2">
            {GENDERS.map((g) => (
              <Pressable
                key={g.key}
                onPress={() => setGender(gender === g.key ? null : g.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: gender === g.key }}
                className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg border py-3 ${gender === g.key ? 'border-primary-700 bg-primary-50' : 'border-ink-200 bg-white'}`}
              >
                <RadioDot checked={gender === g.key} />
                <Text className="text-sm text-ink-800">{g.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Button title="Save changes" onPress={() => void save()} loading={state.isLoading} />
      </View>
    </ScrollView>
  );
}
