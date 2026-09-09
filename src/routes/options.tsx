import { createFileRoute } from "@tanstack/react-router";
import { Download, Monitor } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DESKTOP_RELEASES_URL, isNoxDesktop } from "@/lib/desktop";
import {
  THEMES,
  useSettingsStore,
  type PlaybackRate,
  type SearchModePref,
  type SubtitleBox,
  type SubtitleMode,
  type SubtitlePos,
  type SubtitleSize,
  type ThemeId,
  VIDEO_FITS,
} from "@/stores/settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/options")({
  component: OptionsPage,
});

const RATES: PlaybackRate[] = [1, 1.25, 1.5, 2];
const SUB_MODES: { id: SubtitleMode; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "en", label: "English" },
  { id: "last", label: "Last used" },
];
const SEARCH_MODES: { id: SearchModePref; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "smart", label: "Smart" },
];

function OptionsPage() {
  const theme = useSettingsStore((s) => s.theme);
  const autoplayNext = useSettingsStore((s) => s.autoplayNext);
  const skipIntros = useSettingsStore((s) => s.skipIntros);
  const rememberStream = useSettingsStore((s) => s.rememberStream);
  const playbackRate = useSettingsStore((s) => s.playbackRate);
  const subtitles = useSettingsStore((s) => s.subtitles);
  const searchMode = useSettingsStore((s) => s.searchMode);
  const tvRemote = useSettingsStore((s) => s.tvRemote);
  const subtitleSize = useSettingsStore((s) => s.subtitleSize);
  const subtitleBox = useSettingsStore((s) => s.subtitleBox);
  const subtitlePos = useSettingsStore((s) => s.subtitlePos);
  const videoFit = useSettingsStore((s) => s.videoFit);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-[calc(var(--header-h)+0.75rem)] sm:px-8">
      <h1 className="text-3xl font-semibold">Options</h1>
      <p className="mt-2 mb-10 text-muted">Playback, search, and how Nox looks.</p>

      <DesktopSection />

      <Section title="Playback">
        <Row
          label="Autoplay next episode"
          hint="Start the next episode after the credits countdown"
          control={<Switch on={autoplayNext} onClick={() => useSettingsStore.getState().setAutoplayNext(!autoplayNext)} label="Autoplay next episode" />}
        />
        <Row
          label="Skip intros"
          hint="Jump past the opening when Nox knows where it ends"
          control={<Switch on={skipIntros} onClick={() => useSettingsStore.getState().setSkipIntros(!skipIntros)} label="Skip intros" />}
        />
        <Row
          label="Remember last stream"
          hint="Reuse the add-on and quality you picked last time. English-language files stay first."
          control={<Switch on={rememberStream} onClick={() => useSettingsStore.getState().setRememberStream(!rememberStream)} label="Remember last stream" />}
        />
        <Row
          label="Default speed"
          hint="New streams start at this playback rate"
          control={
            <Segmented
              value={String(playbackRate)}
              options={RATES.map((rate) => ({ id: String(rate), label: `${rate}×` }))}
              onChange={(id) => useSettingsStore.getState().setPlaybackRate(Number(id) as PlaybackRate)}
            />
          }
        />
        <div className="bg-surface px-4 py-4">
          <p className="font-medium">Picture</p>
          <p className="mb-3 text-sm text-muted">
            Fit keeps the shape. Fill crops. Stretch distorts. Zoom hides letterbox bars.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {VIDEO_FITS.map((item) => {
              const on = videoFit === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => useSettingsStore.getState().setVideoFit(item.id)}
                  className={cn(
                    "min-h-11 rounded-md px-3 py-2 text-left touch-manipulation",
                    on ? "bg-fg text-bg" : "bg-elevated text-fg hover:bg-elevated/80",
                  )}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={cn("mt-0.5 block text-2xs", on ? "text-bg/70" : "text-muted")}>{item.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
        <Row
          label="Subtitles"
          hint="English picks a track. Last used remembers the language per title."
          control={
            <Segmented
              value={subtitles}
              options={SUB_MODES}
              onChange={(id) => useSettingsStore.getState().setSubtitles(id as SubtitleMode)}
            />
          }
        />
      </Section>

      <Section title="Theme" flush>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.map((item) => (
            <ThemeCard key={item.id} id={item.id} active={theme === item.id} />
          ))}
        </div>
      </Section>

      <Section title="Search">
        <Row
          label="Default search"
          hint="Smart understands vibes and plots. Title matches the name as written."
          control={
            <Segmented
              value={searchMode}
              options={SEARCH_MODES}
              onChange={(id) => useSettingsStore.getState().setSearchMode(id as SearchModePref)}
            />
          }
        />
      </Section>

      <Section title="Subtitles">
        <Row
          label="Size"
          hint="How large the on-screen text is"
          control={
            <Segmented
              value={subtitleSize}
              options={[
                { id: "s", label: "S" },
                { id: "m", label: "M" },
                { id: "l", label: "L" },
                { id: "xl", label: "XL" },
              ]}
              onChange={(id) => useSettingsStore.getState().setSubtitleSize(id as SubtitleSize)}
            />
          }
        />
        <Row
          label="Background"
          hint="Box behind the words"
          control={
            <Segmented
              value={subtitleBox}
              options={[
                { id: "off", label: "Off" },
                { id: "dim", label: "Dim" },
                { id: "solid", label: "Solid" },
              ]}
              onChange={(id) => useSettingsStore.getState().setSubtitleBox(id as SubtitleBox)}
            />
          }
        />
        <Row
          label="Position"
          hint="Low sits on the controls. High sits mid-frame."
          control={
            <Segmented
              value={subtitlePos}
              options={[
                { id: "low", label: "Low" },
                { id: "mid", label: "Mid" },
                { id: "high", label: "High" },
              ]}
              onChange={(id) => useSettingsStore.getState().setSubtitlePos(id as SubtitlePos)}
            />
          }
        />
      </Section>

      <Section title="TV">
        <Row
          label="TV remote mode"
          hint="Bigger focus rings, hide the cursor, move with the arrow keys. Backspace goes back. Off on the player so seek still works."
          control={<Switch on={tvRemote} onClick={() => useSettingsStore.getState().setTvRemote(!tvRemote)} label="TV remote mode" />}
        />
      </Section>
    </main>
  );
}

function DesktopSection() {
  const [desktop, setDesktop] = useState(false);
  const [updateNote, setUpdateNote] = useState("");
  useEffect(() => {
    setDesktop(isNoxDesktop());
    const stop = window.noxDesktop?.onUpdateStatus?.((payload) => {
      setUpdateNote(payload.message || "");
    });
    return () => {
      stop?.();
    };
  }, []);

  return (
    <Section title="Desktop app">
      <div className="bg-surface px-4 py-5">
        {desktop ? (
          <>
            <p className="flex items-center gap-2 font-medium">
              <Monitor className="size-4 text-accent" />
              You’re in the Nox app
            </p>
            <p className="mt-2 text-sm text-muted">
              This copy runs on your computer — no website required. New versions download themselves; Nox asks to
              restart when one is ready. Atmos, DTS, and AC3 are converted to AAC stereo so they make sound.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="play"
                onClick={() => {
                  setUpdateNote("Checking…");
                  void window.noxDesktop?.checkForUpdates?.();
                }}
              >
                Check for updates
              </Button>
              {updateNote ? <p className="text-sm text-muted">{updateNote}</p> : null}
            </div>
          </>
        ) : (
          <>
            <p className="font-medium">Nox on your computer</p>
            <p className="mt-2 mb-4 text-sm text-muted">
              Install Nox 1.2 or newer for a Windows app that does not need the website. After that, updates install
              themselves. Cinema audio (Atmos / DTS / AC3) plays as AAC stereo.
            </p>
            <Button asChild variant="play">
              <a href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer">
                <Download className="size-4" />
                Get Nox for Windows, Mac, or Linux
              </a>
            </Button>
          </>
        )}
      </div>
    </Section>
  );
}

function Section({ title, children, flush }: { title: string; children: ReactNode; flush?: boolean }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-subtle uppercase">{title}</h2>
      {flush ? children : <div className="flex flex-col gap-px overflow-hidden rounded-md bg-border">{children}</div>}
    </section>
  );
}

