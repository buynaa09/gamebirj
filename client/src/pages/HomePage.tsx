import { Hero } from '../components/home/Hero';
import { Seo } from '../components/seo/Seo';

export function HomePage() {
  return (
    <main>
      <Seo
        title="GameBirj — Тоглоомын аккаунт худалдаа, түрээс | Gaming Account Marketplace"
        description="GameBirj — тоглоомын аккаунт худалдах, худалдан авах, түрээслэх найдвартай marketplace. Escrow хамгаалалттайгаар Mobile Legends, PUBG болон бусад тоглоомын аккаунтыг аюулгүй арилжаал."
        path="/"
      />
      <Hero />
    </main>
  );
}
