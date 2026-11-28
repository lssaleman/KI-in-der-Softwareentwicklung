export function MenuButton({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={isOpen} aria-controls="hauptmenue" onClick={onToggle}>
      <svg viewBox="0 0 10 10"><title>Menü</title><path d="M0 0h10" /></svg>
    </button>
  );
}
