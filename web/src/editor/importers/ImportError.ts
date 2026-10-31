/** A file that cannot be read as a screenplay; the open document stays as it was. */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}
