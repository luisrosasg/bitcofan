const AVATARS = [
  // Crypto
  '₿', '🪙', '💎', '🚀', '🌙', '⚡', '🔥', '💰',
  // Animals
  '🦁', '🐯', '🦊', '🐺', '🦅', '🐉', '🦄', '🐸',
  // Tech / fun
  '🤖', '👾', '🎮', '🎯', '🏆', '💀', '👑', '🎩',
  // People
  '🧙', '🥷', '🧑‍💻', '🦸', '🕵️', '🧛', '🐱‍👤', '🤠',
]

export default function AvatarPicker({ current, onSelect }) {
  return (
    <div className="avatar-picker">
      {AVATARS.map(a => (
        <button
          key={a}
          type="button"
          className={`avatar-option ${a === current ? 'avatar-selected' : ''}`}
          onClick={() => onSelect(a)}
        >
          {a}
        </button>
      ))}
    </div>
  )
}
