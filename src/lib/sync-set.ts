export interface SyncSetOptions<TExisting, TIncoming> {
  existing: TExisting[];
  incoming: TIncoming[];
  match: (existing: TExisting, incoming: TIncoming) => boolean;
  softDelete: (existing: TExisting) => Promise<void>;
  create: (incoming: TIncoming) => Promise<void>;
}

export async function syncSetWithSoftDelete<TExisting, TIncoming>(
  opts: SyncSetOptions<TExisting, TIncoming>,
): Promise<void> {
  const { existing, incoming, match, softDelete, create } = opts;

  const toDelete = existing.filter((e) => !incoming.some((i) => match(e, i)));
  const toCreate = incoming.filter((i) => !existing.some((e) => match(e, i)));

  await Promise.all(toDelete.map(softDelete));
  await Promise.all(toCreate.map(create));
}
