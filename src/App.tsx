import { useEffect } from 'react'
import { useStore } from './store.ts'
import { Bookshelf } from './components/Bookshelf.tsx'
import { Reader } from './components/Reader.tsx'

const THEME_COLOR = { cream: '#F9F6EE', parchment: '#F4EFEA', sage: '#EAEFE9', midnight: '#181615' }

export function App() {
  const ready = useStore((s) => s.ready)
  const open = useStore((s) => !!s.book)
  const theme = useStore((s) => s.prefs.theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  }, [theme])

  if (!ready) return <p className="grid min-h-dvh place-items-center font-serif text-xl italic text-soft">Opening the library…</p>
  return open ? <Reader /> : <Bookshelf />
}
