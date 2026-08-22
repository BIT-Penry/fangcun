import { useState } from "react";

const RECENT_EMOJI_KEY = "fangcun:recent-emojis";

const EMOJIS = [
  "😊", "🥹", "😄", "😂", "🥰", "😍", "😌", "😎", "🤩", "🥳", "😴", "😭",
  "😔", "😮‍💨", "😤", "😡", "🤯", "🥶", "🥵", "🤒", "🤔", "🫡", "🫠", "🙃",
  "👍", "👎", "👏", "🙌", "🤝", "🙏", "💪", "✌️", "🤞", "👌", "👀", "🫶",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🤍", "🖤", "💯", "✨", "🔥", "🎉",
  "🌱", "🌤️", "🌙", "⭐", "☕", "🍵", "🍜", "🍰", "🎧", "📚", "💻", "✍️",
  "✅", "❌", "⚠️", "💡", "📌", "⏰", "🚀", "🏃", "🧘", "🎯", "🏆", "🐾",
];

function loadRecentEmoji(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_EMOJI_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function EmojiPicker({ onSelect, actionLabel = "选择表情" }: {
  onSelect: (emoji: string) => void;
  actionLabel?: string;
}) {
  const [recent, setRecent] = useState(loadRecentEmoji);

  const selectEmoji = (emoji: string) => {
    const nextRecent = [emoji, ...recent.filter((item) => item !== emoji)].slice(0, 10);
    setRecent(nextRecent);
    try {
      window.localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(nextRecent));
    } catch { /* recent emoji history is optional */ }
    onSelect(emoji);
  };

  const renderEmoji = (emoji: string) => (
    <button key={emoji} type="button" className="emoji-option" aria-label={`${actionLabel} ${emoji}`}
      onClick={() => selectEmoji(emoji)}>
      {emoji}
    </button>
  );

  return (
    <div className="emoji-picker" role="dialog" aria-label="Emoji 选择器">
      {recent.length > 0 && (
        <section>
          <p>最近使用</p>
          <div className="emoji-grid recent">{recent.map(renderEmoji)}</div>
        </section>
      )}
      <section>
        <p>所有表情</p>
        <div className="emoji-grid">{EMOJIS.map(renderEmoji)}</div>
      </section>
    </div>
  );
}
