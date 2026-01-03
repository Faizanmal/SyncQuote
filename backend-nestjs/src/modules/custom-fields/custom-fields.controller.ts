import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service';
import {
  CreateFieldDefinitionDto,
  UpdateFieldDefinitionDto,
  CreateFieldGroupDto,
  UpdateFieldGroupDto,
  SetFieldValueDto,
  SetFieldValuesDto,
  CreateDynamicFormDto,
  FieldScope,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('custom-fields')
@UseGuards(JwtAuthGuard)
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  // ==================== FIELD DEFINITIONS ====================

  @Post('definitions')
  async createFieldDefinition(@Request() req: any, @Body() dto: CreateFieldDefinitionDto) {
    return this.customFieldsService.createFieldDefinition(req.user.teamId, dto);
  }

  @Put('definitions/:id')
  async updateFieldDefinition(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateFieldDefinitionDto,
  ) {
    return this.customFieldsService.updateFieldDefinition(req.user.teamId, id, dto);
  }

  @Delete('definitions/:id')
  async deleteFieldDefinition(@Request() req: any, @Param('id') id: string) {
    return this.customFieldsService.deleteFieldDefinition(req.user.teamId, id);
  }

  @Get('definitions')
  async getFieldDefinitions(@Request() req: any, @Query('scope') scope?: FieldScope) {
    return this.customFieldsService.getFieldDefinitions(req.user.teamId, scope);
  }

  @Put('definitions/reorder')
  async reorderFields(
    @Request() req: any,
    @Body() body: { orders: Array<{ id: string; order: number }> },
  ) {
    return this.customFieldsService.reorderFields(req.user.teamId, body.orders);
  }

  // ==================== FIELD GROUPS ====================

  @Post('groups')
  async createFieldGroup(@Request() req: any, @Body() dto: CreateFieldGroupDto) {
    return this.customFieldsService.createFieldGroup(req.user.teamId, dto);
  }

  @Put('groups/:id')
  async updateFieldGroup(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateFieldGroupDto,
  ) {
    return this.customFieldsService.updateFieldGroup(req.user.teamId, id, dto);
  }

  @Delete('groups/:id')
  async deleteFieldGroup(@Request() req: any, @Param('id') id: string) {
    return this.customFieldsService.deleteFieldGroup(req.user.teamId, id);
  }

  @Get('groups')
  async getFieldGroups(@Request() req: any, @Query('scope') scope?: FieldScope) {
    return this.customFieldsService.getFieldGroups(req.user.teamId, scope);
  }

  // ==================== FIELD VALUES ====================

  @Post('values')
  async setFieldValue(@Request() req: any, @Body() dto: SetFieldValueDto) {
    return this.customFieldsService.setFieldValue(req.user.teamId, dto);
  }

  @Post('values/bulk')
  async setFieldValues(@Request() req: any, @Body() dto: SetFieldValuesDto) {
    return this.customFieldsService.setFieldValues(req.user.teamId, dto);
  }

  @Get('values/:entityId')
  async getFieldValues(
    @Request() req: any,
    @Param('entityId') entityId: string,
    @Query('scope') scope: FieldScope,
  ) {
    return this.customFieldsService.getFieldValues(req.user.teamId, entityId, scope);
  }

  @Delete('values/:fieldId/:entityId')
  async deleteFieldValue(
    @Request() req: any,
    @Param('fieldId') fieldId: string,
    @Param('entityId') entityId: string,
  ) {
    return this.customFieldsService.deleteFieldValue(req.user.teamId, fieldId, entityId);
  }

  // ==================== DYNAMIC FORMS ====================

  @Post('forms')
  async createDynamicForm(@Request() req: any, @Body() dto: CreateDynamicFormDto) {
    return this.customFieldsService.createDynamicForm(req.user.teamId, dto);
  }

  @Get('forms/:id')
  async getDynamicForm(@Request() req: any, @Param('id') id: string) {
    return this.customFieldsService.getDynamicForm(req.user.teamId, id);
  }

  @Get('forms')
  async getDynamicForms(@Request() req: any, @Query('scope') scope?: FieldScope) {
    return this.customFieldsService.getDynamicForms(req.user.teamId, scope);
  }
}
