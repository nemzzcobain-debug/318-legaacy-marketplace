import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding 318 LEGAACY Marketplace...')

  // ─── Admin (toi, LEGACY) ───
  const admin = await prisma.user.upsert({
    where: { email: 'admin@318legaacy.fr' },
    update: {},
    create: {
      email: 'admin@318legaacy.fr',
      name: 'LEGAACY',
      displayName: 'LEGAACY',
      passwordHash: await bcrypt.hash('Admin318!', 12),
      role: 'ADMIN',
      producerStatus: 'APPROVED',
      producerBio: 'Fondateur 318 LEGAACY Studio',
      rating: 4.9,
      totalSales: 342,
    },
  })

  // ─── Producteurs de test ───
  const producers = await Promise.all([
    prisma.user.upsert({
      where: { email: 'shadow@test.com' },
      update: {},
      create: {
        email: 'shadow@test.com',
        name: 'ShadowBeats',
        passwordHash: await bcrypt.hash('Test1234!', 12),
        role: 'PRODUCER',
        producerStatus: 'APPROVED',
        producerBio: 'Producteur Trap/Drill certifie',
        rating: 4.7,
        totalSales: 128,
      },
    }),
    prisma.user.upsert({
      where: { email: 'melody@test.com' },
      update: {},
      create: {
        email: 'melody@test.com',
        name: 'MelodyKing',
        passwordHash: await bcrypt.hash('Test1234!', 12),
        role: 'PRODUCER',
        producerStatus: 'APPROVED',
        producerBio: 'Specialiste melodies R&B',
        rating: 4.8,
        totalSales: 256,
      },
    }),
    prisma.user.upsert({
      where: { email: 'dark@test.com' },
      update: {},
      create: {
        email: 'dark@test.com',
        name: 'DarkVibes',
        passwordHash: await bcrypt.hash('Test1234!', 12),
        role: 'PRODUCER',
        producerStatus: 'APPROVED',
        producerBio: 'Drill UK & FR',
        rating: 4.6,
        totalSales: 89,
      },
    }),
  ])

  // ─── Artiste de test ───
  const artist = await prisma.user.upsert({
    where: { email: 'artist@test.com' },
    update: {},
    create: {
      email: 'artist@test.com',
      name: 'TestArtist',
      passwordHash: await bcrypt.hash('Test1234!', 12),
      role: 'ARTIST',
    },
  })

  // ─── Beats ───
  const beats = await Promise.all([
    prisma.beat.create({
      data: {
        title: 'Midnight Vendetta',
        description: 'Dark trap beat with heavy 808s',
        audioUrl: '/uploads/sample.mp3',
        genre: 'Trap',
        mood: 'Sombre',
        bpm: 140,
        key: 'Cm',
        tags: JSON.stringify(['dark', 'trap', '808', 'hard']),
        status: 'ACTIVE',
        plays: 234,
        producerId: admin.id,
      },
    }),
    prisma.beat.create({
      data: {
        title: 'Drip Season',
        description: 'Hard drill beat, UK style',
        audioUrl: '/uploads/sample.mp3',
        genre: 'Drill',
        mood: 'Agressif',
        bpm: 145,
        key: 'Gm',
        tags: JSON.stringify(['drill', 'uk', 'hard']),
        status: 'ACTIVE',
        plays: 456,
        producerId: producers[0].id,
      },
    }),
    prisma.beat.create({
      data: {
        title: 'Velvet Dreams',
        description: 'Smooth R&B vibes',
        audioUrl: '/uploads/sample.mp3',
        genre: 'R&B',
        mood: 'Melancolique',
        bpm: 90,
        key: 'Eb',
        tags: JSON.stringify(['rnb', 'smooth', 'melodic']),
        status: 'ACTIVE',
        plays: 178,
        producerId: producers[1].id,
      },
    }),
    prisma.beat.create({
      data: {
        title: 'Phantom Zone',
        description: 'Dark drill with orchestral elements',
        audioUrl: '/uploads/sample.mp3',
        genre: 'Drill',
        mood: 'Sombre',
        bpm: 150,
        key: 'Dm',
        tags: JSON.stringify(['drill', 'dark', 'orchestral']),
        status: 'ACTIVE',
        plays: 789,
        producerId: producers[2].id,
      },
    }),
  ])

  // ─── Encheres ───
  const now = new Date()

  await Promise.all([
    prisma.auction.create({
      data: {
        beatId: beats[0].id,
        startPrice: 30,
        currentBid: 85,
        startTime: now,
        endTime: new Date(now.getTime() + 3600000 * 2.5), // 2h30
        status: 'ACTIVE',
        totalBids: 12,
        licenseType: 'BASIC',
      },
    }),
    prisma.auction.create({
      data: {
        beatId: beats[1].id,
        startPrice: 50,
        currentBid: 120,
        startTime: now,
        endTime: new Date(now.getTime() + 900000), // 15 min
        status: 'ENDING_SOON',
        totalBids: 18,
        licenseType: 'BASIC',
      },
    }),
    prisma.auction.create({
      data: {
        beatId: beats[2].id,
        startPrice: 25,
        currentBid: 65,
        startTime: now,
        endTime: new Date(now.getTime() + 7200000 * 3), // 6h
        status: 'ACTIVE',
        totalBids: 8,
        licenseType: 'BASIC',
      },
    }),
    prisma.auction.create({
      data: {
        beatId: beats[3].id,
        startPrice: 80,
        currentBid: 200,
        startTime: now,
        endTime: new Date(now.getTime() + 300000), // 5 min
        status: 'ENDING_SOON',
        totalBids: 24,
        licenseType: 'PREMIUM',
      },
    }),
  ])

  console.log('Seed complete !')
  console.log(`Admin: admin@318legaacy.fr / Admin318!`)
  console.log(`Artiste: artist@test.com / Test1234!`)
  console.log(`${beats.length} beats et 4 encheres crees`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
