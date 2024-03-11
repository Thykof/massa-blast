import { Entity, Column, BaseEntity, ObjectIdColumn, ObjectId } from 'typeorm';

@Entity()
export class TotalRollsRecord extends BaseEntity {
  @ObjectIdColumn() id: ObjectId;

  @Column() value: string;
}
