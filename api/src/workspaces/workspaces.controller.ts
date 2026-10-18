import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityService } from '../activity/activity.service.js';
import { CurrentMembership, CurrentUser, Roles } from '../common/decorators.js';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard.js';
import type { AuthUser } from '../common/types.js';
import type { Membership } from '../generated/prisma/client.js';
import { AddMemberDto, CreateWorkspaceDto, UpdateMemberDto, UpdateWorkspaceDto } from './dto.js';
import { WorkspacesService } from './workspaces.service.js';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly activity: ActivityService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, dto);
  }

  // A partir de aquí todas las rutas llevan :workspaceId y pasan por WorkspaceRoleGuard

  @UseGuards(WorkspaceRoleGuard)
  @Get(':workspaceId')
  get(@CurrentMembership() membership: Membership) {
    return this.workspaces.get(membership);
  }

  @UseGuards(WorkspaceRoleGuard)
  @Roles('ADMIN')
  @Patch(':workspaceId')
  update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(workspaceId, user.id, dto);
  }

  @UseGuards(WorkspaceRoleGuard)
  @Roles('ADMIN')
  @HttpCode(204)
  @Delete(':workspaceId')
  remove(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.workspaces.remove(workspaceId);
  }

  @UseGuards(WorkspaceRoleGuard)
  @Get(':workspaceId/members')
  members(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.workspaces.listMembers(workspaceId);
  }

  @UseGuards(WorkspaceRoleGuard)
  @Roles('ADMIN')
  @Post(':workspaceId/members')
  addMember(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMemberDto,
  ) {
    return this.workspaces.addMember(workspaceId, user.id, dto);
  }

  @UseGuards(WorkspaceRoleGuard)
  @Roles('ADMIN')
  @Patch(':workspaceId/members/:userId')
  updateMember(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.workspaces.updateMemberRole(workspaceId, user.id, userId, dto.role);
  }

  @UseGuards(WorkspaceRoleGuard)
  @HttpCode(204)
  @Delete(':workspaceId/members/:userId')
  removeMember(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentMembership() membership: Membership,
  ) {
    return this.workspaces.removeMember(workspaceId, membership, userId);
  }

  @UseGuards(WorkspaceRoleGuard)
  @Get(':workspaceId/activity')
  activityLog(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.activity.list(workspaceId);
  }
}
