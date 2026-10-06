import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPrincipal } from './auth.types';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    admin: AdminPrincipal | undefined,
    action: string,
    entity: string,
    entityId?: string,
    data?: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        adminId: admin?.id,
        action,
        entity,
        entityId,
        data: data === undefined ? undefined : (data as Prisma.InputJsonValue),
      },
    });
  }
}
