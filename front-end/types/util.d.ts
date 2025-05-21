declare module 'util/' {
  export function inspect(object: any, options?: any): string;
  export function format(format: string, ...param: any[]): string;
  export function promisify(fn: Function): Function;
  export function inherits(constructor: any, superConstructor: any): void;
  export function deprecate(fn: Function, message: string): Function;
  export function debuglog(section: string): Function;
  export function isArray(obj: any): boolean;
  export function isBoolean(obj: any): boolean;
  export function isBuffer(obj: any): boolean;
  export function isDate(obj: any): boolean;
  export function isError(obj: any): boolean;
  export function isFunction(obj: any): boolean;
  export function isNull(obj: any): boolean;
  export function isNullOrUndefined(obj: any): boolean;
  export function isNumber(obj: any): boolean;
  export function isObject(obj: any): boolean;
  export function isPrimitive(obj: any): boolean;
  export function isRegExp(obj: any): boolean;
  export function isString(obj: any): boolean;
  export function isSymbol(obj: any): boolean;
  export function isUndefined(obj: any): boolean;
  export function callbackify(fn: Function): Function;
  export const TextEncoder: any;
  export const TextDecoder: any;
  export default {
    inspect,
    format,
    promisify,
    inherits,
    deprecate,
    debuglog,
    isArray,
    isBoolean,
    isBuffer,
    isDate,
    isError,
    isFunction,
    isNull,
    isNullOrUndefined,
    isNumber,
    isObject,
    isPrimitive,
    isRegExp,
    isString,
    isSymbol,
    isUndefined,
    callbackify,
    TextEncoder,
    TextDecoder
  };
}
