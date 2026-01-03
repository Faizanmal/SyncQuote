import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        companyName: true,
        companyLogo: true,
        role: true,
        emailVerified: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        stripeConnectEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(
    userId: string,
    data: { name?: string; companyName?: string; companyLogo?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        companyName: true,
        companyLogo: true,
        subscriptionStatus: true,
      },
    });
  }

  sanitizeUser(user: any) {
    const { password, refreshToken, passwordResetToken, passwordResetExpires, ...sanitized } = user;
    return sanitized;
  }
}
