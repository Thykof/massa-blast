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
  constructor(value: number = 0, createdAt: Date = new Date()) {
    super();
    this.value = value;
    this.createdAt = createdAt;
  }

  @ObjectIdColumn() id: ObjectId;

  @Column() value: number;
  @CreateDateColumn() createdAt: Date;
}
