import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const usageReadingSchema = new Schema(
  {
    kwh: { type: Number, required: true, min: 0 },
    recordedAt: { type: Date, required: true, index: true },
  },
  { _id: false },
);

const roomSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pax: { type: Number, required: true, min: 1, validate: Number.isInteger },
    usage: { type: [usageReadingSchema], default: [] },
  },
  { timestamps: true },
);

export type RoomDocument = InferSchemaType<typeof roomSchema>;

export const Room =
  (mongoose.models.Room as Model<RoomDocument>) ||
  mongoose.model<RoomDocument>("Room", roomSchema);
