import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  IsNumber,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export enum FieldType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  CURRENCY = 'currency',
  DATE = 'date',
  DATETIME = 'datetime',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  EMAIL = 'email',
  PHONE = 'phone',
  URL = 'url',
  FILE = 'file',
  IMAGE = 'image',
  SIGNATURE = 'signature',
  RICH_TEXT = 'rich_text',
  CALCULATED = 'calculated',
  LOOKUP = 'lookup',
  RATING = 'rating',
  SLIDER = 'slider',
  COLOR = 'color',
  ADDRESS = 'address',
}

export enum FieldScope {
  PROPOSAL = 'proposal',
  CLIENT = 'client',
  LINE_ITEM = 'line_item',
  TEMPLATE = 'template',
  TEAM = 'team',
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
  IN = 'in',
  NOT_IN = 'not_in',
}

// Field Definition DTOs
export class CreateFieldDefinitionDto {
  @IsString()
  name: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(FieldType)
  type: FieldType;

  @IsEnum(FieldScope)
  scope: FieldScope;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  unique?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  defaultValue?: any;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsString()
  helpText?: string;

  @IsOptional()
  @IsArray()
  options?: FieldOptionDto[];

  @IsOptional()
  @IsObject()
  validation?: FieldValidationDto;

  @IsOptional()
  @IsArray()
  conditions?: FieldConditionDto[];

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class FieldOptionDto {
  @IsString()
  value: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class FieldValidationDto {
  @IsOptional()
  @IsNumber()
  minLength?: number;

  @IsOptional()
  @IsNumber()
  maxLength?: number;

  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;

  @IsOptional()
  @IsString()
  pattern?: string;

  @IsOptional()
  @IsString()
  patternMessage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedFileTypes?: string[];

  @IsOptional()
  @IsNumber()
  maxFileSize?: number;

  @IsOptional()
  @IsString()
  customValidation?: string; // Expression for custom validation
}

export class FieldConditionDto {
  @IsString()
  fieldId: string;

  @IsEnum(ConditionOperator)
  operator: ConditionOperator;

  @IsOptional()
  value?: any;

  @IsString()
  action: 'show' | 'hide' | 'require' | 'disable';
}

export class UpdateFieldDefinitionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  defaultValue?: any;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsString()
  helpText?: string;

  @IsOptional()
  @IsArray()
  options?: FieldOptionDto[];

  @IsOptional()
  @IsObject()
  validation?: FieldValidationDto;

  @IsOptional()
  @IsArray()
  conditions?: FieldConditionDto[];

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Field Group DTOs
export class CreateFieldGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(FieldScope)
  scope: FieldScope;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsBoolean()
  collapsible?: boolean;

  @IsOptional()
  @IsBoolean()
  collapsed?: boolean;
}

export class UpdateFieldGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsBoolean()
  collapsible?: boolean;

  @IsOptional()
  @IsBoolean()
  collapsed?: boolean;
}

// Field Value DTOs
export class SetFieldValueDto {
  @IsString()
  fieldId: string;

  @IsString()
  entityId: string;

  @IsEnum(FieldScope)
  scope: FieldScope;

  value: any;
}

export class SetFieldValuesDto {
  @IsString()
  entityId: string;

  @IsEnum(FieldScope)
  scope: FieldScope;

  @IsObject()
  values: Record<string, any>;
}

// Dynamic Form DTOs
export class CreateDynamicFormDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(FieldScope)
  scope: FieldScope;

  @IsArray()
  @IsString({ each: true })
  fieldIds: string[];

  @IsOptional()
  @IsObject()
  layout?: FormLayoutDto;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class FormLayoutDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  columns?: number;

  @IsOptional()
  @IsArray()
  sections?: FormSectionDto[];
}

export class FormSectionDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  fieldIds: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  columns?: number;
}

// Calculated Field DTOs
export class CreateCalculatedFieldDto extends CreateFieldDefinitionDto {
  @IsString()
  formula: string;

  @IsArray()
  @IsString({ each: true })
  dependsOnFields: string[];

  @IsOptional()
  @IsString()
  formatString?: string;
}
