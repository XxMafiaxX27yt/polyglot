// Tiny hash router for pages that open on top of the app (legal documents,
// help). Hash links work from anywhere — footer, settings, inside a meeting —
// without unmounting what is underneath, so a call keeps running.
//
//   #/legal            index of documents
//   #/legal/<id>       one document
//   #/help[/<topic>]   Help & Privacy Support

import { useEffect, useState } from 'react';

function parse() {
  if (window.location.hash === '#results' || window.location.pathname === '/results') return { page: 'results' };
  const [, page, arg] = window.location.hash.split('/');
  return page === 'legal' || page === 'help' || page === 'results' ? { page, arg: arg || null } : null;
}

export function useOverlayRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

/** Back to the app underneath. */
export function closeOverlay() {
  window.history.pushState(null, '', (window.location.pathname === '/results' ? '/' : window.location.pathname) + window.location.search);
  window.dispatchEvent(new Event('hashchange'));
}

