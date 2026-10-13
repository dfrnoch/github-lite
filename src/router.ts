import { pageRoutes } from 'virtual:file-routes';
import { createRouter, intentPreload } from '@solidjs/router';
import { fileRoutes } from '@solidjs/router/fs';

// Routes mirror github.com's URL layout under src/routes (see IMPLEMENTATION.md),
// so swapping the host of any GitHub URL lands on the same page here.
export const Router = createRouter({ routes: fileRoutes(pageRoutes), preloadLinks: intentPreload() });

export const { paths } = Router;
