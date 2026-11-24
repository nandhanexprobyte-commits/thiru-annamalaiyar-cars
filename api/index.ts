import { createApp } from '../server.ts';

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: any, res: any) {
  try {
    appPromise ??= createApp();

    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('Vercel API Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
    });
  }
}