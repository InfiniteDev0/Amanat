// The list page gave way to the notes-style page (amanat-notes.tsx).
// import { AmanatPage } from '@/features/amanat/amanat-page';
import { AmanatNotes } from '@/features/amanat/amanat-notes';

/** Amanat, as Milo's Notes: your shops on the left, each customer's amanat as a card. */
export default function Page() {
  // return <AmanatPage />;
  return <AmanatNotes />;
}
