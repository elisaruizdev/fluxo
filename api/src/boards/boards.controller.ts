import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentMembership, CurrentUser, Roles, WorkspaceFrom } from '../common/decorators.js';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard.js';
import type { AuthUser } from '../common/types.js';
import type { Membership } from '../generated/prisma/client.js';
import { BoardsService } from './boards.service.js';
import { CreateBoardDto, CreateColumnDto, UpdateBoardDto, UpdateColumnDto } from './dto.js';

@ApiTags('boards')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@Controller()
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Get('workspaces/:workspaceId/boards')
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.boards.list(workspaceId);
  }

  @Post('workspaces/:workspaceId/boards')
  create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBoardDto,
  ) {
    return this.boards.create(workspaceId, user.id, dto);
  }

  @WorkspaceFrom('board')
  @Get('boards/:boardId')
  snapshot(@Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.boards.snapshot(boardId);
  }

  @WorkspaceFrom('board')
  @Patch('boards/:boardId')
  update(@Param('boardId', ParseUUIDPipe) boardId: string, @Body() dto: UpdateBoardDto) {
    return this.boards.update(boardId, dto);
  }

  @WorkspaceFrom('board')
  @Roles('ADMIN')
  @HttpCode(204)
  @Delete('boards/:boardId')
  remove(@Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.boards.remove(boardId);
  }

  @WorkspaceFrom('board')
  @Post('boards/:boardId/columns')
  createColumn(
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @CurrentMembership() membership: Membership,
    @Body() dto: CreateColumnDto,
  ) {
    return this.boards.createColumn(boardId, membership.workspaceId, membership.userId, dto);
  }

  @WorkspaceFrom('column')
  @Patch('columns/:columnId')
  updateColumn(@Param('columnId', ParseUUIDPipe) columnId: string, @Body() dto: UpdateColumnDto) {
    return this.boards.updateColumn(columnId, dto);
  }

  // Borrar una lista borra sus tarjetas: solo ADMIN
  @WorkspaceFrom('column')
  @Roles('ADMIN')
  @HttpCode(204)
  @Delete('columns/:columnId')
  removeColumn(@Param('columnId', ParseUUIDPipe) columnId: string) {
    return this.boards.removeColumn(columnId);
  }
}
