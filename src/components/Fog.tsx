export function Fog({ intensity = 1 }: { intensity?: number }) {
  return (
    <div className="fog" style={{ opacity: intensity }} aria-hidden>
      <div className="fog__blob fog__blob--a" />
      <div className="fog__blob fog__blob--b" />
      <div className="fog__blob fog__blob--c" />
      <div className="fog__grain" />
    </div>
  );
}
