export class RetrySettings<CallbackReturnType> {
  public _errors: Set<Constructable | Error> = new Set();
  public _returnedValues: Set<CallbackReturnType | null | undefined> = new Set();
  public _times = 3;
  public _intervalMillis = 1000;
  public _backoffFactor = 1;

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
