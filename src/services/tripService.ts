import { PrismaClient } from "@prisma/client";
import { encryptAES, decryptAES } from "../utils/encryption";

const prisma = new PrismaClient();

export async function createTrip(userId: string, destAddress: string) {
  const encryptedAddress = encryptAES(destAddress);
  return prisma.trip.create({
    data: {
      userid: userId,
      destAddressEncrypted: encryptedAddress,
    },
  });
}

export async function getTrips(userId: string) {
  const trips = await prisma.trip.findMany({ where: { userid: userId } });
  return trips.map((trip:any) => ({
    ...trip,
    destAddressEncrypted: trip.destAddressEncrypted
      ? decryptAES(trip.destAddressEncrypted)
      : null,
  }));
}
