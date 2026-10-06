/**
 * Everything a developer can hand out. Today the only collectible is the shard; gear, mounts and powerups join this
 * list when they exist (see docs/design). `max` caps what `/give` may set.
 */
export interface ItemDef {
  id: string;
  name: string;
  max: number;
}

export const ITEMS: Readonly<Record<string, ItemDef>> = {
  shard: { id: 'shard', name: 'Shard', max: 9999 },
};
