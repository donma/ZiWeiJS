export type ZiWeiErrorCode =
  | 'INVALID_DATE'
  | 'INVALID_LUNAR_DATE'
  | 'INVALID_LEAP_MONTH'
  | 'INVALID_TIMEZONE'
  | 'MISSING_LOCATION_FOR_SOLAR_TIME'
  | 'UNKNOWN_BIRTH_TIME'
  | 'UNKNOWN_SEX_FOR_CALCULATION'
  | 'UNSUPPORTED_PROFILE'
  | 'RULE_NOT_FOUND'
  | 'SOURCE_NOT_FOUND'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'EXECUTOR_NOT_FOUND'
  | 'CALENDAR_CONVERSION_FAILED'
  | 'INVALID_INPUT';

export class ZiWeiError extends Error {
  readonly code: ZiWeiErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ZiWeiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ZiWeiError';
    this.code = code;
    this.details = details;
  }
}

export function invalidInput(message: string, details?: Record<string, unknown>): ZiWeiError {
  return new ZiWeiError('INVALID_INPUT', message, details);
}
