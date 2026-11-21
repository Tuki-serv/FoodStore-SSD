import { aplicarFavicon } from '../favicon';

function documentoConEnlace(): Document {
  const doc = document.implementation.createHTMLDocument('t');
  doc.head.innerHTML = '<link id="favicon" rel="icon" type="image/svg+xml" href="data:," />';
  return doc;
}

describe('aplicarFavicon', () => {
  it('pone la URL del asset en el <link id="favicon">', () => {
    const doc = documentoConEnlace();

    aplicarFavicon('/assets/favicon-abc123.svg', doc);

    expect(doc.getElementById('favicon')?.getAttribute('href')).toBe('/assets/favicon-abc123.svg');
  });

  it('con otra URL reemplaza la anterior y no duplica el enlace', () => {
    const doc = documentoConEnlace();

    aplicarFavicon('/a.svg', doc);
    aplicarFavicon('/b.svg', doc);

    expect(doc.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
    expect(doc.getElementById('favicon')?.getAttribute('href')).toBe('/b.svg');
  });

  it('si el documento no tiene el enlace, lo crea', () => {
    const doc = document.implementation.createHTMLDocument('t');

    aplicarFavicon('/c.svg', doc);

    const enlace = doc.querySelector('link[rel="icon"]');
    expect(enlace?.getAttribute('href')).toBe('/c.svg');
    expect(enlace?.id).toBe('favicon');
  });
});
