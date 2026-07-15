import ServiceChapter from './ServiceChapter';

export default function ChapterNFT() {
  return (
    <ServiceChapter
      id="nft"
      index="05"
      service="NFT Service"
      headline="Digital asset workflows should read like product flows."
      body="The NFT service is part of the MVP map, but the implementation shape is early. The marketing story stays at the product layer: define assets, issue them cleanly, and operate them through platform controls when the backend direction is ready."
      status="Draft"
      statusDetail="Service direction early; implementation details intentionally unnamed"
      accent="#FAFAFA"
      animation="nft"
      illustration={() => import('../illustrations/generated/Nft')}
    />
  );
}
