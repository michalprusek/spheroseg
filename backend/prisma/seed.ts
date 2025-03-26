import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  try {
    // Create a demo user
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo@example.com' },
      update: {},
      create: {
        email: 'demo@example.com',
        password: hashedPassword,
        profile: {
          create: {
            username: 'demo_user',
            bio: 'This is a demo user account',
            preferredLanguage: 'en',
            preferredTheme: 'light'
          }
        }
      }
    });

    console.log('Created demo user:', demoUser.email);

    // Create a demo project
    const demoProject = await prisma.project.upsert({
      where: {
        id: 'demo-project-1'
      },
      update: {},
      create: {
        id: 'demo-project-1',
        title: 'Demo Cell Segmentation Project',
        description: 'A demo project for testing cell segmentation',
        userId: demoUser.id
      }
    });

    console.log('Created demo project:', demoProject.title);

    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Error seeding database:', error);
    process.exit(1);
  })
  .finally(async () => {
    // Close database connection
    await prisma.$disconnect();
  }); 