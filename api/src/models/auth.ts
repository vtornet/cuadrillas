import { Schema, model } from "mongoose";
import type { Rol } from "@cuadrilla/shared";

export interface UserDoc {
  _id: string;
  email: string;
  role: Rol;
  organizationId: string;
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ["owner", "foreman", "worker"], default: "owner" },
    organizationId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, _id: false },
);

export const User = model<UserDoc>("User", userSchema);

export interface MagicTokenDoc {
  token: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
}

const magicSchema = new Schema<MagicTokenDoc>(
  {
    token: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { versionKey: false },
);
// TTL: Mongo borra el token al caducar.
magicSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MagicToken = model<MagicTokenDoc>("MagicToken", magicSchema);
