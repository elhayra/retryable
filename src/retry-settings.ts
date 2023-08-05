import { RetryableError } from './errors/retryable-error';

export class RetrySettings<CallbackReturnType> {
  public _errors: Set<Constructable | Error> = new Set();
  public _returnedValues: Set<CallbackReturnType | null | undefined> = new Set();
  public _times = 3;
  public _intervalMillis = 1000;
  public _backoffFactor = 1;
  public _jitter = {
    min: 0,
    max: 0,
  };

  public getSettings(): RetrySettingsData {
    return {
      times: this._times,
      intervalMillis: this._intervalMillis,
      backoffFactor: this._backoffFactor,
      jitter: this._jitter,
    };
  }

  public ifItThrows(error: Constructable | Error): RetrySettings<CallbackReturnType> {
    this._errors.add(error);
    return this;
  }

  public ifItReturns(
    returnValues: CallbackReturnType | undefined | null
  ): RetrySettings<CallbackReturnType> {
    this._returnedValues.add(returnValues);
    return this;
  }

  public times(n: number): RetrySettings<CallbackReturnType> {
    this._times = n;
    return this;
  }

  public withIntervalsOf(intervalMillis: number): RetrySettings<CallbackReturnType> {
    this._intervalMillis = intervalMillis;
    return this;
  }

  public withBackoffFactor(factor: number): RetrySettings<CallbackReturnType> {
    this._backoffFactor = factor;
    return this;
  }

  public withJitter(min: number, max: number): RetrySettings<CallbackReturnType> {
    if (min > max) {
      throw new RetryableError('min is expected to be lower than max', { min, max });
    }
    this._jitter.min = min;
    this._jitter.max = max;
    return this;
  }

  public _isErrorQualifyForRetry(err: Constructable | Error): boolean {
    return Array.from(this._errors.values()).some(
      (e) => e.constructor === err.constructor || err instanceof (e as any)
    );
  }

  public _isValueQualifyForRetry(value: CallbackReturnType | null | undefined): boolean {
    return this._returnedValues.has(value);
  }
}

interface Constructable {
  new (...args: any[]): any;
}

export interface RetrySettingsData {
  times: number;
  intervalMillis: number;
  backoffFactor: number;
  jitter: {
    min: number;
    max: number;
  };
}
