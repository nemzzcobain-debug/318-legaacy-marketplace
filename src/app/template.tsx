// Ré-monté à chaque navigation : fondu d'entrée léger entre les pages.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
