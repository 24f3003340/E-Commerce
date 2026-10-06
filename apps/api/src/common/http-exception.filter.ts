import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/** Normalises errors into { statusCode, message, code? } and hides internals in responses. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload =
        typeof body === 'string' ? { statusCode: status, message: body } : { statusCode: status, ...body };
      res.status(status).json(payload);
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        res.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: 'Record already exists' });
        return;
      }
      if (exception.code === 'P2025') {
        res.status(HttpStatus.NOT_FOUND).json({ statusCode: 404, message: 'Record not found' });
        return;
      }
      if (exception.code === 'P2003') {
        res
          .status(HttpStatus.CONFLICT)
          .json({ statusCode: 409, message: 'Record is referenced by other data' });
        return;
      }
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ statusCode: 500, message: 'Internal server error' });
  }
}
