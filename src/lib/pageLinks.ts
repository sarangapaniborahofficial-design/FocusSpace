import { db } from '../db/db';
import type { PageLink, PageLinkKind } from '../types';
import { uid } from './utils';

export const listLinks = (pageId: string) => db.pageLinks.where('pageId').equals(pageId).toArray();

/** Adds a reference from a page to a task/habit/goal. A no-op if that link already exists. */
export async function addLink(pageId: string, kind: PageLinkKind, targetId: string): Promise<PageLink | null> {
  const existing = await db.pageLinks.where('pageId').equals(pageId).toArray();
  if (existing.some(l => l.kind === kind && l.targetId === targetId)) return null;
  const link: PageLink = { id: uid(), pageId, kind, targetId, createdAt: new Date().toISOString() };
  await db.pageLinks.add(link);
  return link;
}

export const removeLink = (id: string) => db.pageLinks.delete(id);

/** Every page that links to a given task/habit (used so deleting one can also drop dangling links). */
export const linksTo = (kind: PageLinkKind, targetId: string) => db.pageLinks.filter(l => l.kind === kind && l.targetId === targetId).toArray();
