import { Link } from 'react-router-dom';
import { Seo } from '../components/seo/Seo';

export function NotFoundPage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '4rem 1rem',
        textAlign: 'center',
      }}
    >
      <Seo
        title="Хуудас олдсонгүй (404) | GameBirj"
        description="Хайсан хуудас олдсонгүй. GameBirj нүүр хуудас, зарын хэсэг эсвэл түрээсээс үргэлжлүүлнэ үү."
        path="/404"
        noindex
      />
      <p style={{ fontSize: '3rem', margin: 0 }} aria-hidden="true">
        🎮
      </p>
      <h1 style={{ margin: 0 }}>Хуудас олдсонгүй</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>
        Хаяг буруу эсвэл хуудас устгагдсан байж магадгүй.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link className="btn btn-primary" to="/">
          Нүүр хуудас
        </Link>
        <Link className="btn btn-outline" to="/marketplace">
          Зарын хэсэг
        </Link>
        <Link className="btn btn-outline" to="/rent">
          Түрээс
        </Link>
      </div>
    </main>
  );
}
