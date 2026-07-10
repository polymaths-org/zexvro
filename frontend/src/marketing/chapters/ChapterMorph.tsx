import ServiceChapter from './ServiceChapter';

export default function ChapterMorph() {
  return (
    <ServiceChapter
      id="morph"
      index="02"
      service="Morph"
      headline="Point it at your repo. Watch it explain the path."
      body="Morph is the Transformation Agent: a CLI-backed service that inspects codebases, stores useful workspace memory, and turns migration work into readable next steps. It is the most implemented ZEXVRO service today, with API model wiring still left as a follow-up."
      status="Accepted"
      statusDetail="CLI implemented and packaged; model integration pending"
      accent="#3B82F6"
      animation="morph"
      illustration={() => import('../illustrations/generated/Morph')}
    />
  );
}
