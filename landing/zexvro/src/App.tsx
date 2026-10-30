import { useState } from 'react';
import { ScrollProvider } from './components/ScrollProvider';
import { HashScroll } from './components/HashScroll';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Web3Grid } from './components/Web3Grid';
import { Team } from './components/Team';
import { Waitlist } from './components/Waitlist';
import { WaitlistAdmin } from './components/WaitlistAdmin';
import { Footer } from './components/Footer';
import { Preloader } from './components/Preloader';

function hasWaitlistSecret(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('secret') || params.get('key') || params.get('')) return true;
  const raw = window.location.search.replace(/^\?/, '');
  if (!raw) return false;
  if (raw.startsWith('=')) return raw.slice(1).split('&')[0].trim().length > 0;
  if (!raw.includes('=')) return raw.split('&')[0].trim().length > 0;
  return false;
}

// zexvro.in 308s /waitlist → /, so also open admin when secret is on any path.
const isWaitlistAdmin =
  typeof window !== 'undefined' &&
  (window.location.pathname.replace(/\/$/, '') === '/waitlist' || hasWaitlistSecret());

export default function App() {
  const [loaded, setLoaded] = useState(false);

  if (isWaitlistAdmin) {
    return <WaitlistAdmin />;
  }

  return (
    <>
      {!loaded && <Preloader onDone={() => setLoaded(true)} />}
      <ScrollProvider>
        <HashScroll ready={loaded} />
        <div className="relative min-h-screen bg-black text-white selection:bg-blue-500/30 selection:text-white">
          <div className="grain-overlay" />
          <div className="vignette" />

          <Navbar />

          <Hero />
          <Web3Grid />
          <Team />
          <Waitlist />
          <Footer />
        </div>
      </ScrollProvider>
    </>
  );
}
