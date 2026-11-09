'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  errorMessage,
  useAreasQuery,
  useCreateAddressMutation,
  useDistrictsQuery,
  useDivisionsQuery,
  useUpdateAddressMutation,
} from '@marketbd/api-client';
import { ADDRESS_LABELS, type AddressInput, AddressSchema, type AddressView } from '@marketbd/shared';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/client';
import { Button } from '@/components/ui';

export function AddressForm({ address, onSaved }: { address?: AddressView; onSaved: (a: AddressView) => void }) {
  const { t, pick } = useI18n();
  const [create, createState] = useCreateAddressMutation();
  const [update, updateState] = useUpdateAddressMutation();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<AddressInput>({
    resolver: zodResolver(AddressSchema),
    defaultValues: address
      ? {
          label: address.label,
          fullName: address.fullName,
          phone: address.phone,
          divisionId: address.division.id,
          districtId: address.district.id,
          areaId: address.area.id,
          addressLine: address.addressLine,
          landmark: address.landmark ?? undefined,
          isDefault: address.isDefault,
        }
      : { label: 'HOME', isDefault: false },
  });
  const divisionId = Number(useWatch({ control, name: 'divisionId' }) ?? 0);
  const districtId = Number(useWatch({ control, name: 'districtId' }) ?? 0);
  const { data: divisions = [] } = useDivisionsQuery();
  const { data: districts = [] } = useDistrictsQuery(divisionId, { skip: !divisionId });
  const { data: areas = [] } = useAreasQuery(districtId, { skip: !districtId });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = address ? await update({ id: address.id, ...values }).unwrap() : await create(values).unwrap();
      toast.success(t.common.save);
      onSaved(saved);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
      <div>
        <label className="label" htmlFor="fullName">{t.auth.name}</label>
        <input id="fullName" className="input" {...register('fullName')} autoComplete="name" />
        {errors.fullName && <p className="field-error">{errors.fullName.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="phone">{t.auth.phone}</label>
        <input id="phone" className="input" {...register('phone')} inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" />
        {errors.phone && <p className="field-error">{errors.phone.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="divisionId">{t.account.division}</label>
        <select
          id="divisionId"
          className="input"
          {...register('divisionId', {
            onChange: () => {
              setValue('districtId', 0);
              setValue('areaId', 0);
            },
          })}
        >
          <option value={0}>—</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>{pick(d.name, d.nameBn)}</option>
          ))}
        </select>
        {errors.divisionId && <p className="field-error">{errors.divisionId.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="districtId">{t.account.district}</label>
        <select id="districtId" className="input" disabled={!divisionId} {...register('districtId', { onChange: () => setValue('areaId', 0) })}>
          <option value={0}>—</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>{pick(d.name, d.nameBn)}</option>
          ))}
        </select>
        {errors.districtId && <p className="field-error">{errors.districtId.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="areaId">{t.account.area}</label>
        <select id="areaId" className="input" disabled={!districtId} {...register('areaId')}>
          <option value={0}>—</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{pick(a.name, a.nameBn)}</option>
          ))}
        </select>
        {errors.areaId && <p className="field-error">{errors.areaId.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="label">{t.account.label}</label>
        <select id="label" className="input" {...register('label')}>
          {ADDRESS_LABELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="addressLine">{t.account.addressLine}</label>
        <input id="addressLine" className="input" {...register('addressLine')} autoComplete="street-address" />
        {errors.addressLine && <p className="field-error">{errors.addressLine.message}</p>}
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="landmark">{t.account.landmark}</label>
        <input id="landmark" className="input" {...register('landmark')} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="accent-primary-700" {...register('isDefault')} /> {t.account.makeDefault}
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" block loading={createState.isLoading || updateState.isLoading}>
          {t.common.save}
        </Button>
      </div>
    </form>
  );
}
