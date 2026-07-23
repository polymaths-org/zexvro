import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import BrandIntro from './BrandIntro';
import './styles/welcome.css';

const INTRO_SEEN_KEY = 'zexvro.marketing.intro.seen';

function shouldShowMarketingIntro(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  // Device-code / CLI activate links — never play intro
  if (params.has('code') || params.has('activate')) return false;
  // Returning visitors: skip full-screen video
  try {
    if (sessionStorage.getItem(INTRO_SEEN_KEY) === '1') return false;
    if (localStorage.getItem(INTRO_SEEN_KEY) === '1') return false;
  } catch {
    /* ignore */
  }
  return true;
}

export default function MarketingPage() {
  const [showIntro, setShowIntro] = useState(shouldShowMarketingIntro);

  const finishIntro = () => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1');
      localStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    setShowIntro(false);
  };

  return (
    <>
      {showIntro ? <BrandIntro onFinished={finishIntro} /> : null}
      <main className="welcome-page">
        <div className="welcome-background" aria-hidden="true">
          <img src="/backgrounds/cube2-template.webp" alt="" />
        </div>

        <section className="welcome-panel" aria-labelledby="welcome-title">
          <img className="welcome-logo" src="/brand/logo-transparent.png" alt="" />
          <span className="welcome-kicker">Web2 to Web3 Service Platform</span>
          <h1 id="welcome-title">ZEXVRO</h1>
          <p>Private, verifiable services for teams moving real products onto Web3 rails.</p>
          <a className="welcome-action" href="/dashboard">
            Open Service Console
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </section>
      </main>
    </>
  );
}
