import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFieldDefinitionDto,
  UpdateFieldDefinitionDto,
  CreateFieldGroupDto,
  UpdateFieldGroupDto,
  SetFieldValueDto,
  SetFieldValuesDto,
  CreateDynamicFormDto,
  FieldType,
  FieldScope,
  ConditionOperator,
} from './dto';

@Injectable()
export class CustomFieldsService {
  constructor(private prisma: PrismaService) {}

  // ==================== FIELD DEFINITIONS ====================

  /**
   * Create custom field definition
   */
  async createFieldDefinition(teamId: string, dto: CreateFieldDefinitionDto) {
    // Validate unique field name within team and scope
    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { teamId, name: dto.name, scope: dto.scope },
    });

    if (existing) {
      throw new BadRequestException('Field with this name already exists');
    }

    // Get max order for this scope
    const maxOrder = await this.prisma.customFieldDefinition.aggregate({
      where: { teamId, scope: dto.scope },
      _max: { order: true },
    });

    const field = await this.prisma.customFieldDefinition.create({
      data: {
        groupId: dto.groupId || 'default',
        name: dto.name,
        label: dto.label,
        description: dto.description,
        type: dto.type,
        scope: dto.scope,

        required: dto.required ?? false,
        unique: dto.unique ?? false,
        order: dto.order ?? (maxOrder._max.order || 0) + 1,
        defaultValue: dto.defaultValue,
        placeholder: dto.placeholder,
        helpText: dto.helpText,
        options: dto.options as any,
        validation: dto.validation as any,
        conditions: dto.conditions as any,
        settings: dto.settings || {},
      },
    });

    return field;
  }

  /**
   * Update field definition
   */
  async updateFieldDefinition(teamId: string, fieldId: string, dto: UpdateFieldDefinitionDto) {
    const field = await this.prisma.customFieldDefinition.findUnique({
      where: { id: fieldId },
    });

    if (!field) {
      throw new NotFoundException('Field definition not found');
    }

    const updated = await this.prisma.customFieldDefinition.update({
      where: { id: fieldId },
      data: {
        label: dto.label,
        description: dto.description,
        required: dto.required,
        order: dto.order,
        defaultValue: dto.defaultValue,
        placeholder: dto.placeholder,
        helpText: dto.helpText,
        options: dto.options as any,
        validation: dto.validation as any,
        conditions: dto.conditions as any,
        settings: dto.settings,
        isActive: dto.isActive,
      },
    });

    return updated;
  }

  /**
   * Delete field definition
   */
  async deleteFieldDefinition(teamId: string, fieldId: string) {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: { id: fieldId, teamId },
    });

    if (!field) {
      throw new NotFoundException('Field definition not found');
    }

    // Delete all values for this field
    await this.prisma.customFieldValue.deleteMany({
      where: { fieldId },
    });

    await this.prisma.customFieldDefinition.delete({
      where: { id: fieldId },
    });

    return { success: true };
  }

  /**
   * Get field definitions for team
   */
  async getFieldDefinitions(teamId: string, scope?: FieldScope) {
    const where: any = { teamId, isActive: true };
    if (scope) where.scope = scope;

    const fields = await this.prisma.customFieldDefinition.findMany({
      where,
      orderBy: [{ groupId: 'asc' }, { order: 'asc' }],
      include: {
        group: true,
      },
    });

    return fields;
  }

  /**
   * Reorder fields
   */
  async reorderFields(teamId: string, fieldOrders: Array<{ id: string; order: number }>) {
    const updates = fieldOrders.map(({ id, order }) =>
      this.prisma.customFieldDefinition.updateMany({
        where: { id, teamId },
        data: { order },
      }),
    );

    await Promise.all(updates);
    return { success: true };
  }

  // ==================== FIELD GROUPS ====================

  /**
   * Create field group
   */
  async createFieldGroup(teamId: string, dto: CreateFieldGroupDto) {
    const maxOrder = await this.prisma.customFieldGroup.aggregate({
      where: { teamId, scope: dto.scope },
      _max: { order: true },
    });

    const group = await this.prisma.customFieldGroup.create({
      data: {
        userId: teamId,
        name: dto.name,
        description: dto.description,
        scope: dto.scope,
        order: dto.order ?? (maxOrder._max.order || 0) + 1,
        collapsible: dto.collapsible ?? true,
        collapsed: dto.collapsed ?? false,
      },
    });

    return group;
  }

  /**
   * Update field group
   */
  async updateFieldGroup(teamId: string, groupId: string, dto: UpdateFieldGroupDto) {
    const group = await this.prisma.customFieldGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Field group not found');
    }

    const updated = await this.prisma.customFieldGroup.update({
      where: { id: groupId },
      data: {
        name: dto.name,
        description: dto.description,
        order: dto.order,
        collapsible: dto.collapsible,
        collapsed: dto.collapsed,
      },
    });

    return updated;
  }

  /**
   * Delete field group
   */
  async deleteFieldGroup(teamId: string, groupId: string) {
    const group = await this.prisma.customFieldGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Field group not found');
    }

    // Remove group reference from fields
    await this.prisma.customFieldDefinition.updateMany({
      where: { groupId },
      data: { groupId: null },
    });

    await this.prisma.customFieldGroup.delete({
      where: { id: groupId },
    });

    return { success: true };
  }

  /**
   * Get field groups
   */
  async getFieldGroups(teamId: string, scope?: FieldScope) {
    const where: any = { teamId };
    if (scope) where.scope = scope;

    const groups = await this.prisma.customFieldGroup.findMany({
      where: { userId: teamId },
      orderBy: { order: 'asc' },
      include: {
        fields: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    return groups;
  }

  // ==================== FIELD VALUES ====================

  /**
   * Set single field value
   */
  async setFieldValue(teamId: string, dto: SetFieldValueDto) {
    // Check field exists
    const field = await this.prisma.customFieldDefinition.findUnique({
      where: { id: dto.fieldId },
    });

    if (!field) {
      throw new NotFoundException('Field definition not found');
    }

    // Find existing value
    const existing = await this.prisma.customFieldValue.findFirst({
      where: { fieldId: dto.fieldId, entityId: dto.entityId },
    });

    if (existing) {
      const value = await this.prisma.customFieldValue.update({
        where: { id: existing.id },
        data: { value: dto.value },
      });
      return value;
    } else {
      const value = await this.prisma.customFieldValue.create({
        data: {
          fieldId: dto.fieldId,
          entityId: dto.entityId,
          scope: dto.scope,
          value: dto.value,
        },
      });

      return value;
    }
  }

  /**
   * Set multiple field values
   */
  async setFieldValues(teamId: string, dto: SetFieldValuesDto) {
    const fields = await this.prisma.customFieldDefinition.findMany({
      where: { teamId, scope: dto.scope, name: { in: Object.keys(dto.values) } },
    });

    const fieldMap = new Map(fields.map((f) => [f.name, f]));

    const results = [];
    for (const [fieldName, value] of Object.entries(dto.values)) {
      const field = fieldMap.get(fieldName);
      if (field) {
        await this.validateFieldValue(field, value);

        const savedValue = await this.prisma.customFieldValue.upsert({
          where: {
            fieldId_entityId: {
              fieldId: field.id,
              entityId: dto.entityId,
            },
          },
          create: {
            fieldId: field.id,
            entityId: dto.entityId,
            scope: dto.scope,
            value,
          },
          update: { value },
        });

        results.push(savedValue);
      }
    }

    return results;
  }

  /**
   * Get field values for entity
   */
  async getFieldValues(teamId: string, entityId: string, scope: FieldScope) {
    const values = await this.prisma.customFieldValue.findMany({
      where: { entityId, scope },
      include: {
        field: true,
      },
    });

    // Transform to object for easier use
    const valueMap: Record<string, any> = {};
    for (const v of values) {
      valueMap[v.fieldId] = v.value;
    }

    return { values: valueMap, raw: values };
  }

  /**
   * Delete field value
   */
  async deleteFieldValue(teamId: string, fieldId: string, entityId: string) {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: { id: fieldId, teamId },
    });

    if (!field) {
      throw new NotFoundException('Field definition not found');
    }

    await this.prisma.customFieldValue.deleteMany({
      where: { fieldId, entityId },
    });

    return { success: true };
  }

  // ==================== VALIDATION ====================

  /**
   * Validate field value against definition
   */
  private async validateFieldValue(field: any, value: any) {
    const validation = field.validation || {};

    // Skip validation for empty optional fields
    if ((value === null || value === undefined || value === '') && !field.required) {
      return;
    }

    // Required validation
    if (field.required && (value === null || value === undefined || value === '')) {
      throw new BadRequestException('Field is required');
    }

    // Type-specific validation
    switch (field.type) {
      case FieldType.TEXT:
      case FieldType.TEXTAREA:
      case FieldType.RICH_TEXT:
        this.validateTextValue(value, validation, field.label);
        break;

      case FieldType.NUMBER:
      case FieldType.CURRENCY:
      case FieldType.RATING:
      case FieldType.SLIDER:
        this.validateNumberValue(value, validation, field.label);
        break;

      case FieldType.EMAIL:
        this.validateEmailValue(value, field.label);
        break;

      case FieldType.URL:
        this.validateUrlValue(value, field.label);
        break;

      case FieldType.DATE:
      case FieldType.DATETIME:
        this.validateDateValue(value, field.label);
        break;

      case FieldType.SELECT:
      case FieldType.RADIO:
        this.validateSelectValue(value, field.options, field.label);
        break;

      case FieldType.MULTI_SELECT:
      case FieldType.CHECKBOX:
        this.validateMultiSelectValue(value, field.options, field.label);
        break;

      case FieldType.PHONE:
        this.validatePhoneValue(value, field.label);
        break;
    }

    // Pattern validation
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        throw new BadRequestException(
          validation.patternMessage || `${field.label} format is invalid`,
        );
      }
    }

    // Unique validation
    if (field.unique && value) {
      const existing = await this.prisma.customFieldValue.findFirst({
        where: {
          fieldId: field.id,
          value,
          NOT: { entityId: value.entityId },
        },
      });

      if (existing) {
        throw new BadRequestException(`${field.label} must be unique`);
      }
    }
  }

  private validateTextValue(value: any, validation: any, label: string) {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${label} must be text`);
    }

    if (validation.minLength && value.length < validation.minLength) {
      throw new BadRequestException(`${label} must be at least ${validation.minLength} characters`);
    }

    if (validation.maxLength && value.length > validation.maxLength) {
      throw new BadRequestException(`${label} must be at most ${validation.maxLength} characters`);
    }
  }

  private validateNumberValue(value: any, validation: any, label: string) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new BadRequestException(`${label} must be a number`);
    }

    if (validation.min !== undefined && value < validation.min) {
      throw new BadRequestException(`${label} must be at least ${validation.min}`);
    }

    if (validation.max !== undefined && value > validation.max) {
      throw new BadRequestException(`${label} must be at most ${validation.max}`);
    }
  }

  private validateEmailValue(value: any, label: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof value !== 'string' || !emailRegex.test(value)) {
      throw new BadRequestException(`${label} must be a valid email address`);
    }
  }

  private validateUrlValue(value: any, label: string) {
    try {
      new URL(value);
    } catch {
      throw new BadRequestException(`${label} must be a valid URL`);
    }
  }

  private validateDateValue(value: any, label: string) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`${label} must be a valid date`);
    }
  }

  private validateSelectValue(value: any, options: any[], label: string) {
    const validValues = options?.map((o) => o.value) || [];
    if (!validValues.includes(value)) {
      throw new BadRequestException(`${label} must be one of the available options`);
    }
  }

  private validateMultiSelectValue(value: any, options: any[], label: string) {
    if (!Array.isArray(value)) {
      throw new BadRequestException(`${label} must be an array`);
    }

    const validValues = options?.map((o) => o.value) || [];
    for (const v of value) {
      if (!validValues.includes(v)) {
        throw new BadRequestException(`${label} contains invalid option: ${v}`);
      }
    }
  }

  private validatePhoneValue(value: any, label: string) {
    const phoneRegex = /^[\d\s\-+()]+$/;
    if (typeof value !== 'string' || !phoneRegex.test(value)) {
      throw new BadRequestException(`${label} must be a valid phone number`);
    }
  }

  // ==================== DYNAMIC FORMS ====================

  /**
   * Create dynamic form
   */
  async createDynamicForm(teamId: string, dto: CreateDynamicFormDto) {
    const form = await this.prisma.dynamicForm.create({
      data: {
        userId: teamId,
        name: dto.name,
        description: dto.description,
        scope: dto.scope,
        fieldIds: dto.fieldIds,
        layout: dto.layout as any,
        settings: dto.settings || {},
        fields: {},
      },
    });

    return form;
  }

  /**
   * Get dynamic form with fields
   */
  async getDynamicForm(teamId: string, formId: string) {
    const form = await this.prisma.dynamicForm.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    // Get field definitions
    const fields = await this.prisma.customFieldDefinition.findMany({
      where: { id: { in: (form as any).fieldIds } },
      orderBy: { order: 'asc' },
      include: { group: true },
    });

    return { ...form, fields };
  }

  /**
   * Get forms for team
   */
  async getDynamicForms(teamId: string, scope?: FieldScope) {
    const where: any = { teamId };
    if (scope) where.scope = scope;

    const forms = await this.prisma.dynamicForm.findMany({
      where: { userId: teamId },
      orderBy: { createdAt: 'desc' },
    });

    return forms;
  }

  // ==================== CALCULATED FIELDS ====================

  /**
   * Evaluate calculated field
   */
  async evaluateCalculatedField(field: any, entityId: string) {
    if (field.type !== FieldType.CALCULATED || !field.formula) {
      return null;
    }

    // Get values for dependent fields
    const dependsOn = field.dependsOnFields || [];
    const values = await this.prisma.customFieldValue.findMany({
      where: { entityId, field: { name: { in: dependsOn } } },
      include: { field: true },
    });

    const context: Record<string, any> = {};
    for (const v of values) {
      context[v.field.name] = v.value;
    }

    // Simple formula evaluation (in production, use a proper expression parser)
    try {
      const result = this.evaluateFormula(field.formula, context);
      return result;
    } catch (error) {
      return null;
    }
  }

  private evaluateFormula(formula: string, context: Record<string, any>): any {
    // Replace field references with values
    let expression = formula;
    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{${key}}`;
      expression = expression.replace(new RegExp(placeholder, 'g'), String(value || 0));
    }

    // Basic math operations (in production, use safe expression evaluation)
    // This is a simplified version - do not use eval() in production!
    const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
    try {
      return Function(`"use strict"; return (${sanitized})`)();
    } catch {
      return null;
    }
  }

  // ==================== CONDITIONAL LOGIC ====================

  /**
   * Evaluate field conditions
   */
  evaluateConditions(field: any, allValues: Record<string, any>) {
    const conditions = field.conditions || [];
    const results: Record<string, boolean> = {
      visible: true,
      required: field.required,
      disabled: false,
    };

    for (const condition of conditions) {
      const fieldValue = allValues[condition.fieldId];
      const conditionMet = this.checkCondition(condition.operator, fieldValue, condition.value);

      switch (condition.action) {
        case 'show':
          if (!conditionMet) results.visible = false;
          break;
        case 'hide':
          if (conditionMet) results.visible = false;
          break;
        case 'require':
          if (conditionMet) results.required = true;
          break;
        case 'disable':
          if (conditionMet) results.disabled = true;
          break;
      }
    }

    return results;
  }

  private checkCondition(operator: ConditionOperator, value: any, conditionValue: any): boolean {
    switch (operator) {
      case ConditionOperator.EQUALS:
        return value === conditionValue;
      case ConditionOperator.NOT_EQUALS:
        return value !== conditionValue;
      case ConditionOperator.CONTAINS:
        return String(value).includes(String(conditionValue));
      case ConditionOperator.NOT_CONTAINS:
        return !String(value).includes(String(conditionValue));
      case ConditionOperator.GREATER_THAN:
        return Number(value) > Number(conditionValue);
      case ConditionOperator.LESS_THAN:
        return Number(value) < Number(conditionValue);
      case ConditionOperator.IS_EMPTY:
        return value === null || value === undefined || value === '';
      case ConditionOperator.IS_NOT_EMPTY:
        return value !== null && value !== undefined && value !== '';
      case ConditionOperator.IN:
        return Array.isArray(conditionValue) && conditionValue.includes(value);
      case ConditionOperator.NOT_IN:
        return !Array.isArray(conditionValue) || !conditionValue.includes(value);
      default:
        return false;
    }
  }
}
