import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('💥 [Server Error]:', err);

  const status = err.status || 500;
  const message = err.message || 'Došlo je do neočekivane serverske greške.';

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
