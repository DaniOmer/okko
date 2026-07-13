import { UserRepository } from './repositories';
import { InvalidCredentialsError } from './errors';
import { User } from './types';

export class GetMeUseCase {
  constructor(private readonly users: UserRepository) {}
  async execute(input: { userId: string }): Promise<User> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new InvalidCredentialsError();
    return user;
  }
}
