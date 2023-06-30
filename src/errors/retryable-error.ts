import VError from 'verror';

export type ObjectType = Record<string, any>;

export class RetryableError extends VError {
  constructor(message: string, public data?: ObjectType) {
    super({ info: { ...data } }, message);
  }
}
