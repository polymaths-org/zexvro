import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import BrandIntro from './BrandIntro';
import './styles/welcome.css';

export default function MarketingPage() {
  const [showIntro, setShowIntro] = useState(true);

  return (
    <>
      {showIntro ? <BrandIntro onFinished={() => setShowIntro(false)} /> : null}
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
