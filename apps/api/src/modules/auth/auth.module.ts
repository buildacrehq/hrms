import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { EmployeeAuthController } from './controllers/employee-auth.controller';
import { TokenController } from './controllers/token.controller';
import { AdminAuthService } from './services/admin-auth.service';
import { EmployeeAuthService } from './services/employee-auth.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AdminAuthController, EmployeeAuthController, TokenController],
  providers: [
    AdminAuthService,
    EmployeeAuthService,
    TokenService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [JwtAuthGuard, RolesGuard, TokenService],
})
export class AuthModule {}
