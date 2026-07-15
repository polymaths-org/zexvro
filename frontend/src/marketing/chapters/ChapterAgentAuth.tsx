import ServiceChapter from './ServiceChapter';

export default function ChapterAgentAuth() {
  return (
    <ServiceChapter
      id="agent-auth"
      index="04"
      service="Agent Authentication"
      headline="Know when the user is human, agent, or delegated."
      body="Agent Authentication is the access boundary for a web that includes autonomous users. The goal is classification and control, with privacy model and signal design still open rather than overstated."
      status="Draft"
      statusDetail="Signals and privacy model not finalized"
      accent="#22C55E"
      animation="auth"
      illustration={() => import('../illustrations/generated/AgentAuth')}
    />
  );
}
