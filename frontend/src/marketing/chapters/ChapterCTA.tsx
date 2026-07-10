import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ChapterCTA() {
  return (
    <section className="marketing-cta" id="cta" aria-labelledby="cta-title">
      <div className="cta-shell">
        <div className="cta-emblem" aria-hidden="true">
          <img src="/brand/logo-transparent.png" alt="" />
          <span>Z / 01</span>
        </div>
        <div className="cta-copy">
          <p className="footer-kicker">09 / The front door</p>
          <h2 className="cta-title" id="cta-title">
            Build what you can verify.
          </h2>
          <p>
            Explore the working interface and follow the source as ZEXVRO moves from
            product foundation to connected infrastructure.
          </p>
          <div className="footer-links">
            <motion.a
              className="marketing-button primary"
              href="/dashboard"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              Open dashboard
              <ArrowUpRight size={15} aria-hidden="true" />
            </motion.a>
            <motion.a
              className="marketing-button"
              href="https://github.com/polymaths-org/zexvro"
              target="_blank"
              rel="noreferrer"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              View source
            </motion.a>
          </div>
        </div>
      </div>
    </section>
  );
}
