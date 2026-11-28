import Link from "next/link";
import Image from "next/image";
export function Broken({ onOpen }: { onOpen: () => void }) {
  return (
    <div>
      <img src="/team.jpg" />
      <Image src="/a.png" alt="Bild" width={10} height={10} />
      <input type="email" placeholder="E-Mail" />
      <button type="button"><svg viewBox="0 0 1 1"><path d="M0 0" /></svg></button>
      <a href="/kontakt"></a>
      <Link href="/"><Image src="/logo.svg" alt="" width={10} height={10} /></Link>
      <iframe src="https://example.org" />
      <video autoPlay muted src="/clip.mp4" />
      <div onClick={onOpen}>Öffnen</div>
      <span tabIndex={3}>x</span>
      <p role="buton">x</p>
      <button aria-hidden="true">x</button>
      <table><tbody><tr><td>1</td></tr></tbody></table>
    </div>
  );
}
