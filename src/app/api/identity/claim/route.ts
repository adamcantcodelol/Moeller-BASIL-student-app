import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { moveDeviceProjectsToOwner } from "@/lib/db/queries/projects";
import { ownerForIdentity } from "@/lib/auth/identity";
import { getRequestIdentity } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

/** Move projects made anonymously on this computer to the joined class identity. */
export async function POST() {
  try {
    const identity = await getRequestIdentity();
    if (!identity.student || !identity.deviceId) {
      return jsonError("Join your class first.", 400);
    }
    const owner = ownerForIdentity(identity);
    if (!owner) return jsonError("Join your class first.", 400);
    const db = await getRequestDatabase();
    const moved = await moveDeviceProjectsToOwner(db, identity.deviceId, owner);
    return Response.json({ moved });
  } catch (error) {
    return handleServiceError(error);
  }
}
