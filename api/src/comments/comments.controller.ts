import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentMembership, WorkspaceFrom } from '../common/decorators.js';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard.js';
import { trim } from '../common/validation.js';
import type { Membership } from '../generated/prisma/client.js';
import { CommentsService } from './comments.service.js';

export class CreateCommentDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5_000)
  body: string;
}

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@WorkspaceFrom('card')
@Controller('cards/:cardId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@Param('cardId', ParseUUIDPipe) cardId: string) {
    return this.comments.list(cardId);
  }

  @Post()
  create(
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @CurrentMembership() membership: Membership,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(cardId, membership, dto.body);
  }
}
