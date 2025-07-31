import { Response } from 'express';

// Standard success response interface
interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
  requestId?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Standard error response interface
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    timestamp: string;
    requestId?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Send standardized success response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  pagination?: SuccessResponse['pagination'],
): Response => {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId: (res.req as unknown as { requestId?: string }).requestId,
    ...(message && { message }),
    ...(pagination && { pagination }),
  };

  return res.status(statusCode).json(response);
};

/**
 * Send standardized error response
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: Record<string, unknown>,
): Response => {
  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId: (res.req as unknown as { requestId?: string }).requestId,
      ...(code && { code }),
      ...(details && { details }),
    },
  };

  return res.status(statusCode).json(response);
};

/**
 * Send paginated success response
 */
export const sendPaginatedSuccess = <T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  message?: string,
): Response => {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return sendSuccess(res, data, message, 200, {
    ...pagination,
    totalPages,
  });
};

/**
 * Send created resource response
 */
export const sendCreated = <T>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully',
): Response => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Send no content response
 */
export const sendNoContent = (res: Response): Response => {
  return res.status(204).send();
};

/**
 * Send validation error response
 */
export const sendValidationError = (
  res: Response,
  message: string = 'Validation failed',
  details?: Record<string, unknown>,
): Response => {
  return sendError(res, message, 400, 'VALIDATION_ERROR', details);
};

/**
 * Send authentication error response
 */
export const sendAuthError = (
  res: Response,
  message: string = 'Authentication required',
): Response => {
  return sendError(res, message, 401, 'AUTHENTICATION_ERROR');
};

/**
 * Send authorization error response
 */
export const sendAuthorizationError = (
  res: Response,
  message: string = 'Insufficient permissions',
): Response => {
  return sendError(res, message, 403, 'AUTHORIZATION_ERROR');
};

/**
 * Send not found error response
 */
export const sendNotFound = (res: Response, message: string = 'Resource not found'): Response => {
  return sendError(res, message, 404, 'NOT_FOUND');
};

/**
 * Send rate limit error response
 */
export const sendRateLimitError = (
  res: Response,
  message: string = 'Rate limit exceeded',
): Response => {
  return sendError(res, message, 429, 'RATE_LIMIT_ERROR');
};

/**
 * Send internal server error response
 */
export const sendInternalError = (
  res: Response,
  message: string = 'Internal server error',
): Response => {
  return sendError(res, message, 500, 'INTERNAL_SERVER_ERROR');
};

export default {
  sendSuccess,
  sendError,
  sendPaginatedSuccess,
  sendCreated,
  sendNoContent,
  sendValidationError,
  sendAuthError,
  sendAuthorizationError,
  sendNotFound,
  sendRateLimitError,
  sendInternalError,
};
