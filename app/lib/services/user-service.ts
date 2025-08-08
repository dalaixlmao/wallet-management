"use server";

import { prisma } from '../prisma';
import { hash, compare } from 'bcrypt';
import { z } from 'zod';

// Input validation schema
const userSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
  number: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format'),
});

export class UserService {
  async findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        number: true,
        created_at: true,
      },
    });
  }
  
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        number: true,
        password: true,
      },
    });
  }

  async findByPhone(number: string) {
    return prisma.user.findUnique({
      where: { number },
      select: {
        id: true,
        email: true,
        name: true,
        number: true,
      },
    });
  }

  async create(data: {
    email: string;
    password: string;
    name?: string;
    number: string;
  }) {
    // Validate input
    const validData = userSchema.parse(data);
    
    const hashedPassword = await hash(validData.password, 10);
    
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: validData.email,
          password: hashedPassword,
          name: validData.name,
          number: validData.number,
        },
      });

      // Initialize balance for new user
      await tx.balance.create({
        data: {
          userId: user.id,
          amount: 0,
          locked: 0,
        },
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        number: user.number,
      };
    });
  }

  async validatePassword(userId: number, password: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) return false;
    
    return compare(password, user.password);
  }
  
  async getUserWithBalance(userId: number) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        Balance: true,
      },
    });
  }
  
  async updateProfile(userId: number, data: {
    name?: string;
    email?: string;
  }) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        updated_at: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        number: true,
      },
    });
  }
}

export const userService = new UserService();