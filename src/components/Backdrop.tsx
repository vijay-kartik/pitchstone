// Static, elegant backdrop: a near-black base with two very soft violet
// glows for quiet depth. No motion, no canvas — gives the frosted surfaces
// something to blur without distracting from the content.
export default function Backdrop() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background:
          'radial-gradient(1000px 720px at 80% -14%, rgba(124,106,247,0.10), transparent 60%),' +
          'radial-gradient(760px 560px at 6% 114%, rgba(124,106,247,0.05), transparent 55%),' +
          '#1a1a1a',
      }}
    />
  )
}
