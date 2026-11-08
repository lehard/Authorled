/** A part of the app (a lazily loaded screen) that did not load (openspec/specs/web/app). */
export class ChunkLoadError extends Error {
  constructor(screen: string, cause: unknown) {
    super(`Часть «${screen}» не загрузилась`, { cause });
    this.name = "ChunkLoadError";
  }
}
