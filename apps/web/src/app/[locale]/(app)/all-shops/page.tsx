import { GoToShop } from '@/features/workspaces/go-to-shop';

// Owners with two or more shops will get one read-only row per shop plus
// combined totals here. Until it's designed it shows nothing: someone with no
// shop sets one up on top of it, then goes straight to that shop.
export default function AllShopsPage() {
  return <GoToShop />;
}
