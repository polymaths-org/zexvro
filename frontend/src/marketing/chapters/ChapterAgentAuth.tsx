import ServiceChapter from './ServiceChapter';

export default function ChapterAgentAuth() {
  return (
    <ServiceChapter
      id="agent-auth"
      index="04"
      service="Agent Authentication"
      headline="Know when the user is human, agent, or delegated."
      body="ZEXVRO Gate is a dual-channel capability boundary for humans and agents. Policy decides access; channels are non-transferable. Implementation is early — no perfect detection claims."
      status="Draft"
      statusDetail="Signals and privacy model not finalized"
      accent="#22C55E"
      animation="auth"
      illustration={() => import('../illustrations/generated/AgentAuth')}
    />
  );
}
