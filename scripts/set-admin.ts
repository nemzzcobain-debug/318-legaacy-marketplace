import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'nemzzcobain@gmail.com'

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    console.error(`Utilisateur avec email ${email} introuvable !`)
    process.exit(1)
  }

  console.log(`Utilisateur trouve: ${user.name} (${user.email}) — role actuel: ${user.role}`)

  const updated = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
  })

  console.log(`Role mis a jour: ${updated.role}`)
  console.log(`${updated.name} est maintenant ADMIN !`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
