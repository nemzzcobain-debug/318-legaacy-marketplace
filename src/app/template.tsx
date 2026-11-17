// Ré-monté à chaque navigation : fondu d'entrée léger entre les pages
// (opacité seule, voir .page-enter dans globals.css).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
