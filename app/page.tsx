import { manifest } from "@/lib/gallery";
import { SITE } from "@/lib/site";
import Gallery from "@/components/Gallery";

export default function Home() {
  const { photos, albums } = manifest;

  return (
    <main>
      <header className="title-block">
        <p className="kicker">{SITE.kicker}</p>
        <h1 className="title">{SITE.title}</h1>
      </header>

      <Gallery photos={photos} albums={albums} />
    </main>
  );
}
