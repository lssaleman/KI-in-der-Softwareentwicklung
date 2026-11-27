import Link from "next/link";
import Image from "next/image";
export function Logo() {
  return (
    <Link href="/">
      <Image src="/logo.svg" alt="TSV Musterstadt – zur Startseite" width={48} height={48} />
    </Link>
  );
}
