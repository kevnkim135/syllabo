import { useEffect, useState } from 'react';
import { wikiImage, type WikiImage } from '../../../core/wikiImage';

/** A picture beside the note, when Wikipedia has a good one. Renders nothing otherwise. */
export function NoteFigure({ query, alt }: { query: string; alt: string }) {
  const [img, setImg] = useState<WikiImage | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    setImg(null);
    setLoaded(false);
    wikiImage(query).then((v) => live && setImg(v));
    return () => {
      live = false;
    };
  }, [query]);
  if (!img) return null;
  return (
    <figure className={`note-figure${loaded ? ' in' : ''}`}>
      <img src={img.src} alt={alt} width={img.width} height={img.height} loading="lazy" onLoad={() => setLoaded(true)} />
      <figcaption>
        <a href={img.url} target="_blank" rel="noreferrer">
          {img.article}
        </a>{' '}
        · Wikipedia
      </figcaption>
    </figure>
  );
}
