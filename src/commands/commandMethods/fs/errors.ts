export class FileOperationError extends Error {
    constructor(
      message: string,
      public readonly code?: string,
      public readonly path?: string
    ) {
      super(message);
      this.name = 'FileOperationError';
    }
  }
  