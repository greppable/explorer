// enums-and-unions.ts
export type Direction = 'north' | 'south' | 'east' | 'west';

export enum Status {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
