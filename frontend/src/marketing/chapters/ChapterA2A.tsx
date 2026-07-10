import ServiceChapter from './ServiceChapter';

export default function ChapterA2A() {
  return (
    <ServiceChapter
      id="a2a"
      index="03"
      service="A-2-A Trade Pipeline"
      headline="Agents need a negotiation rail, not a blank check."
      body="The A-2-A pipeline is planned as a controlled channel where agents can discover offers, counter, and track settlement state. Wallet authority and spending rules are not invented here; those boundaries need recorded product decisions before implementation claims."
      status="Draft"
      statusDetail="Protocol and wallet policy boundaries pending"
      accent="#FAFAFA"
      animation="a2a"
      illustration={() => import('../illustrations/generated/A2A')}
    />
  );
}
