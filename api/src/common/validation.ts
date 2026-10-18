import { ValidateIf } from 'class-validator';

/**
 * Para PATCH parciales. @IsOptional acepta `undefined` y también `null`, pero un título
 * no puede ser null: con esto el campo puede faltar, y si viene, se valida.
 */
export const IsOptionalNotNull = () => ValidateIf((_, value) => value !== undefined);

export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
