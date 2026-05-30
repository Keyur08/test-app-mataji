"use client";

// filepath: /Users/a200200348/Documents/AajaPadteHai/GeyMatiMataJiApp/admin-dashboard/src/app/(admin)/admin/notifications/page.tsx
// Broadcast push notifications — composes a title + body and dispatches via a
// server action that fans out to all stored push tokens (Expo + FCM).

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Bell, Loader2, Send, Smartphone, Sparkles } from "lucide-react";

import {
  Banner,
  Button,
  Card,
  Field,
  Input,
  Textarea,
} from "@/lib/ui";
import {
  broadcastNotification,
  countRegisteredDevices,
  type BroadcastResult,
} from "./actions";

export default function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    countRegisteredDevices()
      .then(setDeviceCount)
      .catch(() => setDeviceCount(null));
  }, [result]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!title.trim() || !body.trim()) {
      setError("Please enter both a title and a message.");
      return;
    }
    if (deviceCount === 0) {
      setError("No devices have registered for push notifications yet.");
      return;
    }
    if (
      !confirm(
        `Broadcast this notification to ${
          deviceCount ?? "all"
        } registered device(s)?`
      )
    )
      return;

    startTransition(async () => {
      try {
        const res = await broadcastNotification({
          title: title.trim(),
          body: body.trim(),
          data: linkUrl.trim() ? { url: linkUrl.trim() } : undefined,
        });
        setResult(res);
        if (res.successCount > 0) {
          setTitle("");
          setBody("");
          setLinkUrl("");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary sm:text-2xl">
          <Bell size={24} /> Push Notifications
        </h1>
        <p className="text-sm text-neutral-600">
          Compose a message and broadcast it to every devotee who has installed
          the mobile app.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Registered devices"
          value={deviceCount ?? "—"}
          icon={<Smartphone size={16} />}
        />
        <StatTile
          label="Last broadcast"
          value={
            result
              ? `${result.successCount}/${result.totalTokens} delivered`
              : "—"
          }
          icon={<Send size={16} />}
        />
        <StatTile
          label="Stale tokens cleaned"
          value={result?.invalidTokensRemoved ?? "—"}
          icon={<Sparkles size={16} />}
        />
      </div>

      <Card
        title="Compose broadcast"
        description="Notifications are delivered immediately to all registered devices."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title" required>
            <Input
              required
              maxLength={65}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="🙏 Jai Shree Mataji"
            />
            <p className="mt-1 text-right text-xs text-neutral-400">
              {title.length}/65
            </p>
          </Field>

          <Field
            label="Message"
            required
            hint="Keep it short — most devices show ~2 lines on the lock screen."
          >
            <Textarea
              required
              rows={4}
              maxLength={200}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Today's pravachan begins at 6:30 PM. Tap to open the app."
            />
            <p className="mt-1 text-right text-xs text-neutral-400">
              {body.length}/200
            </p>
          </Field>

          <Field
            label="Deep link (optional)"
            hint="Optional URL passed in the notification payload (e.g. gmmapp://library/123)."
          >
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="gmmapp://news/abc123"
            />
          </Field>

          {error && <Banner kind="error">{error}</Banner>}
          {result && (
            <Banner
              kind={result.failureCount === 0 ? "success" : "info"}
            >
              Delivered to {result.successCount} of {result.totalTokens}{" "}
              device(s).{" "}
              {result.failureCount > 0 &&
                `${result.failureCount} failed. `}
              {result.invalidTokensRemoved > 0 &&
                `Removed ${result.invalidTokensRemoved} stale token(s).`}
              {result.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {result.errors.map((er, i) => (
                    <li key={i}>{er}</li>
                  ))}
                </ul>
              )}
            </Banner>
          )}

          {/* Live preview */}
          <NotificationPreview title={title} body={body} />

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {pending ? "Sending…" : "Broadcast to all devices"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-saffron/30 bg-white px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-saffron/15 text-primary">
        {icon}
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          {label}
        </p>
        <p className="text-lg font-semibold text-primary">{value}</p>
      </div>
    </div>
  );
}

function NotificationPreview({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-cream to-white p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-saffron">
        Preview
      </p>
      <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-white">
          <Bell size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {title || "Notification title"}
          </p>
          <p className="line-clamp-2 text-sm text-neutral-600">
            {body || "Your message will appear here."}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-neutral-400">
            ज्ञेयश्री माताजी · now
          </p>
        </div>
      </div>
    </div>
  );
}
