import Link from 'next/link';
import Button from '../styles/button.jsx';

export default function PageTest() {
  return (
    <div>
      <Link href="/">
        <a>Home</a>
      </Link>
      <Button>ONE</Button>
    </div>
  );
}
