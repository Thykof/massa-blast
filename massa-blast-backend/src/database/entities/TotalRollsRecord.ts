import {
  Entity,
  Column,
  BaseEntity,
  ObjectIdColumn,
  ObjectId,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class TotalRollsRecord extends BaseEntity {
  @ObjectIdColumn() id: ObjectId;

  @Column() value: number;
  @CreateDateColumn() createdAt: Date;
}
