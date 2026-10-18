import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { Prisma } from '../../generated/prisma/client.js';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  /** Datos adicionales, p. ej. `current` en un 409 de concurrencia */
  [extra: string]: unknown;
}

interface Resolved {
  status: number;
  message: string | string[];
  extra?: Record<string, unknown>;
}

/** Formato de error único para toda la API, y nunca un stack trace hacia fuera */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const { status, message, extra } = this.resolve(exception);
    if (status >= 500) this.logger.error(exception);

    const body: ErrorBody = {
      ...extra,
      statusCode: status,
      error: STATUS_CODES[status] ?? 'Error',
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    };
    res.status(status).json(body);
  }

  private resolve(exception: unknown): Resolved {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') return { status: exception.getStatus(), message: response };

      // new ConflictException({ message, current }) → `current` llega al cliente
      const { message, statusCode: _s, error: _e, ...extra } = response as Record<string, unknown>;
      return {
        status: exception.getStatus(),
        message: (message as string | string[] | undefined) ?? exception.message,
        extra,
      };
    }

    // Errores de Prisma que son culpa del cliente, no del servidor
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return { status: HttpStatus.CONFLICT, message: 'El recurso ya existe' };
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, message: 'Recurso no encontrado' };
        case 'P2003':
          return { status: HttpStatus.BAD_REQUEST, message: 'Referencia a un recurso inexistente' };
      }
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error interno del servidor' };
  }
}
