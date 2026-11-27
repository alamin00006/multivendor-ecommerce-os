'use client';

import { errorMessage, useMessagingSettingsQuery, useSaveMessagingSettingsMutation, useSendTestMessageMutation } from '@marketbd/api-client';
import { ORDER_MESSAGE_EVENT_LABEL, ORDER_MESSAGE_EVENTS, type MessagingSettingsView, type OrderMessageEvent } from '@marketbd/shared';
import { Badge, Button, cn, Skeleton } from '@marketbd/ui';
import { Mail, MessageSquareText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cn('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-primary-600' : 'bg-ink-300')}>
      <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function TestSend({ channel }: { channel: 'email' | 'sms' }) {
  const [to, setTo] = useState('');
  const [send, { isLoading }] = useSendTestMessageMutation();
  const go = async () => {
    try {
      const r = await send({ channel, to }).unwrap();
      toast.success(r.delivered ? 'Test sent. Check the inbox / phone.' : 'Not configured on the server yet: the message was only written to the API log.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <div className="flex gap-2">
      <input className="input h-9" placeholder={channel === 'email' ? 'you@example.com' : '01XXXXXXXXX'} value={to} onChange={(e) => setTo(e.target.value)} />
      <Button size="sm" variant="ghost" loading={isLoading} disabled={to.trim().length < 5} onClick={() => void go()}>
        Send test
      </Button>
    </div>
  );
}

function Form({ initial }: { initial: MessagingSettingsView }) {
  const [draft, setDraft] = useState(initial);
  const [save, { isLoading }] = useSaveMessagingSettingsMutation();
  const toggleEvent = (e: OrderMessageEvent) =>
    setDraft((d) => ({ ...d, orderSmsEvents: d.orderSmsEvents.includes(e) ? d.orderSmsEvents.filter((x) => x !== e) : [...d.orderSmsEvents, e] }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const submit = async () => {
    try {
      await save({ orderEmailsEnabled: draft.orderEmailsEnabled, orderSmsEnabled: draft.orderSmsEnabled, orderSmsEvents: draft.orderSmsEvents as OrderMessageEvent[] }).unwrap();
      toast.success('Saved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section className="card space-y-5 p-5">
      <div>
        <h3 className="font-semibold">Customer messages</h3>
        <p className="mt-1 text-sm text-ink-600">Order updates sent to customers besides the in-app notification.</p>
      </div>

      <div className="space-y-3 rounded-lg border border-ink-100 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <Mail className="size-4 text-primary-700" /> Order emails {initial.emailReady ? <Badge tone="success">Mail server connected</Badge> : <Badge tone="warning">Mail server not set up</Badge>}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Every order event, to the customer’s account email. From: {initial.mailFrom}
              {!initial.emailReady && ' · Set MAIL_PROVIDER=smtp and the SMTP_* values on the server to send real emails.'}
            </p>
          </div>
          <Toggle on={draft.orderEmailsEnabled} onChange={(v) => setDraft({ ...draft, orderEmailsEnabled: v })} label="Order emails" />
        </div>
        <TestSend channel="email" />
      </div>

      <div className="space-y-3 rounded-lg border border-ink-100 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <MessageSquareText className="size-4 text-primary-700" /> Order SMS {initial.smsReady ? <Badge tone="success">SMS gateway connected</Badge> : <Badge tone="warning">SMS gateway not set up</Badge>}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              To the delivery phone number. Each SMS costs money, so pick only the events that matter.
              {!initial.smsReady && ' · Set SMS_GATEWAY_URL and SMS_GATEWAY_API_KEY on the server.'}
            </p>
          </div>
          <Toggle on={draft.orderSmsEnabled} onChange={(v) => setDraft({ ...draft, orderSmsEnabled: v })} label="Order SMS" />
        </div>
        <div className={cn('grid gap-2 sm:grid-cols-2', !draft.orderSmsEnabled && 'pointer-events-none opacity-50')}>
          {ORDER_MESSAGE_EVENTS.map((e) => (
            <label key={e} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary-700" checked={draft.orderSmsEvents.includes(e)} onChange={() => toggleEvent(e)} />
              {ORDER_MESSAGE_EVENT_LABEL[e]}
            </label>
          ))}
        </div>
        <TestSend channel="sms" />
      </div>

      <div className="flex justify-end">
        <Button loading={isLoading} disabled={!dirty} onClick={() => void submit()}>
          Save
        </Button>
      </div>
    </section>
  );
}

/** Admin → Settings: order emails and SMS. */
export function MessagingSettingsForm() {
  const { data } = useMessagingSettingsQuery();
  if (!data) return <Skeleton className="h-64" />;
  return <Form key={JSON.stringify(data)} initial={data} />;
}