function Row({
  label,
  hint,
  control,
}: {
  label: string;
  hint: string;
  control: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 bg-surface px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function ThemeCard({ id, active }: { id: ThemeId; active: boolean }) {
  const theme = THEMES.find((item) => item.id === id)!;
  return (
    <button
      type="button"
      onClick={() => useSettingsStore.getState().setTheme(id)}
      aria-pressed={active}
      className={cn(
        "rounded-md p-3 text-left outline outline-1 -outline-offset-1 touch-manipulation",
        active ? "outline-fg" : "outline-border hover:outline-fg/40",
      )}
    >
      <span
        className="mb-3 flex h-14 overflow-hidden rounded-sm"
        style={{ background: theme.bg }}
      >
        <span className="w-1/3" style={{ background: theme.accent }} />
        <span className="flex-1" style={{ background: theme.bg }} />
      </span>
      <span className="block text-sm font-semibold">{theme.label}</span>
      <span className="text-xs text-muted">{theme.hint}</span>
    </button>
  );
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-14 shrink-0 items-center overflow-hidden rounded-full p-1 transition-colors duration-200",
        on ? "justify-end bg-accent" : "justify-start bg-elevated",
      )}
    >
      <span className="block size-6 shrink-0 rounded-full bg-fg shadow-sm" />
    </button>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex rounded-full bg-elevated p-1">
      {options.map((option) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "h-9 min-w-14 rounded-full px-3 text-sm font-semibold touch-manipulation",
              on ? "bg-fg text-bg" : "text-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
