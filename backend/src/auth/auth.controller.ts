import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'node:crypto';
import { IsIn, IsString } from 'class-validator';
import { config } from '../config';
import { Role, Roles } from './roles.decorator';

class LoginDto {
  @IsIn(['scanner', 'admin'])
  role: Role;

  @IsString()
  login: string;

  @IsString()
  password: string;
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

@Controller('auth')
export class AuthController {
  constructor(private readonly jwt: JwtService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const account = config.accounts[dto.role];
    const ok = safeEqual(dto.login, account.login) && safeEqual(dto.password, account.password);
    if (!ok) throw new UnauthorizedException('Nieprawidłowy login lub hasło');

    const token = await this.jwt.signAsync({ role: dto.role });
    return { token, role: dto.role };
  }

  @Get('me')
  @Roles('scanner')
  me(@Req() req: { role: Role }) {
    return { role: req.role };
  }
}
