import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.usersService.findById(request.user.id);
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException('Super-admin access required');
    }
    return true;
  }
}
