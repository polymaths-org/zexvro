import ServiceChapter from './ServiceChapter';

export default function ChapterDePin() {
  return (
    <ServiceChapter
      id="depin"
      index="06"
      service="De-Pin"
      headline="Coming into focus."
      body="De-Pin is listed in the ZEXVRO service map, but the scope is not defined yet. This chapter deliberately stays quiet: no invented providers, no fake network claims, just a reserved place in the platform architecture."
      status="Draft"
      statusDetail="Coming soon; scope undefined"
      accent="#A1A1AA"
      animation="depin"
      illustration={() => import('../illustrations/generated/Depin')}
    />
  );
}
