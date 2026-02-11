import { Router, Request, Response } from "express";
import { sendContactRequest } from "../services/email.js";

const router = Router();

type ContactBody = { email?: string; phone: string; name?: string; message?: string };

router.post("/", async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const body = req.body as ContactBody;
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    if (!phone) return res.status(400).json({ error: "Phone is required." });

    const email = typeof body?.email === "string" ? body.email.trim() : user.email ?? "";
    if (!email) return res.status(400).json({ error: "Email is required." });

    await sendContactRequest({
      fromEmail: email,
      fromName: typeof body?.name === "string" ? body.name.trim() || undefined : user.name ?? undefined,
      phone,
      message: typeof body?.message === "string" ? body.message.trim() || undefined : undefined,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Contact request failed", err);
    return res.status(500).json({ error: "Failed to send your message. Please try again." });
  }
});

export default router;
