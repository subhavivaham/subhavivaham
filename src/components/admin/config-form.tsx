"use client";

import { useState, useTransition } from "react";
import { Check, X, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Card } from "@/components/admin/table";
import { PageHeader } from "@/components/admin/shared";
import { useToast } from "@/lib/state/toast-provider";
import { updateSiteConfigAction } from "@/app/(admin)/admin/actions";

export function ConfigForm({
  initial,
}: {
  initial: { bannerText: string; bannerEnabled: boolean; officeAddress: string };
}) {
  const toast = useToast();
  const [bannerText, setBannerText] = useState(initial.bannerText);
  const [bannerEnabled, setBannerEnabled] = useState(initial.bannerEnabled);
  const [officeTags, setOfficeTags] = useState<string[]>(
    initial.officeAddress.split(/\r?\n/).map((a) => a.trim()).filter(Boolean)
  );
  const [officeDraft, setOfficeDraft] = useState("");
  const [busy, startTransition] = useTransition();

  const addOffice = () => {
    const value = officeDraft.trim();
    if (!value) return;
    setOfficeTags((tags) => (tags.includes(value) ? tags : [...tags, value]));
    setOfficeDraft("");
  };

  const moveOffice = (index: number, delta: number) => {
    setOfficeTags((tags) => {
      const next = [...tags];
      const target = index + delta;
      if (target < 0 || target >= next.length) return tags;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const officeAddress = officeTags.join("\n");

  const save = () => {
    startTransition(async () => {
      const result = await updateSiteConfigAction({ bannerText, bannerEnabled, officeAddress });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Configuration saved.", "success");
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration"
        description="Site-wide settings controlled by the admin team."
      />

      <Card>
        <div className="space-y-5 p-2">
          <h2 className="font-display text-lg font-semibold text-charcoal-900">
            Top banner
          </h2>

          <label className="flex items-center gap-3 text-sm font-medium text-charcoal-800">
            <input
              type="checkbox"
              checked={bannerEnabled}
              onChange={(e) => setBannerEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#7a1832]"
            />
            Show the announcement banner on public pages
          </label>

          <Textarea
            label="Banner text"
            placeholder="e.g. Special Diwali offer — premium membership at 20% off"
            value={bannerText}
            onChange={(e) => setBannerText(e.target.value)}
            className="min-h-[88px]"
          />
          <p className="text-xs text-charcoal-400">
            When hidden, visitors see no banner even if text is set.
          </p>

          <h2 className="pt-2 font-display text-lg font-semibold text-charcoal-900">
            Office address
          </h2>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-charcoal-800">
              Registered office addresses
            </label>
            <div className="flex items-center gap-2">
              <input
                value={officeDraft}
                onChange={(e) => setOfficeDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOffice();
                  }
                }}
                placeholder="e.g. 12, North Masi Street, Madurai, Tamil Nadu 625001"
                className="h-11 w-full rounded-xl border border-charcoal-200 bg-white px-3.5 text-sm text-charcoal-900 placeholder:text-charcoal-400 shadow-sm transition-colors focus:outline-none focus:border-wine-400 focus:ring-2 focus:ring-wine-100"
              />
              <Button type="button" variant="outline" size="sm" onClick={addOffice}>
                Add
              </Button>
            </div>
            {officeTags.length > 0 && (
              <ul className="flex flex-col gap-2 pt-2">
                {officeTags.map((tag, index) => (
                  <li
                    key={tag}
                    className="flex items-center justify-between gap-3 rounded-xl border border-charcoal-200 bg-ivory-50 px-4 py-2.5 text-sm text-charcoal-800"
                  >
                    <span className="min-w-0 truncate">{tag}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Edit ${tag}`}
                        onClick={() => {
                          setOfficeDraft(tag);
                          setOfficeTags((tags) => tags.filter((t) => t !== tag));
                        }}
                        className="text-charcoal-400 hover:text-wine-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${tag} up`}
                        disabled={index === 0}
                        onClick={() => moveOffice(index, -1)}
                        className="text-charcoal-400 hover:text-wine-700 disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${tag} down`}
                        disabled={index === officeTags.length - 1}
                        onClick={() => moveOffice(index, 1)}
                        className="text-charcoal-400 hover:text-wine-700 disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${tag}`}
                        onClick={() => setOfficeTags((tags) => tags.filter((t) => t !== tag))}
                        className="text-charcoal-400 hover:text-wine-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-charcoal-400">
            Type one address and press Add (or Enter) to add another. Shown in the
            footer under "Registered Offices" on every public page.
          </p>

          <div className="flex justify-end border-t border-charcoal-100 pt-4">
            <Button size="sm" onClick={save} loading={busy}>
              <Check className="h-4 w-4" /> Save configuration
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
