import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: (dto.role as any) ?? 'USER',
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return {
      user,
      accessToken: await this.signToken(user.id, user.role),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken: await this.signToken(user.id, user.role),
    };
  }

  private async signToken(userId: string, role: string) {
    return this.jwt.signAsync(
      { sub: userId, role },
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any },
    );
  }
}
