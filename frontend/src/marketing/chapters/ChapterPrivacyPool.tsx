import ServiceChapter from './ServiceChapter';

export default function ChapterPrivacyPool() {
  return (
    <ServiceChapter
      id="privacy"
      index="01"
      service="Zero-Knowledge Privacy Pool"
      headline="Prove it happened. Do not reveal how."
      body="The privacy pool is the place for business activity that needs verification without unnecessary exposure. The exact proving system and privacy model are still architecture decisions, so the site frames the intent honestly instead of naming a chain or circuit prematurely."
      status="Draft"
      statusDetail="Architecture in progress; proving system not selected"
      accent="#7C3AED"
      animation="privacy"
      illustration={() => import('../illustrations/generated/PrivacyPool')}
    />
  );
}
