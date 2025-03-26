import bcrypt from 'bcrypt';
import { prisma } from '../index';
import { AppError } from '../middleware/errorHandler';
import { generateToken } from '../middleware/auth';

/**
 * Register a new user
 */
export const registerUser = async (email: string, password: string) => {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new AppError('User with this email already exists', 400);
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user transaction
  return prisma.$transaction(async (tx) => {
    // Create user
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword
      }
    });

    // Create user profile
    await tx.profile.create({
      data: {
        userId: user.id
      }
    });

    // Generate token
    const token = generateToken({ id: user.id, email: user.email });

    // Return user and token
    return {
      user: {
        id: user.id,
        email: user.email
      },
      token
    };
  });
};

/**
 * Login a user
 */
export const loginUser = async (email: string, password: string) => {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  // Generate token
  const token = generateToken({ id: user.id, email: user.email });

  // Return user and token
  return {
    user: {
      id: user.id,
      email: user.email
    },
    token
  };
};

/**
 * Get current user profile
 */
export const getUserProfile = async (userId: string) => {
  // Get user with profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Return user data (exclude password)
  return {
    id: user.id,
    email: user.email,
    profile: user.profile
  };
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId: string, profileData: any) => {
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Update profile
  const updatedProfile = await prisma.profile.update({
    where: { userId },
    data: {
      username: profileData.username,
      avatarUrl: profileData.avatarUrl,
      bio: profileData.bio,
      preferredLanguage: profileData.preferredLanguage,
      preferredTheme: profileData.preferredTheme,
    }
  });

  return updatedProfile;
};

/**
 * Change user password
 */
export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  // Find user
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Verify current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 401);
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  return { message: 'Password updated successfully' };
}; 