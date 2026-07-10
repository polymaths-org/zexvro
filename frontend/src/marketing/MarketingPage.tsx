import { ArrowRight } from 'lucide-react';
import './styles/welcome.css';

export default function MarketingPage() {
  return (
    <main className="welcome-page">
      <div className="welcome-background" aria-hidden="true">
        <img src="/backgrounds/cube2-template.webp" alt="" />
      </div>

      <section className="welcome-panel" aria-labelledby="welcome-title">
        <img className="welcome-logo" src="/brand/logo-transparent.png" alt="" />
        <span className="welcome-kicker">Unified Web3 Platform</span>
        <h1 id="welcome-title">Welcome to ZEXVRO</h1>
        <p>Private, verifiable, agent-ready infrastructure.</p>
        <a className="welcome-action" href="/dashboard">
          Step into Web3
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </section>
    </main>
  );
}
