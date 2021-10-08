/**
 * Simple result type as an alternative to throwing an error.
 */

export type ErrorResult<Error> = { successful: false; exception: Error };
export type OkResult<Value> = { successful: true; value: Value };
export type Result<Value, Error = any> = OkResult<Value> | ErrorResult<Error>;

export function ok<Value>(value: Value): OkResult<Value> {
  return { successful: true, value };
}

export function err<Error>(exception: Error): ErrorResult<Error> {
  return { successful: false, exception };
}
