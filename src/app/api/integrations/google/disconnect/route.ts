import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth';
import { deleteGoogleConnection } from '@/lib/google';

export async function POST() {
  const context = await getWorkspaceContext();
  if (!context?.user || !context.workspace || !['owner','admin'].includes(context.role ?? '')) return NextResponse.json({ error: 'Workspace owner or admin access is required.' }, { status: 403 });
  try { await deleteGoogleConnection(context.workspace.id); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: 'Could not disconnect Google.' }, { status: 500 }); }
}
