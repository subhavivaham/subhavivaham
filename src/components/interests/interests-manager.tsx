"use client";

import { useEffect, useState, useTransition } from "react";
import { HeartHandshake, Inbox, Send, Undo2, Check, X, MapPin } from "lucide-react";
import type { Interest, InterestStatus } from "@/types";
import { ProfileGrid } from "@/components/profile/profile-card";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/admin/table";
import { useToast } from "@/lib/state/toast-provider";
import {
  markReceivedViewed,
  respondToInterest,
  withdrawInterest,
} from "@/app/(app)/profile/actions";
import { formatRelativeTime, cn } from "@/lib/utils";

type Tab = "received" | "sent";

const STATUS_TONE: Record<InterestStatus, "good" | "warn" | "bad" | "neutral"> = {
  accepted: "good",
  pending: "warn",
  declined: "bad",
  withdrawn: "neutral",
};

const STATUS_LABEL: Record<InterestStatus, string> = {
  accepted: "Accepted",
  pending: "Awaiting reply",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

// the tabs carry live counts because the difference between the two is the whole
// point of the page - someone with four received and none sent needs to act,
// someone with the reverse needs to keep browsing
function TabButton({
  active,
  label,
  count,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: typeof Inbox;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-wine-700 text-white shadow-sm"
          : "border border-charcoal-200 bg-white text-charcoal-600 hover:border-wine-300 hover:text-wine-700"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs",
          active ? "bg-white/20 text-white" : "bg-charcoal-100 text-charcoal-500"
        )}
      >
        {count}
      </span>
    </button>
  );
}

export function InterestsManager({
  received: initialReceived,
  sent: initialSent,
}: {
  received: Interest[];
  sent: Interest[];
}) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("received");
  // the lists are owned here rather than re-read after an answer, because the
  // server actions only patch the one row they touched and re-rendering would
  // drop the tab the member was on
  const [received, setReceived] = useState(initialReceived);
  const [sent, setSent] = useState(initialSent);
  // the id being acted on, not a bare boolean: the row that is working is the
  // only one that should look busy
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // an interest is "unread" until the recipient opens the list. one call for the
  // whole batch, and only once - the guard reads the local state this action
  // then updates, so the effect settles rather than re-firing
  const unread = received.some((i) => !i.viewed && i.status === "pending");
  useEffect(() => {
    if (!unread) return;
    // inside the transition, not in the effect body: the local mark has to wait
    // for the write to land, and marking first would claim success for a call
    // that may have failed
    startTransition(async () => {
      const result = await markReceivedViewed();
      if (result.ok) {
        setReceived((rows) => rows.map((i) => ({ ...i, viewed: true })));
      }
    });
  }, [unread]);

  const visible = tab === "received" ? received : sent;

  const act = (id: string, work: () => Promise<void>) => {
    setBusy(id);
    startTransition(async () => {
      await work();
      setBusy(null);
    });
  };

  const answer = (interest: Interest, status: "accepted" | "declined") => {
    act(interest.id, async () => {
      const result = await respondToInterest(interest.id, status);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      setReceived((rows) =>
        rows.map((i) => (i.id === interest.id ? { ...i, status, viewed: true } : i))
      );
      toast(result.message, "success");
    });
  };

  const undo = (interest: Interest) => {
    act(interest.id, async () => {
      const result = await withdrawInterest(interest.profile.id);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      // the row stays in the history as withdrawn rather than disappearing, so
      // the sender can still see that they sent it
      setSent((rows) =>
        rows.map((i) => (i.profile.id === interest.profile.id ? { ...i, status: "withdrawn" } : i))
      );
      toast(result.message, "success");
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
          Interests
        </h1>
        <p className="mt-1 text-charcoal-500">
          Respond to interests you&apos;ve received — accepting opens a private chat.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton
          active={tab === "received"}
          label="Received"
          count={received.length}
          icon={Inbox}
          onClick={() => setTab("received")}
        />
        <TabButton
          active={tab === "sent"}
          label="Sent"
          count={sent.length}
          icon={Send}
          onClick={() => setTab("sent")}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={tab === "received" ? HeartHandshake : Send}
          title={tab === "received" ? "No interests received yet" : "No interests sent yet"}
          description={
            tab === "received"
              ? "When someone expresses interest in your profile, it will appear here."
              : "Send interests to profiles you like to see them listed here."
          }
          action={
            <Button href="/matches" size="sm" variant="outline">
              Browse matches
            </Button>
          }
        />
      ) : (
        <>
          {/* a row per interest carries the status and the answer, because the
              profile card itself only offers a link out */}
          <ul className="space-y-3">
            {visible.map((interest) => {
              const { profile, status } = interest;
              // a send made before the table was wired up has no row behind it,
              // so there is nothing to withdraw or answer
              const trackable = Boolean(interest.id);

              return (
                <li
                  key={`${interest.id}-${profile.id}`}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-charcoal-100 bg-white p-4 shadow-card"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-charcoal-800">
                        {profile.fullName}, {profile.age}
                      </span>
                      <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
                      {!interest.viewed && status === "pending" && (
                        <Pill tone="bad">New</Pill>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-charcoal-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {profile.city}, {profile.state} · {profile.community || profile.religion}
                    </p>
                    {/* an unstamped row renders nothing: formatRelativeTime on an
                        empty string would print "Invalid Date" */}
                    {interest.createdAt && (
                      <p className="mt-0.5 text-xs text-charcoal-400">
                        {tab === "received" ? "Received" : "Sent"}{" "}
                        {formatRelativeTime(interest.createdAt)}
                      </p>
                    )}
                    {interest.message && (
                      <p className="mt-2 border-l-2 border-charcoal-100 pl-3 text-sm italic text-charcoal-600">
                        &ldquo;{interest.message}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button href={`/profile/${profile.id}`} variant="outline" size="sm">
                      View profile
                    </Button>

                    {tab === "received" &&
                      (status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            loading={busy === interest.id}
                            onClick={() => answer(interest, "accepted")}
                          >
                            <Check className="h-4 w-4" /> Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            loading={busy === interest.id}
                            onClick={() => answer(interest, "declined")}
                          >
                            <X className="h-4 w-4" /> Decline
                          </Button>
                        </>
                      ) : (
                        <span className="self-center text-xs text-charcoal-400">
                          {status === "accepted" ? "You accepted this" : "You declined this"}
                        </span>
                      ))}

                    {tab === "sent" &&
                      (status === "pending" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={busy === interest.id}
                          disabled={!trackable}
                          onClick={() => undo(interest)}
                        >
                          <Undo2 className="h-4 w-4" /> Withdraw
                        </Button>
                      ) : (
                        <span className="self-center text-xs text-charcoal-400">
                          {status === "accepted"
                            ? "They accepted"
                            : status === "declined"
                              ? "They declined"
                              : "No longer active"}
                        </span>
                      ))}
                  </div>
                </li>
              );
            })}
          </ul>

          <ProfileGrid profiles={visible.map((i) => i.profile)} />
        </>
      )}
    </div>
  );
}
