import type { AppLoadContext, EntryContext } from '@remix-run/cloudflare'; // J'ai ajouté EntryContext pour un meilleur typage
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
// import { themeStore } from '~/lib/stores/theme'; // Supposant que ce n'est pas pertinent pour la question des headers

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext, // Changé 'any' par 'EntryContext' pour un meilleur typage
  _loadContext: AppLoadContext,
) {
  // await initializeModelList({});

  const readable = await renderToReadableStream(<RemixServer context={remixContext} url={request.url} />, {
    signal: request.signal,
    onError(error: unknown) {
      console.error(error);
      responseStatusCode = 500;
    },
  });

  const body = new ReadableStream({
    start(controller) {
      const head = renderHeadToString({ request, remixContext, Head });

      controller.enqueue(
        new Uint8Array(
          new TextEncoder().encode(
            `<!DOCTYPE html><html lang="en"><head>${head}</head><body><div id="root" class="w-full h-full">`,
          ),
        ),
      );

      const reader = readable.getReader();

      function read() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              controller.enqueue(new Uint8Array(new TextEncoder().encode('</div></body></html>')));
              controller.close();
              return;
            }
            controller.enqueue(value);
            read();
          })
          .catch((error) => {
            console.error('Stream read error:', error); // Ajout d'un log plus descriptif
            controller.error(error);
            // readable.cancel() est souvent appelé par le navigateur ou l'environnement si le controller émet une erreur
          });
      }
      read();
    },
    cancel() {
      console.log('Stream cancelled'); // Ajout d'un log
      readable.cancel();
    },
  });

  if (isbot(request.headers.get('user-agent') || '')) {
    await readable.allReady;
  }

  // --- MODIFICATION ICI ---
  const url = new URL(request.url);
  const pathname = url.pathname;

  responseHeaders.set('Content-Type', 'text/html'); // Toujours définir Content-Type

  // N'appliquer les headers COEP et COOP que si la route n'est pas /onboard
  if (pathname !== '/subscription') {
    responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
    responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
  }
  // --- FIN DE LA MODIFICATION ---

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
