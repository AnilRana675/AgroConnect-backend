import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

type BufferEncoding =
  | 'ascii'
  | 'utf8'
  | 'utf-8'
  | 'utf16le'
  | 'ucs2'
  | 'ucs-2'
  | 'base64'
  | 'base64url'
  | 'latin1'
  | 'binary'
  | 'hex';

const httpLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  logger.http(`${req.method} ${req.originalUrl} - ${req.ip}`);
  const originalEnd = res.end;
  function endOverride(
    this: Response,
    chunk?: unknown,
    encoding?: BufferEncoding,
    cb?: () => void,
  ): Response {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    // Call original end method and return the result
    // @ts-expect-error: Overload signatures are compatible with Express
    return originalEnd.apply(this, [chunk, encoding, cb]);
  }
  res.end = endOverride as typeof res.end;
  next();
};

export default httpLogger;
