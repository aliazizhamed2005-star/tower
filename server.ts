import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';

interface EnquiryRecord {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string;
  preferredLevel: string;
  unitInterest: string;
  message: string;
  createdAt: string;
}

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ROOT_DIR = process.cwd();
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const ENQUIRIES_FILE = path.resolve(DATA_DIR, 'enquiries.json');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const INDEX_HTML_DEV = path.resolve(ROOT_DIR, 'index.html');
const INDEX_HTML_PROD = path.resolve(DIST_DIR, 'index.html');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let writeChain: Promise<void> = Promise.resolve();

function sanitizeField(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

async function appendEnquiryRecord(record: EnquiryRecord): Promise<void> {
  const runWrite = async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    let existing: EnquiryRecord[] = [];
    try {
      const raw = await fs.readFile(ENQUIRIES_FILE, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        existing = parsed as EnquiryRecord[];
      }
    } catch {
      existing = [];
    }
    existing.push(record);
    await fs.writeFile(ENQUIRIES_FILE, JSON.stringify(existing, null, 2), 'utf8');
  };

  writeChain = writeChain.then(runWrite, runWrite);
  await writeChain;
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/enquiries', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ ok: false, error: 'Invalid request payload.' });
      return;
    }

    const name = sanitizeField(body.name, 120);
    const email = sanitizeField(body.email, 160);
    const phone = sanitizeField(body.phone, 40);
    const preferredLevel = sanitizeField(body.preferredLevel, 120) || 'LEVEL 26';
    const unitInterest = sanitizeField(body.unitInterest, 140);
    const message = sanitizeField(body.message, 2000);

    if (!name) {
      res.status(400).json({ ok: false, error: 'Full name is required.' });
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      res.status(400).json({ ok: false, error: 'A valid email address is required.' });
      return;
    }

    const id = crypto.randomUUID();
    const reference = `TWR-${id.slice(0, 8).toUpperCase()}`;
    const createdAt = new Date().toISOString();

    const record: EnquiryRecord = {
      id,
      reference,
      name,
      email,
      phone,
      preferredLevel,
      unitInterest,
      message,
      createdAt,
    };

    try {
      await appendEnquiryRecord(record);
      res.status(201).json({ ok: true, reference, createdAt });
    } catch (err) {
      console.error('Failed to persist enquiry record:', err);
      res.status(500).json({ ok: false, error: 'Unable to record viewing request right now.' });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    app.use(async (req: Request, res: Response, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      try {
        const template = await fs.readFile(INDEX_HTML_DEV, 'utf8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        res.status(500).end('Internal Server Error');
      }
    });
  } else {
    app.use(express.static(DIST_DIR, { index: false }));
    app.use((req: Request, res: Response, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(INDEX_HTML_PROD);
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
