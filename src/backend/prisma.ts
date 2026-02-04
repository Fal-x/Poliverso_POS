import { PrismaClient } from "@prisma/client";

// Single PrismaClient instance for backend services.
export const prisma = new PrismaClient();
