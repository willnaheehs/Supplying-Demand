import seed from '@/data/cluster-catalog.json';
import manifest from '@/data/catalog-manifest.json';
import { getDatabase } from '@/db/client';
import {
  seedCatalog,
  readCatalog,
  addCatalogEntry,
  updateCatalogEntry,
} from '@/db/catalog-store';
import {
  validateManualEntry,
  catalogStats,
  type CatalogEntry,
} from '@/lib/catalog';
import { catalogUser, sameOriginMutation } from '@/lib/catalog-access';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, oai-authenticated-user-id',
    },
  });
function user(request: Request) {
  return catalogUser(request, import.meta.env.DEV);
}

export async function GET(request: Request) {
  const owner = user(request);
  if (!owner)
    return reply({ error: 'Sign in to view your cluster database.' }, 401);
  try {
    const db = getDatabase();
    await seedCatalog(db, seed as CatalogEntry[], manifest.revision);
    const records = await readCatalog(db, owner);
    return reply({ records, stats: catalogStats(records), manifest });
  } catch (error) {
    console.error(
      'Catalog read failed',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    return reply(
      {
        error:
          'The database is temporarily unavailable. Your saved records have not been changed.',
      },
      503,
    );
  }
}

async function write(request: Request, update: boolean) {
  const owner = user(request);
  if (!owner) return reply({ error: 'Sign in to save records.' }, 401);
  if (!sameOriginMutation(request))
    return reply(
      { error: 'Use the same-site catalog form to save a record.' },
      403,
    );
  if (Number(request.headers.get('content-length') || 0) > 40000)
    return reply({ error: 'Record is too large.' }, 413);
  let entry: CatalogEntry;
  try {
    const body = await request.text();
    if (body.length > 40000)
      return reply({ error: 'Record is too large.' }, 413);
    const input: unknown = JSON.parse(body);
    const id =
      update && input && typeof input === 'object' && 'id' in input
        ? input.id
        : `manual-${crypto.randomUUID()}`;
    if (typeof id !== 'string' || !/^manual-[a-zA-Z0-9-]{1,100}$/.test(id))
      throw new Error('Invalid manual record identifier.');
    entry = validateManualEntry(input, id, new Date().toISOString());
  } catch (error) {
    return reply(
      { error: error instanceof Error ? error.message : 'Invalid record.' },
      400,
    );
  }
  try {
    const db = getDatabase();
    if (update) {
      if (!(await updateCatalogEntry(db, entry, owner)))
        return reply({ error: 'Your manual record could not be found.' }, 404);
    } else {
      await addCatalogEntry(db, entry, owner);
    }
    return reply({ record: entry }, update ? 200 : 201);
  } catch (error) {
    console.error(
      'Catalog save failed',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    return reply(
      { error: 'Save failed. Your form is still here; please try again.' },
      503,
    );
  }
}
export async function POST(request: Request) {
  return write(request, false);
}
export async function PATCH(request: Request) {
  return write(request, true);
}
