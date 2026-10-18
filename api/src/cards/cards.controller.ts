import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiTags } from '@nestjs/swagger';
import { CurrentMembership, WorkspaceFrom } from '../common/decorators.js';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard.js';
import type { Membership } from '../generated/prisma/client.js';
import { CardsService } from './cards.service.js';
import { CreateCardDto, UpdateCardDto } from './dto.js';

@ApiTags('cards')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@Controller()
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @WorkspaceFrom('column')
  @Post('columns/:columnId/cards')
  create(
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @CurrentMembership() membership: Membership,
    @Body() dto: CreateCardDto,
  ) {
    return this.cards.create(columnId, membership, dto);
  }

  @WorkspaceFrom('card')
  @ApiConflictResponse({ description: 'La versión enviada no es la actual; el body incluye `current`' })
  @Patch('cards/:cardId')
  update(
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @CurrentMembership() membership: Membership,
    @Body() dto: UpdateCardDto,
  ) {
    return this.cards.update(cardId, membership, dto);
  }

  @WorkspaceFrom('card')
  @HttpCode(204)
  @Delete('cards/:cardId')
  remove(@Param('cardId', ParseUUIDPipe) cardId: string, @CurrentMembership() membership: Membership) {
    return this.cards.remove(cardId, membership);
  }
}
